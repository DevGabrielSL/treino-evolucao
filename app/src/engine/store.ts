// Ponte entre a interface React e o armazenamento atual (IndexedDB).
// Usa os mesmos módulos do app publicado: mesmo banco, mesmo formato de documento.
import { useSyncExternalStore } from 'react';
import { readSnapshot, saveSnapshot, emptyDocument, commit, merged, validateDocument } from '../legacy/store.js';
import { compute } from '../legacy/metrics.js';
import { markLoadBonus, xpReward } from '../legacy/principal_xp.js';

export type Doc = any;
export type Entities = any;
export type XpReward = { from: { total: number; level: number; progress: number }; to: { total: number; level: number; progress: number }; gain: number; finished: boolean; bonus: number } | null;

type State = { status: 'loading' | 'ready' | 'error'; doc: Doc | null; generation: number; model: any; error?: string; version: number };

let state: State = { status: 'loading', doc: null, generation: 0, model: null, version: 0 };
const listeners = new Set<() => void>();
const rewardListeners = new Set<(r: XpReward, message: string) => void>();
const savedListeners = new Set<() => void>();
let busy = false;

function emit() { for (const l of listeners) l(); }
function set(next: Partial<State>) { state = { ...state, ...next, version: state.version + 1 }; emit(); }

export async function loadDocument() {
  try {
    const snap = await readSnapshot();
    const doc = snap.document ?? emptyDocument();
    set({ status: 'ready', doc, generation: snap.generation, model: compute(doc) });
  } catch (err: any) {
    set({ status: 'error', error: err?.message || String(err) });
  }
}

/** Mesmo contrato do perform() do app atual: grava atomicamente e calcula o XP ganho. */
export async function perform(mutate: (draft: Doc) => void, message: string): Promise<boolean> {
  if (busy) throw new Error('Uma gravação já está em andamento. Tente novamente.');
  if (!state.doc) throw new Error('Dados ainda não carregados.');
  busy = true;
  let saved = false;
  try {
    const doc = state.doc;
    const previous = merged(doc);
    const previousSetIds = new Set(previous.sets.map((row: any) => row.id));
    const next = commit(doc, (draft: Doc) => {
      mutate(draft);
      for (const row of draft.overlay.sets) {
        if (previousSetIds.has(row.id) || row.set_type !== 'effective') continue;
        const session = draft.overlay.sessions.find((s: any) => s.id === row.session_id && s.status === 'in_progress');
        if (!session) continue;
        const variant = draft.overlay.exercise_variants.find((v: any) => v.id === row.variant_id)
          || previous.exercise_variants.find((v: any) => v.id === row.variant_id);
        markLoadBonus(row, session, variant, previous);
      }
    });
    const nextGeneration = await saveSnapshot(next, state.generation);
    const reward = xpReward(merged(doc), merged(next)) as XpReward;
    set({ doc: next, generation: nextGeneration, model: compute(next) });
    saved = true;
    for (const l of rewardListeners) l(reward, message);
    return true;
  } finally {
    busy = false;
    if (saved) for (const l of savedListeners) l();
  }
}

/** Grava um documento já validado (importação, sincronização, restauração). Mesmo controle de revisão. */
export async function replaceDocument(next: Doc, { preservePrevious = false } = {}) {
  validateDocument(next);
  const generation = await saveSnapshot(next, state.generation, { preservePrevious });
  set({ doc: next, generation, model: compute(next) });
}
/** Commit + gravação direta, sem XP (ajustes de sincronização e preferências internas). */
export async function commitDirect(mutate: (draft: Doc) => void, opts?: { preservePrevious?: boolean }) {
  if (!state.doc) throw new Error('Dados ainda não carregados.');
  await replaceDocument(commit(state.doc, mutate), opts);
}
export function isBusy() { return busy; }
export function onSaved(fn: () => void) { savedListeners.add(fn); return () => { savedListeners.delete(fn); }; }
export function onReward(fn: (r: XpReward, message: string) => void) { rewardListeners.add(fn); return () => { rewardListeners.delete(fn); }; }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function useStore() { return useSyncExternalStore(subscribe, () => state); }
export function getState() { return state; }
