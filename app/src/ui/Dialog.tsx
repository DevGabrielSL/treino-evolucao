// Diálogos de confirmação no estilo do jogo (substituem o confirm() do navegador).
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type Req = { id: number; text: string; ok: string; danger?: boolean; resolve: (v: boolean) => void };
const bus = new EventTarget(); let seq = 0;
export function ask(text: string, opts: { ok?: string; danger?: boolean } = {}) {
  return new Promise<boolean>(resolve => bus.dispatchEvent(new CustomEvent('ask', { detail: { id: ++seq, text, ok: opts.ok || 'Confirmar', danger: opts.danger, resolve } })));
}
export function DialogHost() {
  const [q, setQ] = useState<Req[]>([]);
  useEffect(() => { const f = (e: Event) => setQ(x => [...x, (e as CustomEvent).detail]); bus.addEventListener('ask', f); return () => bus.removeEventListener('ask', f); }, []);
  const cur = q[0];
  const done = (v: boolean) => { cur.resolve(v); setQ(x => x.slice(1)); };
  return (
    <AnimatePresence>
      {cur && (
        <motion.div key={cur.id} className="fixed inset-0 z-[95] grid place-items-center px-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => done(false)} />
          <motion.div role="alertdialog" aria-modal="true" initial={{ scale: .9, y: 20 }} animate={{ scale: 1, y: 0 }} className="relative w-full max-w-sm panel p-5 border-gold/30">
            <p className="hud-label text-gold text-[11px]">Confirmação</p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{cur.text}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => done(false)} className="h-12 rounded-xl bg-white/10 chip">Voltar</button>
              <button onClick={() => done(true)} className={`h-12 rounded-xl chip ${cur.danger ? 'bg-pink text-night' : 'btn-sunset'}`}>{cur.ok}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
