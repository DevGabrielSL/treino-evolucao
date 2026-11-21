// Temporadas de 8 semanas. Tudo DERIVADO do histórico: nada é gravado nem sincronizado.
// O calendário é fixo (começa numa segunda-feira), então a mesma base gera sempre as mesmas temporadas.
import { xpState } from '../legacy/principal_xp.js';
import { monday, dateLocal } from '../legacy/metrics.js';
import { PRESET_DECKS } from '../legacy/principal_presets.js';
import { records } from './progress';
import { isMission } from '../engine/home';

export const SEASON_WEEKS = 8;
const EPOCH = '2026-01-05'; // segunda-feira; Temporada 1 = 05/01 a 01/03/2026
const DAY = 86400000;
const NAMES = ['Maré Alta', 'Neon Tropical', 'Asfalto Quente', 'Tempestade de Raios', 'Brisa da Marina', 'Lua no Píer', 'Céu de Fogo', 'Onda Elétrica'];
export const TIERS = 10;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const utc = (d: string) => Date.parse(d + 'T00:00:00Z');

export type SeasonInfo = { index: number; number: number; name: string; start: string; end: string; week: number; daysLeft: number; weekStarts: string[] };

export function seasonOf(date = dateLocal()): SeasonInfo {
  const index = Math.floor((utc(monday(date)) - utc(EPOCH)) / (7 * DAY) / SEASON_WEEKS);
  const start = iso(utc(EPOCH) + index * SEASON_WEEKS * 7 * DAY);
  const end = iso(utc(start) + (SEASON_WEEKS * 7 - 1) * DAY);
  const week = Math.min(SEASON_WEEKS, Math.floor((utc(date) - utc(start)) / (7 * DAY)) + 1);
  const weekStarts = Array.from({ length: SEASON_WEEKS }, (_, i) => iso(utc(start) + i * 7 * DAY));
  return { index, number: index + 1, name: NAMES[((index % NAMES.length) + NAMES.length) % NAMES.length], start, end, week, daysLeft: Math.max(0, Math.round((utc(end) - utc(date)) / DAY)), weekStarts };
}

/** Tamanho de cada faixa do passe: proporcional à meta semanal (≈ 340 XP por missão de deck completa).
 * Quem cumpre a meta todas as semanas com missões completas chega perto da faixa 10 no fim. */
export function tierSize(goal: number) { return Math.max(300, Math.round((goal * SEASON_WEEKS * 340) / TIERS / 50) * 50); }

export function tierName(tier: number) { return tier >= 10 ? 'Lendária' : tier >= 7 ? 'Ouro' : tier >= 4 ? 'Prata' : tier >= 1 ? 'Bronze' : 'Sem faixa'; }

export type Challenge = { id: string; title: string; desc: string; value: number; target: number; done: boolean; label: string; state?: 'locked' | 'active' | 'won' | 'lost' };

const WORKING = new Set(['effective', 'core', 'back_off']);

/** Recorte das entidades dentro do período, para reaproveitar a regra de XP do app. */
function slice(entities: any, start: string, end: string) {
  const sessions = entities.sessions.filter((s: any) => s.status === 'completed' && s.date >= start && s.date <= end);
  const ids = new Set(sessions.map((s: any) => s.id));
  const sets = entities.sets.filter((s: any) => ids.has(s.session_id));
  return { sessions, sets };
}

export function seasonProgress(entities: any, goal: number, info: SeasonInfo, today = dateLocal()) {
  const { sessions: all, sets } = slice(entities, info.start, info.end);
  const seasonXp = xpState({ sessions: all, sets }).total as number;
  const sessions = all.filter(isMission); // o desafio diário soma XP, mas não conta como missão
  const size = tierSize(goal);
  const tier = Math.min(TIERS, Math.floor(seasonXp / size));
  const weeks = info.weekStarts.map(w => sessions.filter((s: any) => monday(s.date) === w).length);
  const working = new Map(sets.filter((s: any) => WORKING.has(s.set_type) && Number(s.repetitions) > 0 && s.id).map((s: any) => [s.id, s]));
  const workingPerWeek = info.weekStarts.map(w => [...working.values()].filter((s: any) => monday(s.date) === w).length);
  const goalWeeks = weeks.filter(n => n >= goal).length;
  const deckCounts = PRESET_DECKS.map((d: any) => sessions.filter((s: any) => s.name === d.name).length);
  const prs = records(entities).events.filter((e: any) => e.date >= info.start && e.date <= info.end).length;
  const setTarget = goal * SEASON_WEEKS * 12;

  // Chefão: semana 8. Cumprir a meta e igualar a média semanal de séries das semanas anteriores.
  const finished = today > info.end;
  const before = workingPerWeek.slice(0, SEASON_WEEKS - 1);
  const active = before.filter(n => n > 0);
  const bar = Math.max(goal * 10, Math.round(active.reduce((a, b) => a + b, 0) / Math.max(1, active.length)));
  const lastWeekSets = workingPerWeek[SEASON_WEEKS - 1], lastWeekMissions = weeks[SEASON_WEEKS - 1];
  const bossWon = lastWeekMissions >= goal && lastWeekSets >= bar;
  const bossState: Challenge['state'] = bossWon ? 'won' : finished ? 'lost' : info.week < SEASON_WEEKS ? 'locked' : 'active';

  const challenges: Challenge[] = [
    { id: 'ritmo', title: 'Ritmo de cruzeiro', desc: `Cumpra a meta de ${goal} missões em 6 das 8 semanas.`, value: goalWeeks, target: 6, done: goalWeeks >= 6, label: `${Math.min(goalWeeks, 6)}/6 semanas` },
    { id: 'turne', title: 'Turnê pela cidade', desc: 'Conclua cada um dos 4 distritos pelo menos 2 vezes.', value: deckCounts.reduce((n: number, c: number) => n + Math.min(2, c), 0), target: 8, done: deckCounts.every((c: number) => c >= 2), label: `${deckCounts.filter((c: number) => c >= 2).length}/4 distritos` },
    { id: 'volume', title: 'Turno completo', desc: `Registre ${setTarget} séries de trabalho na temporada.`, value: working.size, target: setTarget, done: working.size >= setTarget, label: `${Math.min(working.size, setTarget)}/${setTarget}` },
    { id: 'recordes', title: 'Novos patamares', desc: 'Supere 3 cargas anteriores (só conta unidade confirmada).', value: prs, target: 3, done: prs >= 3, label: `${Math.min(prs, 3)}/3` },
    { id: 'chefao', title: 'Chefão da semana 8', desc: `Na última semana, conclua ${goal} missões e ${bar} séries de trabalho (a sua média semanal nesta temporada).`,
      value: (Math.min(lastWeekMissions, goal) / goal + Math.min(lastWeekSets, bar) / bar) / 2, target: 1, done: bossWon, state: bossState,
      label: `${Math.min(lastWeekMissions, goal)}/${goal} missões · ${Math.min(lastWeekSets, bar)}/${bar} séries` },
  ];
  return { info, xp: seasonXp, size, tier, next: tier >= TIERS ? null : (tier + 1) * size - seasonXp, weeks, workingPerWeek, challenges, missions: sessions.length, bar, bossState };
}

/** Temporadas anteriores que têm pelo menos uma missão concluída, mais recentes primeiro. */
export function pastSeasons(entities: any, goal: number, today = dateLocal()) {
  const current = seasonOf(today).index;
  const seen = new Set<number>();
  for (const s of entities.sessions) if (isMission(s) && s.date) { const i = seasonOf(s.date).index; if (i < current) seen.add(i); }
  return [...seen].sort((a, b) => b - a).map(i => {
    const start = iso(utc(EPOCH) + i * SEASON_WEEKS * 7 * DAY);
    const info = seasonOf(start);
    const p = seasonProgress(entities, goal, info, iso(utc(info.end) + DAY));
    return { info, tier: p.tier, xp: p.xp, missions: p.missions, challenges: p.challenges.filter(c => c.done).length, boss: p.bossState === 'won' };
  });
}

/** Domínio de cada distrito (deck): missões nas últimas 4 semanas, 1 por semana = 100%. */
export function districtControl(entities: any, today = dateLocal()) {
  const since = iso(utc(today) - 27 * DAY);
  return PRESET_DECKS.map((d: any) => {
    const n = entities.sessions.filter((s: any) => s.status === 'completed' && s.name === d.name && s.date >= since && s.date <= today).length;
    return Math.min(1, n / 4);
  });
}

/** Marcos da cidade: cada um acende com o total de missões concluídas. */
export const CITY_UNLOCKS = [
  { at: 1, label: 'Primeiro quarteirão' }, { at: 3, label: 'Quarteirão do porto' }, { at: 6, label: 'Avenida norte' },
  { at: 10, label: 'Roda-gigante do píer' }, { at: 15, label: 'Quarteirão da marina' }, { at: 25, label: 'Torres do centro' },
  { at: 40, label: 'Farol da orla' }, { at: 60, label: 'Quarteirão sul' }, { at: 85, label: 'Arranha-céu neon' },
  { at: 120, label: 'Letreiro da cidade' },
];
export function cityLights(missions: number) {
  const lit = CITY_UNLOCKS.filter(u => missions >= u.at).length;
  const next = CITY_UNLOCKS[lit] || null;
  return { lit, total: CITY_UNLOCKS.length, next, missing: next ? next.at - missions : 0 };
}
