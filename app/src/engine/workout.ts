// Fluxo de treino: as regras são as mesmas do app atual (app.js), só reorganizadas.
import { perform } from './store';
import { makeId } from '../legacy/store.js';
import { dateLocal } from '../legacy/metrics.js';
import { PRESET_DECKS, presetPlan } from '../legacy/principal_presets.js';
import { catalogEntities } from '../legacy/balanced_coach.js';
import { groupLabel } from '../legacy/coach_logic.js';
import { liveGuidance, nextPending, changeWorkoutPlan } from '../legacy/principal_live.js';
import { confirmSessionVariant, loadUnits } from '../legacy/principal_unit.js';
import { cancelLocalSession } from '../legacy/principal_cancel.js';
import { setPlankRunning, setWorkoutPaused, workoutElapsed, FINISHER_GOALS, finisherProgress, plankElapsed, recordFinisherSet } from '../legacy/principal_finisher.js';
import { balancedPlan, replacementFor } from '../legacy/principal_variety.js';
import { buildCoachPolicy } from '../legacy/coach_policy.js';
import { parseGoal } from '../legacy/coach_logic.js';
import { getState, commitDirect } from './store';
import { authorized, fetchCoachPlanRows } from '../legacy/sheet_sync_browser.js';
import { SHEET_ID } from '../legacy/sheets_config.js';
import { undoLastDraftSet, lastDraftSet, correctLastDraftSet } from '../legacy/coach_commands.js';
import { restTimer } from '../legacy/principal_rest.js';

export { PRESET_DECKS, liveGuidance, nextPending, loadUnits, restTimer, lastDraftSet, FINISHER_GOALS, finisherProgress, plankElapsed, replacementFor };

export const DECK_TITLES = ['Peito + Bíceps', 'Costas + Tríceps', 'Braços + Ombros', 'Pernas completas'];

export function activeSession(model: any) {
  return model?.entities.sessions.filter((s: any) => s.status === 'in_progress').at(-1) || null;
}

export function planFor(presetId: string, model: any) {
  return presetPlan(presetId, model.entities, dateLocal(), {});
}

export async function startMission(presetId: string, model: any): Promise<string> {
  return startPlan(planFor(presetId, model), model);
}

/** Mesma regra do botão "Confirmar deck e começar treino" do app atual. */
export async function startPlan(plan: any, model: any): Promise<string> {
  if (activeSession(model)) throw new Error('Conclua ou cancele o treino atual antes de escolher outra missão.');
  if (!plan?.items?.length) throw new Error('Esta missão não tem exercícios disponíveis.');
  if (plan.adjustment?.blocked) throw new Error('Montagem suspensa pelo relato de dor.');
  const ids = plan.items.map((x: any) => x.variant_id), group = groupLabel(plan.groups), id = makeId('session');
  await perform(d => {
    const catalog = catalogEntities(plan.items);
    // Itens com unidade já definida (peso corporal, tempo) dispensam a confirmação de unidade.
    for (const v of catalog.variants) if (plan.items.some((i: any) => i.variant_id === v.id && i.unit_confirmed === true)) v.unit_confirmed = true;
    const allEx = [...(d.base?.entities?.exercises || []), ...d.overlay.exercises];
    const allVar = [...(d.base?.entities?.exercise_variants || []), ...d.overlay.exercise_variants];
    for (const ex of catalog.exercises) { const existing = allEx.find((x: any) => x.id === ex.id); if (existing && existing.name !== ex.name) throw new Error('Identificador de exercício já está em uso.'); if (!existing) d.overlay.exercises.push(ex); }
    for (const v of catalog.variants) { const existing = allVar.find((x: any) => x.id === v.id); if (existing && existing.exercise_id !== v.exercise_id) throw new Error('Identificador de variação já está em uso.'); if (!existing) d.overlay.exercise_variants.push(v); }
    const available = new Set([...(d.base?.entities?.exercise_variants || []), ...d.overlay.exercise_variants].map((v: any) => v.id));
    if (ids.some((x: string) => !available.has(x))) throw new Error('Um exercício do roteiro não está mais disponível.');
    d.overlay.sessions.push({
      id, date: dateLocal(), name: plan.presetName || group + ' · Assistente', status: 'in_progress', started_at: new Date().toISOString(),
      duration_minutes: null, body_weight_kg: null, lower_back_pain_before: null, lower_back_pain_after: null,
      notes: 'Sessão iniciada pelo assistente local. Sugestões (não realizadas): ' + plan.items.filter((x: any) => x.dose).map((x: any) => x.name + ': ' + x.dose.label).join('; '),
      planned_guidance: Object.fromEntries(plan.items.filter((x: any) => x.dose).map((x: any) => [x.variant_id, { ...x.dose }])),
      planned_variant_ids: ids, provenance: { source: 'android_local' },
    });
  }, 'Missão iniciada e salva no celular.');
  return ids[0];
}

export type Readiness = { fatigue: string; recovery: string; area: string; pain: string };
/** Missão personalizada: mesmo caminho do assistente do app atual (regras da aba Plano + equilíbrio por histórico). */
export async function buildCustomPlan(groupsText: string, minutes: number | null, readiness: Readiness) {
  const doc = getState().doc;
  const notes: string[] = [];
  if (authorized() && navigator.onLine) {
    try {
      const updated = await fetchCoachPlanRows(SHEET_ID);
      if (JSON.stringify(doc.settings.coach_plan_rules || {}) !== JSON.stringify(updated)) await commitDirect(d => { d.settings.coach_plan_rules = updated; });
    } catch { notes.push('Não consegui atualizar a aba Plano agora; usei as regras locais já salvas.'); }
  }
  const input = groupsText + (minutes ? ` ${minutes} minutos` : '');
  const rawGroups = parseGoal(input);
  const cached = getState().doc.settings.coach_plan_rules || {};
  const m = getState().model;
  const planEntities = { ...m.entities, plan_parameters: [...(cached.plan_parameters || []), ...(m.entities.plan_parameters || [])], training_rules: [...(cached.training_rules || []), ...(m.entities.training_rules || [])], weekly_schedule: [...(cached.weekly_schedule || []), ...(m.entities.weekly_schedule || [])] };
  const policy = buildCoachPolicy(planEntities, getState().doc.settings.coach_preferences || {});
  const groups = policy.orderGroups(rawGroups);
  const proposal = balancedPlan(m.entities, groups, input, { ranker: policy.evaluate, today: dateLocal(), readiness });
  return { ...proposal, notes: [...(policy.notes || []), ...notes] };
}

/** Pular, devolver, trocar ou remover exercício do roteiro (mesmas regras do app atual). */
export async function changePlan(session: any, current: string, action: 'skip' | 'undo-skip' | 'swap' | 'remove', replacement?: string) {
  const msg = { skip: 'Série pulada.', 'undo-skip': 'Série devolvida ao roteiro.', swap: 'Exercício trocado. Séries anteriores preservadas.', remove: 'Exercício removido do roteiro.' }[action];
  await perform(d => changeWorkoutPlan(d, { sessionId: session.id, current, replacement, action }), msg);
}

/** Cadastro de exercício/variação (mesma regra do formulário do app atual). */
export async function registerExercise(model: any, name: string, equipment: string, unit: string) {
  name = name.trim(); equipment = equipment.trim();
  if (!name || !equipment || name.length > 100 || equipment.length > 100) throw new Error('Informe nome e equipamento válidos.');
  const old = model.entities.exercises.find((z: any) => z.name.toLowerCase() === name.toLowerCase());
  const exid = old?.id || makeId('exercise'), vid = makeId('variant');
  await perform(d => {
    if (!old) d.overlay.exercises.push({ id: exid, name, muscle_group: null, classification_verified: false, notes: null });
    d.overlay.exercise_variants.push({ id: vid, exercise_id: exid, equipment_or_variation: equipment, unit, unit_confirmed: unit !== 'outra', comparison_group_id: vid, comparison_policy: 'match_same_variant_only' });
  }, 'Exercício cadastrado.');
  return vid;
}

/* ---- Bloco final ---- */
export async function recordFinisher(session: any, key: string, v: { load: number; reps: number; kind: string; unit: string }) {
  await perform(d => recordFinisherSet(d, session.id, key, { id: makeId('set'), now: Date.now(), ...v }), 'Série do bloco final salva.');
}
export async function plank(session: any, running: boolean) {
  await perform(d => setPlankRunning(d, session.id, running, { id: makeId('set') }), running ? 'Prancha contando.' : 'Trecho de prancha salvo.');
}
export async function removeFinisherRow(session: any, setId: string) {
  await perform(d => {
    const s = d.overlay.sessions.find((x: any) => x.id === session.id && x.status === 'in_progress'); if (!s) throw new Error('Treino encerrado.');
    const i = d.overlay.sets.findIndex((x: any) => x.id === setId && x.session_id === session.id && x.finisher_key); if (i < 0) throw new Error('Registro indisponível.');
    d.overlay.sets.splice(i, 1);
  }, 'Registro removido e meta recalculada.');
}

/** Confirma a unidade de carga de uma variante antes do primeiro registro (mesma regra do app atual). */
export async function confirmUnit(session: any, variant: any, unit: string): Promise<string> {
  let created: any;
  await perform(d => { created = confirmSessionVariant(d, { sessionId: session.id, sourceId: variant.id, newId: makeId('variant'), equipment: variant.equipment_or_variation, unit }); }, 'Unidade confirmada.');
  return created.id;
}

export type SetInput = { load: number; reps: number; kind: 'effective' | 'warmup'; rir?: number | null; drops?: { load: number; reps: number }[] };

export async function logSet(session: any, variant: any, model: any, input: SetInput) {
  const { load, reps, kind, drops = [], rir = null } = input;
  // O coordenador da planilha aceita RIR de 0 a 10 (mesma faixa do assistente).
  if (rir !== null && (!Number.isInteger(rir) || rir < 0 || rir > 10)) throw new Error('RIR deve ser um número inteiro de 0 a 10.');
  if (!Number.isInteger(reps) || reps < 1 || reps > 500 || !(load >= 0) || load > 10000) throw new Error('Confira carga e repetições.');
  if (!session.planned_variant_ids?.includes(variant.id)) throw new Error('Escolha um exercício desta missão.');
  if (drops.length && kind !== 'effective') throw new Error('Use Trabalho para registrar um drop set.');
  let previous = load;
  for (const p of drops) { if (!(p.load < previous) || !Number.isInteger(p.reps) || p.reps < 1 || p.reps > 500) throw new Error('Cada redução exige carga menor que a anterior e de 1 a 500 repetições.'); previous = p.load; }
  if (drops.length > 8) throw new Error('Limite de oito reduções por série.');
  const number = model.sets.filter((s: any) => s.session_id === session.id && s.variant_id === variant.id).reduce((n: number, s: any) => Math.max(n, s.set_number || 0), 0) + 1;
  await perform(d => {
    const s = d.overlay.sessions.find((x: any) => x.id === session.id && x.status === 'in_progress');
    if (!s) throw new Error('O treino já foi concluído; não é possível adicionar séries.');
    const row = {
      recorded_at: new Date().toISOString(), id: makeId('set'), date: s.date, session_id: s.id, session_name_original: s.name,
      exercise_id: variant.exercise_id, variant_id: variant.id, set_type: kind, set_type_original: null, set_number: number,
      load_value: load, load_unit_original: variant.unit, repetitions: reps, rir, rpe: null, legacy_volume_index: null,
      discomfort: null, notes: null, provenance: { source: 'android_local' },
    };
    d.overlay.sets.push(row, ...drops.map((p, i) => ({ ...row, id: makeId('set'), set_type: 'drop_set', set_number: number + i + 1, load_value: p.load, repetitions: p.reps, rir: null, notes: 'Drop de ' + row.id })));
  }, 'Série salva no celular.');
  if (restTimer.state(session.id).auto) restTimer.start(session.id);
}

/** Série por tempo (ex.: prancha no roteiro). Formato aceito pelo coordenador da planilha:
 *  unidade "segundos", carga 0, repetições vazias e nota "Tempo · N segundos". */
export async function logTimed(session: any, planned: any, seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) throw new Error('Informe de 1 a 3600 segundos.');
  if (!session.planned_variant_ids?.includes(planned.id)) throw new Error('Escolha um exercício desta missão.');
  const secs = Math.round(seconds * 100) / 100;
  await perform(d => {
    const s = d.overlay.sessions.find((x: any) => x.id === session.id && x.status === 'in_progress');
    if (!s) throw new Error('O treino já foi concluído; não é possível adicionar séries.');
    const all = [...(d.base?.entities?.exercise_variants || []), ...d.overlay.exercise_variants];
    let v = all.find((x: any) => x.exercise_id === planned.exercise_id && x.unit === 'segundos' && x.equipment_or_variation === planned.equipment_or_variation);
    if (!v) { const id = makeId('variant'); v = { id, exercise_id: planned.exercise_id, equipment_or_variation: planned.equipment_or_variation, unit: 'segundos', unit_confirmed: true, comparison_group_id: id, comparison_policy: 'match_same_variant_only', provenance: { source: 'android_local' } }; d.overlay.exercise_variants.push(v); }
    const sets = [...(d.base?.entities?.sets || []), ...d.overlay.sets];
    const number = sets.filter((x: any) => x.session_id === s.id && x.variant_id === v.id).reduce((n: number, x: any) => Math.max(n, x.set_number || 0), 0) + 1;
    d.overlay.sets.push({
      recorded_at: new Date().toISOString(), id: makeId('set'), date: s.date, session_id: s.id, session_name_original: s.name,
      exercise_id: v.exercise_id, variant_id: v.id, planned_variant_id: planned.id, set_type: 'core', set_type_original: null, set_number: number,
      load_value: 0, load_unit_original: 'segundos', repetitions: null, rir: null, rpe: null, legacy_volume_index: null, discomfort: null,
      duration_ms: Math.round(secs * 1000), notes: `Tempo · ${secs.toFixed(2)} segundos`, provenance: { source: 'android_local' },
    });
  }, 'Tempo salvo no celular.');
  if (restTimer.state(session.id).auto) restTimer.start(session.id);
}

/** Corrige a última série deste treino (mesma regra do comando "corrigir última" do assistente). */
export async function correctLast(session: any, v: { load: number; reps: number; rir: number | null; kind: string }) {
  if (!Number.isInteger(v.reps) || v.reps < 1 || v.reps > 500 || !(v.load >= 0) || v.load > 10000) throw new Error('Confira carga e repetições.');
  if (v.rir !== null && (!Number.isInteger(v.rir) || v.rir < 0 || v.rir > 10)) throw new Error('RIR deve ser um número inteiro de 0 a 10.');
  await perform(d => correctLastDraftSet(d, session.id, { load_value: v.load, repetitions: v.reps, rir: v.rir, set_type: v.kind }), 'Última série corrigida.');
}
export async function undoLast(session: any) { await perform(d => undoLastDraftSet(d, session.id), 'Última série desfeita.'); }

export async function finishMission(session: any) {
  await perform(d => {
    const s = d.overlay.sessions.find((x: any) => x.id === session.id && x.status === 'in_progress');
    if (!s) throw new Error('Sessão indisponível.');
    setPlankRunning(d, s.id, false, { id: makeId('set') }); setWorkoutPaused(d, s.id, false);
    s.finished_at = new Date().toISOString();
    const start = Date.parse(s.started_at || s.clock_started_at || '');
    if (Number.isFinite(start)) s.duration_minutes = Math.round(workoutElapsed(s, Date.parse(s.finished_at)) / 60000);
    s.status = 'completed';
  }, 'Missão concluída e salva no celular.');
  restTimer.stop(session.id);
}

export async function cancelMission(session: any) {
  await perform(d => cancelLocalSession(d, session.id), 'Treino cancelado. Séries preservadas no histórico.');
  restTimer.stop(session.id);
}

export async function togglePause(session: any) {
  await perform(d => setWorkoutPaused(d, session.id, !session.clock_paused_at), session.clock_paused_at ? 'Treino retomado.' : 'Treino pausado.');
}
export { workoutElapsed };
