// Backup, restauração e diagnóstico: mesmas regras do app atual.
import { getState, replaceDocument, isBusy } from './store';
import { validateDocument, readRecovery, requestDurableStorage, storageInfo, diagnoseIndexedDB, merged } from '../legacy/store.js';
import { encryptBackup, decodeBackup, downloadJSON } from '../legacy/backup.js';
import { fingerprintDocument, verifyExportedBackup } from '../legacy/integrity.js';
import { dateLocal } from '../legacy/metrics.js';
import { refreshRecovery } from './sheets';

type Confirm = (text: string) => Promise<boolean>;
let pending: { revision: number; fingerprint: string } | null = null;
export const pendingBackup = () => pending;

export async function exportBackup(kind: 'encrypted' | 'plain', password: string, confirm: Confirm) {
  if (isBusy()) throw new Error('Aguarde a operação anterior.');
  const snapshot = structuredClone(getState().doc), revision = snapshot.revision;
  const filename = `treino-evolucao-${dateLocal()}-rev${revision}`;
  if (kind === 'encrypted') {
    const encrypted = await encryptBackup(snapshot, password);
    pending = { revision, fingerprint: await fingerprintDocument(snapshot) };
    downloadJSON(encrypted, filename + '.criptografado.json');
  } else {
    if (!(await confirm('Este JSON terá seu histórico pessoal SEM CRIPTOGRAFIA. Deseja continuar?'))) return false;
    pending = { revision, fingerprint: await fingerprintDocument(snapshot) };
    downloadJSON(snapshot, filename + '.json');
  }
  return true;
}

export async function verifyBackup(file: File, password: string) {
  if (!pending) throw new Error('Exporte um backup antes de validar.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Backup excede 15 MB.');
  await verifyExportedBackup(await file.text(), password, pending);
  const next = structuredClone(getState().doc);
  next.last_backup_revision = Math.max(next.last_backup_revision, Math.min(next.revision, pending.revision));
  next.last_backup_at = new Date().toISOString();
  await replaceDocument(next);
  pending = null;
}

const hasData = () => { const m = merged(getState().doc); return m.sessions.length || m.sets.length || m.weigh_ins.length; };

export async function restoreFile(file: File, password: string, confirm: Confirm) {
  if (isBusy()) throw new Error('Aguarde a operação anterior.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Arquivo maior que o limite permitido de 15 MB.');
  const restored = await decodeBackup(JSON.parse(await file.text()), password);
  if (hasData() && !(await confirm(`ATENÇÃO: a importação substituirá todos os dados locais.\nArquivo: ${restored.base?.entities?.sessions?.length ?? 0} sessões legadas + ${restored.overlay.sessions.length} sessões locais; ${restored.base?.entities?.sets?.length ?? 0} séries legadas + ${restored.overlay.sets.length} séries locais.\nFaça antes um backup externo. A cópia local de recuperação não substitui um backup. Confirma?`))) return false;
  await replaceDocument(restored, { preservePrevious: true });
  pending = null; await refreshRecovery();
  return true;
}

export async function restorePrevious(confirm: Confirm) {
  if (isBusy()) throw new Error('Aguarde a operação anterior.');
  const previous = await readRecovery();
  if (!previous) throw new Error('Não existe cópia de recuperação.');
  validateDocument(previous);
  if (!(await confirm('Substituir o estado atual pelo estado anterior à última importação? Exporte um backup antes.'))) return false;
  await replaceDocument(previous, { preservePrevious: true });
  pending = null;
  return true;
}

export async function diagnose() {
  const database = await diagnoseIndexedDB();
  const worker = Boolean(navigator.serviceWorker?.controller);
  return { database, worker, network: navigator.onLine };
}
export { requestDurableStorage, storageInfo };
