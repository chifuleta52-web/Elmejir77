// Reglas de puntaje y validación de equipos.

export const POSITIONS = ['ARQ', 'DEF', 'VOL', 'DEL'];
export const SQUAD_SHAPE = { ARQ: 2, DEF: 5, VOL: 5, DEL: 3 }; // 15 jugadores
export const FORMATIONS = {
  '4-4-2': { ARQ: 1, DEF: 4, VOL: 4, DEL: 2 },
  '4-3-3': { ARQ: 1, DEF: 4, VOL: 3, DEL: 3 },
  '3-4-3': { ARQ: 1, DEF: 3, VOL: 4, DEL: 3 },
  '3-5-2': { ARQ: 1, DEF: 3, VOL: 5, DEL: 2 },
  '4-5-1': { ARQ: 1, DEF: 4, VOL: 5, DEL: 1 },
  '5-3-2': { ARQ: 1, DEF: 5, VOL: 3, DEL: 2 },
  '5-4-1': { ARQ: 1, DEF: 5, VOL: 4, DEL: 1 },
};

const GOAL_POINTS = { ARQ: 6, DEF: 6, VOL: 5, DEL: 4 };
const CLEAN_SHEET = { ARQ: 4, DEF: 4, VOL: 1, DEL: 0 };

/** Puntos de un jugador en una fecha a partir de sus estadísticas. */
export function playerPoints(pos, s) {
  if (!s || !(s.minutes > 0)) return 0;
  let p = s.minutes >= 60 ? 2 : 1;
  p += (s.goals || 0) * GOAL_POINTS[pos];
  p += (s.assists || 0) * 3;
  if (s.minutes >= 60 && (s.conceded || 0) === 0) p += CLEAN_SHEET[pos];
  if (pos === 'ARQ' || pos === 'DEF') p -= Math.floor((s.conceded || 0) / 2);
  p += (s.pen_saved || 0) * 5;
  p -= (s.pen_missed || 0) * 2;
  p -= (s.own_goals || 0) * 2;
  p -= (s.yellow || 0) * 1;
  p -= (s.red || 0) * 3;
  if (s.mvp) p += 3;
  return p;
}

/**
 * Puntos de un equipo en una fecha.
 * lineup: { players:[15 ids], starters:[11 ids], captain_id }
 * playersById: Map id -> {pos}, statsById: Map id -> stats de la fecha.
 * Si un titular no jugó, entra el suplente del mismo puesto que sí haya jugado.
 * El capitán suma doble.
 */
export function lineupPoints(lineup, playersById, statsById) {
  const played = (id) => (statsById.get(id)?.minutes || 0) > 0;
  const bench = lineup.players.filter((id) => !lineup.starters.includes(id));
  const used = new Set();
  const detail = [];
  let total = 0;
  for (const id of lineup.starters) {
    const pl = playersById.get(id);
    if (!pl) continue;
    let scorer = id;
    let subFor = null;
    if (!played(id)) {
      const sub = bench.find((b) => !used.has(b) && playersById.get(b)?.pos === pl.pos && played(b));
      if (sub) { used.add(sub); scorer = sub; subFor = id; }
    }
    let pts = playerPoints(playersById.get(scorer).pos, statsById.get(scorer));
    const captain = scorer === lineup.captain_id;
    if (captain) pts *= 2;
    total += pts;
    detail.push({ id: scorer, pts, captain, subFor });
  }
  return { total, detail };
}

/** Valida un equipo completo. Devuelve un mensaje de error o null. */
export function validateSquad(sq, playersById, settings) {
  const { formation, players, starters, captain_id } = sq;
  const shape = FORMATIONS[formation];
  if (!shape) return 'Formación inválida.';
  if (!Array.isArray(players) || players.length !== 15 || new Set(players).size !== 15) return 'El equipo debe tener 15 jugadores distintos.';
  if (!Array.isArray(starters) || starters.length !== 11 || new Set(starters).size !== 11) return 'Tenés que elegir 11 titulares.';
  if (!starters.every((id) => players.includes(id))) return 'Los titulares deben pertenecer al plantel.';
  const count = { ARQ: 0, DEF: 0, VOL: 0, DEL: 0 };
  const perClub = {};
  let cost = 0;
  for (const id of players) {
    const p = playersById.get(id);
    if (!p || !p.active) return 'Hay un jugador que ya no está disponible.';
    count[p.pos]++;
    perClub[p.team_id] = (perClub[p.team_id] || 0) + 1;
    cost += p.price;
  }
  for (const pos of POSITIONS) {
    if (count[pos] !== SQUAD_SHAPE[pos]) return `El plantel debe tener ${SQUAD_SHAPE.ARQ} arqueros, ${SQUAD_SHAPE.DEF} defensores, ${SQUAD_SHAPE.VOL} volantes y ${SQUAD_SHAPE.DEL} delanteros.`;
  }
  if (Object.values(perClub).some((n) => n > settings.max_per_club)) return `Máximo ${settings.max_per_club} jugadores del mismo club.`;
  if (cost > settings.budget) return `Te pasaste del presupuesto ($${settings.budget}M).`;
  const sc = { ARQ: 0, DEF: 0, VOL: 0, DEL: 0 };
  for (const id of starters) sc[playersById.get(id).pos]++;
  for (const pos of POSITIONS) if (sc[pos] !== shape[pos]) return `Los titulares no coinciden con la formación ${formation}.`;
  if (!starters.includes(captain_id)) return 'El capitán debe ser titular.';
  return null;
}
