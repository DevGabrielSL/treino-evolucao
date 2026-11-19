// Resumo de uma missão (tela de conclusão, histórico e cartão compartilhável).
import { liveGuidance, PRESET_DECKS } from '../engine/workout';
import { records, xp } from './progress';
import { classifyExercise } from '../legacy/balanced_coach.js';
import { seasonOf, seasonProgress } from './season';

const COVER: Record<string, string> = { peito: '01', biceps: '01', costas: '02', triceps: '02', ombros: '03', core: '03', pernas: '04' };

export function missionSummary(model: any, sessionId: string, goal = 4) {
  const e = model.entities;
  const session = e.sessions.find((x: any) => x.id === sessionId);
  const sets = model.sets.filter((x: any) => x.session_id === sessionId);
  const work = sets.filter((x: any) => ['effective', 'core', 'back_off'].includes(x.set_type));
  const volume = work.reduce((n: number, x: any) => n + (/^kg/.test(x.load_unit_original || '') && typeof x.load_value === 'number' && x.repetitions ? x.load_value * x.repetitions : 0), 0);
  const prs = records(e).events.filter((r: any) => r.session_id === sessionId);
  const ms = session?.started_at && session?.finished_at ? Date.parse(session.finished_at) - Date.parse(session.started_at) - (session.clock_paused_ms || 0) : (session?.duration_minutes ?? 0) * 60000;
  const without = { ...e, sets: e.sets.filter((x: any) => x.session_id !== sessionId), sessions: e.sessions.filter((x: any) => x.id !== sessionId) };
  const missionXp = xp(e).total - xp(without).total;
  const ids: string[] = session?.planned_variant_ids || [];
  const allDone = ids.length > 0 && ids.every(id => { const g = liveGuidance(session, id, e); return g.target === null || g.resolved >= g.target; });
  const beat = prs.length > 0 || sets.some((x: any) => x.xp_load_reference);
  const rating = 1 + (allDone ? 1 : 0) + (allDone && beat ? 1 : 0);
  const ratingText = ['', 'Missão cumprida', 'Missão completa', 'Missão perfeita'][rating];
  const deck = PRESET_DECKS.findIndex((d: any) => d.name === session?.name);
  const group = classifyExercise(model.exerciseMap.get(work[0]?.exercise_id)) || 'peito';
  const cover = deck >= 0 ? `deck-cover-0${deck + 1}.webp` : `deck-cover-${COVER[group] || '01'}.webp`;
  // Passe da temporada antes e depois desta missão (mesmo período da missão).
  const info = seasonOf(session?.date || undefined);
  const season = { number: info.number, name: info.name, before: seasonProgress(without, goal, info).tier, after: seasonProgress(e, goal, info).tier };
  return { session, sets, work, volume, prs, ms: Math.max(0, ms), missionXp, rating, ratingText, cover, season };
}
