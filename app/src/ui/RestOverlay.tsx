// Descanso em tela cheia: contagem grande, ajuste rápido e aviso sonoro/vibração no fim.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { restTimer } from '../engine/workout';
import { sfx } from '../fx/sfx';
import { clock } from './format';

const KEY = 'treino-evolucao-autorest-v1';
export function autoRest() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
export function setAutoRest(on: boolean) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* sem armazenamento */ } }

export function RestOverlay({ sessionId, next, onClose }: { sessionId: string; next: string; onClose: () => void }) {
  const [, tick] = useState(0);
  const was = useRef(true);
  const st = restTimer.state(sessionId);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 250); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (st.running && st.remaining <= 3 && st.remaining > 0) sfx.tick();
    if (was.current && !st.running) { sfx.restEnd(); setTimeout(onClose, 1200); }
    was.current = st.running;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.remaining, st.running]);
  const total = st.seconds || 90, pct = st.running ? st.remaining / total : 0;
  const R = 118, C = 2 * Math.PI * R;
  const add = (d: number) => { const left = Math.max(5, st.remaining + d); restTimer.start(sessionId, Math.min(3600, Math.max(10, left))); restTimer.configure(sessionId, total, restTimer.state(sessionId).auto); tick(x => x + 1); };
  return (
    <motion.div className="fixed inset-0 z-[75] bg-night/95 backdrop-blur-xl flex flex-col items-center justify-center px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button onClick={onClose} className="absolute top-[max(env(safe-area-inset-top),16px)] left-4 chip text-haze flex items-center gap-1"><ChevronDown size={18} /> Minimizar</button>
      <p className="hud-label text-aqua">{st.running ? 'Descanso' : 'Hora da próxima série'}</p>
      <div className="relative mt-4" style={{ width: 2 * R + 24, height: 2 * R + 24 }}>
        <svg viewBox={`0 0 ${2 * R + 24} ${2 * R + 24}`} className="absolute inset-0 -rotate-90">
          <circle cx={R + 12} cy={R + 12} r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="14" />
          <circle cx={R + 12} cy={R + 12} r={R} fill="none" stroke="url(#restg)" strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset .25s linear' }} />
          <defs><linearGradient id="restg"><stop offset="0" stopColor="#1ee8d6" /><stop offset="1" stopColor="#8d5cff" /></linearGradient></defs>
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          {st.running
            ? <span className={`num font-extrabold text-[5.5rem] leading-none ${st.remaining <= 5 ? 'text-gold' : 'text-cream'}`}>{clock(st.remaining * 1000)}</span>
            : <motion.span initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display uppercase text-6xl sunset-text">Vai!</motion.span>}
        </div>
      </div>
      <p className="font-hud text-lg text-haze mt-6 text-center">A seguir: <b className="text-cream">{next}</b></p>
      {st.running && (
        <div className="mt-6 grid grid-cols-3 gap-2 w-full max-w-xs">
          <button onClick={() => add(-15)} className="num font-bold rounded-xl bg-white/10 py-3">−15s</button>
          <button onClick={() => { restTimer.stop(sessionId); tick(x => x + 1); }} className="chip rounded-xl bg-aqua text-night py-3">Pular</button>
          <button onClick={() => add(15)} className="num font-bold rounded-xl bg-white/10 py-3">+15s</button>
        </div>
      )}
    </motion.div>
  );
}
