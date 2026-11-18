// Sincronização com o Google Sheets: mesmas regras e ordem do app atual (app.js),
// só separadas da interface. Nenhuma regra de envio, conferência ou conciliação foi alterada.
import { useSyncExternalStore } from 'react';
import { getState, commitDirect, replaceDocument, isBusy, onSaved } from './store';
import { validateDocument, hasRecovery } from '../legacy/store.js';
import { GOOGLE_CLIENT_ID, SHEET_ID } from '../legacy/sheets_config.js';
import { loadGoogleIdentity, authorize, authorized, disconnect, inspectSpreadsheet, uploadNewRows, COORDINATOR_GATE_MESSAGE } from '../legacy/sheet_sync_browser.js';
import { createAutomaticSyncScheduler } from '../legacy/automatic_sync.js';
import { stageInbound, detectOutboundDrift, planOutbound, mergeKnownRemoteIds } from '../legacy/sheet_sync_core.js';
import { coordinatorReady } from '../legacy/coordinator_client.js';
import { outboundSeriesLabel } from '../legacy/principal_sync_fix.js';

type S = { busy: boolean; error: string; report: any; preflight: any; recovery: boolean; message: string; v: number };
let st: S = { busy: false, error: '', report: null, preflight: null, recovery: false, message: '', v: 0 };
const ls = new Set<() => void>();
const set = (p: Partial<S>) => { st = { ...st, ...p, v: st.v + 1 }; ls.forEach(l => l()); };
export function useSheets() { return useSyncExternalStore(l => { ls.add(l); return () => { ls.delete(l); }; }, () => st); }
const doc = () => getState().doc;
type Confirm = (text: string) => Promise<boolean>;

export { SHEET_ID, COORDINATOR_GATE_MESSAGE, coordinatorReady, authorized };

export function pendingCount() {
  const d = doc(); if (!d) return { Treinos: 0, Series: 0, Peso: 0 };
  const done = new Set([...d.overlay.sessions, ...(d.base?.entities?.sessions || [])].filter((x: any) => x.status === 'completed').map((x: any) => x.id));
  const all: Record<string, any[]> = { Treinos: d.overlay.sessions.filter((x: any) => !x.provenance?.sheet && x.status === 'completed'), Series: d.overlay.sets.filter((x: any) => !x.provenance?.sheet && done.has(x.session_id)), Peso: d.overlay.weigh_ins.filter((x: any) => !x.provenance?.sheet) };
  const remoteIds = st.report?.remoteIds;
  return Object.fromEntries(Object.entries(all).map(([k, list]) => [k, remoteIds ? list.filter(x => !remoteIds[k]?.includes(x.id)).length : list.length])) as Record<string, number>;
}

export function outboundPreview(): string[] | null {
  if (!st.preflight) return null;
  if (st.preflight.checkedRevision !== doc().revision) return ['Prévia vencida após uma alteração local. Confira a planilha de novo.'];
  const plan = planOutbound(doc(), st.preflight.rows);
  return [...plan.Treinos.map((x: any) => 'Treino: ' + x.values[0] + ' · ' + x.values[2]), ...plan.Series.map((x: any) => outboundSeriesLabel(x.values)), ...plan.Peso.map((x: any) => 'Pesagem: ' + x.values[0] + ' · ' + x.values[1] + ' kg')];
}

const collectRemoteIds = (rows: any) => Object.fromEntries(Object.entries({ Treinos: 9, Series: 14, Peso: 6 }).map(([tab, pos]) => [tab, rows[tab].slice(1).map((x: any) => String(x[pos] || '')).filter(Boolean)]));

async function saveKnownRemoteIds(ledger: any) {
  if (JSON.stringify(doc().settings.sheet_sync?.known_remote_ids_v1) === JSON.stringify(ledger)) return;
  await commitDirect(d => { d.settings.sheet_sync = { ...d.settings.sheet_sync, known_remote_ids_v1: structuredClone(ledger) }; });
}
async function saveCoordinatorState(state: any) {
  await commitDirect(d => { d.settings.sheet_sync = { ...d.settings.sheet_sync, coordinator_v1: structuredClone(state) }; });
}

async function inspect() {
  if (!authorized()) throw new Error('Conecte o Google antes de consultar a planilha.');
  set({ preflight: null, report: null });
  const check = await inspectSpreadsheet(SHEET_ID, doc());
  const conflicts = detectOutboundDrift(doc(), check.rows);
  if (conflicts.length) throw new Error('Existem alterações locais em registros já presentes na planilha. Faça backup e revise antes de prosseguir: ' + conflicts.length);
  await saveKnownRemoteIds(mergeKnownRemoteIds(doc(), check.rows));
  check.checkedRevision = doc().revision;
  set({ preflight: check, report: { remoteCounts: check.preview.remoteCounts, remoteIds: collectRemoteIds(check.rows) } });
  return check;
}

export async function connect() {
  if (st.busy) return;
  try { await authorize(GOOGLE_CLIENT_ID); set({ error: '', message: 'Conta Google autorizada.' }); automatic.request('authorization'); }
  catch (err: any) { set({ error: err?.message || String(err) }); throw err; }
}
export function disconnectGoogle() { disconnect(); set({ error: '', preflight: null, message: 'Token Google descartado da memória.' }); }

export async function check() {
  if (st.busy) return; set({ busy: true });
  try { await inspect(); set({ error: '', message: 'Planilha consultada. Nenhuma linha foi alterada.' }); }
  catch (err: any) { set({ error: err?.message || String(err) }); throw err; }
  finally { set({ busy: false }); }
}

export async function importReadOnly() {
  if (isBusy() || st.busy) throw new Error('Já existe uma operação em andamento.');
  set({ busy: true, error: '' });
  try {
    const c = await inspect(), incoming = stageInbound(doc(), c.rows);
    validateDocument(incoming.next);
    await commitDirect(d => { d.base = incoming.next.base; d.overlay = incoming.next.overlay; }, { preservePrevious: true });
    set({ recovery: await hasRecovery(), message: 'Importação salva no dispositivo. Nenhum registro foi enviado para a planilha.' });
  } catch (err: any) { set({ error: err?.message || String(err) }); throw err; }
  finally { set({ busy: false }); }
}

export async function syncNow({ automatic: auto = false, confirm }: { automatic?: boolean; confirm?: Confirm } = {}): Promise<boolean> {
  if (!coordinatorReady()) { set({ error: COORDINATOR_GATE_MESSAGE }); return false; }
  if (auto && !doc().settings.sheet_sync?.last_write_confirmed_at) return false;
  if (isBusy() || st.busy) { if (!auto) throw new Error('Já existe uma gravação em andamento.'); return false; }
  set({ busy: true, error: '' });
  try {
    const initial = await inspect();
    const incoming = stageInbound(doc(), initial.rows);
    validateDocument(incoming.next);
    const totalIncoming = Object.values(incoming.add as Record<string, number>).reduce((a, b) => a + b, 0);
    const totalOutgoing = Object.values(initial.pending as Record<string, number>).reduce((a, b) => a + b, 0);
    if (totalOutgoing && !auto) {
      const planned = planOutbound(doc(), initial.rows);
      const names = planned.Treinos.slice(0, 4).map((x: any) => x.values[0] + ' · ' + x.values[2]).join('\n');
      const summary = 'Enviar para o Google Sheets: ' + planned.Treinos.length + ' treino(s), ' + planned.Series.length + ' série(s) e ' + planned.Peso.length + ' pesagem(ns).\n' + (names ? '\nSessões:\n' + names + '\n' : '') + '\nConfirme seu backup e a conta Google antes de continuar.';
      if (!confirm || !(await confirm(summary))) return false;
    }
    if (totalIncoming || incoming.reconciled?.rowsUpdated || incoming.reconciled?.baselineInitialized || incoming.reconciled?.fieldsUpdated || incoming.linked_legacy_sets || incoming.linked_legacy_sessions || incoming.linked_legacy_weights) {
      await commitDirect(d => { d.base = incoming.next.base; d.overlay = incoming.next.overlay; }, { preservePrevious: true });
      set({ recovery: await hasRecovery() });
    }
    const sent = await uploadNewRows(SHEET_ID, doc(), { onCheckpoint: saveKnownRemoteIds, onState: saveCoordinatorState });
    const c = await inspect();
    if (Object.values(c.pending as Record<string, number>).some(x => x > 0)) throw new Error('Há registros ainda pendentes: verifique a planilha antes de tentar novamente.');
    const when = new Date().toISOString();
    const verifiedWrite = Object.values(sent.written as Record<string, number>).some(x => x > 0);
    await commitDirect(d => { d.settings.sheet_sync = { ...d.settings.sheet_sync, last_success_at: when, spreadsheet_id: SHEET_ID, ...(verifiedWrite ? { last_write_confirmed_at: when } : {}) }; });
    set({ preflight: null, error: '', message: `Sincronizado: ${incoming.add.sessions} treinos importados; ${sent.written.Treinos} enviados; ${sent.written.Series} séries enviadas.` });
    return true;
  } catch (err: any) {
    const msg = err?.message || String(err);
    set({ error: msg });
    if (auto && /conflit|diverg|revis[aã]o|não pôde ser confirmado|recibo|duplicad|fórmula|formula|identidade|desapareceu/i.test(msg)) {
      try {
        await commitDirect(d => { d.settings.sheet_sync = { ...d.settings.sheet_sync, auto: false, auto_pause_reason: 'manual_review_required', auto_paused_at: new Date().toISOString() }; });
        set({ message: 'Sincronização automática pausada para revisão. Nenhum reenvio automático será realizado.' });
      } catch { /* mantém o erro original visível */ }
    }
    if (!auto) throw err;
    return false;
  } finally { set({ busy: false }); }
}

export async function toggleAuto(confirm: Confirm) {
  if (!coordinatorReady()) throw new Error(COORDINATOR_GATE_MESSAGE);
  const enabled = !doc().settings.sheet_sync?.auto;
  if (enabled && (!doc().settings.sheet_sync?.last_write_confirmed_at || doc().settings.sheet_sync?.spreadsheet_id !== SHEET_ID)) throw new Error('Faça primeiro uma gravação manual confirmada nesta planilha Google Sheets.');
  if (enabled && !(await confirm('Ativar envio automático de treinos concluídos e pesagens enquanto houver internet e autorização Google válida? Edições ou exclusões de registros já enviados exigirão revisão manual.'))) return;
  await commitDirect(d => { d.settings.sheet_sync = { ...d.settings.sheet_sync, auto: enabled, auto_pause_reason: enabled ? null : d.settings.sheet_sync?.auto_pause_reason }; });
  set({ message: enabled ? 'Envio automático ativado.' : 'Envio automático desativado.' });
}

const automatic = createAutomaticSyncScheduler({
  getSnapshot: () => ({ doc: doc(), sheetId: SHEET_ID, online: navigator.onLine, authorized: authorized(), busy: isBusy(), sheetsBusy: st.busy }),
  run: () => syncNow({ automatic: true }),
  delayMs: 1200,
  onFailure: (err: any) => set({ error: err?.message || String(err) }),
});

let started = false;
/** Mesmo comportamento de init() do app atual: carrega o Google em segundo plano e agenda o envio automático. */
export async function startSheets() {
  if (started) return; started = true;
  set({ recovery: await hasRecovery().catch(() => false) });
  if (navigator.onLine) loadGoogleIdentity().catch(() => {});
  if (authorized()) automatic.request('authorization');
  onSaved(() => automatic.request('save'));
  window.addEventListener('online', () => { set({}); automatic.request('online'); });
  window.addEventListener('offline', () => set({}));
}
export async function refreshRecovery() { set({ recovery: await hasRecovery() }); }
export { replaceDocument };
