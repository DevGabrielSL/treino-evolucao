// Ranqueada pessoal: emblema, barra até a próxima divisão, partidas recentes e regras.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, X } from 'lucide-react';
import { ranked, rankOf, RULES, TIERS, type Rank } from '../game/ranked';
import { sfx } from '../fx/sfx';

const pt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function RankEmblem({ rank, size = 64 }: { rank: Rank; size?: number }) {
  const c = rank.tier.color, gid = `rk-${rank.tier.key}-${size}`;
  const gems = rank.division ? 3 - ['III', 'II', 'I'].indexOf(rank.division) : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`Emblema ${rank.label}`} className="shrink-0 drop-shadow-[0_0_10px_rgba(255,255,255,.15)]">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} /><stop offset="1" stopColor={c} stopOpacity=".45" /></linearGradient>
      </defs>
      {rank.index >= 18 && <path d="M8 22 L2 10 L16 16 Z M56 22 L62 10 L48 16 Z" fill={c} opacity=".8" />}
      <path d="M32 3 L56 14 L56 34 C56 48 45 57 32 61 C19 57 8 48 8 34 L8 14 Z" fill="#120a22" stroke={`url(#${gid})`} strokeWidth="3.5" />
      <path d="M32 11 L49 19 L49 34 C49 44 41 51 32 54 C23 51 15 44 15 34 L15 19 Z" fill={`url(#${gid})`} opacity=".22" />
      <text x="32" y={rank.division ? 37 : 39} textAnchor="middle" fontFamily="Anton" fontSize={rank.division ? 15 : 13} fill={c} letterSpacing=".5">{rank.tier.name.slice(0, rank.division ? 2 : 6).toUpperCase()}</text>
      {Array.from({ length: gems }, (_, k) => <rect key={k} x={32 - (gems - 1) * 5 + k * 10 - 3} y="44" width="6" height="6" transform={`rotate(45 ${32 - (gems - 1) * 5 + k * 10} 47)`} fill={c} />)}
    </svg>
  );
}

export function RankedCard({ model, goal }: { model: any; goal: number }) {
  const [open, setOpen] = useState(false);
  const r = useMemo(() => ranked(model.entities, goal), [model, goal]);
  const into = r.rank.ceil ? (r.points - r.rank.floor) / (r.rank.ceil - r.rank.floor) : 1;
  const last = r.events.filter(e => e.kind !== 'season').slice(-3).reverse();
  return (
    <>
      <button data-testid="ranked-card" onClick={() => { sfx.tap(); setOpen(true); }} className="panel w-full p-4 text-left relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 size-40 rounded-full blur-3xl pointer-events-none opacity-30" style={{ background: r.rank.tier.color }} />
        <div className="flex items-center gap-3">
          <RankEmblem rank={r.rank} size={62} />
          <div className="flex-1 min-w-0">
            <p className="hud-label text-[10px] text-pink">Ranqueada · temporada {r.missions ? 'ativa' : 'aberta'}</p>
            <p className="font-display uppercase text-[1.8rem] leading-[1.1]" style={{ color: r.rank.tier.color }} data-testid="rank-label">{r.rank.label}</p>
            <p className="num text-xs text-haze">{r.points} pts{r.rank.ceil ? ` · faltam ${r.rank.ceil - r.points} para ${rankOf(r.rank.ceil).label}` : ''}</p>
          </div>
          <ChevronRight className="text-haze shrink-0" />
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: r.rank.tier.color }} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, into)) * 100}%` }} transition={{ duration: .9 }} />
        </div>
        {last.length > 0 ? (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {last.map((e, i) => <span key={i} className={`num text-[11px] rounded-md px-1.5 py-0.5 ${e.delta >= 0 ? 'bg-cash/15 text-cash' : 'bg-pink/15 text-pink'}`}>{e.delta >= 0 ? '+' : ''}{e.delta} {e.kind === 'week' ? 'semana' : 'missão'}</span>)}
          </div>
        ) : <p className="text-[11px] text-haze mt-2">Conclua uma missão para jogar a primeira partida.</p>}
      </button>
      {createPortal(<AnimatePresence>{open && <RankedSheet r={r} goal={goal} onClose={() => setOpen(false)} />}</AnimatePresence>, document.body)}
    </>
  );
}

function RankedSheet({ r, goal, onClose }: { r: ReturnType<typeof ranked>; goal: number; onClose: () => void }) {
  const events = r.events.slice(-20).reverse();
  return (
    <motion.div className="fixed inset-0 z-[55] flex flex-col justify-end max-w-lg mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div role="dialog" aria-label="Ranqueada" className="relative max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-[26px] bg-dusk border-t border-white/10 px-4 pt-5 pb-[max(env(safe-area-inset-bottom),24px)]"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 z-10 size-10 grid place-items-center rounded-full bg-black/60"><X /></button>
        <div className="flex flex-col items-center text-center">
          <RankEmblem rank={r.rank} size={110} />
          <h2 className="font-display uppercase text-4xl leading-[1.1] mt-1" style={{ color: r.rank.tier.color }}>{r.rank.label}</h2>
          <p className="num text-sm text-haze">{r.points} pts · pico {rankOf(r.peak).label} ({r.peak})</p>
        </div>

        <h3 className="font-display uppercase text-xl mt-6"><span className="title-slash">Escada</span></h3>
        <ol className="mt-3 grid grid-cols-4 gap-2">
          {TIERS.map((t, i) => {
            const here = r.rank.tier.key === t.key, reached = r.points >= t.min;
            return (
              <li key={t.key} className={`rounded-xl p-2 text-center border ${here ? 'border-white/60 bg-white/10' : 'border-white/10 bg-black/25'} ${reached ? '' : 'opacity-45'}`}>
                <RankEmblem rank={rankOf(t.min + (i >= 6 ? 0 : 200))} size={40} />
                <p className="font-hud font-bold text-[13px] leading-tight mt-1" style={{ color: t.color }}>{t.name}</p>
                <p className="num text-[10px] text-haze">{t.min}+</p>
              </li>
            );
          })}
        </ol>

        <h3 className="font-display uppercase text-xl mt-6"><span className="title-slash">Partidas recentes</span></h3>
        <ul className="mt-2 divide-y divide-white/5" data-testid="ranked-events">
          {events.map((e, i) => (
            <li key={i} className="flex items-center gap-3 py-2">
              <span className={`num font-extrabold w-12 text-right ${e.delta >= 0 ? 'text-cash' : 'text-pink'}`}>{e.delta >= 0 ? '+' : ''}{e.delta}</span>
              <div className="flex-1 min-w-0">
                <p className="font-hud font-bold leading-tight truncate">{e.label}{e.promoted && <span className="chip text-[10px] text-gold ml-2">subiu: {e.promoted}</span>}{e.demoted && <span className="chip text-[10px] text-pink ml-2">caiu: {e.demoted}</span>}</p>
                <p className="num text-[11px] text-haze">{pt(e.date)} · {e.detail}</p>
              </div>
              <span className="num text-[11px] text-haze">{e.points}</span>
            </li>
          ))}
          {!events.length && <li className="text-sm text-haze py-4 text-center">Nenhuma partida ainda.</li>}
        </ul>

        {r.seasons.length > 0 && (
          <>
            <h3 className="font-display uppercase text-xl mt-6"><span className="title-slash">Fim de temporada</span></h3>
            <ul className="mt-2 space-y-1">{r.seasons.slice().reverse().map(s => <li key={s.number} className="flex justify-between text-sm"><span className="text-haze">{s.number > 0 ? `T${s.number} · ` : ''}{s.name}</span><b className="font-hud" style={{ color: rankOf(s.points).tier.color }}>{s.label}</b></li>)}</ul>
          </>
        )}

        <h3 className="font-display uppercase text-xl mt-6"><span className="title-slash">Como pontua</span></h3>
        <ul className="mt-2 text-sm text-haze space-y-1 leading-snug">
          <li>• Cada missão concluída: <b className="text-cream">+{RULES.base}</b>, mais <b className="text-cream">+{RULES.perStar}</b> por estrela extra (completa / perfeita) e <b className="text-cream">+{RULES.perRecord}</b> por recorde (até {RULES.maxRecords}).</li>
          <li>• Semana fechada com a meta de {goal} missões: <b className="text-cash">+{RULES.weekWin}</b>. Faltou: <b className="text-pink">−{RULES.perMissing}</b> por missão (até −{RULES.maxWeekLoss}).</li>
          <li>• Divisões de 100 pontos (III → II → I). Mestre a partir de 1800 e Lenda a partir de 2200.</li>
          <li>• Nova temporada (a cada 8 semanas): você mantém {Math.round(RULES.seasonKeep * 100)}% dos pontos.</li>
          <li>• O desafio diário não conta como partida. É uma escada pessoal: sem adversários online.</li>
        </ul>
      </motion.div>
    </motion.div>
  );
}
