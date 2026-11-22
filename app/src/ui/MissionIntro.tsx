// Abertura cinematográfica ao iniciar uma missão (toque para pular).
import { useEffect } from 'react';
import { motion } from 'motion/react';
import { DISTRICTS } from './CityMap';
import { sfx } from '../fx/sfx';

export function MissionIntro({ deck, onDone }: { deck: any; onDone: () => void }) {
  useEffect(() => { sfx.start(); const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div className="fixed inset-0 z-[85] bg-night overflow-hidden" onClick={onDone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: .4 } }}>
      <motion.img src={deck.cover} alt="" className="absolute inset-0 size-full object-cover" initial={{ scale: 1.35, x: '6%' }} animate={{ scale: 1.1, x: '-4%' }} transition={{ duration: 3.2, ease: 'linear' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-night/30" />
      {/* faixas de cinema */}
      <motion.div className="absolute inset-x-0 top-0 h-[13vh] bg-black" initial={{ y: '-100%' }} animate={{ y: 0 }} transition={{ duration: .45, ease: 'easeOut' }} />
      <motion.div className="absolute inset-x-0 bottom-0 h-[13vh] bg-black" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: .45, ease: 'easeOut' }} />
      <div className="absolute inset-x-6 bottom-[19vh]">
        <motion.p className="hud-label text-aqua" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .4 }}>{deck.index >= 0 ? `${DISTRICTS[deck.index]?.name} · Deck ${String(deck.index + 1).padStart(2, '0')}` : deck.district}</motion.p>
        <motion.h1 className="font-display uppercase text-[3.4rem] leading-[1.06] sunset-text" initial={{ opacity: 0, y: 40, letterSpacing: '.2em' }} animate={{ opacity: 1, y: 0, letterSpacing: '0em' }} transition={{ delay: .55, duration: .6, ease: 'easeOut' }}>{deck.title}</motion.h1>
        <motion.div className="mt-3 space-y-1" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: .15, delayChildren: 1.1 } } }}>
          {[`${deck.count ?? deck.items.length} alvos · ${deck.sets} séries`, `Recompensa estimada: +${deck.xp} XP`, 'Registre cada série logo após realizar'].map(t => (
            <motion.p key={t} variants={{ h: { opacity: 0, x: -16 }, s: { opacity: 1, x: 0 } }} className="font-hud font-semibold text-lg text-cream flex items-center gap-2"><span className="h-0.5 w-4 bg-gold" />{t}</motion.p>
          ))}
        </motion.div>
      </div>
      <motion.p className="absolute bottom-[4.5vh] inset-x-0 text-center hud-label text-haze text-[10px]" animate={{ opacity: [.3, 1, .3] }} transition={{ duration: 1.6, repeat: Infinity }}>Toque para começar</motion.p>
    </motion.div>
  );
}
