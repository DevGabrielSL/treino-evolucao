import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, ArrowUp, ChevronLeft, CloudUpload, Download, HardDrive, Info, LayoutList, Moon, Play, Plus, Scale, Settings2, ShieldCheck, Smartphone, Trash2, Pencil } from 'lucide-react';
import { useStore } from '../engine/store';
import { useSheets, pendingCount, outboundPreview, connect, disconnectGoogle, check, importReadOnly, syncNow, toggleAuto, authorized, coordinatorReady, COORDINATOR_GATE_MESSAGE, SHEET_ID } from '../engine/sheets';
import { exportBackup, verifyBackup, restoreFile, restorePrevious, diagnose, requestDurableStorage, storageInfo, pendingBackup } from '../engine/backup';
import { addWeighIn, editWeighIn, deleteWeighIn, saveRecovery, deleteRecovery, setWeeklyGoal, templates, newTemplate, tpl } from '../engine/edits';
import { activeSession, registerExercise, loadUnits } from '../engine/workout';
import { weightInsights, recoveryInsights, recoveryRecords } from '../legacy/body.js';
import { dateLocal } from '../legacy/metrics.js';
import { soundOn, setSound, sfx } from '../fx/sfx';
import { autoRest, setAutoRest } from './RestOverlay';
import { progressionOn, setProgression } from '../engine/progression';
import { notifySupported, restNotifyOn, setRestNotify } from '../fx/notify';
import { setRest as saveRest } from '../engine/workout';
import { ExerciseVisual } from './ExerciseVisual';
import { ask } from './Dialog';
import { nf } from './format';

type AppId = 'corpo' | 'sync' | 'backup' | 'modelos' | 'ajustes' | 'instalar' | 'sobre';
type Ctx = { model: any; doc: any; onError: (e: any) => void; toast: (m: string) => void; onGoWorkout: () => void };

const APPS: { id: AppId; label: string; icon: any; bg: string }[] = [
  { id: 'corpo', label: 'Corpo', icon: Scale, bg: 'from-[#ff6b3d] to-[#ff2e93]' },
  { id: 'sync', label: 'Sheets', icon: CloudUpload, bg: 'from-[#1ee8d6] to-[#2a7bff]' },
  { id: 'backup', label: 'Backup', icon: ShieldCheck, bg: 'from-[#7cf29a] to-[#13a36b]' },
  { id: 'modelos', label: 'Modelos', icon: LayoutList, bg: 'from-[#ffc54d] to-[#ff6b3d]' },
  { id: 'ajustes', label: 'Ajustes', icon: Settings2, bg: 'from-[#8d5cff] to-[#4b2a99]' },
  { id: 'instalar', label: 'Instalar', icon: Download, bg: 'from-[#ff2e93] to-[#8d5cff]' },
  { id: 'sobre', label: 'Sobre', icon: Info, bg: 'from-[#5a4b73] to-[#2a1342]' },
];

export function PhoneScreen({ onError, toast, onGoWorkout }: { onError: (e: any) => void; toast: (m: string) => void; onGoWorkout: () => void }) {
  const { model, doc } = useStore();
  const sheets = useSheets();
  const [app, setApp] = useState<AppId | null>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (sheets.message) toast(sheets.message); }, [sheets.message, toast]);
  const pending = pendingCount();
  const badges: Partial<Record<AppId, number>> = {
    sync: pending.Treinos + pending.Peso || 0,
    backup: doc.revision > doc.last_backup_revision ? 1 : 0,
  };
  const ctx: Ctx = { model, doc, onError, toast, onGoWorkout };
  const current = APPS.find(a => a.id === app);
  return (
    <div className="px-4 pb-32">
      <div className="relative rounded-[34px] border-[6px] border-[#1a1226] bg-black shadow-[0_30px_80px_-20px_rgba(141,92,255,.6)] overflow-hidden min-h-[70vh]">
        {/* papel de parede */}
        <div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_100%,rgba(255,107,61,.5),transparent),radial-gradient(60%_40%_at_80%_10%,rgba(141,92,255,.5),transparent),linear-gradient(180deg,#1a0b30,#3a0f3f)]" />
        {/* barra de status */}
        <div className="relative flex items-center justify-between px-5 pt-3 pb-2 num text-[13px] font-bold">
          <span>{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="h-5 w-20 rounded-full bg-black" />
          <span className="flex items-center gap-1.5 text-[11px]">{navigator.onLine ? '5G' : 'OFF'} <span className="flex items-end gap-[2px]">{[3, 5, 7, 9].map(h => <span key={h} className={`w-[3px] rounded-sm ${navigator.onLine ? 'bg-cream' : 'bg-white/30'}`} style={{ height: h }} />)}</span></span>
        </div>
        <AnimatePresence mode="wait">
          {!current ? (
            <motion.div key="home" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} className="relative px-5 pt-6 pb-8">
              <p className="hud-label text-[10px] text-haze text-center">{now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <p className="font-display text-6xl text-center leading-none mt-1">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              {(sheets.error || doc.settings.sheet_sync?.auto_pause_reason) && (
                <button onClick={() => setApp('sync')} className="mt-5 w-full rounded-2xl bg-black/50 backdrop-blur p-3 text-left text-sm border border-pink/30">
                  <span className="hud-label text-pink text-[10px]">Sheets · atenção</span><br />{sheets.error || 'Envio automático pausado para revisão.'}
                </button>
              )}
              <div className="grid grid-cols-4 gap-x-3 gap-y-5 mt-8">
                {APPS.map((a, i) => (
                  <motion.button key={a.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .04 }} whileTap={{ scale: .9 }}
                    onClick={() => { sfx.tap(); setApp(a.id); }} className="flex flex-col items-center gap-1.5">
                    <span className={`relative size-14 rounded-[18px] bg-gradient-to-br ${a.bg} grid place-items-center shadow-lg`}>
                      <a.icon size={26} className="text-white drop-shadow" />
                      {!!badges[a.id] && <span className="absolute -right-1.5 -top-1.5 min-w-5 h-5 px-1 rounded-full bg-pink text-[11px] num font-bold grid place-items-center border-2 border-black">{badges[a.id]}</span>}
                    </span>
                    <span className="text-[11px] font-hud font-semibold">{a.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key={current.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} className="relative bg-dusk/95 min-h-[64vh]">
              <div className={`flex items-center gap-2 px-3 py-3 bg-gradient-to-r ${current.bg}`}>
                <button onClick={() => setApp(null)} aria-label="Voltar à tela inicial do celular" className="size-9 grid place-items-center rounded-full bg-black/25"><ChevronLeft /></button>
                <current.icon size={20} /><span className="font-display uppercase text-2xl leading-[1.1]">{current.label}</span>
              </div>
              <div className="p-4 space-y-4">
                {app === 'corpo' && <BodyApp {...ctx} />}
                {app === 'sync' && <SyncApp {...ctx} />}
                {app === 'backup' && <BackupApp {...ctx} />}
                {app === 'modelos' && <TemplatesApp {...ctx} />}
                {app === 'ajustes' && <SettingsApp {...ctx} />}
                {app === 'instalar' && <InstallApp />}
                {app === 'sobre' && <AboutApp />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative mx-auto mb-2 mt-2 h-1.5 w-28 rounded-full bg-white/50" />
      </div>
    </div>
  );
}

/* ---------- componentes de formulário ---------- */
const Field = ({ label, children }: any) => <label className="block"><span className="hud-label text-[10px] text-haze">{label}</span><div className="mt-1">{children}</div></label>;
const inputCls = 'w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-[15px] outline-none focus:border-gold/60';
const Card = ({ title, children, tone }: any) => <section className={`rounded-2xl p-4 ${tone === 'warn' ? 'bg-gold/10 border border-gold/30' : tone === 'danger' ? 'bg-pink/10 border border-pink/30' : 'bg-white/5 border border-white/10'}`}>{title && <h3 className="font-display uppercase text-xl leading-[1.1] mb-3">{title}</h3>}{children}</section>;
const Btn = ({ children, onClick, disabled, kind = 'primary' }: any) => <button disabled={disabled} onClick={onClick} className={`w-full h-12 rounded-xl text-lg disabled:opacity-40 ${kind === 'primary' ? 'btn-sunset' : kind === 'danger' ? 'bg-pink/20 border border-pink/50 text-pink chip text-sm' : 'bg-white/10 border border-white/10 chip text-sm'}`}>{children}</button>;
const Row = ({ k, v }: any) => <div className="flex items-baseline gap-2 text-sm"><span className="text-haze">{k}</span><span className="flex-1 border-b border-dotted border-white/15" /><b className="num text-right">{v}</b></div>;
function useRun(onError: (e: any) => void) { const [busy, setBusy] = useState(false); return [busy, async (fn: () => Promise<any>) => { if (busy) return; setBusy(true); try { await fn(); } catch (e) { onError(e); } finally { setBusy(false); } }] as const; }

/* ---------- Corpo ---------- */
function BodyApp({ model, doc, onError }: Ctx) {
  const [busy, run] = useRun(onError);
  const today = dateLocal();
  const [w, setW] = useState({ id: '', date: today, weight: '', notes: '' });
  const [r, setR] = useState({ id: '', date: today, sleep: '', energy: '', soreness: '', notes: '' });
  const wi = weightInsights(model.weights, model.goal);
  const ri = recoveryInsights(recoveryRecords(doc), model.entities.sessions);
  const local = new Set(doc.overlay.weigh_ins.map((x: any) => x.id));
  const pts = wi.points.slice(-30);
  const lo = Math.min(...pts.map((p: any) => p.weight)), hi = Math.max(...pts.map((p: any) => p.weight));
  const W = 320, H = 120, x = (i: number) => 10 + (i * (W - 20)) / Math.max(1, pts.length - 1), y = (v: number) => H - 14 - ((v - lo) / Math.max(.5, hi - lo)) * (H - 28);
  return (
    <>
      <Card title="Peso">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[['Atual', wi.latest ? nf(wi.latest.weight_kg) + ' kg' : '—'], ['Semana', wi.weeklyDifference != null ? (wi.weeklyDifference > 0 ? '+' : '') + nf(wi.weeklyDifference) : '—'], ['Meta', model.goal ? nf(model.goal) + ' kg' : '—']].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-black/40 p-2 text-center"><p className="num text-lg font-extrabold">{v}</p><p className="hud-label text-[9px] text-haze">{k}</p></div>
          ))}
        </div>
        {pts.length >= 2 && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full mb-3">
            <path d={pts.map((p: any, i: number) => `${i ? 'L' : 'M'}${x(i)},${y(p.weight)}`).join(' ')} fill="none" stroke="#ff6b3d" strokeWidth="2.5" strokeLinejoin="round" />
            {model.goal && model.goal >= lo - 2 && <line x1="10" x2={W - 10} y1={y(model.goal)} y2={y(model.goal)} stroke="#7cf29a" strokeDasharray="4 4" opacity=".6" />}
            {pts.map((p: any, i: number) => <circle key={i} cx={x(i)} cy={y(p.weight)} r="2.5" fill="#ffc54d" />)}
          </svg>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Data"><input type="date" value={w.date} onChange={e => setW({ ...w, date: e.target.value })} className={inputCls} /></Field>
          <Field label="Peso (kg)"><input inputMode="decimal" value={w.weight} onChange={e => setW({ ...w, weight: e.target.value })} className={inputCls} placeholder="80,5" /></Field>
        </div>
        <div className="mt-2"><Field label="Observação"><input value={w.notes} onChange={e => setW({ ...w, notes: e.target.value })} className={inputCls} /></Field></div>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <Btn disabled={busy || !w.weight} onClick={() => run(async () => { w.id ? await editWeighIn(w.id, w.date, w.weight, w.notes) : await addWeighIn(w.date, w.weight, w.notes); setW({ id: '', date: today, weight: '', notes: '' }); })}>{w.id ? 'Salvar correção' : 'Registrar pesagem'}</Btn>
          {w.id && <button onClick={() => setW({ id: '', date: today, weight: '', notes: '' })} className="px-4 rounded-xl bg-white/10 chip text-sm">Cancelar</button>}
        </div>
        <ul className="mt-3 divide-y divide-white/5">
          {[...model.weights].reverse().slice(0, 8).map((p: any) => (
            <li key={p.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="num text-haze w-20">{p.date.split('-').reverse().join('/')}</span><b className="num flex-1">{nf(p.weight_kg)} kg</b>
              {local.has(p.id) && <>
                <button aria-label="Corrigir pesagem" onClick={() => setW({ id: p.id, date: p.date, weight: String(p.weight_kg), notes: p.notes || '' })} className="size-8 grid place-items-center rounded-md bg-white/10"><Pencil size={14} /></button>
                <button aria-label="Excluir pesagem" onClick={() => run(async () => { if (await ask('Excluir esta pesagem do celular?', { ok: 'Excluir', danger: true })) await deleteWeighIn(p.id); })} className="size-8 grid place-items-center rounded-md bg-white/10 text-pink"><Trash2 size={14} /></button>
              </>}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Recuperação">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[['Sono médio', ri.averageSleep != null ? nf(ri.averageSleep) + ' h' : '—'], ['Energia', ri.averageEnergy != null ? nf(ri.averageEnergy) + '/5' : '—'], ['Desconforto', ri.averageSoreness != null ? nf(ri.averageSoreness) + '/10' : '—']].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-black/40 p-2 text-center"><p className="num text-lg font-extrabold">{v}</p><p className="hud-label text-[9px] text-haze">{k}</p></div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Data"><input type="date" max={today} value={r.date} onChange={e => setR({ ...r, date: e.target.value })} className={inputCls} /></Field>
          <Field label="Sono (h)"><input inputMode="decimal" value={r.sleep} onChange={e => setR({ ...r, sleep: e.target.value })} className={inputCls} placeholder="7,5" /></Field>
        </div>
        <div className="mt-2"><span className="hud-label text-[10px] text-haze">Energia (1–5)</span>
          <div className="grid grid-cols-5 gap-1.5 mt-1">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setR({ ...r, energy: r.energy === String(n) ? '' : String(n) })} className={`h-10 rounded-lg num font-bold ${r.energy === String(n) ? 'bg-gold text-night' : 'bg-white/10'}`}>{n}</button>)}</div>
        </div>
        <div className="mt-2"><span className="hud-label text-[10px] text-haze">Desconforto muscular (0–10): <b className="text-cream">{r.soreness || '—'}</b></span>
          <input type="range" min="0" max="10" value={r.soreness || 0} onChange={e => setR({ ...r, soreness: e.target.value })} className="w-full accent-[#ff2e93]" />
        </div>
        <div className="mt-2"><Field label="Notas"><input value={r.notes} onChange={e => setR({ ...r, notes: e.target.value })} className={inputCls} /></Field></div>
        <div className="mt-3"><Btn disabled={busy} onClick={() => run(async () => { await saveRecovery(r); setR({ id: '', date: today, sleep: '', energy: '', soreness: '', notes: '' }); })}><Moon size={16} className="inline -mt-1 mr-1" />{r.id ? 'Salvar correção' : 'Salvar diário'}</Btn></div>
        <ul className="mt-3 divide-y divide-white/5">
          {ri.rows.slice(0, 7).map((x: any) => (
            <li key={x.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="num text-haze w-20">{x.date.split('-').reverse().join('/')}</span>
              <span className="num flex-1">{x.sleep_hours != null ? nf(x.sleep_hours) + 'h' : '—'} · E{x.energy ?? '—'} · D{x.soreness ?? '—'}</span>
              <button aria-label="Editar registro" onClick={() => setR({ id: x.id, date: x.date, sleep: x.sleep_hours != null ? String(x.sleep_hours) : '', energy: x.energy != null ? String(x.energy) : '', soreness: x.soreness != null ? String(x.soreness) : '', notes: x.notes || '' })} className="size-8 grid place-items-center rounded-md bg-white/10"><Pencil size={14} /></button>
              <button aria-label="Excluir registro" onClick={() => run(async () => { if (await ask('Excluir este registro do diário?', { ok: 'Excluir', danger: true })) await deleteRecovery(x.id); })} className="size-8 grid place-items-center rounded-md bg-white/10 text-pink"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

/* ---------- Google Sheets ---------- */
function SyncApp({ doc, onError }: Ctx) {
  const s = useSheets();
  const [, run] = useRun(onError);
  const auth = authorized(), ready = coordinatorReady();
  const ss = doc.settings.sheet_sync || {};
  const verifiedWrite = Boolean(ss.last_write_confirmed_at && ss.spreadsheet_id === SHEET_ID);
  const pending = pendingCount();
  const preview = s.preflight ? outboundPreview() : null;
  return (
    <>
      <Card>
        <div className="flex items-center gap-3">
          <span className={`size-3 rounded-full ${s.busy ? 'bg-gold animate-pulse' : s.error ? 'bg-pink' : auth ? 'bg-cash' : 'bg-white/30'}`} />
          <p className="font-hud font-bold text-lg">{s.busy ? 'Sincronizando…' : auth ? 'Conta Google autorizada' : 'Autorização Google necessária'}</p>
        </div>
        <div className="mt-3 space-y-1.5">
          <Row k="Última sincronização confirmada" v={ss.last_success_at ? new Date(ss.last_success_at).toLocaleString('pt-BR') : 'Nunca neste aparelho'} />
          <Row k="Na planilha (treinos/séries/pesagens)" v={s.report ? `${s.report.remoteCounts.Treinos} / ${s.report.remoteCounts.Series} / ${s.report.remoteCounts.Peso}` : 'Conferência pendente'} />
          <Row k="Locais sem confirmação*" v={`${pending.Treinos} / ${pending.Series} / ${pending.Peso}`} />
          <Row k="Envio automático" v={ss.auto ? 'Ativo' : 'Desligado'} />
        </div>
        <p className="text-[11px] text-haze mt-2">*Estimativa até a primeira leitura. Séries de treino ainda não concluído não são enviadas.</p>
      </Card>
      {!ready && <Card tone="warn"><p className="text-sm">{COORDINATOR_GATE_MESSAGE}</p></Card>}
      {s.error && <Card tone="danger"><p className="text-sm">{s.error}</p></Card>}
      {ss.auto_pause_reason && <Card tone="warn"><p className="text-sm">Envio automático pausado por conflito: confira a planilha antes de reativar.</p></Card>}
      {preview && <Card title="Prévia de envio" tone="warn"><p className="text-[11px] text-haze mb-2">Esta conferência não grava nada.</p>{preview.length ? preview.slice(0, 8).map(t => <p key={t} className="text-sm">{t}</p>) : <p className="text-sm">Nenhum registro novo do celular será enviado agora.</p>}{preview.length > 8 && <p className="text-xs text-haze mt-1">… e mais {preview.length - 8}.</p>}</Card>}
      <div className="grid grid-cols-2 gap-2">
        <Btn kind="secondary" disabled={s.busy} onClick={() => run(connect)}>{auth ? 'Reautorizar' : 'Conectar Google'}</Btn>
        <Btn kind="secondary" disabled={!auth || s.busy} onClick={() => run(check)}>Conferir planilha</Btn>
      </div>
      <Btn kind="secondary" disabled={!auth || s.busy} onClick={() => run(importReadOnly)}>Importar novidades da planilha</Btn>
      <Btn disabled={!ready || !auth || s.busy} onClick={() => run(() => syncNow({ confirm: t => ask(t, { ok: 'Enviar' }) }))}>Importar e enviar pendências</Btn>
      <Btn kind="secondary" disabled={!ready || !verifiedWrite || s.busy} onClick={() => run(() => toggleAuto(t => ask(t, { ok: 'Ativar' })))}>{ss.auto ? 'Desativar envio automático' : 'Ativar envio automático'}</Btn>
      {!verifiedWrite && <p className="text-[11px] text-haze">O envio automático só pode ser ativado depois da primeira gravação manual confirmada pelo Google Sheets.</p>}
      <Btn kind="secondary" disabled={!auth || s.busy} onClick={disconnectGoogle}>Desconectar desta sessão</Btn>
      <p className="text-[11px] text-haze">A planilha é a fonte principal. O app salva primeiro no celular e só confirma quando o Google Sheets responde e a leitura posterior encontra os registros. Em caso de divergência, o envio é interrompido.</p>
    </>
  );
}

/* ---------- Backup ---------- */
function BackupApp({ doc, onError, toast }: Ctx) {
  const [busy, run] = useRun(onError);
  const s = useSheets();
  const [pwd, setPwd] = useState(''), [vpwd, setVpwd] = useState(''), [rpwd, setRpwd] = useState('');
  const [vfile, setVfile] = useState<File | null>(null), [rfile, setRfile] = useState<File | null>(null);
  const [pendingVerify, setPendingVerify] = useState(!!pendingBackup());
  const behind = doc.revision - doc.last_backup_revision;
  return (
    <>
      <Card>
        <Row k="Revisão local" v={doc.revision} />
        <Row k="Último backup conferido" v={doc.last_backup_at ? new Date(doc.last_backup_at).toLocaleString('pt-BR') : 'Nenhum'} />
        <Row k="Alterações desde o backup" v={behind} />
      </Card>
      <Card title="Gerar backup">
        <p className="text-sm text-haze mb-2">Recomendado após cada treino. Guarde o arquivo fora do navegador.</p>
        <Field label="Senha (mínimo 10 caracteres)"><input type="password" autoComplete="new-password" value={pwd} onChange={e => setPwd(e.target.value)} className={inputCls} /></Field>
        <div className="mt-3 space-y-2">
          <Btn disabled={busy} onClick={() => run(async () => { if (await exportBackup('encrypted', pwd, ask)) { setPendingVerify(true); toast('Download solicitado. Selecione o arquivo baixado para conferir.'); } })}>Backup criptografado</Btn>
          <Btn kind="secondary" disabled={busy} onClick={() => run(async () => { if (await exportBackup('plain', '', t => ask(t, { ok: 'Exportar', danger: true }))) setPendingVerify(true); })}>JSON sem criptografia</Btn>
        </div>
        {pendingVerify && (
          <div className="mt-4 rounded-xl bg-gold/10 border border-gold/30 p-3 space-y-2">
            <p className="text-sm"><b>Verificação obrigatória:</b> selecione o arquivo que ficou em Downloads. Só uma cópia legível e idêntica é marcada como protegida.</p>
            <input type="file" accept=".json,application/json" onChange={e => setVfile(e.target.files?.[0] || null)} className="text-sm w-full" aria-label="Arquivo de backup baixado" />
            <input type="password" placeholder="Senha do arquivo (se criptografado)" value={vpwd} onChange={e => setVpwd(e.target.value)} className={inputCls} />
            <Btn kind="secondary" disabled={busy || !vfile} onClick={() => run(async () => { await verifyBackup(vfile!, vpwd); setPendingVerify(false); toast('Arquivo de backup validado e marcado como conferido.'); })}>Validar arquivo salvo</Btn>
          </div>
        )}
        <p className="text-[11px] text-haze mt-2">Sem a senha, um backup criptografado não pode ser recuperado.</p>
      </Card>
      <Card title="Importar / restaurar" tone="warn">
        <p className="text-sm mb-2">Aceita o histórico JSON da Etapa 2 e backups do app, inclusive criptografados. Substitui os dados locais: faça backup antes.</p>
        <input type="file" accept=".json,application/json" onChange={e => setRfile(e.target.files?.[0] || null)} className="text-sm w-full" aria-label="Arquivo para importar" />
        <input type="password" placeholder="Senha (só para backup criptografado)" value={rpwd} onChange={e => setRpwd(e.target.value)} className={inputCls + ' mt-2'} />
        <div className="mt-2"><Btn kind="danger" disabled={busy || !rfile} onClick={() => run(async () => { if (await restoreFile(rfile!, rpwd, t => ask(t, { ok: 'Substituir', danger: true }))) toast('Dados importados e conferidos.'); })}>Importar ou restaurar</Btn></div>
      </Card>
      {s.recovery && (
        <Card title="Recuperação de segurança" tone="danger">
          <p className="text-sm mb-2">Há uma cópia do estado anterior à última importação.</p>
          <Btn kind="danger" disabled={busy} onClick={() => run(async () => { if (await restorePrevious(t => ask(t, { ok: 'Restaurar', danger: true }))) toast('Estado anterior recuperado.'); })}>Restaurar estado anterior</Btn>
        </Card>
      )}
    </>
  );
}

/* ---------- Modelos ---------- */
function TemplatesApp({ model, onError, onGoWorkout }: Ctx) {
  const [busy, run] = useRun(onError);
  const list = templates();
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [add, setAdd] = useState({ variant: '', sets: '3', reps: '' });
  const variants = useMemo(() => model.entities.exercise_variants.filter((v: any) => v.unit_confirmed).map((v: any) => ({ v, label: `${model.exerciseMap.get(v.exercise_id)?.name || 'Exercício'} · ${v.equipment_or_variation} · ${v.unit}` })).sort((a: any, b: any) => a.label.localeCompare(b.label, 'pt-BR')), [model]);
  const t = list.find((x: any) => x.id === open);
  const active = activeSession(model);
  if (t) return (
    <>
      <button onClick={() => setOpen(null)} className="chip text-sm text-haze flex items-center gap-1"><ChevronLeft size={16} /> Modelos</button>
      <div className="flex items-center gap-2">
        <input defaultValue={t.name} onBlur={e => e.target.value !== t.name && run(() => tpl.rename(t.id, e.target.value))} className={inputCls + ' font-display uppercase text-xl'} aria-label="Nome do modelo" />
        <button aria-label="Excluir modelo" onClick={() => run(async () => { if (await ask(`Excluir o modelo "${t.name}"?`, { ok: 'Excluir', danger: true })) { await tpl.remove(t.id); setOpen(null); } })} className="size-11 shrink-0 grid place-items-center rounded-xl bg-pink/15 text-pink"><Trash2 size={18} /></button>
      </div>
      <ol className="space-y-2">
        {t.items.map((it: any, i: number) => {
          const v = model.variantMap.get(it.variant_id), ex = model.exerciseMap.get(v?.exercise_id);
          return (
            <li key={it.variant_id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
              <div className="duotone-wrap size-11 rounded-lg shrink-0"><ExerciseVisual name={ex?.name} equipment={v?.equipment_or_variation} size="sm" /></div>
              <div className="flex-1 min-w-0"><p className="font-hud font-bold leading-tight truncate">{ex?.name || 'Exercício indisponível'}</p><p className="num text-[11px] text-haze">{it.target_sets} séries{it.target_reps ? ` × ${it.target_reps}` : ''} · {v?.unit}</p></div>
              <button disabled={i === 0} aria-label="Subir" onClick={() => run(() => tpl.move(t.id, it.variant_id, -1))} className="size-8 grid place-items-center rounded-md bg-white/10 disabled:opacity-30"><ArrowUp size={14} /></button>
              <button disabled={i === t.items.length - 1} aria-label="Descer" onClick={() => run(() => tpl.move(t.id, it.variant_id, 1))} className="size-8 grid place-items-center rounded-md bg-white/10 disabled:opacity-30"><ArrowDown size={14} /></button>
              <button aria-label="Remover do modelo" onClick={() => run(() => tpl.removeItem(t.id, it.variant_id))} className="size-8 grid place-items-center rounded-md bg-white/10 text-pink"><Trash2 size={14} /></button>
            </li>
          );
        })}
      </ol>
      <Card title="Adicionar exercício">
        <select value={add.variant} onChange={e => setAdd({ ...add, variant: e.target.value })} className={inputCls} aria-label="Exercício"><option value="">Escolha…</option>{variants.map((o: any) => <option key={o.v.id} value={o.v.id}>{o.label}</option>)}</select>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Field label="Séries"><input inputMode="numeric" value={add.sets} onChange={e => setAdd({ ...add, sets: e.target.value })} className={inputCls} /></Field>
          <Field label="Reps (opcional)"><input inputMode="numeric" value={add.reps} onChange={e => setAdd({ ...add, reps: e.target.value })} className={inputCls} /></Field>
        </div>
        <div className="mt-3"><Btn kind="secondary" disabled={busy || !add.variant} onClick={() => run(async () => { await tpl.addItem(t.id, add.variant, Number(add.sets), add.reps === '' ? null : Number(add.reps)); setAdd({ variant: '', sets: '3', reps: '' }); })}><Plus size={16} className="inline -mt-1" /> Incluir</Btn></div>
        {!variants.length && <p className="text-[11px] text-haze mt-2">Exercícios aparecem aqui depois que a unidade de carga for confirmada num treino.</p>}
      </Card>
      <Btn disabled={busy || !t.items.length || !!active} onClick={() => run(async () => { await tpl.start(t.id); onGoWorkout(); })}><Play size={18} className="inline -mt-1 fill-current" /> Iniciar com este modelo</Btn>
    </>
  );
  return (
    <>
      <p className="text-sm text-haze">Seus roteiros pessoais. Também dá para criar um modelo a partir de qualquer treino no Histórico.</p>
      <div className="flex gap-2"><input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do novo modelo" className={inputCls} /><button disabled={busy || !name.trim()} onClick={() => run(async () => { const id = await newTemplate(name.trim()); setName(''); setOpen(id); })} className="px-4 rounded-xl btn-sunset disabled:opacity-40"><Plus /></button></div>
      {!list.length && <p className="text-center text-haze text-sm py-6">Nenhum modelo salvo ainda.</p>}
      <RegisterExercise model={model} onError={onError} />
      <ul className="space-y-2">{list.map((x: any) => (
        <li key={x.id}><button onClick={() => setOpen(x.id)} className="w-full flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3 text-left">
          <LayoutList className="text-gold" /><span className="flex-1"><b className="font-hud text-lg">{x.name}</b><br /><span className="num text-xs text-haze">{x.items.length} exercícios</span></span><ChevronLeft className="rotate-180 text-haze" />
        </button></li>
      ))}</ul>
    </>
  );
}

function RegisterExercise({ model, onError }: { model: any; onError: (e: any) => void }) {
  const [busy, run] = useRun(onError);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', equipment: '', unit: 'kg' });
  const [done, setDone] = useState('');
  if (!open) return <button onClick={() => setOpen(true)} className="w-full h-11 rounded-xl bg-white/5 border border-dashed border-white/20 chip text-sm"><Plus size={14} className="inline -mt-0.5" /> Cadastrar exercício novo</button>;
  return (
    <Card title="Cadastrar exercício">
      <p className="text-xs text-haze mb-2">Para máquinas diferentes, registre variações separadas. Evite mudar a unidade depois de registrar séries.</p>
      <div className="space-y-2">
        <Field label="Nome"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} placeholder="Ex.: Remada cavalinho" /></Field>
        <Field label="Equipamento ou variação"><input value={f.equipment} onChange={e => setF({ ...f, equipment: e.target.value })} className={inputCls} placeholder="Ex.: Máquina A" /></Field>
        <Field label="Unidade de carga"><select value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className={inputCls}>{loadUnits.map((u: string) => <option key={u}>{u}</option>)}</select></Field>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Btn kind="secondary" disabled={busy || !f.name.trim() || !f.equipment.trim()} onClick={() => run(async () => { await registerExercise(model, f.name, f.equipment, f.unit); setDone(f.name); setF({ name: '', equipment: '', unit: 'kg' }); })}>Cadastrar</Btn>
        <button onClick={() => setOpen(false)} className="px-4 rounded-xl bg-white/10 chip text-sm">Fechar</button>
      </div>
      {done && <p className="text-sm text-cash mt-2">✓ {done} cadastrado. Já aparece em Modelos e em "Trocar exercício".</p>}
    </Card>
  );
}

/* ---------- Ajustes ---------- */
function SettingsApp({ doc, onError, toast }: Ctx) {
  const [busy, run] = useRun(onError);
  const [goal, setGoal] = useState(doc.settings.weekly_goal);
  const [snd, setSnd] = useState(soundOn()), [rest, setRest] = useState(autoRest()), [prog, setProg] = useState(progressionOn()), [notify, setNotify] = useState(restNotifyOn());
  const [persist, setPersist] = useState<string>('Verificando…');
  const [diag, setDiag] = useState<any>(null);
  useEffect(() => { storageInfo().then((s: any) => setPersist(s.persistent === true ? 'Ativo' : s.persistent === false ? 'Não garantido' : 'Indisponível')).catch(() => setPersist('Não verificado')); }, []);
  return (
    <>
      <Card title="Meta semanal">
        <div className="flex items-center gap-3">
          <button onClick={() => setGoal((g: number) => Math.max(1, g - 1))} className="size-12 rounded-xl bg-white/10 text-2xl">−</button>
          <p className="flex-1 text-center"><span className="font-display text-5xl">{goal}</span><br /><span className="hud-label text-[10px] text-haze">missões por semana</span></p>
          <button onClick={() => setGoal((g: number) => Math.min(14, g + 1))} className="size-12 rounded-xl bg-white/10 text-2xl">+</button>
        </div>
        <div className="mt-3"><Btn disabled={busy || goal === doc.settings.weekly_goal} onClick={() => run(() => setWeeklyGoal(goal))}>Salvar meta</Btn></div>
      </Card>
      <Card title="Jogo">
        <label className="flex items-center justify-between py-1.5"><span>Efeitos sonoros</span><input type="checkbox" checked={snd} onChange={e => { setSound(e.target.checked); setSnd(e.target.checked); if (e.target.checked) sfx.set(); }} className="size-5 accent-[#ff2e93]" /></label>
        <label className="flex items-center justify-between py-1.5"><span>Descanso automático após cada série</span><input type="checkbox" checked={rest} onChange={e => { setAutoRest(e.target.checked); setRest(e.target.checked); }} className="size-5 accent-[#1ee8d6]" /></label>
      </Card>
      <Card title="Descanso padrão">
        <p className="text-[12px] text-haze leading-snug">Usado nos exercícios em que você ainda não escolheu um tempo. Ao tocar num tempo na barra de descanso do treino, ele fica salvo só para aquele exercício.</p>
        <div className="mt-2 grid grid-cols-5 gap-1.5" role="group" aria-label="Descanso padrão">
          {[90, 120, 150, 180, 240].map(sec => {
            const on = (doc.settings.rest?.default ?? 150) === sec;
            return <button key={sec} aria-pressed={on} aria-label={`Padrão ${sec} segundos`} onClick={() => saveRest(sec).catch(onError)} className={`num h-11 rounded-xl font-bold ${on ? 'bg-aqua text-night' : 'bg-white/10'}`}>{`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`}</button>;
          })}
        </div>
        {Object.keys(doc.settings.rest?.by_variant || {}).length > 0 && <p className="num text-[11px] text-haze mt-2">{Object.keys(doc.settings.rest.by_variant).length} exercício(s) com descanso próprio.</p>}
      </Card>
      <Card title="Alarme do descanso">
        <p className="text-[12px] text-haze leading-snug">O fim do descanso toca 3 rajadas fortes e vibra, mesmo com a tela de descanso minimizada. O volume é o de <b>mídia</b> do celular (não o da campainha).</p>
        <button onClick={() => sfx.restEnd()} className="mt-2 w-full h-11 rounded-xl bg-white/10 chip text-sm">Testar alarme</button>
        {notifySupported() && <label className="flex items-center justify-between gap-3 py-1.5 mt-2"><span>Notificar com o app em segundo plano</span><input type="checkbox" checked={notify} onChange={async e => setNotify(await setRestNotify(e.target.checked))} className="size-5 accent-[#7cf29a]" /></label>}
        {notifySupported() && <p className="text-[11px] text-haze leading-snug">Útil se você trocar de app durante o descanso. Com a tela bloqueada, o Android pode atrasar o aviso.</p>}
      </Card>
      <Card title="Treino">
        <label className="flex items-center justify-between gap-3 py-1.5"><span>Sugestão de progressão de carga</span><input type="checkbox" checked={prog} onChange={e => { setProgression(e.target.checked); setProg(e.target.checked); }} className="size-5 accent-[#7cf29a]" /></label>
        <p className="text-[11px] text-haze leading-snug">Opcional. Compara a última vez em cada exercício com a faixa de repetições: sugere subir um degrau quando todas as séries chegaram ao topo da faixa e sobraram repetições (RIR 1 ou mais; sem RIR, espera 2 treinos seguidos no topo) e sugere reduzir quando as repetições ficaram abaixo da faixa ou você chegou na falha (RIR 0) em 2 ou mais séries. A carga só muda se você tocar em “Usar”. Dor ou técnica ruim valem mais que a sugestão.</p>
      </Card>
      <Card title="Armazenamento">
        <Row k="Proteção contra limpeza automática" v={persist} />
        <Row k="Origem do histórico" v={doc.base ? 'Importação privada v2' : 'Local'} />
        {diag && <><Row k="Gravação de teste local" v={diag.database ? 'Aprovada' : 'Falhou'} /><Row k="Modo offline (service worker)" v={diag.worker ? 'Ativo' : 'Não confirmado'} /><Row k="Rede" v={diag.network ? 'Disponível' : 'Indisponível'} /></>}
        <div className="mt-3 space-y-2">
          <Btn kind="secondary" disabled={busy} onClick={() => run(async () => { const ok = await requestDurableStorage(); toast(ok ? 'Armazenamento persistente autorizado.' : 'O navegador não concedeu. Faça backups regularmente.'); const s: any = await storageInfo(); setPersist(s.persistent ? 'Ativo' : 'Não garantido'); })}><HardDrive size={16} className="inline -mt-1" /> Solicitar proteção</Btn>
          <Btn kind="secondary" disabled={busy} onClick={() => run(async () => setDiag(await diagnose()))}>Verificar armazenamento</Btn>
        </div>
      </Card>
    </>
  );
}

/* ---------- Instalar ---------- */
let deferred: any = null;
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', (e: any) => { e.preventDefault(); deferred = e; });
function InstallApp() {
  const [msg, setMsg] = useState('');
  const standalone = typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches;
  return (
    <>
      <Card><div className="flex items-center gap-3"><Smartphone className="text-gold" size={36} /><p className="text-sm">{standalone ? 'Você já está usando o app instalado.' : 'Tenha o Treino & Evolução na tela inicial, abrindo em tela cheia e funcionando sem internet.'}</p></div></Card>
      {!standalone && <Btn onClick={async () => { if (!deferred) { setMsg('O navegador não ofereceu a instalação agora. Use o menu ⋮ do Chrome → Instalar aplicativo.'); return; } deferred.prompt(); const r = await deferred.userChoice; setMsg(r.outcome === 'accepted' ? 'Instalação iniciada.' : 'Instalação cancelada.'); deferred = null; }}>Instalar aplicativo</Btn>}
      {msg && <p className="text-sm text-gold">{msg}</p>}
      <Card title="Como instalar pelo navegador">
        <ol className="text-sm space-y-1.5 list-decimal list-inside text-haze">
          <li>Se abriu dentro de outro app, use ⋮ → <b className="text-cream">Abrir no Chrome</b>.</li>
          <li>No Chrome, toque em ⋮ → <b className="text-cream">Instalar aplicativo</b> ou <b className="text-cream">Adicionar à tela inicial</b>.</li>
          <li>No iPhone, abra no Safari → Compartilhar → <b className="text-cream">Adicionar à Tela de Início</b>.</li>
        </ol>
        <p className="text-[11px] text-haze mt-2">Mantenha sempre o mesmo endereço: os dados ficam guardados por endereço do site.</p>
      </Card>
    </>
  );
}

function AboutApp() {
  return (
    <Card title="Transparência">
      <p className="text-sm text-haze">Sem servidor próprio e sem anúncios. Seus treinos ficam no celular (IndexedDB) e, se você autorizar, na sua planilha Google. O cache offline guarda só os arquivos do programa, nunca o seu histórico.</p>
      <p className="text-sm text-haze mt-2">XP, níveis, conquistas, recordes e atributos são calculados a partir do histórico: não criam dados novos nem são enviados à planilha.</p>
      <p className="text-[11px] text-haze mt-3">Nunca publique backups ou a pasta privado/ em repositórios públicos.</p>
      <p className="num text-[11px] text-haze mt-3" data-testid="release">Versão {String(import.meta.env.VITE_RELEASE || 'local').slice(0, 12)}</p>
    </Card>
  );
}
