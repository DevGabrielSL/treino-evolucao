import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeftRight, Ban, Minus, Plus, RotateCcw, Search, SkipForward, Trash2, Timer, Pause, Play } from 'lucide-react';
import { changePlan, confirmUnit, loadUnits, liveGuidance, FINISHER_GOALS, finisherProgress, plankElapsed, recordFinisher, plank, removeFinisherRow } from '../engine/workout';
import { ExerciseVisual } from './ExerciseVisual';
import { Sheet } from './WorkoutScreen';
import { ask } from './Dialog';
import { clock, nf } from './format';

/* ---------- Opções do exercício atual ---------- */
export function ExerciseOptions({ model, session, current, onClose, onSelect, onError }: { model: any; session: any; current: string; onClose: () => void; onSelect: (id: string) => void; onError: (e: any) => void }) {
  const [mode, setMode] = useState<'menu' | 'swap' | 'unit'>('menu');
  const [q, setQ] = useState('');
  const g = liveGuidance(session, current, model.entities);
  const variant = model.variantMap.get(current), ex = model.exerciseMap.get(variant?.exercise_id);
  const run = async (fn: () => Promise<any>) => { try { await fn(); } catch (e) { onError(e); } };
  const occupied = new Set((session.planned_variant_ids || []).flatMap((id: string) => [id, ...(session.prior_planned_variants?.[id] || [])]));
  const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const options = useMemo(() => model.entities.exercise_variants.filter((v: any) => !occupied.has(v.id)).map((v: any) => ({ v, e: model.exerciseMap.get(v.exercise_id) }))
    .filter((o: any) => o.e && (!q || norm(`${o.e.name} ${o.v.equipment_or_variation}`).includes(norm(q)))).sort((a: any, b: any) => a.e.name.localeCompare(b.e.name, 'pt-BR')).slice(0, 60),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, q, session]);
  const done = g.target !== null && g.resolved >= g.target;
  return (
    <Sheet onClose={onClose} title={mode === 'swap' ? 'Trocar exercício' : mode === 'unit' ? 'Unidade de carga' : ex?.name || 'Exercício'}>
      {mode === 'menu' && (
        <div className="space-y-2">
          {g.target !== null && <Item icon={SkipForward} disabled={done} onClick={() => run(async () => { await changePlan(session, current, 'skip'); onClose(); })} title="Pular uma série" sub="Conta como resolvida, sem registro de carga." />}
          {g.skipped > 0 && <Item icon={RotateCcw} onClick={() => run(async () => { await changePlan(session, current, 'undo-skip'); onClose(); })} title="Devolver série pulada" sub={`${g.skipped} pulada(s) neste exercício.`} />}
          <Item icon={ArrowLeftRight} disabled={done} onClick={() => setMode('swap')} title="Trocar por outro exercício" sub="As séries já feitas continuam salvas." />
          <Item icon={Ban} onClick={() => setMode('unit')} title="Trocar unidade de carga" sub={`Atual: ${variant?.unit}`} />
          <Item icon={Trash2} danger onClick={() => run(async () => { if (await ask(`Remover ${ex?.name || 'este exercício'} do roteiro deste treino? As séries salvas serão mantidas.`, { ok: 'Remover', danger: true })) { await changePlan(session, current, 'remove'); onClose(); } })} title="Remover do roteiro" sub="Só desta missão." />
        </div>
      )}
      {mode === 'swap' && (
        <div>
          <div className="flex items-center gap-2 rounded-xl bg-black/40 border border-white/10 px-3"><Search size={16} className="text-haze" /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar exercício ou equipamento" className="flex-1 bg-transparent py-2.5 outline-none" /></div>
          <ul className="mt-3 max-h-[52vh] overflow-y-auto no-scrollbar space-y-1.5">
            {options.map((o: any) => (
              <li key={o.v.id}><button onClick={() => run(async () => { await changePlan(session, current, 'swap', o.v.id); onSelect(o.v.id); onClose(); })} className="w-full flex items-center gap-3 rounded-xl bg-white/5 p-2 text-left">
                <div className="duotone-wrap size-11 rounded-lg shrink-0"><ExerciseVisual name={o.e.name} equipment={o.v.equipment_or_variation} size="sm" /></div>
                <span className="flex-1 min-w-0"><b className="font-hud block truncate">{o.e.name}</b><span className="text-[11px] text-haze truncate block">{o.v.equipment_or_variation} · {o.v.unit}</span></span>
              </button></li>
            ))}
            {!options.length && <p className="text-sm text-haze text-center py-6">Nenhum exercício disponível. Cadastre um novo no app Modelos do Celular.</p>}
          </ul>
        </div>
      )}
      {mode === 'unit' && (
        <div className="grid grid-cols-2 gap-2">
          {loadUnits.map((u: string) => <button key={u} disabled={u === variant?.unit} onClick={() => run(async () => { const id = await confirmUnit(session, variant, u); onSelect(id); onClose(); })} className={`h-14 rounded-xl font-hud font-bold text-lg ${u === variant?.unit ? 'bg-gold text-night' : 'bg-white/10'}`}>{u}</button>)}
          <p className="col-span-2 text-[11px] text-haze">A troca cria uma variação separada: cargas em unidades diferentes nunca são comparadas.</p>
        </div>
      )}
    </Sheet>
  );
}
function Item({ icon: Icon, title, sub, onClick, disabled, danger }: any) {
  return <button disabled={disabled} onClick={onClick} className={`w-full flex items-center gap-3 rounded-xl p-3 text-left disabled:opacity-35 ${danger ? 'bg-pink/10 text-pink' : 'bg-white/5'}`}><Icon size={20} /><span><b className="font-hud text-[17px] block leading-tight">{title}</b><span className="text-xs text-haze">{sub}</span></span></button>;
}

/* ---------- Reduções de drop set ---------- */
export type Drop = { load: string; reps: string };
export function DropRows({ drops, setDrops, unit }: { drops: Drop[]; setDrops: (d: Drop[]) => void; unit: string }) {
  return (
    <div className="space-y-2 mt-3">
      {drops.map((d, i) => (
        <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center gap-2 rounded-xl bg-violet/10 border border-violet/30 p-2">
          <span className="chip text-[11px] text-violet w-12">Drop {i + 1}</span>
          <input inputMode="decimal" value={d.load} placeholder={unit} aria-label={`Carga do drop ${i + 1}`} onChange={e => setDrops(drops.map((x, k) => k === i ? { ...x, load: e.target.value } : x))} className="num w-full min-w-0 rounded-lg bg-black/40 px-2 py-2 text-lg text-center" />
          <span className="text-haze">×</span>
          <input inputMode="numeric" value={d.reps} placeholder="reps" aria-label={`Repetições do drop ${i + 1}`} onChange={e => setDrops(drops.map((x, k) => k === i ? { ...x, reps: e.target.value } : x))} className="num w-full min-w-0 rounded-lg bg-black/40 px-2 py-2 text-lg text-center" />
          <button onClick={() => setDrops(drops.filter((_, k) => k !== i))} aria-label="Remover redução" className="size-9 shrink-0 grid place-items-center rounded-lg bg-white/10"><Minus size={16} /></button>
        </motion.div>
      ))}
    </div>
  );
}

/* ---------- Bloco final ---------- */
export function FinisherPanel({ model, session, onError }: { model: any; session: any; onError: (e: any) => void }) {
  const [, tick] = useState(0);
  const running = Boolean(session.finisher_plank_started_at), paused = Boolean(session.clock_paused_at);
  useEffect(() => { if (!running) return; const t = setInterval(() => tick(x => x + 1), 500); return () => clearInterval(t); }, [running]);
  const goals = finisherProgress(session, model.sets);
  const abs = goals.find((x: any) => x.key === 'abs'), pl = goals.find((x: any) => x.key === 'plank');
  const [f, setF] = useState({ load: '', reps: '', kind: 'effective', unit: 'kg' });
  const run = async (fn: () => Promise<any>) => { try { await fn(); } catch (e) { onError(e); } };
  const secs = Math.floor(plankElapsed(session, model.sets) / 1000);
  const recent = model.sets.filter((s: any) => s.session_id === session.id && FINISHER_GOALS.some((g: any) => g.key === s.finisher_key)).slice(-4).reverse();
  return (
    <section className="mx-3 mt-3 panel p-4">
      <p className="hud-label text-[10px] text-pink">Fechamento</p>
      <h3 className="font-display uppercase text-2xl leading-[1.1]">Bloco final</h3>
      <div className="mt-3 rounded-xl bg-black/30 p-3">
        <div className="flex justify-between items-baseline"><b className="font-hud text-lg">{abs.name}</b><span className={`num ${abs.remaining ? '' : 'text-cash'}`}>{abs.done}/{abs.target} reps</span></div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-1"><motion.div className="h-full bg-gradient-to-r from-pink to-gold" animate={{ width: `${Math.min(100, (abs.done / abs.target) * 100)}%` }} /></div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <input inputMode="decimal" placeholder="Carga" value={f.load} onChange={e => setF({ ...f, load: e.target.value })} className="num rounded-lg bg-black/40 px-3 py-2 text-lg" aria-label="Carga do abdominal" />
          <input inputMode="numeric" placeholder="Repetições" value={f.reps} onChange={e => setF({ ...f, reps: e.target.value })} className="num rounded-lg bg-black/40 px-3 py-2 text-lg" aria-label="Repetições do abdominal" />
          <select value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className="rounded-lg bg-black/40 px-3 py-2" aria-label="Unidade da máquina"><option value="kg">kg</option><option value="plaquetas">plaquetas</option></select>
          <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} className="rounded-lg bg-black/40 px-3 py-2" aria-label="Tipo de série"><option value="effective">Trabalho</option><option value="warmup">Aquecimento</option></select>
        </div>
        <button disabled={!f.load || !f.reps} onClick={() => run(async () => { await recordFinisher(session, 'abs', { load: Number(f.load.replace(',', '.')), reps: Number(f.reps), kind: f.kind, unit: f.unit }); setF({ ...f, reps: '' }); })} className="mt-2 w-full h-11 rounded-xl btn-sunset text-lg disabled:opacity-40"><Plus size={16} className="inline -mt-1" /> Salvar série</button>
        <p className="text-[11px] text-haze mt-1">Some repetições em séries de trabalho. Aquecimentos não contam.</p>
      </div>
      <div className="mt-3 rounded-xl bg-black/30 p-3 flex items-center gap-3">
        <div className="relative size-16 shrink-0">
          <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90"><circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6" /><circle cx="32" cy="32" r="27" fill="none" stroke="#1ee8d6" strokeWidth="6" strokeLinecap="round" strokeDasharray={169.6} strokeDashoffset={169.6 * (1 - Math.min(1, secs / 180))} /></svg>
          <Timer size={20} className="absolute inset-0 m-auto text-aqua" />
        </div>
        <div className="flex-1"><b className="font-hud text-lg">Prancha</b> <span className="text-xs text-haze">meta 3 min</span><p className="num text-2xl font-extrabold">{clock(secs * 1000)}</p><p className="text-[11px] text-haze">{pl.remaining ? `Faltam ${pl.remaining}s` : 'Meta atingida'}{paused ? ' · retome o treino para continuar' : ''}</p></div>
        <button disabled={paused} onClick={() => run(() => plank(session, !running))} className={`h-12 px-4 rounded-xl chip text-sm flex items-center gap-1 disabled:opacity-40 ${running ? 'bg-gold text-night' : 'bg-aqua text-night'}`}>{running ? <><Pause size={16} />Salvar trecho</> : <><Play size={16} />{secs ? 'Continuar' : 'Iniciar'}</>}</button>
      </div>
      {recent.length > 0 && <ul className="mt-3 space-y-1">{recent.map((r: any) => (
        <li key={r.id} className="flex items-center gap-2 text-sm rounded-lg bg-white/5 px-2 py-1.5">
          <span className="flex-1">{r.finisher_key === 'plank' ? `Prancha · ${(r.duration_ms / 1000).toFixed(1)} s` : `Abdominal · ${nf(r.load_value)} ${r.load_unit_original} × ${r.repetitions}${r.set_type === 'warmup' ? ' (aq.)' : ''}`}</span>
          <button aria-label="Remover registro" onClick={() => run(async () => { if (await ask('Remover este registro do bloco final? A meta será recalculada.', { ok: 'Remover', danger: true })) await removeFinisherRow(session, r.id); })} className="size-8 grid place-items-center rounded-md bg-white/10 text-pink"><Trash2 size={14} /></button>
        </li>))}</ul>}
    </section>
  );
}
