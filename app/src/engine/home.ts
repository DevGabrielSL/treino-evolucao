// Treino em casa (peso corporal) e desafios diários.
// Os planos usam o mesmo formato dos decks; as séries seguem o formato aceito pela planilha:
// repetições com unidade "peso corporal" (carga extra, 0 = só o corpo) ou tempo em "segundos".
import { dateLocal } from '../legacy/metrics.js';

export const HOME_NAME = 'Treino em casa';
export const DAILY_NAME = 'Desafio diário';

/** Sessões que contam como "missão" na meta semanal, temporada e cidade (o desafio diário é extra). */
export const isMission = (s: any) => s?.status === 'completed' && s.name !== DAILY_NAME;

type Spec = { key: string; group: string; name: string; equipment: string; unit: 'peso corporal' | 'segundos'; min: number; max: number; sets: number; note?: string };

const HOME: Spec[] = [
  { key: 'polichinelo', group: 'cardio', name: 'Polichinelo', equipment: 'Peso corporal', unit: 'segundos', min: 30, max: 60, sets: 3 },
  { key: 'agachamento', group: 'pernas', name: 'Agachamento livre', equipment: 'Peso corporal', unit: 'peso corporal', min: 15, max: 25, sets: 3 },
  { key: 'flexao', group: 'peito', name: 'Flexão de braço', equipment: 'Peso corporal', unit: 'peso corporal', min: 8, max: 15, sets: 3, note: 'Se ficar pesado, apoie os joelhos.' },
  { key: 'afundo', group: 'pernas', name: 'Afundo alternado', equipment: 'Peso corporal', unit: 'peso corporal', min: 10, max: 15, sets: 3, note: 'Repetições por lado.' },
  { key: 'ponte', group: 'pernas', name: 'Ponte de glúteo', equipment: 'Peso corporal', unit: 'peso corporal', min: 15, max: 20, sets: 3 },
  { key: 'abdominal', group: 'core', name: 'Abdominal', equipment: 'Peso corporal · solo', unit: 'peso corporal', min: 15, max: 25, sets: 3 },
  { key: 'escalador', group: 'cardio', name: 'Escalador', equipment: 'Peso corporal', unit: 'segundos', min: 30, max: 45, sets: 3 },
  { key: 'prancha', group: 'core', name: 'Prancha', equipment: 'Peso corporal · antebraços', unit: 'segundos', min: 30, max: 60, sets: 3 },
];
const CARDIO: Spec = { key: 'cardio', group: 'cardio', name: 'Cardio livre', equipment: 'Esteira, bike, corrida ou polichinelo', unit: 'segundos', min: 300, max: 900, sets: 1, note: 'Use o cronômetro e salve o tempo total.' };

function item(spec: Spec, entities: any) {
  const variant_id = 'home_var_' + spec.key, exercise_id = 'home_ex_' + spec.key;
  const exists = (entities.exercise_variants || []).some((v: any) => v.id === variant_id);
  const timed = spec.unit === 'segundos';
  const done = new Set((entities.sessions || []).filter((s: any) => s.status === 'completed').map((s: any) => s.id));
  const last = timed ? null : (entities.sets || []).filter((s: any) => s.variant_id === variant_id && done.has(s.session_id) && s.set_type === 'effective' && Number.isInteger(s.repetitions))
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))).at(-1) || null;
  const dose = {
    sets: spec.sets, min: spec.min, max: spec.max, unit: timed ? 'segundos' : 'repetições',
    source: 'Treino em casa: peso corporal, sem carga presumida.',
    effort: (spec.note ? spec.note + ' ' : '') + (timed ? 'Ritmo que mantém a técnica.' : 'Pare com 1–2 repetições em reserva. Carga extra é opcional (0 = só o corpo).'),
    label: `Sugestão: ${spec.sets} série(s) de ${spec.min}–${spec.max} ${timed ? 'segundos' : 'repetições'}`,
  };
  // Unidade já conhecida: peso corporal e tempo não precisam de confirmação.
  return { group: spec.group, name: spec.name, equipment: spec.equipment, unit: spec.unit, exercise_id, variant_id, is_catalog: !exists, unit_confirmed: true, last, dose };
}

function plan(name: string, specs: Spec[], entities: any, note: string) {
  const items = specs.map(s => item(s, entities));
  return { presetId: name === HOME_NAME ? 'home' : 'daily', presetName: name, presetNote: note, groups: [...new Set(items.map(i => i.group))], items, minutes: null, budget: items.length, only: true, excluded: [], short: 0, options: items, adjustment: {}, notes: [] };
}

/** Exercícios de peso corporal/tempo para o catálogo de "adicionar exercício". */
export function homeCatalog(entities: any) { return [...HOME, CARDIO].map(s => item(s, entities)); }

export function homePlan(entities: any) {
  return plan(HOME_NAME, HOME, entities, 'Circuito sem equipamento: faça as 3 séries de cada exercício ou alterne os exercícios em rodadas.');
}

// ---------------- desafios diários ----------------
const norm = (x: any) => String(x ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const WORK = new Set(['effective', 'core', 'back_off']);
const secsOf = (s: any) => Number.isFinite(s.duration_ms) ? s.duration_ms / 1000 : Number((/(\d+(?:\.\d+)?) segundos$/.exec(String(s.notes || '')) || [])[1]) || 0;

export type Quest = { key: string; title: string; unit: 'reps' | 's'; target: number; value: number; done: boolean; match: RegExp; timed: boolean; spec: Spec };
const MAIN = [
  { key: 'abs', title: 'Abdominais', unit: 'reps' as const, target: 50, match: /abdominal/, timed: false, spec: HOME[5] },
  { key: 'plank', title: 'Prancha', unit: 's' as const, target: 120, match: /prancha/, timed: true, spec: HOME[7] },
  { key: 'cardio', title: 'Cardio', unit: 's' as const, target: 600, match: /polichinelo|escalador|cardio|corrida|esteira|bike|bicicleta|eliptico|pular corda|caminhada/, timed: true, spec: CARDIO },
];
const BONUS = [
  { key: 'pushup', title: 'Flexões', unit: 'reps' as const, target: 30, match: /flexao de braco/, timed: false, spec: HOME[2] },
  { key: 'squat', title: 'Agachamentos livres', unit: 'reps' as const, target: 50, match: /agachamento livre/, timed: false, spec: HOME[1] },
  { key: 'lunge', title: 'Afundos', unit: 'reps' as const, target: 30, match: /afundo/, timed: false, spec: HOME[3] },
  { key: 'bridge', title: 'Pontes de glúteo', unit: 'reps' as const, target: 40, match: /ponte de gluteo|elevacao pelvica/, timed: false, spec: HOME[4] },
];
const dayIndex = (d: string) => Math.floor(Date.parse(d + 'T12:00:00Z') / 86400000);

export type DailyTargets = { abs?: number; plank?: number; cardio?: number };
export const DAILY_DEFAULTS = { abs: 50, plank: 120, cardio: 600 };
export function questsFor(date: string, targets: DailyTargets = {}) {
  const main = MAIN.map(q => { const t = (targets as any)[q.key]; return Number.isInteger(t) && t > 0 ? { ...q, target: t } : q; });
  return [...main, BONUS[((dayIndex(date) % BONUS.length) + BONUS.length) % BONUS.length]];
}

/** Progresso do dia: soma séries de qualquer treino daquela data (academia, casa ou desafio). */
export function dailyQuests(entities: any, date = dateLocal(), targets: DailyTargets = {}): Quest[] {
  const exName = new Map((entities.exercises || []).map((e: any) => [e.id, norm(e.name)]));
  const live = new Set((entities.sessions || []).filter((s: any) => s.status !== 'cancelled' && s.date === date).map((s: any) => s.id));
  const rows = (entities.sets || []).filter((s: any) => live.has(s.session_id) && WORK.has(s.set_type));
  return questsFor(date, targets).map(q => {
    const mine = rows.filter((s: any) => q.match.test(String(exName.get(s.exercise_id) || '')));
    const raw = q.timed ? mine.reduce((n: number, s: any) => n + (s.load_unit_original === 'segundos' || Number.isFinite(s.duration_ms) ? secsOf(s) : 0), 0)
      : mine.reduce((n: number, s: any) => n + (Number.isInteger(s.repetitions) ? s.repetitions : 0), 0);
    const value = Math.floor(raw);
    return { ...q, value, done: value >= q.target };
  });
}

/** Dias seguidos com os 3 desafios principais completos (hoje conta se já completou). */
export function dailyStreak(entities: any, today = dateLocal(), targets: DailyTargets = {}) {
  const shift = (d: string, k: number) => new Date(Date.parse(d + 'T12:00:00Z') + k * 86400000).toISOString().slice(0, 10);
  const full = (d: string) => dailyQuests(entities, d, targets).slice(0, 3).every(q => q.done);
  let n = 0, d = full(today) ? today : shift(today, -1);
  while (n < 366 && full(d)) { n++; d = shift(d, -1); }
  return n;
}

/** Missão curta só com o que falta hoje (ou o pacote completo, se já fez tudo). */
export function dailyPlan(entities: any, date = dateLocal(), targets: DailyTargets = {}) {
  const qs = dailyQuests(entities, date, targets);
  const open = qs.filter(q => !q.done);
  const specs = (open.length ? open : qs).map(q => ({ ...q.spec, sets: q.key === 'cardio' ? 1 : q.timed ? 2 : 2 }));
  return plan(DAILY_NAME, specs, entities, 'Desafio rápido do dia. Conta para os desafios diários e para o XP, mas não para a meta semanal de missões.');
}
