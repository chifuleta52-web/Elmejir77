// Servidor HTTP: API del juego + archivos estáticos de la app (carpeta www).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, GameError } from './game.js';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const WWW = join(ROOT, 'www');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

export function createApp(dbPath) {
  const game = createGame(dbPath);
  const routes = [];
  const route = (method, path, handler, opts = {}) => {
    const keys = [];
    const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, ...opts });
  };

  // Límite simple de intentos (en memoria).
  const hits = new Map();
  const limit = (key, max, windowMs) => {
    const t = Date.now();
    const list = (hits.get(key) || []).filter((x) => t - x < windowMs);
    if (list.length >= max) throw new GameError('Demasiados intentos. Probá de nuevo más tarde.', 429);
    list.push(t); hits.set(key, list);
  };

  // --- Público ---
  route('POST', '/api/register', ({ body, ip }) => { limit('reg:' + ip, 20, 3600e3); return game.register(body); });
  route('POST', '/api/login', ({ body, ip }) => { limit('login:' + ip + ':' + String(body.username).toLowerCase(), 10, 600e3); return game.login(body); });
  route('GET', '/api/bootstrap', ({ user }) => game.bootstrap(user));
  route('GET', '/api/ranking', ({ query, user }) => game.ranking(Number(query.get('round')) || 0, user));
  route('GET', '/api/lineup/:user/:round', ({ params, user }) => game.lineup(Number(params.user), Number(params.round), user));
  route('GET', '/api/prizes', () => game.prizes());
  // --- Usuario ---
  const auth = { auth: true };
  route('POST', '/api/logout', ({ token }) => { game.logout(token); return {}; }, auth);
  route('PUT', '/api/squad', ({ user, body }) => game.saveSquad(user, body), auth);
  route('POST', '/api/pins/redeem', ({ user, body }) => { limit('pin:' + user.id, 8, 3600e3); return game.redeemPin(user, body.code); }, auth);
  // --- Administración ---
  const adm = { auth: true, admin: true };
  const A = game.admin;
  route('GET', '/api/admin/overview', () => A.overview(), adm);
  route('GET', '/api/admin/pins', () => A.pins(), adm);
  route('POST', '/api/admin/pins', ({ body }) => ({ codes: A.generatePins(body.count, body.changes, body.batch) }), adm);
  route('GET', '/api/admin/users', () => A.users(), adm);
  route('PUT', '/api/admin/rounds/:id', ({ params, body }) => A.updateRound(Number(params.id), body), adm);
  route('POST', '/api/admin/rounds/:id/lock', ({ params }) => A.lockRound(Number(params.id)), adm);
  route('POST', '/api/admin/rounds/:id/reopen', ({ params }) => A.reopenRound(Number(params.id)), adm);
  route('POST', '/api/admin/rounds/:id/finalize', ({ params }) => A.finalizeRound(Number(params.id)), adm);
  route('POST', '/api/admin/matches', ({ body }) => A.saveMatch(body), adm);
  route('DELETE', '/api/admin/matches/:id', ({ params }) => A.deleteMatch(Number(params.id)), adm);
  route('PUT', '/api/admin/teams/:id', ({ params, body }) => A.setEliminated(params.id, body.eliminated), adm);
  route('GET', '/api/admin/stats', ({ query }) => A.stats(Number(query.get('round')), query.get('team')), adm);
  route('PUT', '/api/admin/stats', ({ body }) => A.saveStats(Number(body.round_id), body.rows), adm);
  route('POST', '/api/admin/players', ({ body }) => A.savePlayer(body), adm);
  route('PUT', '/api/admin/settings', ({ body }) => A.saveSettings(body), adm);
  route('PUT', '/api/admin/prizes/:id', ({ params, body }) => A.setPrizePaid(Number(params.id), body.paid), adm);

  const send = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  const readBody = (req) => new Promise((ok, fail) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 300_000) { fail(new GameError('Pedido demasiado grande.', 413)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { fail(new GameError('JSON inválido.')); } });
    req.on('error', fail);
  });

  async function handleApi(req, res, url) {
    const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
    if (!r) return send(res, 404, { error: 'No encontrado.' });
    try {
      const m = url.pathname.match(r.re);
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const token = (req.headers.authorization || '').replace(/^Bearer /, '') || null;
      const user = game.userByToken(token);
      if (r.auth && !user) throw new GameError('Iniciá sesión para continuar.', 401);
      if (r.admin && !user.is_admin) throw new GameError('No autorizado.', 403);
      const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const ip = (process.env.TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
      const out = await r.handler({ params, query: url.searchParams, body: body || {}, user, token, ip });
      send(res, 200, out ?? { ok: true });
    } catch (e) {
      if (e instanceof GameError) return send(res, e.status, { error: e.message });
      console.error(e);
      send(res, 500, { error: 'Error interno del servidor.' });
    }
  }

  async function handleStatic(res, pathname) {
    let rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\]|\.\.)+/, '');
    if (!rel || !extname(rel)) rel = 'index.html';
    const file = join(WWW, rel);
    if (!file.startsWith(WWW)) { res.writeHead(403); return res.end(); }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch { res.writeHead(404); res.end('No encontrado'); }
  }

  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    handleStatic(res, url.pathname);
  });
  // Cierre automático de fechas aunque nadie esté usando la app.
  const timer = setInterval(() => { try { game.lockDueRounds(); } catch (e) { console.error(e); } }, 30_000);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  return { server, game };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server, game } = createApp(process.env.DB_PATH || join(ROOT, 'server', 'data', 'app.db'));
  if (process.env.ADMIN_USER && process.env.ADMIN_PASSWORD) {
    game.ensureAdmin(process.env.ADMIN_USER, process.env.ADMIN_PASSWORD);
  } else if (game.adminCount() === 0) {
    const pw = randomBytes(9).toString('base64url');
    game.ensureAdmin('admin', pw);
    console.log(`\n>>> Usuario administrador creado: admin / ${pw}\n>>> Guardá esta contraseña (o definí ADMIN_USER y ADMIN_PASSWORD).\n`);
  }
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => console.log(`El Mejor DT escuchando en http://localhost:${port}`));
}
