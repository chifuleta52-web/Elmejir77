/* El Mejor DT — Playoffs Clausura 2026. App de una sola página, sin dependencias. */
(() => {
  'use strict';
  const API = ((window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '').replace(/\/$/, '');
  const TZ = 'America/Argentina/Buenos_Aires';
  const POS = ['ARQ', 'DEF', 'VOL', 'DEL'];
  const POS_NAME = { ARQ: 'Arquero', DEF: 'Defensor', VOL: 'Volante', DEL: 'Delantero' };
  const SHAPE = { ARQ: 2, DEF: 5, VOL: 5, DEL: 3 };
  const FORMATIONS = {
    '4-4-2': { ARQ: 1, DEF: 4, VOL: 4, DEL: 2 }, '4-3-3': { ARQ: 1, DEF: 4, VOL: 3, DEL: 3 },
    '3-4-3': { ARQ: 1, DEF: 3, VOL: 4, DEL: 3 }, '3-5-2': { ARQ: 1, DEF: 3, VOL: 5, DEL: 2 },
    '4-5-1': { ARQ: 1, DEF: 4, VOL: 5, DEL: 1 }, '5-3-2': { ARQ: 1, DEF: 5, VOL: 3, DEL: 2 },
    '5-4-1': { ARQ: 1, DEF: 5, VOL: 4, DEL: 1 },
  };
  const NATIVE = !!(window.APP_CONFIG && window.APP_CONFIG.NATIVE);
  const $app = document.getElementById('app');
  const $sheet = document.getElementById('sheet');
  const $toast = document.getElementById('toast');

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  };
  const S = {
    token: store.get('token'), boot: null, tab: 'home', draft: null, authMode: 'login',
    rankRound: 0, rank: null, more: 'menu', adm: { tab: 'resumen' }, picker: null,
  };
  let P = new Map(); let T = new Map();

  // ---------- utilidades ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => '$' + new Intl.NumberFormat('es-AR').format(n);
  const fmtDate = (iso) => iso ? new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(',', '') + ' h' : 'A confirmar';
  const toLocalInput = (iso) => { // ISO -> valor de <input datetime-local> en hora argentina
    if (!iso) return '';
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  };
  const fromLocalInput = (v) => (v ? v + ':00-03:00' : null);
  const timeLeft = (iso) => {
    const ms = new Date(iso) - Date.now();
    if (ms <= 0) return 'cerrando…';
    const h = Math.floor(ms / 3600e3); const d = Math.floor(h / 24);
    return d > 0 ? `faltan ${d} d ${h % 24} h` : h > 0 ? `faltan ${h} h ${Math.floor(ms / 60e3) % 60} min` : `faltan ${Math.max(1, Math.floor(ms / 60e3))} min`;
  };
  const surname = (name) => { const p = name.split(' '); return p.length > 1 ? p.slice(1).join(' ') : name; };
  let toastTimer;
  function toast(msg, err) {
    $toast.textContent = msg; $toast.className = 'toast' + (err ? ' err' : ''); $toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $toast.hidden = true; }, err ? 4500 : 2500);
  }
  async function api(method, path, body) {
    let res;
    try {
      res = await fetch(API + path, {
        method, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { throw new Error('No se pudo conectar con el servidor. Revisá tu conexión.'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ocurrió un error.');
    return data;
  }
  const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

  const badge = (teamId) => { const t = T.get(teamId) || {}; return `<span class="badge" style="--b1:${esc(t.c1)};--b2:${esc(t.c2)}" title="${esc(t.name)}">${esc(teamId)}</span>`; };
  const round = (id) => S.boot.rounds.find((r) => r.id === id);
  const curRound = () => round(S.boot.current_round);
  const STATUS = { open: ['Abierta', 'green'], locked: ['En juego', 'gold'], finished: ['Finalizada', ''], pending: ['Próxima', ''] };
  const statusTag = (r) => `<span class="tag ${STATUS[r.status][1]}">${STATUS[r.status][0]}</span>`;

  // ---------- carga ----------
  async function load() {
    S.boot = await api('GET', '/api/bootstrap');
    if (S.token && !S.boot.me) { S.token = null; store.set('token', null); }
    P = new Map(S.boot.players.map((p) => [p.id, p]));
    T = new Map(S.boot.teams.map((t) => [t.id, t]));
    if (!S.draft) S.draft = draftFrom(S.boot.me && S.boot.me.squad);
  }
  function draftFrom(sq) {
    const d = { formation: '4-4-2', pos: {}, captain: null };
    for (const p of POS) d.pos[p] = Array(SHAPE[p]).fill(null);
    if (sq) {
      d.formation = sq.formation; d.captain = sq.captain_id;
      for (const p of POS) {
        const mine = sq.players.filter((id) => P.get(id) && P.get(id).pos === p);
        const ordered = [...mine.filter((id) => sq.starters.includes(id)), ...mine.filter((id) => !sq.starters.includes(id))];
        ordered.forEach((id, i) => { if (i < SHAPE[p]) d.pos[p][i] = id; });
      }
    }
    return d;
  }
  const draftIds = () => POS.flatMap((p) => S.draft.pos[p]).filter(Boolean);
  const draftCost = () => draftIds().reduce((a, id) => a + P.get(id).price, 0);
  const isStarter = (pos, i) => i < FORMATIONS[S.draft.formation][pos];
  function draftSquad() {
    const f = FORMATIONS[S.draft.formation];
    return {
      formation: S.draft.formation, players: draftIds(),
      starters: POS.flatMap((p) => S.draft.pos[p].slice(0, f[p])).filter(Boolean), captain_id: S.draft.captain,
    };
  }
  const pendingChanges = () => {
    const me = S.boot.me;
    if (!me || !me.has_snapshot || !me.squad) return 0;
    return draftIds().filter((id) => !me.squad.players.includes(id)).length;
  };

  // ---------- vistas ----------
  const ICON = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    team: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/><circle cx="12" cy="12" r="3"/>',
    rank: '<path d="M8 21V10M12 21V4M16 21v-8M4 21h16"/>',
    pin: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 12h.01M11 12h.01M15 12h2"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  };
  const TABS = [['home', 'Inicio'], ['team', 'Mi equipo'], ['rank', 'Ranking'], ['pin', 'PINs'], ['more', 'Más']];

  function render() {
    if (!S.boot) return;
    const me = S.boot.me;
    if (!me) { $app.innerHTML = viewAuth(); return; }
    const view = { home: viewHome, team: viewTeam, rank: viewRank, pin: viewPins, more: viewMore }[S.tab]();
    $app.innerHTML = `
      <header class="top"><h1>El Mejor <b>DT</b></h1>
        <span class="chip" title="Cambios disponibles">🔁 ${me.changes_balance + me.free_left} cambios</span></header>
      <main>${view}</main>
      <nav class="tabs"><div>${TABS.map(([k, n]) => `<button data-a="tab" data-tab="${k}" class="${S.tab === k ? 'on' : ''}" ${S.tab === k ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24">${ICON[k]}</svg>${n}</button>`).join('')}</div></nav>`;
  }

  function viewAuth() {
    const reg = S.authMode === 'register';
    const s = S.boot.settings;
    return `<main><div class="auth">
      <div class="logo">El Mejor <b>DT</b></div>
      <p class="center muted">Playoffs · Torneo Clausura 2026</p>
      <div class="card hero"><div class="prizes">
        <div><div class="small">Mejor de cada fecha</div><div class="stat">${money(s.prize_round)}</div></div>
        <div><div class="small">Campeón del torneo</div><div class="stat">${money(s.prize_tournament)}</div></div></div></div>
      <div class="card" style="margin-top:14px"><h2>${reg ? 'Crear cuenta' : 'Ingresar'}</h2>
        <form data-form="auth">
          <label>Usuario<input name="username" autocomplete="username" autocapitalize="none" required minlength="3" maxlength="20"></label>
          ${reg ? `<label>Email<input name="email" type="email" autocomplete="email" required></label>
          <label>Nombre de tu equipo<input name="team_name" required minlength="3" maxlength="30"></label>` : ''}
          <label>Contraseña<input name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required minlength="6"></label>
          ${reg ? '<p class="small muted">Al registrarte declarás ser mayor de 18 años y aceptás las reglas del juego.</p>' : ''}
          <button class="btn primary">${reg ? 'Crear cuenta' : 'Ingresar'}</button>
        </form>
        <button class="btn" data-a="authmode">${reg ? 'Ya tengo cuenta' : 'No tengo cuenta: registrarme'}</button>
      </div></div></main>`;
  }

  function matchRow(m) {
    const t = (id, cls) => `<div class="t ${cls}">${badge(id)}<span class="${m.winner && m.winner !== id ? 'out' : ''}">${esc(T.get(id).name)}</span></div>`;
    const mid = m.home_goals != null && m.away_goals != null ? `<div class="score num">${m.home_goals} - ${m.away_goals}</div>` : `<div>${esc(fmtDate(m.kickoff)).replace(/ (\d\d:\d\d h)$/, '<br>$1')}</div>`;
    return `<div class="match">${t(m.home, 'home')}<div class="mid">${mid}</div>${t(m.away, 'away')}</div>`;
  }

  function viewHome() {
    const { me, settings: s } = S.boot;
    const r = curRound();
    const total = me.scores.reduce((a, x) => a + x.points, 0);
    const matches = S.boot.matches.filter((m) => r && m.round_id === r.id);
    let status;
    if (!r) status = '<h2>Torneo finalizado</h2><p class="muted">Mirá los ganadores en Más → Premios.</p>';
    else if (r.status === 'open') status = `<div class="row"><h2 class="grow">${esc(r.name)}</h2>${statusTag(r)}</div>
      <p>Cierre de equipos: <b>${esc(fmtDate(r.lock_at))}</b> <span class="muted">(${timeLeft(r.lock_at)})</span></p>`;
    else status = `<div class="row"><h2 class="grow">${esc(r.name)}</h2>${statusTag(r)}</div><p class="muted">Los equipos están cerrados. Los puntos se actualizan a medida que se cargan los partidos.</p>`;
    return `
      <div class="card hero">
        <div class="small">Hola, ${esc(me.username)} · <b>${esc(me.team_name)}</b></div>
        <div class="row"><div class="grow"><div class="small">Tus puntos</div><div class="big num">${total}</div></div>
          ${me.squad ? '' : '<button class="btn primary" data-a="tab" data-tab="team">Armar mi equipo</button>'}</div>
        <div class="prizes">
          <div><div class="small">Mejor de la fecha</div><div class="stat">${money(s.prize_round)}</div></div>
          <div><div class="small">Campeón del torneo</div><div class="stat">${money(s.prize_tournament)}</div></div></div>
      </div>
      <div class="card">${status}${matches.length ? matches.map(matchRow).join('') : (r ? '<p class="muted">Cruces a confirmar.</p>' : '')}</div>
      <div class="card"><h2>Fechas</h2><div class="list">${S.boot.rounds.map((x) => {
        const sc = me.scores.find((q) => q.round_id === x.id);
        return `<div><div class="grow"><b>${esc(x.name)}</b><div class="small muted">Cierre: ${esc(fmtDate(x.lock_at))}</div></div>${sc ? `<b class="num">${sc.points} pts</b>` : ''}${statusTag(x)}</div>`;
      }).join('')}</div></div>`;
  }

  function slotHtml(pos, i, opts = {}) {
    const id = S.draft.pos[pos][i];
    if (!id) return `<button class="slot empty" data-a="slot" data-pos="${pos}" data-i="${i}" aria-label="Agregar ${POS_NAME[pos]}"><span class="shirt">+</span><span class="nm">${pos}</span></button>`;
    const p = P.get(id); const t = T.get(p.team_id);
    return `<button class="slot ${t.eliminated ? 'elim' : ''}" data-a="slot" data-pos="${pos}" data-i="${i}" style="--b1:${esc(t.c1)};--b2:${esc(t.c2)}">
      ${S.draft.captain === id && !opts.bench ? '<span class="cap" title="Capitán">C</span>' : ''}
      <span class="shirt">${esc(p.team_id)}</span><span class="nm">${esc(surname(p.name))}</span><span class="pr num">$${p.price}M</span></button>`;
  }

  function viewTeam() {
    const { me, settings: s } = S.boot;
    const f = FORMATIONS[S.draft.formation];
    const left = s.budget - draftCost();
    const n = draftIds().length;
    const pend = pendingChanges();
    const avail = me.changes_balance + me.free_left;
    const lines = ['DEL', 'VOL', 'DEF', 'ARQ'].map((p) => `<div class="line">${Array.from({ length: f[p] }, (_, i) => slotHtml(p, i)).join('')}</div>`).join('');
    const bench = POS.map((p) => Array.from({ length: SHAPE[p] - f[p] }, (_, k) => slotHtml(p, f[p] + k, { bench: true })).join('')).join('');
    let notice = '';
    if (!me.can_edit) notice = '<div class="card"><b>Fecha en juego</b><span class="muted">Tu equipo está cerrado hasta que termine la fecha.</span></div>';
    else if (!me.has_snapshot) notice = '<p class="small muted">Hasta tu primera fecha jugada podés armar y modificar el equipo gratis. Después, cada jugador nuevo consume un cambio.</p>';
    else if (pend > 0) notice = `<div class="card"><div class="row"><div class="grow">Este guardado usa <b>${pend}</b> cambio${pend > 1 ? 's' : ''}. Tenés <b class="${pend > avail ? 'bad' : 'good'}">${avail}</b>.</div>${pend > avail ? '<button class="btn sm primary" data-a="tab" data-tab="pin">Cargar PIN</button>' : ''}</div></div>`;
    return `
      <div class="kpis">
        <div><span class="small muted">Presupuesto</span><b class="num ${left < 0 ? 'bad' : ''}">$${left}M</b></div>
        <div><span class="small muted">Jugadores</span><b class="num">${n}/15</b></div>
        <div><span class="small muted">Cambios</span><b class="num">${avail}</b></div>
      </div>
      <div class="seg">${Object.keys(FORMATIONS).map((k) => `<button class="btn sm ${k === S.draft.formation ? 'on' : ''}" data-a="formation" data-f="${k}">${k}</button>`).join('')}</div>
      <div class="pitch">${lines}</div>
      <div class="benchbox"><h3>Suplentes</h3><div class="line">${bench}</div></div>
      ${notice}
      <div class="row sticky-save">
        ${me.squad ? '<button class="btn" data-a="resetdraft">Deshacer</button>' : ''}
        <button class="btn primary grow" data-a="savesquad" ${me.can_edit ? '' : 'disabled'}>Guardar equipo</button>
      </div>`;
  }

  function viewRank() {
    const rounds = S.boot.rounds.filter((r) => r.status === 'locked' || r.status === 'finished');
    const d = S.rank;
    const seg = `<div class="seg"><button class="btn sm ${S.rankRound === 0 ? 'on' : ''}" data-a="rank" data-r="0">General</button>${rounds.map((r) => `<button class="btn sm ${S.rankRound === r.id ? 'on' : ''}" data-a="rank" data-r="${r.id}">${esc(r.name)}</button>`).join('')}</div>`;
    if (!d) return seg + '<p class="muted center">Cargando…</p>';
    const viewRound = S.rankRound || (rounds.length ? rounds[rounds.length - 1].id : 0);
    const row = (x) => `<button class="item ${x.user_id === S.boot.me.id ? 'me-row' : ''}" data-a="lineup" data-u="${x.user_id}" data-r="${viewRound}">
      <span class="rank num">${x.rank}</span><span class="grow"><b>${esc(x.team_name)}</b><div class="small muted">${esc(x.username)}</div></span><b class="num">${x.points}</b></button>`;
    const meOut = d.me && !d.top.some((x) => x.user_id === d.me.user_id);
    return `${seg}
      <div class="card"><div class="row"><h2 class="grow">${S.rankRound ? esc(round(S.rankRound).name) : 'Tabla general'}</h2><span class="small muted">${d.total} equipos</span></div>
      ${d.top.length ? `<div class="list">${d.top.map(row).join('')}${meOut ? row(d.me) : ''}</div>` : '<p class="muted">Todavía no hay equipos en esta tabla.</p>'}</div>`;
  }

  function viewPins() {
    const { me, settings: s } = S.boot;
    const canBuy = S.boot.payments_enabled && (!NATIVE || s.mp_in_app);
    return `
      <div class="card hero center"><div class="small">Cambios disponibles</div><div class="big num">${me.changes_balance + me.free_left}</div>
        <div class="small">${me.changes_balance} por PIN${s.free_changes_per_round ? ` · ${me.free_left} gratis de esta fecha` : ''}</div></div>
      <div class="card pinbox"><h2>Cargar un PIN</h2>
        <form data-form="redeem"><input name="code" placeholder="XXXX-XXXX-XXXX" maxlength="14" autocomplete="off" autocapitalize="characters" aria-label="Código PIN" required>
          <button class="btn primary">Activar PIN</button></form>
        <p class="small muted">Cada PIN habilita ${s.pin_changes} cambios de jugadores. Los cambios no vencen durante el torneo.</p></div>
      ${canBuy ? `<form data-form="buy" class="card"><h2>Comprar PINs</h2>
        <div class="row"><label class="grow">Cantidad<select name="quantity">${[1, 2, 3, 5, 10].map((n) => `<option value="${n}">${n} PIN${n > 1 ? 's' : ''} · ${n * s.pin_changes} cambios · ${money(n * s.pin_price)}</option>`).join('')}</select></label></div>
        <button class="btn primary">Pagar con Mercado Pago</button>
        <p class="small muted">Al aprobarse el pago, los cambios se suman solos a tu cuenta.</p></form>` : ''}
      ${canBuy && !s.pin_buy_info ? '' : `<div class="card"><h2>¿Cómo consigo un PIN?</h2>
        <p>Precio del PIN: <b>${money(s.pin_price)}</b></p>
        <p style="white-space:pre-wrap">${s.pin_buy_info ? esc(s.pin_buy_info) : '<span class="muted">Consultá con el organizador del torneo para comprar tu PIN.</span>'}</p></div>`}`;
  }

  const RULES = [
    ['Jugó el partido', '+1'], ['Jugó 60 minutos o más', '+2'], ['Gol de delantero', '+4'], ['Gol de volante', '+5'], ['Gol de defensor o arquero', '+6'],
    ['Asistencia', '+3'], ['Valla invicta (arquero o defensor, 60\'+)', '+4'], ['Valla invicta (volante, 60\'+)', '+1'], ['Penal atajado', '+5'], ['Figura del partido', '+3'],
    ['Cada 2 goles recibidos (arquero o defensor)', '−1'], ['Penal errado', '−2'], ['Gol en contra', '−2'], ['Tarjeta amarilla', '−1'], ['Tarjeta roja', '−3'],
  ];
  function viewMore() {
    const { me, settings: s } = S.boot;
    const back = '<button class="btn sm" data-a="more" data-m="menu">← Volver</button>';
    if (S.more === 'rules') return `${back}
      <div class="card"><h2>Cómo se juega</h2>
        <p>Armá un plantel de 15 jugadores (2 arqueros, 5 defensores, 5 volantes y 3 delanteros) de los equipos clasificados a los playoffs del Clausura 2026, con un presupuesto de $${s.budget}M y hasta ${s.max_per_club} jugadores por club.</p>
        <p>Elegí formación, 11 titulares y un capitán: el capitán suma doble. Si un titular no juega, entra automáticamente el suplente del mismo puesto.</p>
        <p>Cada instancia (octavos, cuartos, semifinales y final) es una fecha. Los equipos se cierran cuando empieza el primer partido de la fecha.</p></div>
      <div class="card"><h2>Cambios y PINs</h2>
        <p>Hasta tu primera fecha jugada podés modificar el equipo libremente. Después, cada jugador nuevo que sumás consume un cambio. Los cambios se habilitan con PINs: cada PIN vale ${s.pin_changes} cambios${s.free_changes_per_round ? `, y además tenés ${s.free_changes_per_round} cambio(s) gratis por fecha` : ''}.</p>
        <p>Cambiar formación, capitán o pasar jugadores entre titulares y suplentes es siempre gratis.</p></div>
      <div class="card"><h2>Premios</h2>
        <p><b>${money(s.prize_round)}</b> para el equipo con más puntos de cada fecha y <b>${money(s.prize_tournament)}</b> para el que sume más puntos en todo el torneo. En caso de empate, el premio se reparte en partes iguales.</p></div>
      <div class="card"><h2>Puntajes</h2><table>${RULES.map(([a, b]) => `<tr><td>${a}</td><td class="right num"><b>${b}</b></td></tr>`).join('')}</table></div>`;
    if (S.more === 'prizes') {
      const list = S.prizes;
      return `${back}<div class="card"><h2>Ganadores</h2>${!list ? '<p class="muted">Cargando…</p>' : !list.length ? '<p class="muted">Todavía no hay ganadores. El primer premio se define al terminar los octavos.</p>' :
        `<div class="list">${list.map((p) => `<div><div class="grow"><b>${esc(p.team_name)}</b><div class="small muted">${esc(p.username)} · ${p.kind === 'torneo' ? 'Campeón del torneo' : esc(round(p.round_id).name)} · ${p.points} pts</div></div><b class="num">${money(p.amount)}</b></div>`).join('')}</div>`}</div>`;
    }
    if (S.more === 'admin' && me.is_admin) return back + viewAdmin();
    return `
      <div class="card"><div class="row"><div class="grow"><b>${esc(me.team_name)}</b><div class="small muted">${esc(me.username)} · ${esc(me.email)}</div></div></div></div>
      <div class="card"><div class="list">
        <button class="item" data-a="more" data-m="rules"><span class="grow">Reglas y puntajes</span>›</button>
        <button class="item" data-a="more" data-m="prizes"><span class="grow">Premios y ganadores</span>›</button>
        ${me.is_admin ? '<button class="item" data-a="more" data-m="admin"><span class="grow">Panel de administración</span>›</button>' : ''}
      </div></div>
      <button class="btn danger" data-a="logout">Cerrar sesión</button>`;
  }

  // ---------- administración ----------
  const ADM_TABS = [['resumen', 'Resumen'], ['fechas', 'Fechas'], ['partidos', 'Partidos'], ['puntajes', 'Puntajes'], ['pins', 'PINs'], ['jugadores', 'Jugadores'], ['ajustes', 'Ajustes']];
  const teamOptions = (sel) => S.boot.teams.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  const roundOptions = (sel) => S.boot.rounds.map((r) => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(r.name)}</option>`).join('');

  function viewAdmin() {
    const a = S.adm;
    const seg = `<div class="seg">${ADM_TABS.map(([k, n]) => `<button class="btn sm ${a.tab === k ? 'on' : ''}" data-a="adm" data-t="${k}">${n}</button>`).join('')}</div>`;
    let body = '';
    if (a.tab === 'resumen') {
      const o = a.overview;
      body = !o ? '<p class="muted">Cargando…</p>' : `
        <div class="kpis"><div><span class="small muted">Usuarios</span><b class="num">${o.users}</b></div><div><span class="small muted">Equipos</span><b class="num">${o.squads}</b></div><div><span class="small muted">PINs usados</span><b class="num">${o.pins_used}/${o.pins_total}</b></div></div>
        <div class="card"><h2>Ventas por Mercado Pago</h2><p><b class="num">${money(o.sales.total)}</b> <span class="muted">· ${o.sales.n} pago${o.sales.n === 1 ? '' : 's'} · ${o.sales.pins} PIN${o.sales.pins === 1 ? '' : 's'}</span></p>
          ${o.orders.length ? `<div class="tscroll"><table><tr><th>Usuario</th><th>PINs</th><th>Monto</th><th>Pago MP</th><th>Fecha</th></tr>${o.orders.map((x) => `<tr><td>${esc(x.username)}</td><td class="num">${x.quantity}</td><td class="num">${money(x.amount)}</td><td class="num">${esc(x.mp_payment)}</td><td>${esc(fmtDate(x.paid_at))}</td></tr>`).join('')}</table></div>` : ''}</div>
        <div class="card"><h2>Premios a pagar</h2>${o.prizes.length ? `<div class="list">${o.prizes.map((p) => `<div><div class="grow"><b>${esc(p.team_name)}</b> <span class="muted">(${esc(p.username)})</span><div class="small muted">${esc(p.email)} · ${p.kind === 'torneo' ? 'Torneo' : esc(round(p.round_id).name)} · ${money(p.amount)}</div></div>
          <button class="btn sm ${p.paid ? '' : 'primary'}" data-a="prizepaid" data-id="${p.id}" data-paid="${p.paid ? 0 : 1}">${p.paid ? 'Pagado ✓' : 'Marcar pagado'}</button></div>`).join('')}</div>` : '<p class="muted">Sin premios todavía.</p>'}</div>
        <div class="card"><h2>Usuarios</h2>${a.users ? `<div class="tscroll"><table><tr><th>Equipo</th><th>Usuario</th><th>Email</th><th>Pts</th><th>Cambios</th></tr>${a.users.map((u) => `<tr><td>${esc(u.team_name)}</td><td>${esc(u.username)}</td><td>${esc(u.email)}</td><td class="num">${u.points}</td><td class="num">${u.changes_balance}</td></tr>`).join('')}</table></div>` : ''}</div>`;
    } else if (a.tab === 'fechas') {
      body = S.boot.rounds.map((r) => `<div class="card"><div class="row"><h2 class="grow">${esc(r.name)}</h2>${statusTag(r)}</div>
        <form data-form="roundlock" data-id="${r.id}"><label>Cierre de equipos (hora de Argentina)<input type="datetime-local" name="lock_at" value="${toLocalInput(r.lock_at)}" required></label><button class="btn sm">Guardar horario</button></form>
        <div class="row wrap">
          ${r.status === 'open' ? `<button class="btn sm" data-a="roundact" data-id="${r.id}" data-act="lock" data-msg="¿Cerrar ahora los equipos de ${esc(r.name)}?">Cerrar equipos ahora</button>` : ''}
          ${r.status === 'locked' ? `<button class="btn sm" data-a="roundact" data-id="${r.id}" data-act="reopen" data-msg="¿Reabrir ${esc(r.name)}? Se borran los equipos congelados de esta fecha.">Reabrir</button>
            <button class="btn sm primary" data-a="roundact" data-id="${r.id}" data-act="finalize" data-msg="¿Finalizar ${esc(r.name)}? Se define el ganador del premio y se abre la fecha siguiente. Revisá antes que los puntajes estén completos y que el cierre de la próxima fecha sea correcto.">Finalizar y premiar</button>` : ''}
        </div></div>`).join('');
    } else if (a.tab === 'partidos') {
      const form = (m) => `<form data-form="match" class="card">
          <input type="hidden" name="id" value="${m.id || ''}">
          <div class="row"><label class="grow">Fecha<select name="round_id">${roundOptions(m.round_id)}</select></label><label class="grow">Horario<input type="datetime-local" name="kickoff" value="${toLocalInput(m.kickoff)}"></label></div>
          <div class="row"><label class="grow">Local<select name="home">${teamOptions(m.home)}</select></label><label style="width:64px">Goles<input name="home_goals" inputmode="numeric" value="${m.home_goals ?? ''}"></label></div>
          <div class="row"><label class="grow">Visitante<select name="away">${teamOptions(m.away)}</select></label><label style="width:64px">Goles<input name="away_goals" inputmode="numeric" value="${m.away_goals ?? ''}"></label></div>
          <label>Clasificado (el otro queda eliminado)<select name="winner"><option value="">Sin definir</option>${m.id ? [m.home, m.away].map((id) => `<option value="${id}" ${m.winner === id ? 'selected' : ''}>${esc(T.get(id).name)}</option>`).join('') : ''}</select></label>
          <div class="row"><button class="btn sm primary grow">${m.id ? 'Guardar' : 'Agregar partido'}</button>${m.id ? `<button type="button" class="btn sm danger" data-a="delmatch" data-id="${m.id}">Borrar</button>` : ''}</div>
        </form>`;
      body = `<p class="small muted">Al elegir el clasificado, el rival queda marcado como eliminado. Para un partido nuevo, guardalo primero y después cargá el clasificado.</p>
        ${S.boot.matches.map(form).join('')}<h3>Nuevo partido</h3>${form({ round_id: S.boot.current_round || 1 })}
        <div class="card"><h2>Equipos eliminados</h2><div class="row wrap">${S.boot.teams.map((t) => `<button class="btn sm ${t.eliminated ? 'danger' : ''}" data-a="elim" data-id="${t.id}" data-v="${t.eliminated ? 0 : 1}">${esc(t.name)}${t.eliminated ? ' ✕' : ''}</button>`).join('')}</div></div>`;
    } else if (a.tab === 'puntajes') {
      a.statRound = a.statRound || S.boot.current_round || 1;
      const cols = [['minutes', 'Min'], ['goals', 'G'], ['assists', 'A'], ['conceded', 'GR'], ['yellow', 'TA'], ['red', 'TR'], ['own_goals', 'EC'], ['pen_saved', 'PA'], ['pen_missed', 'PE']];
      body = `<div class="card"><div class="row"><label class="grow">Fecha<select data-change="statround">${roundOptions(a.statRound)}</select></label>
          <label class="grow">Club<select data-change="statteam"><option value="">Elegir…</option>${teamOptions(a.statTeam)}</select></label></div>
        <p class="small muted">Min: minutos · G: goles · A: asistencias · GR: goles recibidos por su equipo mientras jugó · TA/TR: tarjetas · EC: goles en contra · PA: penales atajados · PE: penales errados · Fig: figura.</p></div>
        ${a.stats ? `<form data-form="stats" class="card"><div class="tscroll"><table><tr><th>Jugador</th>${cols.map((c) => `<th>${c[1]}</th>`).join('')}<th>Fig</th></tr>
          ${a.stats.map((p) => `<tr data-pid="${p.id}"><td><span class="tag">${p.pos}</span> ${esc(p.name)}</td>${cols.map((c) => `<td><input inputmode="numeric" name="${c[0]}" value="${p[c[0]] || ''}" aria-label="${c[1]} ${esc(p.name)}"></td>`).join('')}<td><input type="checkbox" name="mvp" ${p.mvp ? 'checked' : ''} aria-label="Figura ${esc(p.name)}"></td></tr>`).join('')}
          </table></div><button class="btn primary">Guardar puntajes</button></form>` : ''}`;
    } else if (a.tab === 'pins') {
      const s = S.boot.settings;
      body = `<form data-form="genpins" class="card"><h2>Generar PINs</h2>
          <div class="row"><label class="grow">Cantidad<input name="count" inputmode="numeric" value="10" required></label><label class="grow">Cambios por PIN<input name="changes" inputmode="numeric" value="${s.pin_changes}" required></label></div>
          <label>Nota del lote (opcional)<input name="batch" maxlength="60" placeholder="Ej.: venta kiosco"></label><button class="btn primary">Generar</button></form>
        ${a.newCodes ? `<div class="card"><h2>PINs recién generados</h2><pre class="codes">${a.newCodes.map(fmtPin).join('\n')}</pre><p class="small muted">Copialos ahora: cada uno sirve una sola vez.</p></div>` : ''}
        <div class="card"><h2>Todos los PINs</h2>${a.pins ? `<div class="tscroll"><table><tr><th>PIN</th><th>Cambios</th><th>Lote</th><th>Estado</th></tr>${a.pins.map((p) => `<tr><td class="num">${fmtPin(p.code)}</td><td>${p.changes}</td><td>${esc(p.batch)}</td><td>${p.used_by ? `<span class="tag">Usado por ${esc(p.used_by)}</span>` : '<span class="tag green">Disponible</span>'}</td></tr>`).join('')}</table></div>` : '<p class="muted">Cargando…</p>'}</div>`;
    } else if (a.tab === 'jugadores') {
      a.plTeam = a.plTeam || S.boot.teams[0].id;
      const list = S.boot.players.filter((p) => p.team_id === a.plTeam).sort((x, y) => POS.indexOf(x.pos) - POS.indexOf(y.pos) || x.name.localeCompare(y.name));
      const posOpts = (sel) => POS.map((p) => `<option ${p === sel ? 'selected' : ''}>${p}</option>`).join('');
      const form = (p) => `<form data-form="player" class="row"><input type="hidden" name="id" value="${p.id || ''}">
          <input name="name" value="${esc(p.name || '')}" placeholder="Nombre" required class="grow" aria-label="Nombre">
          <select name="pos" style="width:74px" aria-label="Puesto">${posOpts(p.pos)}</select>
          <input name="price" inputmode="numeric" value="${p.price || ''}" placeholder="$M" style="width:54px" required aria-label="Precio en millones">
          ${p.id ? `<label class="row small" style="flex-direction:row" title="Disponible"><input type="checkbox" name="active" ${p.active ? 'checked' : ''} style="width:18px;height:18px"></label>` : ''}
          <button class="btn sm">${p.id ? 'OK' : 'Agregar'}</button></form>`;
      body = `<div class="card"><label>Club<select data-change="plteam">${teamOptions(a.plTeam)}</select></label>
        <p class="small muted">Editá nombre, puesto y precio (en millones). Destildá la casilla para quitar un jugador de la lista de compra.</p>
        ${list.map(form).join('')}<h3>Nuevo jugador</h3>${form({})}</div>`;
    } else if (a.tab === 'ajustes') {
      const s = S.boot.settings;
      const f = (k, label) => `<label>${label}<input name="${k}" inputmode="numeric" value="${s[k]}" required></label>`;
      body = `<form data-form="settings" class="card"><h2>Ajustes del juego</h2>
        ${f('prize_round', 'Premio por fecha ($)')}${f('prize_tournament', 'Premio del torneo ($)')}${f('pin_price', 'Precio del PIN ($)')}${f('pin_changes', 'Cambios por PIN (para PINs nuevos)')}
        ${f('free_changes_per_round', 'Cambios gratis por fecha')}${f('budget', 'Presupuesto (millones)')}${f('max_per_club', 'Máximo de jugadores por club')}
        <label>Botón de Mercado Pago dentro de la app Android<select name="mp_in_app"><option value="0" ${s.mp_in_app ? '' : 'selected'}>No mostrar (recomendado para Play Store)</option><option value="1" ${s.mp_in_app ? 'selected' : ''}>Mostrar</option></select></label>
        <label>Cómo comprar un PIN (se muestra a los usuarios)<textarea name="pin_buy_info" rows="4" maxlength="1000" placeholder="Ej.: transferí al alias MI.ALIAS y mandá el comprobante por WhatsApp al 11-xxxx-xxxx">${esc(s.pin_buy_info)}</textarea></label>
        <button class="btn primary">Guardar ajustes</button></form>`;
    }
    return seg + body;
  }
  const fmtPin = (c) => c.replace(/(.{4})(?=.)/g, '$1-');
  async function loadAdmin() {
    const a = S.adm;
    if (a.tab === 'resumen') { [a.overview, a.users] = await Promise.all([api('GET', '/api/admin/overview'), api('GET', '/api/admin/users')]); }
    if (a.tab === 'pins') a.pins = await api('GET', '/api/admin/pins');
    if (a.tab === 'puntajes') a.stats = a.statTeam ? await api('GET', `/api/admin/stats?round=${a.statRound || S.boot.current_round || 1}&team=${a.statTeam}`) : null;
    render();
  }

  // ---------- hojas (modales) ----------
  function openSheet(html) { $sheet.innerHTML = `<div class="panel" role="dialog" aria-modal="true">${html}</div>`; $sheet.hidden = false; }
  function closeSheet() { $sheet.hidden = true; $sheet.innerHTML = ''; S.picker = null; }

  function pickerSheet() {
    const { pos, i, q, team } = S.picker;
    const s = S.boot.settings;
    const current = S.draft.pos[pos][i];
    const taken = new Set(draftIds());
    const budgetLeft = s.budget - draftCost() + (current ? P.get(current).price : 0);
    const clubCount = {};
    for (const id of taken) if (id !== current) { const t = P.get(id).team_id; clubCount[t] = (clubCount[t] || 0) + 1; }
    const list = S.boot.players
      .filter((p) => p.pos === pos && p.active && !taken.has(p.id) && (!team || p.team_id === team) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    const rows = list.map((p) => {
      const t = T.get(p.team_id);
      const why = p.price > budgetLeft ? 'Sin presupuesto' : (clubCount[p.team_id] || 0) >= s.max_per_club ? `Máx. ${s.max_per_club} por club` : '';
      return `<button class="item" data-a="pick" data-id="${p.id}" ${why ? 'disabled style="opacity:.45"' : ''}>${badge(p.team_id)}
        <span class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(t.name)} ${t.eliminated ? '<span class="tag red">Eliminado</span>' : ''} ${why ? `<span class="tag">${why}</span>` : ''}</div></span><b class="num">$${p.price}M</b></button>`;
    }).join('');
    return `<div class="row"><h2 class="grow">Elegir ${POS_NAME[pos].toLowerCase()}</h2><span class="chip num">Disponible $${budgetLeft}M</span><button class="btn sm" data-a="closesheet" aria-label="Cerrar">✕</button></div>
      <div class="row"><input class="grow" placeholder="Buscar jugador" value="${esc(q)}" data-input="pq" aria-label="Buscar jugador">
        <select style="width:42%" data-change="pteam" aria-label="Filtrar por club"><option value="">Todos los clubes</option>${teamOptions(team)}</select></div>
      <div class="scroll"><div class="list" id="plist">${rows || '<p class="muted">No hay jugadores para mostrar.</p>'}</div></div>`;
  }
  function slotSheet(pos, i) {
    const id = S.draft.pos[pos][i];
    const p = P.get(id); const t = T.get(p.team_id);
    const starter = isStarter(pos, i);
    const f = FORMATIONS[S.draft.formation];
    const others = S.draft.pos[pos].map((x, k) => ({ x, k })).filter(({ x, k }) => x && isStarter(pos, k) !== starter);
    return `<div class="row">${badge(p.team_id)}<div class="grow"><h2>${esc(p.name)}</h2><div class="small muted">${POS_NAME[pos]} · ${esc(t.name)} · $${p.price}M ${t.eliminated ? '<span class="tag red">Eliminado</span>' : ''}</div></div><button class="btn sm" data-a="closesheet" aria-label="Cerrar">✕</button></div>
      <div class="scroll" style="display:flex;flex-direction:column;gap:8px">
      ${starter && S.draft.captain !== id ? `<button class="btn" data-a="captain" data-id="${id}">Nombrar capitán (puntos dobles)</button>` : ''}
      ${others.map(({ x, k }) => `<button class="btn" data-a="swap" data-pos="${pos}" data-i="${i}" data-k="${k}">${starter ? 'Mandar al banco y que entre' : 'Poner de titular en lugar de'} ${esc(P.get(x).name)}</button>`).join('')}
      ${!others.length && f[pos] < SHAPE[pos] && !starter ? '<p class="small muted">Completá los titulares de este puesto para poder intercambiar.</p>' : ''}
      <button class="btn" data-a="replace" data-pos="${pos}" data-i="${i}">Cambiar por otro jugador</button>
      <button class="btn danger" data-a="remove" data-pos="${pos}" data-i="${i}">Quitar del equipo</button></div>`;
  }
  function lineupSheet(d) {
    const pts = new Map(d.detail.map((x) => [x.subFor || x.id, x]));
    const cell = (id, bench) => {
      const x = pts.get(id); const shown = P.get(x ? x.id : id); if (!shown) return '';
      const t = T.get(shown.team_id);
      return `<div class="slot" style="--b1:${esc(t.c1)};--b2:${esc(t.c2)}">${x && x.captain ? '<span class="cap">C</span>' : ''}<span class="shirt">${esc(shown.team_id)}</span>
        <span class="nm">${x && x.subFor ? '↔ ' : ''}${esc(surname(shown.name))}</span>${bench ? '' : `<span class="pts num">${x ? x.pts : 0}</span>`}</div>`;
    };
    const usedSubs = new Set(d.detail.filter((x) => x.subFor).map((x) => x.id));
    const byPos = (ids) => ['DEL', 'VOL', 'DEF', 'ARQ'].map((p) => ids.filter((id) => P.get(id) && P.get(id).pos === p));
    const bench = d.players.filter((id) => !d.starters.includes(id) && !usedSubs.has(id));
    return `<div class="row"><div class="grow"><h2>${esc(d.team_name)}</h2><div class="small muted">${esc(d.username)} · ${esc(round(d.round_id).name)} · ${d.formation}</div></div><b class="stat num">${d.points}</b><button class="btn sm" data-a="closesheet" aria-label="Cerrar">✕</button></div>
      <div class="scroll"><div class="pitch">${byPos(d.starters).map((ids) => `<div class="line">${ids.map((id) => cell(id)).join('')}</div>`).join('')}</div>
      <p class="small muted" style="margin:10px 0 6px">Suplentes sin usar</p><div class="line">${bench.map((id) => cell(id, true)).join('')}</div></div>`;
  }

  // ---------- acciones ----------
  const refresh = async () => { await load(); render(); };
  const actions = {
    tab: run(async (d) => {
      S.tab = d.tab; S.more = 'menu';
      render(); window.scrollTo(0, 0);
      if (d.tab === 'rank') { S.rank = await api('GET', '/api/ranking?round=' + S.rankRound); render(); }
      if (d.tab === 'home' || d.tab === 'pin') await refresh();
    }),
    authmode() { S.authMode = S.authMode === 'login' ? 'register' : 'login'; render(); },
    logout: run(async () => { await api('POST', '/api/logout').catch(() => {}); S.token = null; store.set('token', null); S.draft = null; S.tab = 'home'; S.authMode = 'login'; await refresh(); }),
    formation(d) {
      S.draft.formation = d.f;
      const starters = draftSquad().starters;
      if (!starters.includes(S.draft.captain)) S.draft.captain = null;
      render();
    },
    slot(d) {
      const i = Number(d.i);
      if (!S.boot.me.can_edit) return toast('La fecha está en juego: el equipo está cerrado.', true);
      if (S.draft.pos[d.pos][i]) openSheet(slotSheet(d.pos, i));
      else { S.picker = { pos: d.pos, i, q: '', team: '' }; openSheet(pickerSheet()); }
    },
    replace(d) { S.picker = { pos: d.pos, i: Number(d.i), q: '', team: '' }; openSheet(pickerSheet()); },
    pick(d) {
      const { pos, i } = S.picker; const old = S.draft.pos[pos][i]; const id = Number(d.id);
      S.draft.pos[pos][i] = id;
      if (old && S.draft.captain === old) S.draft.captain = isStarter(pos, i) ? id : null;
      closeSheet(); render();
    },
    remove(d) { const i = Number(d.i); if (S.draft.captain === S.draft.pos[d.pos][i]) S.draft.captain = null; S.draft.pos[d.pos][i] = null; closeSheet(); render(); },
    captain(d) { S.draft.captain = Number(d.id); closeSheet(); render(); },
    swap(d) {
      const arr = S.draft.pos[d.pos]; const i = Number(d.i); const k = Number(d.k);
      [arr[i], arr[k]] = [arr[k], arr[i]];
      if (!draftSquad().starters.includes(S.draft.captain)) S.draft.captain = null;
      closeSheet(); render();
    },
    closesheet: closeSheet,
    resetdraft() { S.draft = draftFrom(S.boot.me.squad); render(); },
    savesquad: run(async () => {
      const sq = draftSquad();
      if (sq.players.length < 15) throw new Error(`Te faltan ${15 - sq.players.length} jugadores para completar el plantel.`);
      if (!sq.captain_id) throw new Error('Elegí un capitán: tocá un titular y nombralo capitán.');
      const pend = pendingChanges();
      if (pend > 0 && !confirm(`Vas a usar ${pend} cambio${pend > 1 ? 's' : ''}. ¿Confirmás?`)) return;
      await api('PUT', '/api/squad', sq);
      S.draft = null; await refresh(); toast('¡Equipo guardado!');
    }),
    rank: run(async (d) => { S.rankRound = Number(d.r); S.rank = null; render(); S.rank = await api('GET', '/api/ranking?round=' + S.rankRound); render(); }),
    lineup: run(async (d) => {
      if (!Number(d.r)) return toast('Los equipos se pueden ver cuando se cierre la primera fecha.');
      openSheet(lineupSheet(await api('GET', `/api/lineup/${d.u}/${d.r}`)));
    }),
    more: run(async (d) => {
      S.more = d.m; render(); window.scrollTo(0, 0);
      if (d.m === 'prizes') { S.prizes = await api('GET', '/api/prizes'); render(); }
      if (d.m === 'admin') await loadAdmin();
    }),
    adm: run(async (d) => { S.adm.tab = d.t; S.adm.newCodes = null; render(); await loadAdmin(); }),
    roundact: run(async (d) => {
      if (!confirm(d.msg)) return;
      await api('POST', `/api/admin/rounds/${d.id}/${d.act}`); await refresh(); toast('Listo.');
    }),
    delmatch: run(async (d) => { if (!confirm('¿Borrar este partido?')) return; await api('DELETE', '/api/admin/matches/' + d.id); await refresh(); }),
    elim: run(async (d) => { await api('PUT', '/api/admin/teams/' + d.id, { eliminated: d.v === '1' }); await refresh(); }),
    prizepaid: run(async (d) => { await api('PUT', '/api/admin/prizes/' + d.id, { paid: d.paid === '1' }); await loadAdmin(); }),
  };
  const forms = {
    auth: async (v) => {
      const out = await api('POST', S.authMode === 'register' ? '/api/register' : '/api/login', v);
      S.token = out.token; store.set('token', out.token); S.draft = null; S.tab = 'home'; await refresh();
    },
    buy: async (v) => {
      const out = await api('POST', '/api/payments/checkout', { quantity: Number(v.quantity) });
      window.location.href = out.init_point;
    },
    redeem: async (v) => { const out = await api('POST', '/api/pins/redeem', v); await refresh(); toast(`¡PIN activado! Sumaste ${out.added} cambios.`); },
    roundlock: async (v, f) => { await api('PUT', '/api/admin/rounds/' + f.dataset.id, { lock_at: fromLocalInput(v.lock_at) }); await refresh(); toast('Horario guardado.'); },
    match: async (v) => { await api('POST', '/api/admin/matches', { ...v, kickoff: fromLocalInput(v.kickoff) }); await refresh(); toast('Partido guardado.'); },
    stats: async (_, f) => {
      const rows = [...f.querySelectorAll('tr[data-pid]')].map((tr) => {
        const r = { id: Number(tr.dataset.pid) };
        tr.querySelectorAll('input').forEach((inp) => { r[inp.name] = inp.type === 'checkbox' ? inp.checked : inp.value; });
        return r;
      });
      await api('PUT', '/api/admin/stats', { round_id: S.adm.statRound, rows }); toast('Puntajes guardados.');
    },
    genpins: async (v) => { const out = await api('POST', '/api/admin/pins', v); S.adm.newCodes = out.codes; await loadAdmin(); },
    player: async (v, f) => {
      const active = f.querySelector('[name=active]');
      await api('POST', '/api/admin/players', { ...v, team_id: S.adm.plTeam, active: active ? active.checked : true }); await refresh(); toast('Jugador guardado.');
    },
    settings: async (v) => { await api('PUT', '/api/admin/settings', v); await refresh(); toast('Ajustes guardados.'); },
  };
  const changes = {
    pteam(v) { S.picker.team = v; openSheet(pickerSheet()); },
    statround: run(async (v) => { S.adm.statRound = Number(v); await loadAdmin(); }),
    statteam: run(async (v) => { S.adm.statTeam = v; await loadAdmin(); }),
    plteam(v) { S.adm.plTeam = v; render(); },
  };

  document.addEventListener('click', (ev) => {
    if (ev.target === $sheet) return closeSheet();
    const el = ev.target.closest('[data-a]');
    if (el && !el.disabled && actions[el.dataset.a]) actions[el.dataset.a](el.dataset, el);
  });
  document.addEventListener('submit', (ev) => {
    const f = ev.target.closest('[data-form]');
    if (!f) return;
    ev.preventDefault();
    run(forms[f.dataset.form])(Object.fromEntries(new FormData(f)), f);
  });
  document.addEventListener('change', (ev) => {
    const k = ev.target.dataset && ev.target.dataset.change;
    if (k && changes[k]) changes[k](ev.target.value);
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.dataset && ev.target.dataset.input === 'pq' && S.picker) {
      S.picker.q = ev.target.value;
      const tmp = document.createElement('div'); tmp.innerHTML = pickerSheet();
      document.getElementById('plist').innerHTML = tmp.querySelector('#plist').innerHTML;
    }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$sheet.hidden) closeSheet(); });

  // Vuelta desde Mercado Pago: confirmamos el pago sin esperar al aviso del servidor.
  async function handlePaymentReturn() {
    const qs = new URLSearchParams(location.search);
    if (!qs.has('pago')) return;
    history.replaceState(null, '', location.pathname);
    const paymentId = qs.get('payment_id') || qs.get('collection_id');
    if (qs.get('pago') === 'error') return toast('El pago no se completó.', true);
    if (!S.token || !paymentId || paymentId === 'null') return toast('Tu pago está en proceso. Los cambios se acreditan apenas se apruebe.');
    try {
      const r = await api('POST', '/api/payments/confirm', { payment_id: paymentId });
      if (r.status === 'approved') { S.tab = 'pin'; await refresh(); toast(r.credited ? `¡Pago aprobado! Sumaste ${r.credited} cambios.` : '¡Pago aprobado! Tus cambios ya están acreditados.'); }
      else toast('Tu pago está pendiente. Los cambios se acreditan apenas se apruebe.');
    } catch (e) { toast(e.message, true); }
  }

  load().then(render).then(handlePaymentReturn).catch((e) => {
    $app.innerHTML = `<div class="splash"><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
  });
})();
