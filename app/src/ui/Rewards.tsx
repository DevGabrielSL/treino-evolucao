import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { missionSummary } from '../game/summary';
import { shareMission } from '../fx/shareCard';
import { Share2 } from 'lucide-react';
import { fx } from '../fx/FxLayer';
import { sfx } from '../fx/sfx';
import { AnimatePresence, motion, animate } from 'motion/react';
import { XP_PER_LEVEL, rankFor } from '../game/progress';
import type { XpReward } from '../engine/store';
import { clock, nf } from './format';
import { tierName } from '../game/season';

export function XpToast({ reward }: { reward: (XpReward & { key: number }) | null }) {
  return (
    <div className="fixed right-3 top-[calc(max(env(safe-area-inset-top),10px)+64px)] z-[60] pointer-events-none">
      <AnimatePresence>
        {reward && !reward.finished && (
          <motion.div key={reward.key} initial={{ x: 140, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 140, opacity: 0 }} transition={{ type: 'spring', damping: 20 }}
            className="rounded-l-xl rounded-r-md bg-black/80 border-r-4 border-cash px-4 py-2 text-right shadow-xl">
            <p className="num text-3xl font-extrabold text-cash leading-none">+{reward.gain} XP</p>
            {reward.bonus > 0 && <p className="chip text-[11px] text-gold mt-1">Carga anterior superada</p>}
            {reward.to.level > reward.from.level && <p className="chip text-[11px] text-pink mt-1">Subiu para o nível {reward.to.level}!</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Counter({ to, from = 0, duration = 1.4 }: { to: number; from?: number; duration?: number }) {
  const [v, setV] = useState(from);
  useEffect(() => { const c = animate(from, to, { duration, ease: 'easeOut', onUpdate: x => setV(Math.round(x)) }); return () => c.stop(); }, [to, from, duration]);
  return <>{nf(v, 0)}</>;
}

export function MissionComplete({ data, model, goal = 4, onClose }: { data: { sessionId: string; reward: XpReward } | null; model: any; goal?: number; onClose: () => void }) {
  const [stage, setStage] = useState<'stats' | 'level'>('stats');
  useEffect(() => { sfx.complete(); const t = setTimeout(() => fx.confetti(), 450); return () => clearTimeout(t); }, []);
  if (!data) return null;
  const sum = missionSummary(model, data.sessionId, goal);
  const { session: s, work, volume, prs, ms, missionXp, rating, ratingText, season } = sum;
  const tierUp = season.after > season.before;
  const r = data.reward, levelUp = r && r.to.level > r.from.level;
  return (
    <motion.div className="fixed inset-0 z-[70] grid place-items-center px-5 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur" />
      {/* faixa de luz */}
      <motion.div className="absolute inset-x-0 top-[22%] h-40 bg-gradient-to-r from-transparent via-pink/35 to-transparent blur-2xl" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: .7 }} />
      {stage === 'level' && r && (
        <motion.div className="absolute inset-0 z-10 grid place-items-center bg-night/95 text-center px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
          <div>
            <p className="hud-label text-aqua">Novo nível</p>
            <motion.p initial={{ scale: 4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 10 }} className="font-display text-[9rem] leading-none sunset-text">{r.to.level}</motion.p>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .5 }} className="font-display uppercase text-3xl mt-2">{rankFor(r.to.level)}</motion.p>
            {rankFor(r.to.level) !== rankFor(r.from.level) && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .9 }} className="chip text-gold mt-2">Novo título desbloqueado</motion.p>}
            <p className="hud-label text-haze mt-10 text-[10px]">Toque para continuar</p>
          </div>
        </motion.div>
      )}
      <div className="relative w-full max-w-sm text-center">
        <motion.p className="hud-label text-aqua" initial={{ opacity: 0, letterSpacing: '.6em' }} animate={{ opacity: 1, letterSpacing: '.18em' }} transition={{ duration: .6 }}>{s?.name}</motion.p>
        <motion.h1 className="font-display uppercase text-[3.4rem] leading-[1.12] sunset-text mt-3" initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 13, stiffness: 160, delay: .15 }}>
          Missão<br />concluída
        </motion.h1>
        <div className="mt-4 flex justify-center gap-2">
          {[1, 2, 3].map(i => (
            <motion.span key={i} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: .5 + i * .18, type: 'spring', damping: 9 }}>
              <Star size={44} strokeWidth={1.5} className={i <= rating ? 'fill-gold text-gold drop-shadow-[0_0_14px_rgba(255,197,77,.9)]' : 'text-white/25'} />
            </motion.span>
          ))}
        </div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="chip text-gold mt-1">{ratingText}</motion.p>
        <motion.div className="mt-5 space-y-2 text-left num text-lg" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: .12, delayChildren: .6 } } }}>
          {[
            ['Tempo', clock(Math.max(0, ms))],
            ['Séries de trabalho', String(work.length)],
            ['Volume movido', `${nf(volume, 0)} kg`],
            ['Recordes batidos', String(prs.length)],
          ].map(([k, v]) => (
            <motion.div key={k} variants={{ h: { opacity: 0, x: -20 }, s: { opacity: 1, x: 0 } }} className="flex items-baseline gap-2">
              <span className="font-hud text-haze">{k}</span><span className="flex-1 border-b border-dotted border-white/25" /><b>{v}</b>
            </motion.div>
          ))}
        </motion.div>
        {prs.length > 0 && (
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="mt-3 space-y-1 text-left">
            {prs.slice(0, 3).map((p: any) => <li key={p.variant_id} className="chip text-[13px] text-gold">★ {p.exercise}: {nf(p.previous)} → {nf(p.load)} {p.unit}</li>)}
          </motion.ul>
        )}
        {r && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }} className="mt-6">
            <p className="num text-5xl font-extrabold text-cash drop-shadow-[0_3px_0_rgba(0,0,0,.8)]">+<Counter to={missionXp} /> XP</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="font-display text-xl">{r.to.level}</span>
              <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-pink via-flame to-gold" initial={{ width: `${levelUp ? 0 : (r.from.progress / XP_PER_LEVEL) * 100}%` }} animate={{ width: `${(r.to.progress / XP_PER_LEVEL) * 100}%` }} transition={{ delay: 1.6, duration: 1.2 }} />
              </div>
              <span className="font-display text-xl text-haze">{r.to.level + 1}</span>
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, scale: tierUp ? [1, 1.12, 1] : 1 }} transition={{ delay: 2.1 }} data-testid="season-tier"
              className={`chip text-[13px] mt-2 ${tierUp ? 'text-aqua' : 'text-haze'}`}>
              Temporada {season.number > 0 ? season.number : ''} · {tierUp ? `Faixa ${season.before} → ${season.after} · ${tierName(season.after)}` : `Faixa ${season.after} do passe`}
            </motion.p>
            {levelUp && <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.4, type: 'spring' }} className="chip text-pink text-lg mt-2">Novo nível · {rankFor(r.to.level)}</motion.p>}
          </motion.div>
        )}
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} onClick={() => { if (levelUp && stage === 'stats') { sfx.level(); fx.confetti(); setStage('level'); } else onClose(); }} className="btn-sunset shine mt-8 w-full h-14 rounded-xl text-2xl">Continuar</motion.button>
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }} onClick={() => shareMission(model, data.sessionId).catch(() => {})} className="mt-2 w-full h-12 rounded-xl bg-white/10 border border-white/15 chip text-sm flex items-center justify-center gap-2"><Share2 size={16} /> Compartilhar cartão da missão</motion.button>
      </div>
    </motion.div>
  );
}
