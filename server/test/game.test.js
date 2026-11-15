import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { playerPoints, lineupPoints } from '../src/scoring.js';

// Arma un equipo válido y barato: máx. 3 por club, 2-5-5-3.
function buildSquad(game, skip = new Set()) {
  const { players } = game.bootstrap(null);
  const need = { ARQ: 2, DEF: 5, VOL: 5, DEL: 3 };
  const perClub = {}; const picked = [];
  for (const p of [...players].sort((a, b) => a.price - b.price)) {
    if (skip.has(p.id) || !need[p.pos] || (perClub[p.team_id] || 0) >= 3) continue;
    need[p.pos]--; perClub[p.team_id] = (perClub[p.team_id] || 0) + 1; picked.push(p);
  }
  const f = { ARQ: 1, DEF: 4, VOL: 4, DEL: 2 }; const starters = [];
  for (const p of picked) if (f[p.pos]) { f[p.pos]--; starters.push(p.id); }
  return { formation: '4-4-2', players: picked.map((p) => p.id), starters, captain_id: starters[0] };
}
const user = (game, name) => game.userByToken(game.register({ username: name, password: 'secreto1', email: `${name}@test.com`, team_name: `Equipo ${name}` }).token);

test('puntaje por jugador', () => {
  assert.equal(playerPoints('DEL', { minutes: 90, goals: 2, conceded: 1 }), 2 + 8);
  assert.equal(playerPoints('ARQ', { minutes: 90, conceded: 0, pen_saved: 1 }), 2 + 4 + 5);
  assert.equal(playerPoints('DEF', { minutes: 90, conceded: 3, yellow: 1 }), 2 - 1 - 1);
  assert.equal(playerPoints('VOL', { minutes: 0, goals: 3 }), 0);
});

test('suplente reemplaza al titular que no jugó y el capitán suma doble', () => {
  const players = new Map([[1, { pos: 'DEL' }], [2, { pos: 'DEL' }], [3, { pos: 'VOL' }]]);
  const stats = new Map([[2, { minutes: 90, goals: 1, conceded: 1 }], [3, { minutes: 90, goals: 1, conceded: 1 }]]);
  const r = lineupPoints({ players: [1, 2, 3], starters: [1, 3], captain_id: 3 }, players, stats);
  assert.equal(r.total, 6 + 14);
  assert.equal(r.detail[0].subFor, 1);
});

test('flujo completo: equipo, cierre, puntajes, premios, PINs y cambios', () => {
  const game = createGame(':memory:');
  const ana = user(game, 'ana'); const beto = user(game, 'beto');
  const sq = buildSquad(game);
  assert.equal(game.saveSquad(ana, sq).changes_used, 0);
  game.saveSquad(beto, { ...sq, captain_id: sq.starters[1] });
  assert.throws(() => game.saveSquad(ana, { ...sq, players: sq.players.slice(1) }), /15 jugadores/);

  game.admin.lockRound(1);
  assert.throws(() => game.saveSquad(ana, sq), /en juego/);
  // El capitán de Ana hace un gol: Ana gana la fecha.
  game.admin.saveStats(1, sq.starters.map((id, i) => ({ id, minutes: 90, goals: i === 0 ? 1 : 0, conceded: 1 })));
  const rk = game.ranking(1, ana);
  assert.equal(rk.top[0].username, 'ana');
  assert.ok(rk.top[0].points > rk.top[1].points);
  assert.equal(game.lineup(ana.id, 1).points, rk.top[0].points);

  game.admin.finalizeRound(1);
  let prizes = game.prizes();
  assert.deepEqual(prizes.map((p) => [p.username, p.amount, p.kind]), [['ana', 100000, 'fecha']]);
  assert.equal(game.bootstrap(ana).current_round, 2);

  // Segunda fecha: cambiar un jugador cuesta un cambio y hace falta un PIN.
  const other = buildSquad(game, new Set([sq.players[14]]));
  const incoming = other.players.filter((id) => !sq.players.includes(id)).length;
  assert.ok(incoming >= 1);
  assert.throws(() => game.saveSquad(ana, other), /PIN/);
  const [code] = game.admin.generatePins(1, 4, 'test');
  assert.throws(() => game.redeemPin(ana, 'AAAA-BBBB-CCCC'), /inválido/);
  assert.equal(game.redeemPin(ana, code.toLowerCase()).changes_balance, 4);
  assert.throws(() => game.redeemPin(beto, code), /ya fue utilizado/);
  assert.equal(game.saveSquad(ana, other).changes_used, incoming);
  assert.equal(game.bootstrap(ana).me.changes_balance, 4 - incoming);
  // Cambiar capitán o formación no cuesta nada.
  assert.equal(game.saveSquad(ana, { ...other, captain_id: other.starters[2] }).changes_used, 0);

  // Se juegan las fechas restantes sin puntos: empate en cada fecha, se reparte.
  for (const id of [2, 3, 4]) { game.admin.lockRound(id); game.admin.finalizeRound(id); }
  prizes = game.prizes();
  const torneo = prizes.filter((p) => p.kind === 'torneo');
  assert.deepEqual(torneo.map((p) => [p.username, p.amount]), [['ana', 1000000]]);
  assert.equal(prizes.filter((p) => p.round_id === 2).every((p) => p.amount === 50000), true);
  assert.equal(game.bootstrap(ana).current_round, null);
});

test('cierre automático por horario', () => {
  const game = createGame(':memory:');
  const ana = user(game, 'ana');
  game.saveSquad(ana, buildSquad(game));
  game.lockDueRounds(new Date('2026-11-20T23:00:01Z'));
  assert.equal(game.bootstrap(null).rounds[0].status, 'locked');
  assert.equal(game.bootstrap(ana).me.has_snapshot, true);
});
