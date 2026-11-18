import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { XP_PER_LEVEL, rankFor } from '../game/progress';
import { nf } from './format';

export function LevelBadge({ level, progress, size = 54 }: { level: number; progress: number; size?: number }) {
  const r = size / 2 - 4, c = 2 * Math.PI * r, p = progress / XP_PER_LEVEL;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(11,7,22,.85)" stroke="rgba(255,255,255,.1)" strokeWidth="4" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#lvl)" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        <defs><linearGradient id="lvl" x1="0" x2="1"><stop offset="0" stopColor="#ff2e93" /><stop offset="1" stopColor="#ffc54d" /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center leading-none text-center">
        <span className="hud-label text-[9px] text-haze -mb-0.5">NV</span>
        <span className="font-display text-xl text-cream" style={{ marginTop: -4 }}>{level}</span>
      </div>
    </div>
  );
}

export function Stars({ value, total = 5, size = 15 }: { value: number; total?: number; size?: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} de ${total} estrelas`}>
      {Array.from({ length: total }, (_, i) => (
        <Star key={i} size={size} strokeWidth={2.2}
          className={i < value ? 'fill-gold text-gold drop-shadow-[0_0_6px_rgba(255,197,77,.7)]' : 'text-white/25'} />
      ))}
    </div>
  );
}

export function TopHud({ xp, rhythm }: { xp: { total: number; level: number; progress: number }; rhythm: { stars: number; thisWeek: number; goal: number } }) {
  return (
    <header className="sticky top-0 z-30 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 bg-gradient-to-b from-night via-night/85 to-transparent">
      <div className="flex items-center gap-3">
        <LevelBadge level={xp.level} progress={xp.progress} />
        <div className="min-w-0 flex-1">
          <p className="hud-label text-aqua text-[10px]">{rankFor(xp.level)}</p>
          <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-pink via-flame to-gold"
              initial={{ width: 0 }} animate={{ width: `${(xp.progress / XP_PER_LEVEL) * 100}%` }} transition={{ duration: 1 }} />
          </div>
          <p className="num text-[11px] text-haze mt-1">{nf(xp.progress, 0)} / {XP_PER_LEVEL} XP para o nível {xp.level + 1}</p>
        </div>
        <div className="text-right">
          <p className="num text-2xl font-extrabold leading-none text-cash drop-shadow-[0_2px_0_rgba(0,0,0,.6)]">{nf(xp.total, 0)}<span className="text-sm ml-0.5">XP</span></p>
          <div className="mt-1.5 flex justify-end"><Stars value={rhythm.stars} size={13} /></div>
        </div>
      </div>
    </header>
  );
}
