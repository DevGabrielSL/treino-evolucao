import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pencil, Check, ChevronLeft, ChevronRight, Minus, MoreVertical, Pause, Play, Plus, RotateCcw, Timer, Undo2 } from 'lucide-react';
import { finisherProgress, liveGuidance, nextPending, loadUnits, restTimer, logSet, logTimed, confirmUnit, finishMission, cancelMission, togglePause, undoLast, correctLast, lastDraftSet, workoutElapsed } from '../engine/workout';
import { ExerciseVisual } from './ExerciseVisual';
import { onReward } from '../engine/store';
import { xp, rankFor } from '../game/progress';
import { fx } from '../fx/FxLayer';
import { sfx, soundOn, setSound } from '../fx/sfx';
import { RestOverlay, autoRest, setAutoRest } from './RestOverlay';
import { ask } from './Dialog';
import { ExerciseOptions, DropRows, FinisherPanel, AddExercise, type Drop } from './WorkoutExtras';
import { clock, nf } from './format';
import { Sheet } from './Sheet';
import { progressionHint, progressionOn } from '../engine/progression';
import { finisherMarks } from '../engine/finisherMarks';
import { notifyRestEnd } from '../fx/notify';
import { TrendingDown, TrendingUp } from 'lucide-react';
export { Sheet };

type Props = { model: any; doc: any; session: any; onExit: () => void; onError: (e: any) => void; onFinished: (sessionId: string) => void };

const UNIT_HELP: Record<string, string> = { 'kg': 'Peso total', 'kg/lado': 'Por lado', 'kg/halter': 'Por halter', 'plaquetas': 'Placas', 'peso corporal': 'Corpo' };

function useTick(ms = 1000) { const [, set] = useState(0); useEffect(() => { const t = setInterval(() => set(x => x + 1), ms); return () => clearInterval(t); }, [ms]); }

export function WorkoutScreen({ model, doc, session, onExit, onError, onFinished }: Props) {
  useTick();
  const entities = model.entities;
  const ids: string[] = session.planned_variant_ids || [];
  const [selected, setSelected] = useState<string>(() => ids.find(id => { const g = liveGuidance(session, id, entities); return g.target === null || g.resolved < g.target; }) || ids[0]);
  const current = ids.includes(selected) ? selected : ids[0];
  const variant = model.variantMap.get(current);
  const exercise = model.exerciseMap.get(variant?.exercise_id);
  const guide = liveGuidance(session, current, entities);
  const sessionSets = model.sets.filter((s: any) => s.session_id === session.id);
  const lastId = lastDraftSet(doc, session.id)?.id;
  const mySets = sessionSets.filter((s: any) => (s.planned_variant_id || s.variant_id) === current).sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0));
  const totalTarget = ids.reduce((n, id) => n + (liveGuidance(session, id, entities).target || 0), 0);
  const totalDone = ids.reduce((n, id) => { const g = liveGuidance(session, id, entities); return n + Math.min(g.resolved, g.target ?? g.resolved); }, 0);
  const elapsed = workoutElapsed(session);
  const [menu, setMenu] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [finisher, setFinisher] = useState(() => { try { return sessionStorage.getItem('workout-finisher-session') === session.id || Boolean(session.finisher_plank_started_at) || model.sets.some((x: any) => x.session_id === session.id && x.finisher_key); } catch { return false; } });
  const toggleFinisher = () => setFinisher(v => { try { sessionStorage.setItem('workout-finisher-session', v ? '' : session.id); } catch { /* sem armazenamento */ } return !v; });
  const [sound, setSoundState] = useState(soundOn());
  const [auto, setAuto] = useState(autoRest());
  const registerRef = useRef<HTMLButtonElement>(null);
  const totalXp = xp(entities).total;

  // Combo: séries de trabalho seguidas com no máximo 5 min entre elas
  const work = sessionSets.filter((x: any) => x.set_type === 'effective' && x.recorded_at).sort((a: any, b: any) => a.recorded_at.localeCompare(b.recorded_at));
  let combo = work.length ? 1 : 0;
  for (let i = work.length - 1; i > 0; i--) { if (Date.parse(work[i].recorded_at) - Date.parse(work[i - 1].recorded_at) <= 5 * 60000) combo++; else break; }
  if (work.length && Date.now() - Date.parse(work.at(-1).recorded_at) > 5 * 60000) combo = 0;

  // Tela sempre acesa enquanto a missão estiver aberta (o navegador libera ao sair ou minimizar).
  useEffect(() => {
    const nav: any = navigator; if (!nav.wakeLock) return;
    let lock: any = null, alive = true;
    const acquire = async () => { try { if (alive && document.visibilityState === 'visible') { lock = await nav.wakeLock.request('screen'); } } catch { /* economia de bateria ou permissão */ } };
    const onVis = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire(); document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis); lock?.release?.().catch?.(() => {}); };
  }, [session.id]);

  useEffect(() => onReward((r) => {
    if (!r) return;
    if (!r.finished) fx.flyXp(registerRef.current, `+${r.gain}`);
    if (r.to.level > r.from.level) { setTimeout(() => { sfx.level(); fx.stamp(`Nível ${r.to.level}`, rankFor(r.to.level), 'pink'); fx.confetti(); }, 700); }
  }), []);

  const ref = guide.reference || guide.latest;
  const [load, setLoad] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [kind, setKind] = useState<'effective' | 'warmup'>('effective');
  const [rir, setRir] = useState<number | null>(null);
  const [editLast, setEditLast] = useState<any>(null);
  useEffect(() => { // ao trocar de alvo, pré-preenche com a última série deste treino ou a referência
    const base = mySets.at(-1) || ref;
    setLoad(base?.load_value != null ? String(base.load_value) : variant?.unit === 'peso corporal' ? '0' : '');
    setReps(base?.repetitions != null ? String(base.repetitions) : String(guide.dose?.min ?? ''));
    setKind('effective'); setDrops([]); setRir(null); setEditLast(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const needsUnit = variant && (variant.unit_confirmed !== true || !loadUnits.includes(variant.unit));
  // Sugestão de progressão: só com a opção ligada em Ajustes; nunca preenche sozinha.
  const hint = progressionOn() && !needsUnit ? progressionHint(current, guide.dose, entities, { excludeSession: session.id, today: session.date }) : null;
  const timed = guide.dose?.unit === 'segundos';
  const step = variant?.unit === 'plaquetas' ? 1 : variant?.unit === 'kg/halter' ? 1 : 2.5;
  const rest = restTimer.state(session.id);

  async function run(fn: () => Promise<any>) { if (busy) return; setBusy(true); try { await fn(); } catch (e) { onError(e); } finally { setBusy(false); } }

  async function submit(repeat?: { load: number; reps: number }) {
    const l = repeat ? repeat.load : Number(String(load).replace(',', '.')), r = repeat ? repeat.reps : Number(reps);
    const k = repeat ? 'effective' : kind;
    const done = new Set(entities.sessions.filter((x: any) => x.status === 'completed').map((x: any) => x.id));
    const prevBest = Math.max(-Infinity, ...model.sets.filter((x: any) => done.has(x.session_id) && x.variant_id === variant?.id && x.set_type === 'effective' && typeof x.load_value === 'number').map((x: any) => x.load_value),
      ...sessionSets.filter((x: any) => x.variant_id === variant?.id && x.set_type === 'effective').map((x: any) => x.load_value));
    await run(async () => {
      const dropList = repeat ? [] : drops.map(d => ({ load: Number(String(d.load).replace(',', '.')), reps: Number(d.reps) }));
      if (dropList.some(d => !Number.isFinite(d.load) || !d.reps)) throw new Error('Preencha carga e repetições de cada redução.');
      await logSet(session, variant, model, { load: l, reps: r, kind: k, rir: k === 'effective' ? rir : null, drops: dropList });
      setDrops([]); setRir(null);
      if (repeat) { setLoad(String(l)); setReps(String(r)); }
      sfx.set();
      if (k === 'effective' && variant?.unit_confirmed && Number.isFinite(prevBest) && l > prevBest) {
        setTimeout(() => { sfx.pr(); fx.stamp('Novo recorde', `${exercise?.name}: ${nf(prevBest)} → ${nf(l)} ${variant.unit}`); fx.confetti(); }, 350);
      } else if (k === 'effective' && combo + 1 >= 2) { sfx.combo(combo + 1); }
      // descanso também depois do aquecimento
      if (auto) { restTimer.start(session.id, restTimer.state(session.id).seconds || 150); setRestOpen(true); }
    });
  }
  // A meta de séries é sugestão: depois dela o alvo continua aberto para séries extras.
  const reachedNext = guide.target !== null && guide.resolved >= guide.target ? nextPending(session, current, entities) : null;
  // Cronômetro desde a última série registrada neste treino (qualquer tipo).
  const lastAt = sessionSets.reduce((m: number, x: any) => { const t = Date.parse(x.recorded_at || ''); return Number.isFinite(t) && t > m ? t : m; }, 0) || null;

  const adjust = (setter: (v: string) => void, value: string, delta: number, min = 0) => {
    const n = Number(String(value).replace(',', '.')) || 0; setter(String(Math.max(min, Math.round((n + delta) * 100) / 100)));
  };

  return (
    <div className="min-h-dvh pb-40">
      {/* HUD da missão */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-night via-night/90 to-transparent px-3 pt-[max(env(safe-area-inset-top),10px)] pb-3">
        <div className="flex items-center gap-2">
          <button onClick={onExit} aria-label="Voltar às missões" className="size-10 grid place-items-center rounded-full bg-white/5"><ChevronLeft /></button>
          <div className="flex-1 min-w-0">
            <p className={`hud-label text-[10px] ${session.clock_paused_at ? 'text-gold' : 'text-pink'}`}>{session.clock_paused_at ? '❚❚ Missão pausada' : '● Missão em andamento'}</p>
            <p className="font-hud font-bold text-[17px] leading-tight truncate">{session.name}</p>
          </div>
          <div className="text-right leading-none">
            <div className="num text-2xl font-extrabold text-cream tabular-nums">{clock(elapsed)}</div>
            <div id="xp-target" key={totalXp} className="num text-[13px] font-bold text-cash pop">{nf(totalXp, 0)} XP</div>
          </div>
          <button onClick={() => run(() => togglePause(session))} aria-label={session.clock_paused_at ? 'Retomar' : 'Pausar'} className="size-10 grid place-items-center rounded-full bg-white/5">{session.clock_paused_at ? <Play size={18} /> : <Pause size={18} />}</button>
          <button onClick={() => setMenu(true)} aria-label="Opções" className="size-10 grid place-items-center rounded-full bg-white/5"><MoreVertical size={18} /></button>
        </div>
        {/* barra de progresso da missão */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-aqua via-violet to-pink" animate={{ width: `${totalTarget ? (totalDone / totalTarget) * 100 : 0}%` }} />
          </div>
          <span className="num text-xs text-haze">{totalDone}/{totalTarget} séries</span>
        </div>
      </header>

      {/* Combo */}
      <AnimatePresence>
        {combo >= 2 && (
          <motion.div key={combo} initial={{ scale: 1.8, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -4 }} exit={{ opacity: 0 }} transition={{ type: 'spring', damping: 12 }}
            className="absolute right-4 top-[96px] z-30 font-display uppercase text-2xl text-gold drop-shadow-[0_0_12px_rgba(255,197,77,.8)] pointer-events-none">
            Combo ×{combo}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Objetivo */}
      <motion.div key={current + guide.resolved} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        className="mx-3 mb-3 flex items-center gap-2 rounded-lg bg-black/50 border-l-4 border-gold px-3 py-2">
        <span className="hud-label text-gold text-[11px] shrink-0">Objetivo</span>
        <span className="font-hud text-[15px] font-semibold leading-tight">
          {guide.target === null ? 'Registre o que realizar neste exercício.' : guide.resolved >= guide.target
            ? <>Meta de {guide.target} cumprida. <span className="text-aqua">Série extra {guide.resolved + 1} liberada.</span></>
            : <>Série <b className="text-gold">{guide.resolved + 1}</b> de {guide.target} · {guide.dose?.min}–{guide.dose?.max} reps</>}
        </span>
        {reachedNext && <button onClick={() => setSelected(reachedNext)} className="ml-auto shrink-0 chip text-[12px] rounded-md bg-aqua text-night px-2 py-1 flex items-center">Próximo <ChevronRight size={14} /></button>}
      </motion.div>

      {/* Alvos da missão */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 pb-1">
        {ids.map((id, i) => {
          const v = model.variantMap.get(id), e = model.exerciseMap.get(v?.exercise_id), g = liveGuidance(session, id, entities);
          const done = g.target !== null && g.resolved >= g.target, on = id === current;
          return (
            <button key={id} onClick={() => setSelected(id)} className={`relative shrink-0 w-[74px] rounded-xl overflow-hidden border-2 transition ${on ? 'border-gold shadow-[0_0_18px_-2px_rgba(255,197,77,.7)]' : done ? 'border-cash/60' : 'border-white/10'}`}>
              <div className="duotone-wrap h-[74px] bg-plum"><ExerciseVisual name={e?.name} equipment={v?.equipment_or_variation} size="sm" /></div>
              <span className="absolute left-1 top-1 num text-[11px] font-bold bg-black/60 rounded px-1">{String(i + 1).padStart(2, '0')}</span>
              {done && <span className="absolute right-1 top-1 size-5 grid place-items-center rounded-full bg-cash text-night"><Check size={13} strokeWidth={3} /></span>}
              <div className="flex justify-center gap-0.5 py-1 bg-black/70">
                {Array.from({ length: g.target || 3 }, (_, k) => <span key={k} className={`h-1.5 w-3 rounded-sm ${k < g.resolved ? 'bg-gold' : 'bg-white/20'}`} />)}
              </div>
              <span className="sr-only">{e?.name}</span>
            </button>
          );
        })}
        <button onClick={() => setAddOpen(true)} aria-label="Adicionar exercício" className="shrink-0 w-[74px] rounded-xl border-2 border-dashed border-aqua/50 text-aqua grid place-items-center bg-aqua/5">
          <span className="flex flex-col items-center gap-1"><Plus size={22} /><span className="chip text-[10px] leading-tight text-center">Adicionar</span></span>
        </button>
      </div>
      {addOpen && <AddExercise model={model} session={session} onClose={() => setAddOpen(false)} onAdded={(id: string) => { setSelected(id); setAddOpen(false); }} onError={onError} />}

      {/* Cartão do exercício */}
      <AnimatePresence mode="wait">
        <motion.section key={current} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .25 }}
          className="mx-3 mt-3 panel overflow-hidden">
          <div className="relative duotone-wrap h-52 bg-plum">
            <button onClick={() => setOptionsOpen(true)} aria-label="Opções do exercício" className="absolute right-2 top-2 z-20 size-10 grid place-items-center rounded-full bg-black/60 backdrop-blur border border-white/15"><MoreVertical size={18} /></button>
            <ExerciseVisual name={exercise?.name} equipment={variant?.equipment_or_variation} />
            <div className="absolute inset-x-0 bottom-0 p-3 z-10">
              <p className="chip text-[12px] text-aqua">{variant?.equipment_or_variation}</p>
              <h2 className="font-display uppercase text-[2rem] leading-[.95]">{exercise?.name}</h2>
            </div>
          </div>

          {ref && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-black/30 border-b border-white/5">
              <RotateCcw size={16} className="text-haze shrink-0" />
              <p className="text-sm flex-1"><span className="text-haze">Última vez:</span> <b className="num text-[15px]">{nf(ref.load_value)} {ref.load_unit_original || variant?.unit} × {ref.repetitions}</b></p>
              {!needsUnit && <button onClick={() => { setLoad(String(ref.load_value ?? '')); setReps(String(ref.repetitions ?? '')); }} className="chip text-xs text-gold border border-gold/40 rounded-md px-2 py-1">Usar</button>}
            </div>
          )}

          {hint && !timed && (
            <div data-testid="progression" data-kind={hint.kind} className={`flex items-start gap-3 px-3 py-2.5 border-b border-white/5 ${hint.kind === 'subir' ? 'bg-cash/10' : hint.kind === 'confirmar' ? 'bg-gold/10' : hint.kind === 'reduzir' ? 'bg-pink/10' : 'bg-black/20'}`}>
              {hint.kind === 'reduzir' ? <TrendingDown size={16} className="shrink-0 mt-0.5 text-pink" /> : <TrendingUp size={16} className={`shrink-0 mt-0.5 ${hint.kind === 'subir' ? 'text-cash' : hint.kind === 'confirmar' ? 'text-gold' : 'text-haze'}`} />}
              <div className="flex-1 min-w-0">
                <p className="font-hud font-bold text-[15px] leading-tight">{hint.title}</p>
                <p className="text-[12px] text-haze leading-snug mt-0.5">{hint.detail}</p>
              </div>
              {hint.kind !== 'manter' && <button onClick={() => { setLoad(String(hint.next)); setReps(String(hint.min)); sfx.tap(); }} className={`chip text-xs rounded-md px-2 py-1 shrink-0 border ${hint.kind === 'reduzir' ? 'text-pink border-pink/40' : 'text-cash border-cash/40'}`}>Usar {nf(hint.next)}</button>}
            </div>
          )}

          <div className="p-3">
            {needsUnit && !timed ? (
              <div>
                <p className="hud-label text-gold">Confirme a unidade de carga</p>
                <p className="text-sm text-haze mt-1">Como a carga é medida neste equipamento? Isso evita comparar valores diferentes.</p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {loadUnits.map((u: string) => (
                    <button key={u} disabled={busy} onClick={() => run(async () => { const id = await confirmUnit(session, variant, u); setSelected(id); })}
                      className="rounded-xl border border-white/15 bg-white/5 py-2.5 active:bg-pink/20">
                      <span className="block font-hud font-bold text-lg">{u}</span>
                      <span className="block text-[11px] text-haze">{UNIT_HELP[u]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : timed ? (
              <TimedEntry dose={guide.dose} busy={busy} onSave={(secs: number) => run(async () => { await logTimed(session, variant, secs); sfx.set(); if (auto) { restTimer.start(session.id, restTimer.state(session.id).seconds || 150); setRestOpen(true); } })} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Stepper label={variant?.unit === 'peso corporal' ? 'Carga extra · kg (0 = só o corpo)' : `Carga · ${variant?.unit}`} value={load} onChange={setLoad} onMinus={() => adjust(setLoad, load, -step)} onPlus={() => adjust(setLoad, load, step)} decimal />
                  <Stepper label="Repetições" value={reps} onChange={setReps} onMinus={() => adjust(setReps, reps, -1, 1)} onPlus={() => adjust(setReps, reps, 1, 1)} />
                </div>
                <div className="mt-3 grid grid-cols-2 rounded-xl bg-black/40 p-1">
                  {(['effective', 'warmup'] as const).map(k => (
                    <button key={k} onClick={() => setKind(k)} className={`relative chip text-sm py-2 rounded-lg ${kind === k ? 'text-night' : 'text-haze'}`}>
                      {kind === k && <motion.span layoutId="kind" className="absolute inset-0 rounded-lg bg-cream" />}
                      <span className="relative">{k === 'effective' ? 'Trabalho · +10 XP' : 'Aquecimento · +5 XP'}</span>
                    </button>
                  ))}
                </div>
                {kind === 'effective' && <RirPicker value={rir} onChange={setRir} />}
                {kind === 'effective' && <DropRows drops={drops} setDrops={setDrops} unit={variant?.unit} />}
                {kind === 'effective' && drops.length < 8 && <button onClick={() => setDrops([...drops, { load: '', reps: '' }])} className="mt-2 chip text-xs text-violet border border-violet/40 rounded-lg px-3 py-1.5">+ Drop set (redução de carga)</button>}
                {(() => {
                  const lastEff = mySets.filter((x: any) => x.set_type === 'effective' && x.load_value != null && x.repetitions).at(-1);
                  return lastEff && !drops.length && kind === 'effective' && (
                    <button disabled={busy} onClick={() => submit({ load: lastEff.load_value, reps: lastEff.repetitions })} className="mt-3 w-full h-12 rounded-xl bg-white/10 border border-white/15 chip text-sm flex items-center justify-center gap-2 disabled:opacity-40">
                      <RotateCcw size={16} /> Repetir série · {nf(lastEff.load_value)} {variant?.unit} × {lastEff.repetitions}{rir !== null ? ` · RIR ${rir === 5 ? '5+' : rir}` : ''}
                    </button>
                  );
                })()}
                <motion.button ref={registerRef} whileTap={{ scale: .95 }} disabled={busy || !load || !reps} onClick={() => submit()}
                  className="btn-sunset shine mt-3 w-full h-16 rounded-2xl text-[1.7rem] disabled:opacity-40">
                  Registrar série
                </motion.button>
              </>
            )}

            {mySets.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {mySets.map((s: any, i: number) => (
                  <motion.li key={s.id} initial={{ opacity: 0, x: -16, backgroundColor: 'rgba(255,197,77,.25)' }} animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(255,255,255,.04)' }} transition={{ duration: .5 }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2">
                    <span className={`num text-xs font-bold rounded px-1.5 py-0.5 ${s.set_type === 'warmup' ? 'bg-aqua/20 text-aqua' : s.set_type === 'drop_set' ? 'bg-violet/25 text-violet' : 'bg-gold/20 text-gold'}`}>{s.set_type === 'warmup' ? 'AQ' : s.set_type === 'drop_set' ? 'DROP' : s.duration_ms != null ? `T${i + 1}` : `S${i + 1}`}</span>
                    <span className="num text-lg font-bold flex-1">{s.duration_ms != null ? <>⏱ {nf(s.duration_ms / 1000, 1)} <span className="text-sm text-haze">s</span></> : <>{nf(s.load_value)} <span className="text-sm text-haze">{s.load_unit_original}</span> × {s.repetitions}{s.rir != null && <span className="text-xs text-aqua ml-2">RIR {s.rir}</span>}</>}</span>
                    {s.xp_load_reference && <span className="chip text-[10px] text-cash">Carga superada</span>}
                    {lastId === s.id && s.duration_ms == null && <button onClick={() => setEditLast({ load: String(s.load_value ?? ''), reps: String(s.repetitions ?? ''), rir: s.rir ?? null, kind: s.set_type })} aria-label="Corrigir última série" className="size-8 grid place-items-center rounded-md bg-white/10"><Pencil size={14} /></button>}
                  </motion.li>
                ))}
              </ul>
            )}
            {editLast && (
              <div className="mt-3 rounded-xl border border-gold/40 bg-gold/5 p-3 space-y-2">
                <p className="hud-label text-gold text-[11px]">Corrigir última série</p>
                <div className="grid grid-cols-3 gap-2">
                  <input inputMode="decimal" value={editLast.load} onChange={e => setEditLast({ ...editLast, load: e.target.value })} className="num rounded-lg bg-black/40 px-3 py-2 text-lg" aria-label="Carga corrigida" />
                  <input inputMode="numeric" value={editLast.reps} onChange={e => setEditLast({ ...editLast, reps: e.target.value })} className="num rounded-lg bg-black/40 px-3 py-2 text-lg" aria-label="Repetições corrigidas" />
                  <select value={editLast.kind} onChange={e => setEditLast({ ...editLast, kind: e.target.value })} className="rounded-lg bg-black/40 px-2 py-2" aria-label="Tipo corrigido"><option value="effective">Trabalho</option><option value="warmup">Aquecimento</option></select>
                </div>
                <RirPicker value={editLast.rir} onChange={(v: number | null) => setEditLast({ ...editLast, rir: v })} />
                <div className="grid grid-cols-2 gap-2"><button onClick={() => setEditLast(null)} className="h-11 rounded-xl bg-white/10 chip">Cancelar</button>
                  <button onClick={() => run(async () => { await correctLast(session, { load: Number(String(editLast.load).replace(',', '.')), reps: Number(editLast.reps), rir: editLast.rir, kind: editLast.kind }); setEditLast(null); })} className="h-11 rounded-xl btn-sunset">Salvar correção</button></div>
              </div>
            )}
          </div>
        </motion.section>
      </AnimatePresence>

      {/* Descanso */}
      <RestBar sessionId={session.id} rest={rest} since={lastAt} auto={auto} onAuto={(v: boolean) => { setAutoRest(v); setAuto(v); }} onOpen={() => setRestOpen(true)} />

      <div className="mx-3 mt-3">
        <button onClick={toggleFinisher} className={`w-full h-12 rounded-xl chip text-sm border ${finisher ? 'bg-pink/15 border-pink/40 text-pink' : 'bg-white/5 border-white/10'}`}>{finisher ? 'Fechar bloco final' : 'Bloco final · abdominal + prancha'}</button>
      </div>
      {finisher && <FinisherPanel model={model} session={session} onError={onError} />}

      {/* Rodapé de ações */}
      <div className="fixed bottom-0 inset-x-0 z-40 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] bg-gradient-to-t from-night via-night/95 to-transparent">
        <div className="grid grid-cols-[auto_1fr_1fr] gap-2 max-w-lg mx-auto">
          <button disabled={busy || !lastDraftSet(doc, session.id)} onClick={() => run(() => undoLast(session))} aria-label="Desfazer última série" className="size-13 h-13 w-13 grid place-items-center rounded-xl bg-white/5 border border-white/10 disabled:opacity-30"><Undo2 /></button>
          <button onClick={() => { const n = nextPending(session, current, entities); if (n) setSelected(n); }} className="h-13 rounded-xl bg-white/5 border border-white/10 chip text-sm flex items-center justify-center gap-1">Próximo alvo <ChevronRight size={16} /></button>
          <button disabled={busy || !sessionSets.length} onClick={() => setConfirmFinish(true)} className="h-13 rounded-xl bg-cash/90 text-night chip text-sm font-extrabold disabled:opacity-30">Concluir missão</button>
        </div>
      </div>

      <AnimatePresence>
        {optionsOpen && variant && <ExerciseOptions model={model} session={session} current={current} onClose={() => setOptionsOpen(false)} onSelect={setSelected} onError={onError} />}
      </AnimatePresence>
      <AnimatePresence>
        <RestAlarm sessionId={session.id} next={guide.target !== null && guide.resolved < guide.target ? `${exercise?.name} · série ${guide.resolved + 1}` : `${exercise?.name || 'próximo exercício'}`} overlay={restOpen} />
      {restOpen && <RestOverlay sessionId={session.id} since={lastAt} next={guide.target !== null && guide.resolved < guide.target ? `${exercise?.name} · série ${guide.resolved + 1} de ${guide.target}` : `${exercise?.name} · série extra ou próximo alvo`} onClose={() => setRestOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {menu && (
          <Sheet onClose={() => setMenu(false)} title="Opções da missão">
            <label className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 mb-3">
              <span className="font-hud font-semibold text-lg">Efeitos sonoros</span>
              <input type="checkbox" checked={sound} onChange={e => { setSound(e.target.checked); setSoundState(e.target.checked); if (e.target.checked) sfx.set(); }} className="size-5 accent-[#ff2e93]" />
            </label>
            <button onClick={() => { setMenu(false); run(async () => { if (await ask('Abandonar esta missão? Ela não será marcada como concluída. As séries registradas ficam no histórico.', { ok: 'Abandonar', danger: true })) { await cancelMission(session); onExit(); } }); }}
              className="w-full rounded-xl bg-pink/15 border border-pink/40 text-pink chip py-3">Abandonar missão</button>
          </Sheet>
        )}
        {confirmFinish && (
          <Sheet onClose={() => setConfirmFinish(false)} title="Concluir missão?">
            <Summary session={session} entities={entities} ids={ids} sets={sessionSets} />
            <button disabled={busy} onClick={() => run(async () => { await finishMission(session); setConfirmFinish(false); restTimer.stop(session.id); onFinished(session.id); })} className="btn-sunset w-full h-14 rounded-xl text-2xl mt-4">Concluir</button>
            <button onClick={() => setConfirmFinish(false)} className="w-full chip text-haze py-3 mt-1">Voltar ao treino</button>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stepper({ label, value, onChange, onMinus, onPlus, decimal }: any) {
  return (
    <div className="rounded-xl bg-black/40 border border-white/10 p-2">
      <p className="hud-label text-[10px] text-haze text-center">{label}</p>
      <div className="flex items-center gap-1 mt-1">
        <button onClick={onMinus} aria-label={`Diminuir ${label}`} className="size-10 shrink-0 grid place-items-center rounded-lg bg-white/10 active:bg-white/20"><Minus size={18} /></button>
        <input value={value} onChange={e => onChange(e.target.value.replace(/[^0-9.,]/g, ''))} inputMode={decimal ? 'decimal' : 'numeric'} aria-label={label}
          className="num w-full min-w-0 bg-transparent text-center text-[2rem] font-extrabold outline-none text-cream" />
        <button onClick={onPlus} aria-label={`Aumentar ${label}`} className="size-10 shrink-0 grid place-items-center rounded-lg bg-white/10 active:bg-white/20"><Plus size={18} /></button>
      </div>
    </div>
  );
}

function RestBar({ sessionId, rest, since, auto, onAuto, onOpen }: { sessionId: string; rest: any; since: number | null; auto: boolean; onAuto: (v: boolean) => void; onOpen: () => void }) {
  const [, force] = useState(0);
  const total = rest.seconds || 150, pct = rest.running || rest.remaining ? rest.remaining / total : 0;
  const act = (fn: () => void) => { fn(); force(x => x + 1); };
  return (
    <div className="mx-3 mt-3 panel p-3">
      <div className="flex items-center gap-3">
        <button onClick={onOpen} className="relative size-14 shrink-0" aria-label="Abrir descanso em tela cheia">
          <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="5" />
            <circle cx="28" cy="28" r="24" fill="none" stroke="#1ee8d6" strokeWidth="5" strokeLinecap="round" strokeDasharray={150.8} strokeDashoffset={150.8 * (1 - pct)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <Timer size={20} className="absolute inset-0 m-auto text-aqua" />
        </button>
        <div className="flex-1">
          <p className="hud-label text-[10px] text-aqua">Descanso</p>
          <p className="num text-2xl font-extrabold">{rest.running || rest.remaining ? clock(rest.remaining * 1000) : clock(total * 1000)}</p>
        </div>
        <div className="text-right" data-testid="since-last">
          <p className="hud-label text-[10px] text-gold">Desde a última série</p>
          <p className="num text-2xl font-extrabold text-gold">{since ? clock(Math.max(0, Date.now() - since)) : '--:--'}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {rest.running ? (
          <button onClick={() => act(() => restTimer.stop(sessionId))} className="chip text-sm rounded-lg bg-white/10 px-3 py-2 w-full">Pular descanso</button>
        ) : [90, 120, 150, 180].map(s => (
          <button key={s} onClick={() => act(() => { restTimer.configure(sessionId, s, restTimer.state(sessionId).auto); })} aria-label={`Descanso de ${s} segundos`}
            className={`flex-1 num text-sm font-bold rounded-lg py-2 ${s === total ? 'bg-aqua text-night' : 'bg-white/10'}`}>{clock(s * 1000).replace(/^0/, '')}</button>
        ))}
      </div>
      <label className="mt-2 flex items-center justify-between text-sm text-haze">
        <span>Iniciar descanso automaticamente após cada série</span>
        <input type="checkbox" checked={auto} onChange={e => onAuto(e.target.checked)} className="size-5 accent-[#1ee8d6]" />
      </label>
    </div>
  );
}

function Summary({ session, entities, ids, sets }: any) {
  const work = sets.filter((s: any) => ['effective', 'core', 'back_off'].includes(s.set_type)).length;
  const warm = sets.filter((s: any) => s.set_type === 'warmup').length;
  const pending = ids.map((id: string) => liveGuidance(session, id, entities)).filter((g: any) => g.target !== null && g.resolved < g.target).length;
  return (
    <div className="space-y-2 num text-lg">
      <Row k="Séries de trabalho" v={work} />
      <Row k="Aquecimentos" v={warm} />
      <Row k="Alvos pendentes" v={pending} warn={pending > 0} />
      {finisherProgress(session, sets).filter((g: any) => g.done > 0).map((g: any) => {
        const last = finisherMarks(entities, g.key, session.id).last;
        const fmt = (n: number) => g.timed ? clock(n * 1000) : `${n} reps`;
        return <Row key={g.key} k={`Bloco final · ${g.name}`} v={`${fmt(g.done)}${last ? ` · última ${fmt(last.value)}` : ''}`} />;
      })}
    </div>
  );
}
function Row({ k, v, warn }: any) { return <div className="flex items-baseline gap-2"><span className="text-haze font-hud">{k}</span><span className="flex-1 border-b border-dotted border-white/20" /><b className={warn ? 'text-gold' : ''}>{v}</b></div>; }

/** Esforço da série: repetições que ainda daria para fazer (RIR). Opcional. */
function RirPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const opts: [number, string][] = [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5+']];
  return (
    <div className="mt-3">
      <p className="text-[11px] text-haze">Esforço (opcional): quantas repetições <b className="text-cream">ainda sobravam</b>?</p>
      <div className="grid grid-cols-6 gap-1.5 mt-1.5" role="radiogroup" aria-label="Repetições em reserva (RIR)">
        {opts.map(([v, l]) => (
          <button key={v} role="radio" aria-checked={value === v} aria-label={`RIR ${l}`} onClick={() => onChange(value === v ? null : v)}
            className={`h-10 rounded-lg num font-bold ${value === v ? (v === 0 ? 'bg-pink text-night' : 'bg-aqua text-night') : 'bg-black/40 border border-white/10'}`}>{l}</button>
        ))}
      </div>
      <p className="text-[10px] text-haze mt-1">0 = não dava mais nenhuma · 5+ = sobrou bastante</p>
    </div>
  );
}

/** Registro por tempo: cronômetro ou digitação dos segundos. */
function TimedEntry({ dose, busy, onSave }: { dose: any; busy: boolean; onSave: (secs: number) => void }) {
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [manual, setManual] = useState('');
  useEffect(() => { if (start === null) return; const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, [start]);
  const secs = start === null ? 0 : (now - start) / 1000;
  const inRange = dose && secs >= dose.min && secs <= dose.max;
  return (
    <div>
      <p className="text-sm text-haze">Meta: <b className="text-cream">{dose?.min}–{dose?.max} segundos</b>. Encerre antes se perder a posição.</p>
      <div className="mt-3 rounded-2xl bg-black/40 border border-white/10 p-4 text-center">
        <p className={`num font-extrabold text-6xl ${inRange ? 'text-cash' : 'text-cream'}`} role="timer" aria-label="Cronômetro">{secs.toFixed(1)}<span className="text-2xl text-haze"> s</span></p>
        {start === null
          ? <button onClick={() => { setStart(Date.now()); setNow(Date.now()); }} className="mt-3 w-full h-14 rounded-xl bg-aqua text-night font-display uppercase text-2xl">Iniciar cronômetro</button>
          : <button onClick={() => { const v = Math.max(1, Math.round(((Date.now() - start) / 1000) * 100) / 100); setStart(null); onSave(v); }} className="mt-3 w-full h-14 rounded-xl btn-sunset text-2xl">Parar e salvar</button>}
      </div>
      <div className="mt-3 flex gap-2">
        <input inputMode="decimal" value={manual} onChange={e => setManual(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="ou digite os segundos" aria-label="Segundos realizados" className="num flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-lg" />
        <button disabled={busy || !manual} onClick={() => { const v = Number(manual.replace(',', '.')); setManual(''); onSave(v); }} className="px-4 rounded-xl bg-white/10 chip text-sm disabled:opacity-40">Salvar tempo</button>
      </div>
      <p className="text-[11px] text-haze mt-2">Séries por tempo contam para a meta de séries, mas não somam XP (mesma regra da prancha do bloco final).</p>
    </div>
  );
}

/** Alarme do descanso: funciona com a tela cheia aberta ou minimizada (antes só tocava na tela cheia). */
function RestAlarm({ sessionId, next, overlay }: { sessionId: string; next: string; overlay: boolean }) {
  const [, tick] = useState(0);
  const [flash, setFlash] = useState(false);
  const was = useRef(false), lastBeep = useRef(-1);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 250); return () => clearInterval(t); }, []);
  const st = restTimer.state(sessionId);
  useEffect(() => {
    if (st.running && st.remaining <= 3 && st.remaining > 0 && lastBeep.current !== st.remaining) { lastBeep.current = st.remaining; sfx.tick(); }
    // Fim natural (o cronômetro chegou a zero). "Pular" zera sem alarme.
    if (was.current && !st.running && st.endsAt !== null) {
      sfx.restEnd(); notifyRestEnd(next);
      if (!overlay) { setFlash(true); setTimeout(() => setFlash(false), 4000); }
    }
    if (st.remaining > 3) lastBeep.current = -1;
    was.current = st.running;
  });
  return (
    <AnimatePresence>
      {flash && (
        <motion.button data-testid="rest-flash" onClick={() => setFlash(false)} initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }}
          className="fixed top-[max(env(safe-area-inset-top),10px)] inset-x-3 z-[80] rounded-2xl px-4 py-3 text-left bg-gradient-to-r from-pink via-flame to-gold text-night shadow-[0_0_40px_rgba(255,46,147,.6)]">
          <motion.span className="block font-display uppercase text-2xl leading-tight" animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: .6 }}>Descanso acabou!</motion.span>
          <span className="block font-hud font-bold text-sm">A seguir: {next}</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
