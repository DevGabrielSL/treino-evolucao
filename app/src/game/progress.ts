// Camada de jogo: tudo é DERIVADO do histórico já salvo. Nada aqui grava dados,
// então a sincronização com o Google Sheets não muda.
import { xpState } from '../legacy/principal_xp.js';
import { isMission } from '../engine/home';
import { classifyExercise } from '../legacy/balanced_coach.js';
import { monday, dateLocal } from '../legacy/metrics.js';

const WORKING = new Set(['effective', 'core', 'back_off']);

export const RANKS = [
  'Recruta da Orla', 'Novato do Calçadão', 'Atleta de Bairro', 'Corredor da Avenida', 'Veterano do Píer',
  'Força da Marina', 'Titã do Boulevard', 'Chefe da Costa', 'Lenda do Litoral', 'Ícone da Cidade',
];
export function rankFor(level: number) { return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 3))]; }

export function xp(entities: any) { return xpState(entities) as { total: number; level: number; progress: number }; }
export const XP_PER_LEVEL = 500;

export const GROUPS: { key: string; label: string; short: string }[] = [
  { key: 'peito', label: 'Peito', short: 'PEI' },
  { key: 'costas', label: 'Costas', short: 'COS' },
  { key: 'pernas', label: 'Pernas', short: 'PER' },
  { key: 'ombros', label: 'Ombros', short: 'OMB' },
  { key: 'biceps', label: 'Bíceps', short: 'BÍC' },
  { key: 'triceps', label: 'Tríceps', short: 'TRÍ' },
  { key: 'core', label: 'Core', short: 'COR' },
];

function completedWork(entities: any) {
  const done = new Set(entities.sessions.filter((s: any) => s.status === 'completed').map((s: any) => s.id));
  const seen = new Set<string>();
  return entities.sets.filter((s: any) => {
    if (!done.has(s.session_id) || !WORKING.has(s.set_type) || !(s.repetitions > 0)) return false;
    if (s.id && seen.has(s.id)) return false; if (s.id) seen.add(s.id); return true;
  });
}

/** Atributo por grupo: nível pela soma histórica de séries de trabalho; "forma" pelas últimas 4 semanas. */
export function attributes(entities: any, today = dateLocal()) {
  const ex = new Map(entities.exercises.map((e: any) => [e.id, e]));
  const v = new Map(entities.exercise_variants.map((x: any) => [x.id, x]));
  const total: Record<string, number> = {}, recent: Record<string, number> = {};
  const cutoff = new Date(today + 'T12:00:00Z'); cutoff.setUTCDate(cutoff.getUTCDate() - 28);
  const since = cutoff.toISOString().slice(0, 10);
  for (const s of completedWork(entities)) {
    const e = ex.get((v.get(s.variant_id) as any)?.exercise_id || s.exercise_id);
    const g = classifyExercise(e); if (!g) continue;
    total[g] = (total[g] || 0) + 1;
    if (s.date >= since) recent[g] = (recent[g] || 0) + 1;
  }
  return GROUPS.map(g => {
    const sets = total[g.key] || 0;
    const level = Math.floor(Math.sqrt(sets / 2)) + 1;           // 2, 8, 18, 32… séries para subir
    const floor = 2 * (level - 1) ** 2, ceil = 2 * level ** 2;
    const form = Math.min(100, Math.round(((recent[g.key] || 0) / 40) * 100)); // ~10 séries/semana = 100%
    return { ...g, sets, level, progress: (sets - floor) / (ceil - floor), form, recent: recent[g.key] || 0 };
  });
}

/** Ritmo semanal: treinos concluídos na semana atual x meta, e sequência de semanas cumpridas. */
export function weeklyRhythm(entities: any, goal: number, today = dateLocal()) {
  const weeks = new Map<string, number>();
  for (const s of entities.sessions) if (isMission(s)) weeks.set(monday(s.date), (weeks.get(monday(s.date)) || 0) + 1);
  const current = monday(today), thisWeek = weeks.get(current) || 0;
  let streak = 0; const d = new Date(current + 'T12:00:00Z');
  if (thisWeek >= goal) streak++;
  for (;;) { d.setUTCDate(d.getUTCDate() - 7); if ((weeks.get(d.toISOString().slice(0, 10)) || 0) >= goal) streak++; else break; }
  return { thisWeek, goal, streak, stars: Math.min(5, Math.round((thisWeek / goal) * 5)) };
}

/** Recordes: maior carga por variante com unidade confirmada; marca se veio do treino informado. */
export function records(entities: any) {
  const v = new Map(entities.exercise_variants.map((x: any) => [x.id, x]));
  const ex = new Map(entities.exercises.map((e: any) => [e.id, e]));
  const best = new Map<string, any>();
  const rows = completedWork(entities).filter((s: any) => s.set_type === 'effective' && typeof s.load_value === 'number' && s.load_value > 0)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)) || String(a.recorded_at || '').localeCompare(String(b.recorded_at || '')));
  const prEvents: any[] = [];
  for (const s of rows) {
    const variant: any = v.get(s.variant_id); if (!variant?.unit_confirmed) continue;
    const old = best.get(s.variant_id);
    if (!old || s.load_value > old.load) {
      const rec = { variant_id: s.variant_id, exercise: (ex.get(variant.exercise_id) as any)?.name || 'Exercício', equipment: variant.equipment_or_variation, unit: variant.unit, load: s.load_value, reps: s.repetitions, date: s.date, session_id: s.session_id, previous: old?.load ?? null };
      if (old) prEvents.push(rec);
      best.set(s.variant_id, rec);
    }
  }
  return { best: [...best.values()].sort((a, b) => b.date.localeCompare(a.date)), events: prEvents.reverse() };
}

export function totals(entities: any) {
  const work = completedWork(entities);
  const tonnage = work.reduce((n: number, s: any) => n + (s.set_type === 'effective' && typeof s.load_value === 'number' && /^kg/.test(s.load_unit_original || '') ? s.load_value * s.repetitions : 0), 0);
  const missions = entities.sessions.filter(isMission).length;
  return { sets: work.length, tonnage, missions };
}

export type Achievement = { id: string; title: string; desc: string; done: boolean; progress: number; tier: 'bronze' | 'prata' | 'ouro' | 'lendario' };

export function achievements(entities: any, goal: number): Achievement[] {
  const t = totals(entities), r = records(entities), w = weeklyRhythm(entities, goal), x = xp(entities);
  const decks = new Set(entities.sessions.filter((s: any) => s.status === 'completed').map((s: any) => s.name));
  const hours = entities.sessions.filter((s: any) => s.status === 'completed' && s.started_at).map((s: any) => new Date(s.started_at).getHours());
  const a = (id: string, title: string, desc: string, value: number, target: number, tier: Achievement['tier']): Achievement =>
    ({ id, title, desc, done: value >= target, progress: Math.min(1, value / target), tier });
  return [
    a('first', 'Primeiro trampo', 'Conclua sua primeira missão.', t.missions, 1, 'bronze'),
    a('m10', 'Rotina na veia', 'Conclua 10 missões.', t.missions, 10, 'prata'),
    a('m50', 'Dono da quebrada', 'Conclua 50 missões.', t.missions, 50, 'ouro'),
    a('m150', 'Lenda do litoral', 'Conclua 150 missões.', t.missions, 150, 'lendario'),
    a('s100', 'Cem na conta', 'Registre 100 séries de trabalho.', t.sets, 100, 'bronze'),
    a('s1000', 'Mil e uma séries', 'Registre 1.000 séries de trabalho.', t.sets, 1000, 'ouro'),
    a('t10', 'Dez toneladas', 'Mova 10 t em séries de trabalho (kg).', t.tonnage, 10000, 'prata'),
    a('t100', 'Cem toneladas', 'Mova 100 t em séries de trabalho (kg).', t.tonnage, 100000, 'lendario'),
    a('pr1', 'Novo patamar', 'Supere sua maior carga em um exercício.', r.events.length, 1, 'bronze'),
    a('pr25', 'Colecionador de recordes', 'Bata 25 recordes de carga.', r.events.length, 25, 'ouro'),
    a('streak4', 'Mês no ritmo', 'Cumpra a meta semanal 4 semanas seguidas.', w.streak, 4, 'prata'),
    a('streak12', 'Temporada completa', 'Cumpra a meta semanal 12 semanas seguidas.', w.streak, 12, 'lendario'),
    a('decks', 'Turnê completa', 'Conclua os 4 decks prontos.', ['Peito', 'Costas', 'Braços', 'Pernas'].filter(k => [...decks].some((n: any) => String(n).includes(k))).length, 4, 'prata'),
    a('early', 'Antes do sol', 'Comece uma missão antes das 7h.', hours.some((h: number) => h < 7) ? 1 : 0, 1, 'bronze'),
    a('night', 'Turno da noite', 'Comece uma missão depois das 21h.', hours.some((h: number) => h >= 21) ? 1 : 0, 1, 'bronze'),
    a('lv10', 'Nome na cidade', 'Alcance o nível 10.', x.level, 10, 'ouro'),
  ];
}
