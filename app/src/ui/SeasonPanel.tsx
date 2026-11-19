// Passe da temporada (8 semanas). Só lê o histórico; nada é gravado.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronRight, Crown, Lock, Skull, Swords, X } from 'lucide-react';
import { pastSeasons, seasonOf, seasonProgress, tierName, TIERS, SEASON_WEEKS, type Challenge } from '../game/season';
import { sfx } from '../fx/sfx';
import { nf } from './format';

const pt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const TIER_BG = (t: number) => t >= 10 ? 'from-pink via-violet to-aqua' : t >= 7 ? 'from-gold to-flame' : t >= 4 ? 'from-[#e6e9f0] to-[#7d8494]' : t >= 1 ? 'from-[#c77b3d] to-[#7a3f1a]' : 'from-white/15 to-white/5';

export function SeasonCard({ model, goal }: { model: any; goal: number }) {
  const [open, setOpen] = useState(false);
  const p = useMemo(() => seasonProgress(model.entities, goal, seasonOf()), [model, goal]);
  const into = p.tier >= TIERS ? 1 : (p.xp - p.tier * p.size) / p.size;
  const done = p.challenges.filter(c => c.done).length;
  return (
    <>
      <button data-testid="season-card" onClick={() => { sfx.tap(); setOpen(true); }} className="panel w-full p-4 text-left relative overflow-hidden">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-violet/25 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <TierBadge tier={p.tier} />
          <div className="flex-1 min-w-0">
            <p className="hud-label text-aqua text-[10px]">Temporada {p.info.number > 0 ? p.info.number : ''} · semana {p.info.week}/{SEASON_WEEKS}</p>
            <p className="font-display uppercase text-[1.7rem] leading-[1.1] sunset-text truncate">{p.info.name}</p>
            <p className="num text-xs text-haze">{p.tier >= TIERS ? 'Passe completo' : `Faixa ${p.tier} · faltam ${nf(p.next ?? 0, 0)} XP para a ${p.tier + 1}`} · {p.info.daysLeft} {p.info.daysLeft === 1 ? 'dia' : 'dias'}</p>
          </div>
          <ChevronRight className="text-haze shrink-0" />
        </div>
        <div className="mt-3 grid grid-cols-10 gap-[3px]" aria-label={`Faixa ${p.tier} de ${TIERS}`}>
          {Array.from({ length: TIERS }, (_, k) => (
            <span key={k} className="h-2.5 rounded-[2px] bg-white/10 overflow-hidden">
              <motion.span className="block h-full bg-gradient-to-r from-violet via-pink to-gold" initial={{ width: 0 }}
                animate={{ width: k < p.tier ? '100%' : k === p.tier ? `${into * 100}%` : '0%' }} transition={{ delay: .05 * k, duration: .5 }} />
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] chip">
          <span className="text-haze">Desafios {done}/{p.challenges.length}</span>
          <span className={p.bossState === 'active' ? 'text-pink animate-pulse' : p.bossState === 'won' ? 'text-cash' : 'text-haze'}>
            {p.bossState === 'active' ? 'Chefão liberado!' : p.bossState === 'won' ? 'Chefão vencido' : p.bossState === 'lost' ? 'Chefão escapou' : `Chefão na semana ${SEASON_WEEKS}`}
          </span>
        </div>
      </button>
      {/* no body: o painel não herda a animação/transform da tela */}
      {createPortal(<AnimatePresence>{open && <SeasonSheet model={model} goal={goal} onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
}

function TierBadge({ tier, size = 54 }: { tier: number; size?: number }) {
  return (
    <span className={`relative grid place-items-center shrink-0 rotate-45 rounded-xl bg-gradient-to-br ${TIER_BG(tier)} shadow-[0_0_24px_-6px_rgba(255,46,147,.7)]`} style={{ width: size * .78, height: size * .78, margin: size * .11 }}>
      <span className="-rotate-45 font-display text-night leading-none" style={{ fontSize: size * .42 }}>{tier}</span>
    </span>
  );
}

function SeasonSheet({ model, goal, onClose }: { model: any; goal: number; onClose: () => void }) {
  const p = useMemo(() => seasonProgress(model.entities, goal, seasonOf()), [model, goal]);
  const past = useMemo(() => pastSeasons(model.entities, goal), [model, goal]);
  const max = Math.max(goal, ...p.weeks);
  const boss = p.challenges.find(c => c.id === 'chefao')!;
  return (
    <motion.div className="fixed inset-0 z-[55] flex flex-col justify-end max-w-lg mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div role="dialog" aria-label="Temporada" className="relative max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-[26px] bg-dusk border-t border-white/10 px-4 pt-5 pb-[max(env(safe-area-inset-bottom),24px)]"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 z-10 size-10 grid place-items-center rounded-full bg-black/60"><X /></button>
        <p className="chip text-gold text-sm">Temporada {p.info.number > 0 ? p.info.number : ''} · {pt(p.info.start)} a {pt(p.info.end)}</p>
        <h2 className="font-display uppercase text-[2.6rem] leading-[1.1] sunset-text pr-10">{p.info.name}</h2>
        <div className="mt-2 flex items-center gap-3">
          <TierBadge tier={p.tier} size={64} />
          <div>
            <p className="font-hud font-bold text-xl leading-tight">Faixa {p.tier} · {tierName(p.tier)}</p>
            <p className="num text-sm text-haze">{nf(p.xp, 0)} XP na temporada · {nf(p.size, 0)} por faixa</p>
          </div>
        </div>

        {/* Semanas */}
        <h3 className="font-display uppercase text-xl mt-6"><span className="title-slash">Semanas</span></h3>
        <div className="mt-3 grid grid-cols-8 gap-1.5 items-end h-28">
          {p.weeks.map((n, i) => {
            const cur = i + 1 === p.info.week, future = i + 1 > p.info.week, hit = n >= goal;
            return (
              <div key={i} className="flex flex-col items-center gap-1 h-full justify-end">
                <span className={`num text-[11px] ${hit ? 'text-cash' : 'text-haze'}`}>{future ? '' : n}</span>
                <motion.span initial={{ height: 0 }} animate={{ height: `${Math.max(future ? 4 : 8, (n / max) * 70)}%` }} transition={{ delay: i * .05 }}
                  className={`w-full rounded-t-md ${i === SEASON_WEEKS - 1 ? 'bg-gradient-to-t from-pink to-flame' : hit ? 'bg-gradient-to-t from-aqua to-cash' : future ? 'bg-white/5' : 'bg-white/20'} ${cur ? 'ring-2 ring-gold' : ''}`} />
                <span className={`chip text-[10px] ${cur ? 'text-gold' : 'text-haze'}`}>{i === SEASON_WEEKS - 1 ? <Skull size={12} className="inline" /> : `S${i + 1}`}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-haze mt-1">Barra verde = meta de {goal} missões cumprida. A semana {SEASON_WEEKS} é a do chefão.</p>

        {/* Chefão */}
        <div className={`mt-5 rounded-2xl p-4 border relative overflow-hidden ${boss.state === 'active' ? 'border-pink/60 bg-pink/10' : boss.state === 'won' ? 'border-cash/50 bg-cash/10' : 'border-white/10 bg-black/30'}`} data-testid="season-boss" data-state={boss.state}>
          <div className="flex items-center gap-3">
            <span className={`grid place-items-center size-12 rounded-xl ${boss.state === 'won' ? 'bg-cash text-night' : boss.state === 'active' ? 'bg-pink text-white' : 'bg-white/10 text-white/50'}`}>
              {boss.state === 'won' ? <Crown /> : boss.state === 'locked' ? <Lock size={20} /> : <Swords />}
            </span>
            <div className="flex-1">
              <p className="hud-label text-[10px] text-pink">Chefão da temporada</p>
              <p className="font-hud font-bold text-lg leading-tight">{boss.state === 'won' ? 'Vencido!' : boss.state === 'lost' ? 'Escapou desta vez' : boss.state === 'active' ? 'Semana decisiva' : `Libera em ${pt(p.info.weekStarts[SEASON_WEEKS - 1])}`}</p>
            </div>
          </div>
          <p className="text-sm text-haze mt-2">{boss.desc}</p>
          {boss.state !== 'locked' && <Bar value={boss.value} target={1} done={boss.done} label={boss.label} />}
        </div>

        {/* Desafios */}
        <h3 className="font-display uppercase text-xl mt-6"><span className="title-slash">Desafios</span></h3>
        <ul className="mt-3 space-y-3">
          {p.challenges.filter(c => c.id !== 'chefao').map(c => <ChallengeRow key={c.id} c={c} />)}
        </ul>

        {past.length > 0 && (
          <>
            <h3 className="font-display uppercase text-xl mt-6"><span className="title-slash">Temporadas anteriores</span></h3>
            <ul className="mt-3 divide-y divide-white/5">
              {past.map(s => (
                <li key={s.info.index} className="flex items-center gap-3 py-2.5">
                  <TierBadge tier={s.tier} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-hud font-bold leading-tight truncate">{s.info.number > 0 ? `T${s.info.number} · ` : ''}{s.info.name}</p>
                    <p className="num text-[11px] text-haze">{pt(s.info.start)}–{pt(s.info.end)} · {s.missions} {s.missions === 1 ? 'missão' : 'missões'} · {s.challenges}/5 desafios</p>
                  </div>
                  {s.boss && <Crown size={18} className="text-gold" aria-label="Chefão vencido" />}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-[11px] text-haze mt-6 leading-snug">O passe é calculado a partir do seu histórico, com a mesma regra de XP do app. Nada novo é salvo nem enviado para a planilha. Temporadas mudam a cada 8 semanas, às segundas-feiras.</p>
      </motion.div>
    </motion.div>
  );
}

function ChallengeRow({ c }: { c: Challenge }) {
  return (
    <li className={`rounded-xl p-3 border ${c.done ? 'border-cash/40 bg-cash/5' : 'border-white/10 bg-black/25'}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 grid place-items-center size-6 rounded-full shrink-0 ${c.done ? 'bg-cash text-night' : 'bg-white/10'}`}>{c.done && <Check size={14} strokeWidth={3} />}</span>
        <div className="flex-1 min-w-0">
          <p className="font-hud font-bold leading-tight">{c.title}</p>
          <p className="text-xs text-haze leading-snug">{c.desc}</p>
        </div>
      </div>
      <Bar value={c.value} target={c.target} done={c.done} label={c.label} />
    </li>
  );
}

function Bar({ value, target, done, label }: { value: number; target: number; done: boolean; label: string }) {
  return (
    <div className="mt-2">
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div className={`h-full rounded-full ${done ? 'bg-cash' : 'bg-gradient-to-r from-violet via-pink to-flame'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(1, value / target) * 100}%` }} transition={{ duration: .8 }} />
      </div>
      <p className="num text-[11px] text-haze mt-1 text-right">{label}</p>
    </div>
  );
}
