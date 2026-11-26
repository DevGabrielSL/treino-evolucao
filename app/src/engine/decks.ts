// Decks personalizáveis. A personalização fica em doc.settings.deck_custom (no aparelho e no backup);
// os decks originais continuam no código e podem ser restaurados a qualquer momento.
// Cada item guarda só uma referência + a dose: 'var:<variação sua>', 'cat:<chave do catálogo>' ou 'home:<chave>'.
import { presetPlan, catalogItems } from '../legacy/principal_presets.js';
import { dateLocal } from '../legacy/metrics.js';
import { homeCatalog } from './home';
import { getState, perform } from './store';

const settingsNow = () => getState().doc?.settings || {};

export type DeckEntry = { ref: string; sets: number; min: number; max: number };
const LOAD_UNITS = ['kg', 'kg/lado', 'kg/halter', 'plaquetas', 'peso corporal'];
const norm = (x: any) => String(x ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const customOf = (settings: any, deckId: string): DeckEntry[] | null => {
  const c = settings?.deck_custom?.[deckId];
  return c && Array.isArray(c.items) && c.items.length ? c.items : null;
};

function doseFor(e: DeckEntry, timed: boolean, extra = '') {
  const unit = timed ? 'segundos' : 'repetições';
  return { sets: e.sets, min: e.min, max: e.max, unit, source: 'Deck personalizado por você.', effort: (timed ? 'Ritmo que mantém a técnica.' : 'Use carga adequada à sua técnica, mantendo repetições em reserva.') + extra, label: `Sugestão: ${e.sets} série(s) de ${e.min}–${e.max} ${unit}` };
}

function lastSet(entities: any, variantId: string) {
  const done = new Set(entities.sessions.filter((s: any) => s.status === 'completed' && s.date <= dateLocal()).map((s: any) => s.id));
  return entities.sets.filter((s: any) => s.variant_id === variantId && done.has(s.session_id) && s.set_type === 'effective' && Number.isFinite(s.load_value) && Number.isInteger(s.repetitions) && s.repetitions > 0)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))).at(-1) || null;
}

function fromVariant(entities: any, variant: any, e: DeckEntry) {
  const ex = entities.exercises.find((x: any) => x.id === variant.exercise_id);
  if (!ex) return null;
  const timed = variant.unit === 'segundos';
  return { group: ex.group || ex.muscle_group || 'outros', name: ex.name, equipment: variant.equipment_or_variation, unit: variant.unit, exercise_id: ex.id, variant_id: variant.id, is_catalog: false, last: timed ? null : lastSet(entities, variant.id), dose: doseFor(e, timed), ref: e.ref };
}

/** Transforma uma referência do deck em item de plano (mesmo formato dos decks prontos). */
export function resolveEntry(entities: any, e: DeckEntry) {
  const [kind, key] = [e.ref.slice(0, e.ref.indexOf(':')), e.ref.slice(e.ref.indexOf(':') + 1)];
  if (kind === 'var') {
    const v = entities.exercise_variants.find((x: any) => x.id === key);
    return v ? fromVariant(entities, v, e) : null;
  }
  if (kind === 'cat') {
    const item = catalogItems().find((i: any) => i.exercise_id === 'preset_ex_' + key);
    if (!item) return null;
    // Mesma regra dos decks prontos: usa a sua variação já confirmada com o mesmo nome e equipamento.
    const mine = entities.exercise_variants.find((v: any) => v.unit_confirmed === true && LOAD_UNITS.includes(v.unit) && (item.unit === 'a confirmar' || v.unit === item.unit)
      && norm(v.equipment_or_variation) === norm(item.equipment) && entities.exercises.some((x: any) => x.id === v.exercise_id && norm(x.name) === norm(item.name)));
    if (mine) { const r = fromVariant(entities, mine, e); if (r) return { ...r, group: item.group }; }
    return { ...item, dose: doseFor(e, false, /unilateral|afundo/.test(norm(item.name)) ? ' Repetições por lado.' : ''), ref: e.ref };
  }
  if (kind === 'home') {
    const item = homeCatalog(entities).find((i: any) => i.variant_id === 'home_var_' + key);
    if (!item) return null;
    const existing = entities.exercise_variants.find((v: any) => v.id === item.variant_id);
    if (existing) { const r = fromVariant(entities, existing, e); if (r) return { ...r, group: item.group }; }
    return { ...item, dose: doseFor(e, item.unit === 'segundos'), ref: e.ref };
  }
  return null;
}

/** Itens do deck pronto convertidos em referências (ponto de partida do editor). */
export function defaultEntries(deckId: string, entities: any): DeckEntry[] {
  return presetPlan(deckId, entities, dateLocal(), {}).items.map((i: any) => ({
    ref: i.is_catalog ? 'cat:' + String(i.exercise_id).replace(/^preset_ex_/, '') : 'var:' + i.variant_id,
    sets: i.dose.sets, min: i.dose.min, max: i.dose.max,
  }));
}

export function deckEntries(deckId: string, model: any, settings: any = settingsNow()): DeckEntry[] {
  return customOf(settings, deckId) || defaultEntries(deckId, model.entities);
}

/** Plano do deck: o personalizado, se existir; senão o pronto. */
export function deckPlan(deckId: string, model: any, settings: any = settingsNow()) {
  const base = presetPlan(deckId, model.entities, dateLocal(), {});
  const custom = customOf(settings, deckId);
  if (!custom) return base;
  const seen = new Set<string>();
  const items = custom.map(e => resolveEntry(model.entities, e)).filter((i: any) => i && !seen.has(i.variant_id) && seen.add(i.variant_id));
  const groups = [...new Set(items.filter((x: any) => x.group !== 'core').map((x: any) => x.group))];
  return { ...base, items, options: items, groups, budget: items.length, custom: true };
}

export function validateEntries(list: DeckEntry[]) {
  if (!Array.isArray(list) || list.length < 1 || list.length > 18) throw new Error('O deck precisa ter de 1 a 18 exercícios.');
  const refs = new Set<string>();
  for (const e of list) {
    if (!e || typeof e.ref !== 'string' || !/^(var|cat|home):.{1,160}$/.test(e.ref) || refs.has(e.ref)) throw new Error('Exercício repetido ou inválido no deck.');
    refs.add(e.ref);
    if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 10) throw new Error('Séries: de 1 a 10 por exercício.');
    if (!Number.isInteger(e.min) || !Number.isInteger(e.max) || e.min < 1 || e.max < e.min || e.max > 3600) throw new Error('Faixa inválida: o mínimo precisa ser menor ou igual ao máximo.');
  }
  return true;
}

export async function saveDeck(deckId: string, list: DeckEntry[]) {
  validateEntries(list);
  await perform(d => { d.settings.deck_custom = { ...(d.settings.deck_custom || {}), [deckId]: { items: list.map(e => ({ ref: e.ref, sets: e.sets, min: e.min, max: e.max })), updated_at: new Date().toISOString() } }; }, 'Deck salvo.');
}

export async function resetDeck(deckId: string) {
  await perform(d => { const c = { ...(d.settings.deck_custom || {}) }; delete c[deckId]; d.settings.deck_custom = c; }, 'Deck restaurado ao padrão.');
}

/** Referência de deck para uma opção do seletor de exercícios. */
export function refForOption(o: { mine: boolean; item: any }) {
  const id = String(o.item.variant_id);
  if (o.mine) return 'var:' + id;
  if (id.startsWith('preset_var_')) return 'cat:' + id.slice('preset_var_'.length);
  if (id.startsWith('home_var_')) return 'home:' + id.slice('home_var_'.length);
  return 'var:' + id;
}
