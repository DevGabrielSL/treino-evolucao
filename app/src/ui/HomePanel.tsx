// Desafios diários e Treino em casa (peso corporal).
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronRight, Flame, Home, Play, X, Zap } from 'lucide-react';
import { dailyPlan, dailyQuests, dailyStreak, homePlan, HOME_NAME, DAILY_NAME } from '../engine/home';
import { startPlan } from '../engine/workout';
import { ExerciseVisual } from './ExerciseVisual';
import { asset } from './assets';
import { sfx } from '../fx/sfx';
import { clock, nf } from './format';

type P = { model: any; active: any; onStarted: (deck: any) => void; onError: (e: any) => void };
const fmt = (n: number, unit: 'reps' | 's') => unit === 's' ? (n >= 60 ? clock(n * 1000).replace(/^0/, '') : `${n}s`) : `${n}`;

function deckFor(plan: any, title: string, district: string, cover: string) {
  const sets = plan.items.reduce((n: number, x: any) => n + (x.dose?.sets || 3), 0);
  return { id: plan.presetId, index: -1, title, district, cover: asset(cover), items: plan.items, sets, xp: sets * 10 + 100 };
}

export function DailyCard({ model, active, onStarted, onError }: P) {
  const quests = useMemo(() => dailyQuests(model.entities), [model]);
  const streak = useMemo(() => dailyStreak(model.entities), [model]);
  const [busy, setBusy] = useState(false);
  const main = quests.slice(0, 3), bonus = quests[3];
  const allMain = main.every(q => q.done);
  const start = async () => {
    if (busy) return; setBusy(true); sfx.tap();
    try { const plan = dailyPlan(model.entities); await startPlan(plan, model); onStarted(deckFor(plan, 'Desafio diário', 'Desafios do dia', 'deck-cover-03.webp')); }
    catch (e) { onError(e); } finally { setBusy(false); }
  };
  return (
    <section className="panel p-4" data-testid="daily-card">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display uppercase text-2xl"><span className="title-slash">Desafios do dia</span></h2>
        <span className="num text-sm text-haze flex items-center gap-1">{streak > 0 ? <><Flame size={14} className="text-flame" />{streak} {streak === 1 ? 'dia' : 'dias'}</> : 'Comece hoje'}</span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {[...main, bonus].map((q, i) => {
          const p = Math.min(1, q.value / q.target);
          return (
            <li key={q.key} data-testid={`quest-${q.key}`} data-done={q.done}>
              <div className="flex items-center gap-2 text-sm">
                <span className={`grid place-items-center size-5 rounded-full shrink-0 ${q.done ? 'bg-cash text-night' : 'bg-white/10'}`}>{q.done && <Check size={12} strokeWidth={3} />}</span>
                <span className={`font-hud font-semibold text-[15px] flex-1 ${q.done ? 'text-cash' : ''}`}>{q.title} {i === 3 && <span className="chip text-[10px] text-gold ml-1">bônus</span>}</span>
                <span className="num text-haze">{fmt(Math.min(q.value, q.target), q.unit)}/{fmt(q.target, q.unit)}{q.unit === 'reps' ? ' reps' : ''}</span>
              </div>
              <div className="mt-1 ml-7 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div className={`h-full rounded-full ${q.done ? 'bg-cash' : 'bg-gradient-to-r from-aqua to-violet'}`} initial={{ width: 0 }} animate={{ width: `${p * 100}%` }} transition={{ duration: .8, delay: i * .08 }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-haze mt-3 leading-snug">Conta tudo o que você registrar hoje: bloco final da academia, treino em casa ou o desafio rápido. Cardio é por tempo (esteira, bike, corrida, polichinelo).</p>
      <button disabled={!!active || busy} onClick={start} className="mt-3 w-full h-12 rounded-xl bg-gradient-to-r from-aqua to-violet text-night chip text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-40">
        <Zap size={16} className="fill-current" /> {active ? 'Termine a missão atual' : allMain ? 'Fazer de novo (extra)' : 'Fazer o que falta agora'}
      </button>
    </section>
  );
}

export function HomeCard({ model, active, onStarted, onError }: P) {
  const [open, setOpen] = useState(false);
  const plan = useMemo(() => homePlan(model.entities), [model]);
  const sets = plan.items.reduce((n: number, x: any) => n + x.dose.sets, 0);
  const last = model.entities.sessions.filter((s: any) => s.status === 'completed' && s.name === HOME_NAME).map((s: any) => s.date).sort().at(-1);
  return (
    <>
      <button data-testid="home-card" onClick={() => { sfx.tap(); setOpen(true); }} className="panel w-full flex items-center gap-3 p-3 text-left">
        <span className="grid place-items-center size-11 rounded-xl bg-gradient-to-br from-aqua to-cash text-night"><Home size={20} /></span>
        <span className="flex-1"><b className="font-display uppercase text-xl leading-[1.1] block">Treino em casa</b>
          <span className="text-xs text-haze">{plan.items.length} exercícios · {sets} séries · sem equipamento{last ? ` · último ${last.split('-').reverse().slice(0, 2).join('/')}` : ''}</span></span>
        <ChevronRight className="text-haze" />
      </button>
      {createPortal(<AnimatePresence>{open && <HomeBriefing model={model} plan={plan} active={active} onClose={() => setOpen(false)} onStarted={onStarted} onError={onError} />}</AnimatePresence>, document.body)}
    </>
  );
}

function HomeBriefing({ model, plan, active, onClose, onStarted, onError }: any) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (busy) return; setBusy(true);
    try { await startPlan(plan, model); onClose(); onStarted(deckFor(plan, 'Treino em casa', 'Sem equipamento', 'deck-cover-04.webp')); }
    catch (e) { onError(e); } finally { setBusy(false); }
  };
  return (
    <motion.div className="fixed inset-0 z-[55] flex flex-col justify-end max-w-lg mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div role="dialog" aria-label={HOME_NAME} className="relative max-h-[88vh] overflow-y-auto no-scrollbar rounded-t-[26px] bg-dusk border-t border-white/10"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 z-10 size-10 grid place-items-center rounded-full bg-black/60"><X /></button>
        <div className="px-4 pt-6">
          <p className="chip text-aqua text-sm">Briefing · sem equipamento</p>
          <h2 className="font-display uppercase text-4xl leading-[1.08] sunset-text pr-10">Treino em casa</h2>
          <p className="text-haze text-sm mt-2">{plan.presetNote} Repetições com o próprio peso (carga extra é opcional); polichinelo, escalador e prancha são por tempo.</p>
        </div>
        <ol className="px-4 mt-4 space-y-2 pb-36">
          {plan.items.map((item: any, i: number) => (
            <li key={item.variant_id} className="panel flex items-center gap-3 p-2 pr-3">
              <span className="num font-extrabold text-2xl w-8 text-center text-white/30">{String(i + 1).padStart(2, '0')}</span>
              <div className="duotone-wrap size-14 rounded-lg shrink-0 bg-plum"><ExerciseVisual name={item.name} equipment={item.equipment} size="sm" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-hud font-bold text-[17px] leading-tight">{item.name}</p>
                <p className="text-xs text-haze truncate">{item.equipment}</p>
              </div>
              <div className="text-right">
                <p className="num font-bold text-gold">{item.dose.sets}×{item.dose.min}–{item.dose.max}{item.dose.unit === 'segundos' ? 's' : ''}</p>
                {item.last && <p className="num text-[11px] text-haze">últ. {item.last.repetitions} reps{item.last.load_value ? ` +${nf(item.last.load_value)} kg` : ''}</p>}
              </div>
            </li>
          ))}
        </ol>
        <div className="fixed bottom-0 inset-x-0 max-w-lg mx-auto p-4 pb-[max(env(safe-area-inset-bottom),16px)] bg-gradient-to-t from-dusk via-dusk to-transparent">
          <button disabled={!!active || busy} onClick={go} className="btn-sunset w-full h-14 rounded-xl text-2xl flex items-center justify-center gap-2 disabled:opacity-40">
            <Play className="fill-current" size={22} /> {active ? 'Termine a missão atual' : 'Iniciar treino em casa'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export { DAILY_NAME };
