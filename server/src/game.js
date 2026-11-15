// Base de datos (SQLite) y lógica del juego.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TEAMS, SQUADS, ROUNDS, MATCHES, SETTINGS } from './seed-data.js';
import { lineupPoints, validateSquad } from './scoring.js';

export class GameError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const PIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createGame(dbPath) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT NOT NULL,
      pass_hash TEXT NOT NULL, team_name TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0,
      changes_balance INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, c1 TEXT, c2 TEXT, eliminated INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY, team_id TEXT NOT NULL, name TEXT NOT NULL, pos TEXT NOT NULL,
      price INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS rounds (id INTEGER PRIMARY KEY, name TEXT NOT NULL, lock_at TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY, round_id INTEGER NOT NULL, home TEXT NOT NULL, away TEXT NOT NULL,
      kickoff TEXT, home_goals INTEGER, away_goals INTEGER, winner TEXT);
    CREATE TABLE IF NOT EXISTS squads (
      user_id INTEGER PRIMARY KEY, formation TEXT NOT NULL, players TEXT NOT NULL,
      starters TEXT NOT NULL, captain_id INTEGER NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS snapshots (
      user_id INTEGER NOT NULL, round_id INTEGER NOT NULL, formation TEXT NOT NULL, players TEXT NOT NULL,
      starters TEXT NOT NULL, captain_id INTEGER NOT NULL, PRIMARY KEY (user_id, round_id));
    CREATE TABLE IF NOT EXISTS stats (
      player_id INTEGER NOT NULL, round_id INTEGER NOT NULL, minutes INTEGER NOT NULL DEFAULT 0,
      goals INTEGER NOT NULL DEFAULT 0, assists INTEGER NOT NULL DEFAULT 0, yellow INTEGER NOT NULL DEFAULT 0,
      red INTEGER NOT NULL DEFAULT 0, own_goals INTEGER NOT NULL DEFAULT 0, pen_saved INTEGER NOT NULL DEFAULT 0,
      pen_missed INTEGER NOT NULL DEFAULT 0, conceded INTEGER NOT NULL DEFAULT 0, mvp INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (player_id, round_id));
    CREATE TABLE IF NOT EXISTS scores (
      user_id INTEGER NOT NULL, round_id INTEGER NOT NULL, points INTEGER NOT NULL, detail TEXT NOT NULL,
      PRIMARY KEY (user_id, round_id));
    CREATE TABLE IF NOT EXISTS pins (
      code TEXT PRIMARY KEY, changes INTEGER NOT NULL, batch TEXT, created_at TEXT NOT NULL,
      used_by INTEGER, used_at TEXT);
    CREATE TABLE IF NOT EXISTS free_used (user_id INTEGER NOT NULL, round_id INTEGER NOT NULL, used INTEGER NOT NULL, PRIMARY KEY (user_id, round_id));
    CREATE TABLE IF NOT EXISTS prizes (
      id INTEGER PRIMARY KEY, kind TEXT NOT NULL, round_id INTEGER, user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL, points INTEGER NOT NULL, paid INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);

  const q = (sql) => db.prepare(sql);
  const now = () => new Date().toISOString();
  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };

  // ---------- Carga inicial ----------
  if (q('SELECT COUNT(*) n FROM teams').get().n === 0) {
    tx(() => {
      for (const t of TEAMS) q('INSERT INTO teams (id,name,c1,c2) VALUES (?,?,?,?)').run(t.id, t.name, t.c1, t.c2);
      for (const [team, list] of Object.entries(SQUADS)) {
        for (const item of list.split(';')) {
          const [name, pos, price] = item.split('|');
          q('INSERT INTO players (team_id,name,pos,price) VALUES (?,?,?,?)').run(team, name, pos, Number(price));
        }
      }
      ROUNDS.forEach((r, i) => q('INSERT INTO rounds (id,name,lock_at,status) VALUES (?,?,?,?)').run(r.id, r.name, r.lock_at, i === 0 ? 'open' : 'pending'));
      for (const m of MATCHES) q('INSERT INTO matches (round_id,home,away,kickoff) VALUES (?,?,?,?)').run(m.round_id, m.home, m.away, m.kickoff);
    });
  }
  for (const [k, v] of Object.entries(SETTINGS)) q('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)').run(k, JSON.stringify(v));

  // ---------- Utilidades ----------
  const getSettings = () => Object.fromEntries(q('SELECT key,value FROM settings').all().map((r) => [r.key, JSON.parse(r.value)]));
  const playersMap = () => new Map(q('SELECT * FROM players').all().map((p) => [p.id, p]));
  const parseSquad = (r) => r && { formation: r.formation, players: JSON.parse(r.players), starters: JSON.parse(r.starters), captain_id: r.captain_id };
  const currentRound = () => q("SELECT * FROM rounds WHERE status IN ('open','locked') ORDER BY id LIMIT 1").get() || null;
  const hasSnapshot = (uid) => q('SELECT COUNT(*) n FROM snapshots WHERE user_id=?').get(uid).n > 0;
  const hashPass = (pw, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
  const checkPass = (pw, stored) => {
    const [salt, hash] = stored.split(':');
    return timingSafeEqual(scryptSync(pw, salt, 32), Buffer.from(hash, 'hex'));
  };
  const publicUser = (u) => ({ id: u.id, username: u.username, team_name: u.team_name, email: u.email, is_admin: !!u.is_admin, changes_balance: u.changes_balance });
  const newSession = (uid) => {
    const token = randomBytes(32).toString('hex');
    q('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)').run(token, uid, now());
    return token;
  };

  // ---------- Cuentas ----------
  function register({ username, password, email, team_name }) {
    username = String(username || '').trim().toLowerCase();
    team_name = String(team_name || '').trim();
    email = String(email || '').trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) throw new GameError('El usuario debe tener entre 3 y 20 caracteres (letras, números, punto o guion bajo).');
    if (String(password || '').length < 6) throw new GameError('La contraseña debe tener al menos 6 caracteres.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) throw new GameError('Ingresá un email válido (lo usamos para avisarte si ganás).');
    if (team_name.length < 3 || team_name.length > 30) throw new GameError('El nombre del equipo debe tener entre 3 y 30 caracteres.');
    if (q('SELECT 1 FROM users WHERE username=?').get(username)) throw new GameError('Ese usuario ya existe.');
    const r = q('INSERT INTO users (username,email,pass_hash,team_name,created_at) VALUES (?,?,?,?,?)').run(username, email, hashPass(password), team_name, now());
    return { token: newSession(Number(r.lastInsertRowid)) };
  }
  function login({ username, password }) {
    const u = q('SELECT * FROM users WHERE username=?').get(String(username || '').trim().toLowerCase());
    if (!u || !checkPass(String(password || ''), u.pass_hash)) throw new GameError('Usuario o contraseña incorrectos.', 401);
    return { token: newSession(u.id) };
  }
  const logout = (token) => { q('DELETE FROM sessions WHERE token=?').run(token); };
  const userByToken = (token) => (token ? q('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=?').get(token) : null) || null;
  function ensureAdmin(username, password) {
    username = username.toLowerCase();
    const u = q('SELECT * FROM users WHERE username=?').get(username);
    if (u) q('UPDATE users SET is_admin=1, pass_hash=? WHERE id=?').run(hashPass(password), u.id);
    else q('INSERT INTO users (username,email,pass_hash,team_name,is_admin,created_at) VALUES (?,?,?,?,1,?)').run(username, 'admin@localhost', hashPass(password), 'Administración', now());
  }
  const adminCount = () => q('SELECT COUNT(*) n FROM users WHERE is_admin=1').get().n;

  // ---------- Fechas ----------
  function lockRound(id) {
    const r = q('SELECT * FROM rounds WHERE id=?').get(id);
    if (!r || r.status !== 'open') throw new GameError('La fecha no está abierta.');
    tx(() => {
      q(`INSERT OR REPLACE INTO snapshots (user_id,round_id,formation,players,starters,captain_id)
         SELECT user_id, ?, formation, players, starters, captain_id FROM squads`).run(id);
      q("UPDATE rounds SET status='locked' WHERE id=?").run(id);
    });
    recalcRound(id);
  }
  /** Cierra automáticamente las fechas cuyo horario de cierre ya pasó. */
  function lockDueRounds(date = new Date()) {
    for (const r of q("SELECT * FROM rounds WHERE status='open'").all()) {
      if (new Date(r.lock_at) <= date) lockRound(r.id);
    }
  }
  function reopenRound(id) {
    const r = q('SELECT * FROM rounds WHERE id=?').get(id);
    if (!r || r.status !== 'locked') throw new GameError('Solo se puede reabrir una fecha cerrada y no finalizada.');
    if (new Date(r.lock_at) <= new Date()) throw new GameError('Primero cambiá el horario de cierre a una fecha futura.');
    tx(() => {
      q('DELETE FROM snapshots WHERE round_id=?').run(id);
      q('DELETE FROM scores WHERE round_id=?').run(id);
      q("UPDATE rounds SET status='open' WHERE id=?").run(id);
    });
  }
  function recalcRound(id) {
    const players = playersMap();
    const stats = new Map(q('SELECT * FROM stats WHERE round_id=?').all(id).map((s) => [s.player_id, s]));
    tx(() => {
      const up = q('INSERT OR REPLACE INTO scores (user_id,round_id,points,detail) VALUES (?,?,?,?)');
      for (const row of q('SELECT * FROM snapshots WHERE round_id=?').all(id)) {
        const { total, detail } = lineupPoints(parseSquad(row), players, stats);
        up.run(row.user_id, id, total, JSON.stringify(detail));
      }
    });
  }
  function awardPrize(kind, roundId, rows, amount) {
    if (!rows.length) return;
    const top = rows[0].points;
    const winners = rows.filter((r) => r.points === top);
    const share = Math.floor(amount / winners.length); // empate: se reparte en partes iguales
    for (const w of winners) q('INSERT INTO prizes (kind,round_id,user_id,amount,points,created_at) VALUES (?,?,?,?,?,?)').run(kind, roundId, w.user_id, share, top, now());
  }
  function finalizeRound(id) {
    const r = q('SELECT * FROM rounds WHERE id=?').get(id);
    if (!r || r.status !== 'locked') throw new GameError('Solo se puede finalizar una fecha cerrada.');
    recalcRound(id);
    const s = getSettings();
    tx(() => {
      const notAdmin = 'user_id NOT IN (SELECT id FROM users WHERE is_admin=1)';
      awardPrize('fecha', id, q(`SELECT user_id, points FROM scores WHERE round_id=? AND ${notAdmin} ORDER BY points DESC`).all(id), s.prize_round);
      q("UPDATE rounds SET status='finished' WHERE id=?").run(id);
      const next = q("SELECT * FROM rounds WHERE status='pending' ORDER BY id LIMIT 1").get();
      if (next) q("UPDATE rounds SET status='open' WHERE id=?").run(next.id);
      else awardPrize('torneo', null, q(`SELECT user_id, SUM(points) points FROM scores WHERE ${notAdmin} GROUP BY user_id ORDER BY points DESC`).all(), s.prize_tournament);
    });
  }

  // ---------- Equipo del usuario ----------
  function freeLeft(uid, round, settings) {
    if (!round) return 0;
    const used = q('SELECT used FROM free_used WHERE user_id=? AND round_id=?').get(uid, round.id)?.used || 0;
    return Math.max(0, settings.free_changes_per_round - used);
  }
  function saveSquad(user, body) {
    lockDueRounds();
    const settings = getSettings();
    const sq = {
      formation: String(body.formation || ''),
      players: (body.players || []).map(Number),
      starters: (body.starters || []).map(Number),
      captain_id: Number(body.captain_id),
    };
    const err = validateSquad(sq, playersMap(), settings);
    if (err) throw new GameError(err);
    const round = currentRound();
    if (!round) throw new GameError('El torneo ya terminó.');
    const snap = hasSnapshot(user.id);
    if (round.status === 'locked' && snap) throw new GameError('La fecha está en juego: los equipos están cerrados hasta que termine.');
    const prev = parseSquad(q('SELECT * FROM squads WHERE user_id=?').get(user.id));
    const incoming = prev ? sq.players.filter((id) => !prev.players.includes(id)).length : 0;
    const cost = snap ? incoming : 0; // hasta tu primera fecha jugada, armar el equipo es gratis
    return tx(() => {
      if (cost > 0) {
        const free = Math.min(freeLeft(user.id, round, settings), cost);
        const fromPins = cost - free;
        const balance = q('SELECT changes_balance b FROM users WHERE id=?').get(user.id).b;
        if (fromPins > balance) throw new GameError(`Necesitás ${fromPins} cambio${fromPins > 1 ? 's' : ''} y tenés ${balance}. Cargá un PIN para habilitar más cambios.`, 402);
        if (free) q('INSERT INTO free_used (user_id,round_id,used) VALUES (?,?,?) ON CONFLICT(user_id,round_id) DO UPDATE SET used=used+excluded.used').run(user.id, round.id, free);
        if (fromPins) q('UPDATE users SET changes_balance=changes_balance-? WHERE id=?').run(fromPins, user.id);
      }
      q(`INSERT OR REPLACE INTO squads (user_id,formation,players,starters,captain_id,updated_at) VALUES (?,?,?,?,?,?)`)
        .run(user.id, sq.formation, JSON.stringify(sq.players), JSON.stringify(sq.starters), sq.captain_id, now());
      return { changes_used: cost };
    });
  }

  // ---------- PINs ----------
  function generatePins(count, changes, batch) {
    count = Math.min(Math.max(1, Number(count) || 1), 1000);
    changes = Math.min(Math.max(1, Number(changes) || getSettings().pin_changes), 50);
    const codes = [];
    tx(() => {
      while (codes.length < count) {
        const bytes = randomBytes(12);
        const code = [...bytes].map((b) => PIN_ALPHABET[b % 32]).join('');
        if (q('INSERT OR IGNORE INTO pins (code,changes,batch,created_at) VALUES (?,?,?,?)').run(code, changes, String(batch || '').slice(0, 60), now()).changes) codes.push(code);
      }
    });
    return codes;
  }
  function redeemPin(user, raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 12) throw new GameError('El PIN tiene 12 caracteres. Revisalo y probá de nuevo.');
    return tx(() => {
      const pin = q('SELECT * FROM pins WHERE code=?').get(code);
      if (!pin) throw new GameError('PIN inválido.');
      if (pin.used_by) throw new GameError('Ese PIN ya fue utilizado.');
      q('UPDATE pins SET used_by=?, used_at=? WHERE code=?').run(user.id, now(), code);
      q('UPDATE users SET changes_balance=changes_balance+? WHERE id=?').run(pin.changes, user.id);
      return { added: pin.changes, changes_balance: q('SELECT changes_balance b FROM users WHERE id=?').get(user.id).b };
    });
  }

  // ---------- Lecturas ----------
  function bootstrap(user) {
    lockDueRounds();
    const settings = getSettings();
    const round = currentRound();
    const data = {
      settings,
      teams: q('SELECT * FROM teams').all(),
      players: q('SELECT id,team_id,name,pos,price,active FROM players').all(),
      rounds: q('SELECT * FROM rounds ORDER BY id').all(),
      matches: q('SELECT * FROM matches ORDER BY kickoff, id').all(),
      current_round: round?.id || null,
      me: null,
    };
    if (user) {
      const fresh = q('SELECT * FROM users WHERE id=?').get(user.id);
      const snap = hasSnapshot(user.id);
      data.me = {
        ...publicUser(fresh),
        has_snapshot: snap,
        free_left: freeLeft(user.id, round, settings),
        can_edit: !!round && !(round.status === 'locked' && snap),
        squad: parseSquad(q('SELECT * FROM squads WHERE user_id=?').get(user.id)),
        scores: q('SELECT round_id, points FROM scores WHERE user_id=?').all(user.id),
      };
    }
    return data;
  }
  function ranking(roundId, user) {
    lockDueRounds();
    const noAdmin = 'u.is_admin=0';
    const rows = roundId
      ? q(`SELECT u.id user_id, u.username, u.team_name, sc.points FROM scores sc JOIN users u ON u.id=sc.user_id
           WHERE sc.round_id=? AND ${noAdmin} ORDER BY sc.points DESC, u.id`).all(roundId)
      : q(`SELECT u.id user_id, u.username, u.team_name, COALESCE(SUM(sc.points),0) points FROM squads s JOIN users u ON u.id=s.user_id
           LEFT JOIN scores sc ON sc.user_id=u.id WHERE ${noAdmin} GROUP BY u.id ORDER BY points DESC, u.id`).all();
    let rank = 0;
    rows.forEach((r, i) => { if (i === 0 || r.points < rows[i - 1].points) rank = i + 1; r.rank = rank; });
    return { total: rows.length, top: rows.slice(0, 100), me: (user && rows.find((r) => r.user_id === user.id)) || null };
  }
  function lineup(userId, roundId, viewer) {
    const r = q('SELECT * FROM rounds WHERE id=?').get(roundId);
    if (!r || r.status === 'open' || r.status === 'pending') throw new GameError('Los equipos se pueden ver cuando la fecha está cerrada.', 403);
    const snap = parseSquad(q('SELECT * FROM snapshots WHERE user_id=? AND round_id=?').get(userId, roundId));
    if (!snap) throw new GameError('Ese equipo no participó de esta fecha.', 404);
    const u = q('SELECT username, team_name FROM users WHERE id=?').get(userId);
    const sc = q('SELECT * FROM scores WHERE user_id=? AND round_id=?').get(userId, roundId);
    return { ...u, round_id: roundId, ...snap, points: sc?.points || 0, detail: sc ? JSON.parse(sc.detail) : [] };
  }
  const prizes = () => q(`SELECT p.id, p.kind, p.round_id, p.amount, p.points, p.paid, u.username, u.team_name
                          FROM prizes p JOIN users u ON u.id=p.user_id ORDER BY p.id`).all();

  // ---------- Administración ----------
  const admin = {
    overview: () => ({
      users: q('SELECT COUNT(*) n FROM users WHERE is_admin=0').get().n,
      squads: q('SELECT COUNT(*) n FROM squads').get().n,
      pins_total: q('SELECT COUNT(*) n FROM pins').get().n,
      pins_used: q('SELECT COUNT(*) n FROM pins WHERE used_by IS NOT NULL').get().n,
      prizes: q(`SELECT p.*, u.username, u.team_name, u.email FROM prizes p JOIN users u ON u.id=p.user_id ORDER BY p.id`).all(),
    }),
    pins: () => q(`SELECT p.code, p.changes, p.batch, p.created_at, p.used_at, u.username used_by FROM pins p
                   LEFT JOIN users u ON u.id=p.used_by ORDER BY p.created_at DESC, p.code LIMIT 2000`).all(),
    generatePins,
    users: () => q(`SELECT u.id, u.username, u.team_name, u.email, u.changes_balance, u.created_at,
                    (SELECT COALESCE(SUM(points),0) FROM scores WHERE user_id=u.id) points
                    FROM users u WHERE is_admin=0 ORDER BY points DESC, u.id LIMIT 2000`).all(),
    updateRound(id, { lock_at }) {
      const d = new Date(lock_at);
      if (isNaN(d)) throw new GameError('Fecha inválida.');
      q('UPDATE rounds SET lock_at=? WHERE id=?').run(d.toISOString(), id);
    },
    lockRound, reopenRound, finalizeRound,
    saveMatch(m) {
      const ids = new Set(q('SELECT id FROM teams').all().map((t) => t.id));
      if (!ids.has(m.home) || !ids.has(m.away) || m.home === m.away) throw new GameError('Equipos inválidos.');
      const num = (v) => (v === '' || v == null ? null : Number(v));
      const winner = m.winner && [m.home, m.away].includes(m.winner) ? m.winner : null;
      const args = [Number(m.round_id), m.home, m.away, m.kickoff ? new Date(m.kickoff).toISOString() : null, num(m.home_goals), num(m.away_goals), winner];
      tx(() => {
        if (m.id) q('UPDATE matches SET round_id=?,home=?,away=?,kickoff=?,home_goals=?,away_goals=?,winner=? WHERE id=?').run(...args, Number(m.id));
        else q('INSERT INTO matches (round_id,home,away,kickoff,home_goals,away_goals,winner) VALUES (?,?,?,?,?,?,?)').run(...args);
        // El perdedor de un cruce queda eliminado.
        if (winner) q('UPDATE teams SET eliminated=1 WHERE id=?').run(winner === m.home ? m.away : m.home);
      });
    },
    deleteMatch: (id) => { q('DELETE FROM matches WHERE id=?').run(id); },
    setEliminated: (id, v) => { q('UPDATE teams SET eliminated=? WHERE id=?').run(v ? 1 : 0, id); },
    stats: (roundId, teamId) => q(`SELECT p.id, p.name, p.pos, s.minutes, s.goals, s.assists, s.yellow, s.red, s.own_goals, s.pen_saved, s.pen_missed, s.conceded, s.mvp
        FROM players p LEFT JOIN stats s ON s.player_id=p.id AND s.round_id=? WHERE p.team_id=? AND p.active=1
        ORDER BY CASE p.pos WHEN 'ARQ' THEN 1 WHEN 'DEF' THEN 2 WHEN 'VOL' THEN 3 ELSE 4 END, p.name`).all(roundId, teamId),
    saveStats(roundId, rows) {
      const r = q('SELECT * FROM rounds WHERE id=?').get(roundId);
      if (!r) throw new GameError('Fecha inválida.');
      const n = (v, max) => Math.min(Math.max(0, Math.trunc(Number(v) || 0)), max);
      tx(() => {
        const up = q(`INSERT OR REPLACE INTO stats (player_id,round_id,minutes,goals,assists,yellow,red,own_goals,pen_saved,pen_missed,conceded,mvp)
                      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const s of rows || []) {
          up.run(Number(s.id), roundId, n(s.minutes, 150), n(s.goals, 20), n(s.assists, 20), n(s.yellow, 2), n(s.red, 1),
            n(s.own_goals, 10), n(s.pen_saved, 20), n(s.pen_missed, 20), n(s.conceded, 30), s.mvp ? 1 : 0);
        }
      });
      if (r.status !== 'open' && r.status !== 'pending') recalcRound(roundId);
    },
    savePlayer(p) {
      const name = String(p.name || '').trim();
      const price = Math.trunc(Number(p.price));
      if (!name || !['ARQ', 'DEF', 'VOL', 'DEL'].includes(p.pos) || !(price >= 1 && price <= 30)) throw new GameError('Datos del jugador inválidos.');
      if (!q('SELECT 1 FROM teams WHERE id=?').get(p.team_id)) throw new GameError('Club inválido.');
      if (p.id) q('UPDATE players SET name=?,pos=?,price=?,team_id=?,active=? WHERE id=?').run(name, p.pos, price, p.team_id, p.active === false || p.active === 0 ? 0 : 1, Number(p.id));
      else q('INSERT INTO players (team_id,name,pos,price) VALUES (?,?,?,?)').run(p.team_id, name, p.pos, price);
    },
    saveSettings(patch) {
      const cur = getSettings();
      for (const [k, v] of Object.entries(patch || {})) {
        if (!(k in cur)) continue;
        const val = typeof cur[k] === 'number' ? Math.max(0, Math.trunc(Number(v) || 0)) : String(v).slice(0, 1000);
        q('UPDATE settings SET value=? WHERE key=?').run(JSON.stringify(val), k);
      }
    },
    setPrizePaid: (id, paid) => { q('UPDATE prizes SET paid=? WHERE id=?').run(paid ? 1 : 0, id); },
  };

  return { db, register, login, logout, userByToken, ensureAdmin, adminCount, publicUser, bootstrap, saveSquad, redeemPin, ranking, lineup, prizes, lockDueRounds, getSettings, admin };
}
