// Venta de PINs con Mercado Pago (Checkout Pro).
// Nunca se confía en lo que llega por el webhook: siempre se consulta el pago
// a la API de Mercado Pago con el access token antes de acreditar.
import { GameError } from './game.js';

const MP_API = 'https://api.mercadopago.com';

export function createPayments(game, { accessToken, publicUrl, fetchImpl = globalThis.fetch } = {}) {
  const enabled = !!(accessToken && publicUrl);
  const base = (publicUrl || '').replace(/\/$/, '');

  async function mp(method, path, body) {
    let res;
    try {
      res = await fetchImpl(MP_API + path, {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GameError('No se pudo conectar con Mercado Pago. Probá de nuevo.', 502);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Mercado Pago', method, path, res.status, JSON.stringify(data).slice(0, 500));
      throw new GameError(res.status === 404 ? 'Pago no encontrado.' : 'Mercado Pago rechazó el pedido.', res.status === 404 ? 404 : 502);
    }
    return data;
  }

  /** Crea la orden y la preferencia de pago. Devuelve la URL a la que hay que mandar al usuario. */
  async function checkout(user, quantity) {
    if (!enabled) throw new GameError('El pago con Mercado Pago no está configurado.', 503);
    const s = game.getSettings();
    const order = game.createOrder(user, quantity);
    const pref = await mp('POST', '/checkout/preferences', {
      items: [{
        id: 'pin', title: `El Mejor DT - ${order.quantity} PIN${order.quantity > 1 ? 's' : ''} (${order.changes} cambios)`,
        quantity: order.quantity, unit_price: s.pin_price, currency_id: 'ARS',
      }],
      external_reference: order.id,
      notification_url: `${base}/api/payments/webhook?source_news=webhooks`,
      back_urls: { success: `${base}/?pago=ok`, pending: `${base}/?pago=pendiente`, failure: `${base}/?pago=error` },
      auto_return: 'approved',
      statement_descriptor: 'EL MEJOR DT',
    });
    game.setOrderPreference(order.id, pref.id);
    return { init_point: pref.init_point, order_id: order.id };
  }

  /** Consulta un pago en Mercado Pago y, si está aprobado, acredita su orden. */
  async function processPayment(paymentId) {
    if (!enabled) throw new GameError('El pago con Mercado Pago no está configurado.', 503);
    if (!/^\d{1,20}$/.test(String(paymentId))) throw new GameError('Pago inválido.');
    const p = await mp('GET', `/v1/payments/${paymentId}`);
    const order = p.external_reference ? game.getOrder(String(p.external_reference)) : null;
    if (!order) return { status: p.status, credited: 0, order: null };
    if (p.status !== 'approved' || p.currency_id !== 'ARS') return { status: p.status, credited: 0, order };
    const r = game.markOrderPaid(order.id, p.id, Number(p.transaction_amount));
    return { status: 'approved', credited: r.credited, order: r.order };
  }

  /** Notificación de Mercado Pago (webhook o IPN). */
  async function webhook(query, body) {
    const type = body?.type || query.get('type') || query.get('topic');
    const id = body?.data?.id || query.get('data.id') || query.get('id');
    if (type !== 'payment' || !id) return { ignored: true };
    await processPayment(id);
    return { ok: true };
  }

  /** El usuario vuelve de Mercado Pago: confirmamos sin esperar al webhook. */
  async function confirm(user, paymentId) {
    const r = await processPayment(paymentId);
    if (r.order && r.order.user_id !== user.id) throw new GameError('Ese pago no es tuyo.', 403);
    return { status: r.status, credited: r.credited, changes: r.order?.changes || 0 };
  }

  return { enabled, checkout, webhook, confirm };
}
