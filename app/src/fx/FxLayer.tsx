// Camada de efeitos visuais (partículas, XP voando, carimbos) acionada por eventos.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type Burst = { id: number; x: number; y: number; colors: string[]; count: number; spread: number };
type Fly = { id: number; x: number; y: number; tx: number; ty: number; text: string };
type Stamp = { id: number; title: string; sub?: string; tone: 'gold' | 'pink' | 'aqua' };

let seq = 0;
const bus = new EventTarget();
export const fx = {
  burst(x: number, y: number, opts: Partial<Omit<Burst, 'id' | 'x' | 'y'>> = {}) { bus.dispatchEvent(new CustomEvent('burst', { detail: { id: ++seq, x, y, colors: ['#ffc54d', '#ff2e93', '#1ee8d6', '#ff6b3d'], count: 22, spread: 140, ...opts } })); },
  burstFrom(el: Element | null, opts?: Partial<Omit<Burst, 'id' | 'x' | 'y'>>) { if (!el) return; const r = el.getBoundingClientRect(); fx.burst(r.left + r.width / 2, r.top + r.height / 2, opts); },
  flyXp(from: Element | null, text: string) {
    const target = document.getElementById('xp-target'); if (!from || !target) return;
    const a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
    bus.dispatchEvent(new CustomEvent('fly', { detail: { id: ++seq, x: a.left + a.width / 2, y: a.top + a.height / 2, tx: b.left + b.width / 2, ty: b.top + b.height / 2, text } }));
  },
  stamp(title: string, sub?: string, tone: Stamp['tone'] = 'gold') { bus.dispatchEvent(new CustomEvent('stamp', { detail: { id: ++seq, title, sub, tone } })); },
  confetti() { const w = window.innerWidth; [0.2, 0.5, 0.8].forEach((p, i) => setTimeout(() => fx.burst(w * p, window.innerHeight * .35, { count: 34, spread: 220 }), i * 140)); },
};

export function FxLayer() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [flies, setFlies] = useState<Fly[]>([]);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  useEffect(() => {
    const add = <T extends { id: number }>(set: (f: (x: T[]) => T[]) => void, ms: number) => (e: Event) => {
      const d = (e as CustomEvent).detail as T; set(x => [...x, d]); setTimeout(() => set(x => x.filter(i => i.id !== d.id)), ms);
    };
    const b = add<Burst>(setBursts, 1400), f = add<Fly>(setFlies, 1100), s = add<Stamp>(setStamps, 2300);
    bus.addEventListener('burst', b); bus.addEventListener('fly', f); bus.addEventListener('stamp', s);
    return () => { bus.removeEventListener('burst', b); bus.removeEventListener('fly', f); bus.removeEventListener('stamp', s); };
  }, []);
  return (
    <div className="fixed inset-0 z-[90] pointer-events-none overflow-hidden" aria-hidden="true">
      {bursts.map(b => Array.from({ length: b.count }, (_, i) => {
        const ang = (i / b.count) * Math.PI * 2 + Math.random() * .5, dist = b.spread * (.45 + Math.random() * .7), size = 4 + Math.random() * 7;
        return (
          <motion.span key={b.id + '-' + i} className="absolute rounded-[2px]"
            style={{ left: b.x, top: b.y, width: size, height: size * (Math.random() > .5 ? 1 : 2.4), background: b.colors[i % b.colors.length], boxShadow: `0 0 8px ${b.colors[i % b.colors.length]}` }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{ x: Math.cos(ang) * dist, y: Math.sin(ang) * dist + 120, opacity: 0, rotate: Math.random() * 540, scale: .6 }}
            transition={{ duration: 1.1 + Math.random() * .3, ease: [.15, .7, .3, 1] }} />
        );
      }))}
      {flies.map(f => (
        <motion.span key={f.id} className="absolute num font-extrabold text-2xl text-cash drop-shadow-[0_2px_0_rgba(0,0,0,.8)] -translate-x-1/2 -translate-y-1/2"
          style={{ left: f.x, top: f.y }}
          initial={{ x: 0, y: 0, scale: .6, opacity: 0 }}
          animate={{ x: [0, (f.tx - f.x) * .3, f.tx - f.x], y: [0, -70, f.ty - f.y], scale: [.6, 1.4, .5], opacity: [0, 1, .9] }}
          transition={{ duration: 1, times: [0, .35, 1], ease: 'easeInOut' }}>{f.text}</motion.span>
      ))}
      <AnimatePresence>
        {stamps.slice(-1).map(s => (
          <motion.div key={s.id} className="absolute inset-x-0 top-[30%] flex justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -30 }}>
            <motion.div initial={{ scale: 3, rotate: -14, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }} transition={{ type: 'spring', damping: 11, stiffness: 220 }}
              className={`px-6 py-3 text-center border-4 rounded-lg bg-night/80 backdrop-blur ${s.tone === 'gold' ? 'border-gold text-gold shadow-[0_0_50px_rgba(255,197,77,.6)]' : s.tone === 'pink' ? 'border-pink text-pink shadow-[0_0_50px_rgba(255,46,147,.6)]' : 'border-aqua text-aqua shadow-[0_0_50px_rgba(30,232,214,.6)]'}`}>
              <p className="font-display uppercase text-5xl leading-[1.1]">{s.title}</p>
              {s.sub && <p className="chip text-cream text-sm mt-1">{s.sub}</p>}
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
