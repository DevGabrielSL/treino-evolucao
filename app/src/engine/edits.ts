// Edição de histórico, corpo, modelos e preferências: mesmas operações do app atual.
import { perform, getState } from './store';
import { makeId } from '../legacy/store.js';
import { dateLocal } from '../legacy/metrics.js';
import { mutateLocalSet, mutateLocalSession, repeatSessionAsDraft } from '../legacy/edit_ops.js';
import { correctLocalSetUnit } from '../legacy/principal_unit.js';
import { upsertRecovery, removeRecovery, changeWeighIn, removeWeighIn } from '../legacy/body.js';
import { getTemplates, addTemplate, renameTemplate, deleteTemplate, addTemplateItem, removeTemplateItem, moveTemplateItem, createTemplateFromSession, startTemplateSession } from '../legacy/template_ops.js';

const iso = (v: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) !== v) throw new Error('Informe uma data válida.'); return v; };
const num = (v: any, { min = 0, max = 100000, optional = true } = {}) => { const t = String(v ?? '').trim().replace(',', '.'); if (!t) { if (optional) return null; throw new Error('Preencha o valor numérico.'); } const n = Number(t); if (!Number.isFinite(n) || n < min || n > max) throw new Error('Número fora dos limites permitidos.'); return n; };
export const isLocalSet = (id: string) => getState().doc.overlay.sets.some((s: any) => s.id === id);
export const isLocalSession = (id: string) => getState().doc.overlay.sessions.some((s: any) => s.id === id);

export async function editSet(id: string, unit: string, v: { load: string; reps: string; type: string }) {
  if (!isLocalSet(id)) throw new Error('Esta série não é editável.');
  const load = num(v.load, { max: 10000, optional: false }), reps = num(v.reps, { min: 1, max: 500, optional: false });
  const rir = getState().doc.overlay.sets.find((r: any) => r.id === id).rir ?? null;
  await perform(d => correctLocalSetUnit(d, id, unit, makeId('variant'), { load_value: load, repetitions: reps, rir, set_type: v.type }, mutateLocalSet), 'Correção salva; os indicadores foram recalculados.');
}
export async function deleteSet(id: string) {
  if (!isLocalSet(id)) throw new Error('Uma série importada não pode ser modificada nesta versão.');
  await perform(d => { d.overlay.sets = d.overlay.sets.filter((x: any) => x.id !== id); }, 'Série removida.');
}
export async function editSession(id: string, name: string, notes: string) { await perform(d => mutateLocalSession(d, id, { name, notes }), 'Treino atualizado.'); }
export async function repeatSession(id: string) { const newId = makeId('session'); await perform(d => repeatSessionAsDraft(d, id, newId, dateLocal()), 'Novo treino iniciado com base no anterior.'); return newId; }

export async function addWeighIn(date: string, weight: string, notes: string) {
  const w = num(weight, { min: 20, max: 500, optional: false });
  await perform(d => d.overlay.weigh_ins.push({ id: makeId('weighin'), date: iso(date), weight_kg: w, goal_weight_kg_reported: null, notes: String(notes || '').trim(), provenance: { source: 'android_local' } }), 'Pesagem salva no dispositivo.');
}
export async function editWeighIn(id: string, date: string, weight: string, notes: string) {
  const w = num(weight, { min: 20, max: 500, optional: false }) as number;
  await perform(d => changeWeighIn(d, { id, date: iso(date), weight_kg: w, notes: String(notes || '').trim() }), 'Pesagem corrigida no dispositivo.');
}
export async function deleteWeighIn(id: string) { await perform(d => removeWeighIn(d, id), 'Pesagem excluída.'); }
export async function saveRecovery(v: { id?: string; date: string; sleep: string; energy: string; soreness: string; notes: string }) {
  const sleep = num(v.sleep, { min: 0, max: 24 }); if (sleep !== null && Math.abs(sleep * 4 - Math.round(sleep * 4)) > 0.00001) throw new Error('Sono: use intervalos de 15 minutos.');
  const energy = num(v.energy, { min: 1, max: 5 }), soreness = num(v.soreness, { min: 0, max: 10 });
  if (energy !== null && !Number.isInteger(energy) || soreness !== null && !Number.isInteger(soreness)) throw new Error('Energia e desconforto devem ser números inteiros.');
  const date = iso(v.date); if (date > dateLocal()) throw new Error('Registros futuros não são permitidos no diário.');
  const id = v.id || makeId('recovery');
  await perform(d => upsertRecovery(d, { id, date, sleep_hours: sleep, energy, soreness, notes: v.notes }), 'Diário de recuperação salvo.');
}
export async function deleteRecovery(id: string) { await perform(d => removeRecovery(d, id), 'Registro removido.'); }
export async function setWeeklyGoal(goal: number) { if (!Number.isInteger(goal) || goal < 1 || goal > 14) throw new Error('Meta semanal inválida.'); await perform(d => { d.settings.weekly_goal = goal; }, 'Meta semanal atualizada.'); }

export const templates = () => getTemplates(getState().doc);
export async function newTemplate(name: string) { const id = makeId('template'); await perform(d => addTemplate(d, { id, name }), 'Modelo criado.'); return id; }
export async function templateFromSession(sessionId: string, name: string) { const id = makeId('template'); await perform(d => createTemplateFromSession(d, { id, session_id: sessionId, name }), 'Modelo criado a partir do treino.'); return id; }
export const tpl = {
  rename: (id: string, name: string) => perform(d => renameTemplate(d, id, name), 'Modelo atualizado.'),
  remove: (id: string) => perform(d => deleteTemplate(d, id), 'Modelo excluído.'),
  addItem: (id: string, variant_id: string, sets: number, reps: number | null) => perform(d => addTemplateItem(d, id, { variant_id, target_sets: sets, target_reps: reps }), 'Exercício incluído no modelo.'),
  removeItem: (id: string, variant: string) => perform(d => removeTemplateItem(d, id, variant), 'Exercício removido do modelo.'),
  move: (id: string, variant: string, dir: -1 | 1) => perform(d => moveTemplateItem(d, id, variant, dir), 'Ordem atualizada.'),
  async start(id: string) { const session_id = makeId('session'); await perform(d => startTemplateSession(d, { template_id: id, session_id, date: dateLocal() }), 'Treino iniciado a partir do modelo.'); return session_id; },
};
