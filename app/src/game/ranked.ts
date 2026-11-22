// Ranqueada pessoal: uma escada de divisões calculada só a partir do seu histórico.
// Não há servidor nem adversários online: cada missão é uma "partida" contra a sua própria constância.
// Nada é gravado; mudar uma regra aqui recalcula tudo de forma determinística.
import { liveGuidance } from '../legacy/principal_live.js';
import { monday, dateLocal } from '../legacy/metrics.js';
import { records } from './progress';
import { seasonOf } from './season';
import { isMission } from '../engine/home';

export const TIERS = [
  { key: 'ferro', name: 'Ferro', min: 0, color: '#9aa0aa' },
  { key: 'bronze', name: 'Bronze', min: 300, color: '#d0874a' },
  { key: 'prata', name: 'Prata', min: 600, color: '#dfe4ec' },
  { key: 'ouro', name: 'Ouro', min: 900, color: '#ffc54d' },
  { key: 'platina', name: 'Platina', min: 1200, color: '#5fe0c7' },
  { key: 'diamante', name: 'Diamante', min: 1500, color: '#7cc4ff' },
  { key: 'mestre', name: 'Mestre', min: 1800, color: '#b07bff' },
  { key: 'lenda', name: 'Lenda', min: 2200, color: '#ff2e93' },
];
const DIV = ['III', 'II', 'I'];
export const RULES = {
  base: 12, perStar: 6, perRecord: 8, maxRecords: 2,
  weekWin: 15, perMissing: 12, maxWeekLoss: 36, seasonKeep: 0.6,
};

export type Rank = { points: number; tier: typeof TIERS[number]; division: string | null; label: string; floor: number; ceil: number | null; index: number };

export function rankOf(points: number): Rank {
  let i = TIERS.length - 1; while (i > 0 && points < TIERS[i].min) i--;
  const tier = TIERS[i], top = i >= 6;
  if (top) { const ceil = TIERS[i + 1]?.min ?? null; return { points, tier, division: null, label: tier.name, floor: tier.min, ceil, index: i * 3 + 2 }; }
  const d = Math.min(2, Math.floor((points - tier.min) / 100));
  return { points, tier, division: DIV[d], label: `${tier.name} ${DIV[d]}`, floor: tier.min + d * 100, ceil: tier.min + (d + 1) * 100, index: i * 3 + d };
}

export type RankEvent = { kind: 'mission' | 'week' | 'season'; date: string; delta: number; points: number; label: string; detail: string; sessionId?: string; promoted?: string | null; demoted?: string | null };

const DAY = 86400000;
const addDays = (d: string, k: number) => new Date(Date.parse(d + 'T00:00:00Z') + k * DAY).toISOString().slice(0, 10);

/** Estrelas da missão (mesma regra da tela de conclusão): 1 cumprida, 2 completa, 3 completa com recorde. */
function stars(session: any, entities: any, prs: number) {
  const ids: string[] = session.planned_variant_ids || [];
  const allDone = ids.length > 0 && ids.every(id => { const g = liveGuidance(session, id, entities); return g.target === null || g.resolved >= g.target; });
  const beat = prs > 0 || entities.sets.some((x: any) => x.session_id === session.id && x.xp_load_reference);
  return 1 + (allDone ? 1 : 0) + (allDone && beat ? 1 : 0);
}

export function ranked(entities: any, goal = 4, today = dateLocal()) {
  const missions = entities.sessions.filter((s: any) => isMission(s) && s.date && s.date <= today)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)) || String(a.finished_at || '').localeCompare(String(b.finished_at || '')));
  const prsBy = new Map<string, number>();
  for (const e of records(entities).events) prsBy.set(e.session_id, (prsBy.get(e.session_id) || 0) + 1);
  const events: RankEvent[] = [];
  let points = 0, peak = 0;
  const seasons: { number: number; name: string; label: string; points: number }[] = [];
  const push = (ev: Omit<RankEvent, 'points' | 'promoted' | 'demoted'>) => {
    const before = rankOf(points);
    points = Math.max(0, points + ev.delta);
    const after = rankOf(points);
    peak = Math.max(peak, points);
    events.push({ ...ev, points, promoted: after.index > before.index && ev.kind !== 'season' ? after.label : null, demoted: after.index < before.index && ev.kind !== 'season' ? after.label : null });
  };
  if (!missions.length) return { rank: rankOf(0), points: 0, peak: 0, events, seasons, missions: 0 };

  const thisWeek = monday(today);
  let week = monday(missions[0].date);
  let season = seasonOf(missions[0].date).index;
  let i = 0;
  while (week <= thisWeek) {
    // Virada de temporada: mantém 60% dos pontos (reinício parcial, como numa nova temporada ranqueada).
    const s = seasonOf(week);
    if (s.index !== season) {
      const prev = seasonOf(addDays(week, -1));
      seasons.push({ number: prev.number, name: prev.name, label: rankOf(points).label, points });
      const keep = Math.round(points * RULES.seasonKeep);
      if (keep !== points) push({ kind: 'season', date: week, delta: keep - points, label: `Nova temporada · ${s.name}`, detail: `Reinício parcial: você mantém ${Math.round(RULES.seasonKeep * 100)}% dos pontos.` });
      season = s.index;
    }
    const end = addDays(week, 6);
    let count = 0;
    while (i < missions.length && missions[i].date <= end) {
      const m = missions[i++]; count++;
      const prs = prsBy.get(m.id) || 0, st = stars(m, entities, prs);
      const rec = Math.min(RULES.maxRecords, prs);
      const delta = RULES.base + RULES.perStar * (st - 1) + RULES.perRecord * rec;
      push({ kind: 'mission', date: m.date, delta, sessionId: m.id, label: m.name || 'Missão', detail: `${'★'.repeat(st)}${'☆'.repeat(3 - st)}${rec ? ` · ${rec} recorde${rec > 1 ? 's' : ''}` : ''}` });
    }
    // Fechamento da semana (só semanas já encerradas).
    if (week < thisWeek) {
      if (count >= goal) push({ kind: 'week', date: end, delta: RULES.weekWin, label: 'Semana vencida', detail: `${count}/${goal} missões` });
      else push({ kind: 'week', date: end, delta: -Math.min(RULES.maxWeekLoss, RULES.perMissing * (goal - count)), label: count ? 'Semana incompleta' : 'Semana sem treino', detail: `${count}/${goal} missões` });
    }
    week = addDays(week, 7);
  }
  return { rank: rankOf(points), points, peak, events, seasons, missions: missions.length };
}

/** Resultado de uma missão específica na ranqueada (para a tela de conclusão). */
export function missionRanked(entities: any, sessionId: string, goal = 4) {
  const r = ranked(entities, goal);
  const ev = r.events.find(e => e.sessionId === sessionId);
  return ev ? { delta: ev.delta, label: rankOf(ev.points).label, promoted: ev.promoted } : null;
}
