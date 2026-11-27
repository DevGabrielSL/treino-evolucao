// Partes da tela de treino: campos, descanso, resumo, esforço (RIR), série por tempo e alarme.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Plus, Timer } from 'lucide-react';
import { finisherProgress, liveGuidance, restTimer } from '../engine/workout';
import { finisherMarks } from '../engine/finisherMarks';
import { sfx } from '../fx/sfx';
import { notifyRestEnd } from '../fx/notify';
import { clock } from './format';

export function Stepper({ label, value, onChange, onMinus, onPlus, decimal }: any) {
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

export function RestBar({ sessionId, rest, since, planned, onPick, auto, onAuto, onOpen }: { sessionId: string; rest: any; since: number | null; planned: number; onPick: (s: number) => void; auto: boolean; onAuto: (v: boolean) => void; onOpen: () => void }) {
  const [, force] = useState(0);
  const total = rest.running || rest.remaining ? rest.seconds || planned : planned, pct = rest.running || rest.remaining ? rest.remaining / total : 0;
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
          <button key={s} onClick={() => act(() => { restTimer.configure(sessionId, s, restTimer.state(sessionId).auto); onPick(s); })} aria-label={`Descanso de ${s} segundos`}
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

export function Summary({ session, entities, ids, sets }: any) {
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
export function RirPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
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
export function TimedEntry({ dose, busy, onSave }: { dose: any; busy: boolean; onSave: (secs: number) => void }) {
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
export function RestAlarm({ sessionId, next, overlay, onEnd }: { sessionId: string; next: string; overlay: boolean; onEnd?: () => void }) {
  const [, tick] = useState(0);
  const [flash, setFlash] = useState(false);
  const was = useRef(false), lastBeep = useRef(-1);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 250); return () => clearInterval(t); }, []);
  const st = restTimer.state(sessionId);
  useEffect(() => {
    if (st.running && st.remaining <= 3 && st.remaining > 0 && lastBeep.current !== st.remaining) { lastBeep.current = st.remaining; sfx.tick(); }
    // Fim natural (o cronômetro chegou a zero). "Pular" zera sem alarme.
    if (was.current && !st.running && st.endsAt !== null) {
      sfx.restEnd(); notifyRestEnd(next); onEnd?.();
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
