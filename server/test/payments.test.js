import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { createPayments } from '../src/payments.js';

// Simula la API de Mercado Pago.
function fakeMp() {
  const payments = new Map(); const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    if (url.endsWith('/checkout/preferences')) {
      const b = JSON.parse(init.body);
      return json(201, { id: 'pref-' + b.external_reference, init_point: 'https://mp.test/pay/' + b.external_reference });
    }
    const m = url.match(/\/v1\/payments\/(\d+)$/);
    if (m && payments.has(m[1])) return json(200, payments.get(m[1]));
    return json(404, { message: 'not found' });
  };
  return { payments, calls, fetchImpl };
}

test('compra de PINs con Mercado Pago', async () => {
  const game = createGame(':memory:');
  const mp = fakeMp();
  const pay = createPayments(game, { accessToken: 'TEST', publicUrl: 'https://dt.test/', fetchImpl: mp.fetchImpl });
  const reg = (n) => game.userByToken(game.register({ username: n, password: 'secreto1', email: `${n}@t.com`, team_name: `Eq ${n}` }).token);
  const ana = reg('ana'); const beto = reg('beto');

  const { init_point, order_id } = await pay.checkout(ana, 2);
  assert.match(init_point, /mp\.test/);
  const body = JSON.parse(mp.calls[0].init.body);
  assert.equal(body.items[0].unit_price, 2000);
  assert.equal(body.items[0].quantity, 2);
  assert.equal(body.notification_url, 'https://dt.test/api/payments/webhook?source_news=webhooks');
  await assert.rejects(pay.checkout(ana, 0), /entre 1 y 10/);

  // Pago pendiente: no acredita.
  mp.payments.set('111', { id: 111, status: 'pending', external_reference: order_id, transaction_amount: 4000, currency_id: 'ARS' });
  assert.equal((await pay.confirm(ana, '111')).credited, 0);
  // Pago aprobado por un monto menor: no acredita.
  mp.payments.set('112', { id: 112, status: 'approved', external_reference: order_id, transaction_amount: 10, currency_id: 'ARS' });
  await assert.rejects(pay.confirm(ana, '112'), /monto/);
  // Aprobado: webhook acredita una sola vez aunque llegue repetido.
  mp.payments.set('113', { id: 113, status: 'approved', external_reference: order_id, transaction_amount: 4000, currency_id: 'ARS' });
  await pay.webhook(new URLSearchParams('type=payment&data.id=113'), null);
  await pay.webhook(new URLSearchParams(), { type: 'payment', data: { id: '113' } });
  assert.equal((await pay.confirm(ana, '113')).credited, 0);
  assert.equal(game.bootstrap(ana).me.changes_balance, 8);
  // Otro usuario no puede reclamar el pago, y avisos inventados no hacen nada.
  await assert.rejects(pay.confirm(beto, '113'), /no es tuyo/);
  await assert.rejects(pay.webhook(new URLSearchParams('type=payment&data.id=999'), null), /no encontrado/);
  assert.deepEqual(await pay.webhook(new URLSearchParams('topic=merchant_order&id=5'), null), { ignored: true });
  assert.equal(game.admin.overview().sales.total, 4000);
});

test('sin credenciales queda deshabilitado', async () => {
  const game = createGame(':memory:');
  const pay = createPayments(game, {});
  assert.equal(pay.enabled, false);
  await assert.rejects(pay.checkout({ id: 1 }, 1), /no está configurado/);
});
