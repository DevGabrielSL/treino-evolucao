import { motion } from 'motion/react';
import { Award, Lock, Medal } from 'lucide-react';
import { achievements, attributes, records, totals, weeklyRhythm, xp, rankFor } from '../game/progress';
import { LevelBadge, Stars } from './Hud';
import { nf } from './format';
import { Radar } from './Radar';

const TIER: Record<string, string> = { bronze: 'from-[#c77b3d] to-[#7a3f1a]', prata: 'from-[#e6e9f0] to-[#7d8494]', ouro: 'from-gold to-flame', lendario: 'from-pink via-violet to-aqua' };

export function CharacterScreen({ model, goal }: { model: any; goal: number }) {
  const e = model.entities, x = xp(e), attrs = attributes(e), rec = records(e), t = totals(e), w = weeklyRhythm(e, goal), ach = achievements(e, goal);
  const unlocked = ach.filter(a => a.done).length;
  return (
    <div className="px-4 pb-32 space-y-5">
      <section className="panel p-4 flex items-center gap-4">
        <LevelBadge level={x.level} progress={x.progress} size={78} />
        <div className="flex-1 min-w-0">
          <p className="hud-label text-aqua text-[10px]">Perfil</p>
          <h1 className="font-display uppercase text-3xl leading-none sunset-text">{rankFor(x.level)}</h1>
          <div className="mt-2 flex items-center gap-2"><Stars value={w.stars} /><span className="num text-xs text-haze">{w.thisWeek}/{w.goal} na semana</span></div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[['Missões', nf(t.missions, 0)], ['Séries', nf(t.sets, 0)], ['Toneladas', nf(t.tonnage / 1000, 1)]].map(([k, v]) => (
          <div key={k} className="panel p-3 text-center"><p className="num text-2xl font-extrabold">{v}</p><p className="hud-label text-[10px] text-haze">{k}</p></div>
        ))}
      </section>

      <section className="panel p-4">
        <h2 className="font-display uppercase text-2xl"><span className="title-slash">Atributos</span></h2>
        <Radar items={attrs} />
        <p className="text-xs text-haze -mt-1 text-center"><span className="text-gold">■</span> Nível (séries acumuladas) · <span className="text-aqua">◇</span> Forma (últimas 4 semanas)</p>
        <div className="mt-4 space-y-3.5">
          {attrs.map((a, i) => (
            <div key={a.key}>
              <div className="flex items-baseline justify-between">
                <span className="font-hud font-bold uppercase tracking-wide">{a.label}</span>
                <span className="num text-sm"><span className="text-haze">NV</span> <b className="text-gold text-lg">{a.level}</b></span>
              </div>
              <div className="mt-1 grid grid-cols-10 gap-[3px]">
                {Array.from({ length: 10 }, (_, k) => (
                  <motion.span key={k} initial={{ opacity: 0, scaleY: .2 }} animate={{ opacity: 1, scaleY: 1 }} transition={{ delay: i * .05 + k * .03 }}
                    className={`h-2.5 rounded-[2px] ${k < Math.round(a.form / 10) ? 'bg-gradient-to-r from-aqua to-violet shadow-[0_0_6px_rgba(30,232,214,.5)]' : 'bg-white/10'}`} />
                ))}
              </div>
              <p className="num text-[11px] text-haze mt-0.5">Forma {a.form}% · {a.recent} séries em 4 sem. · {a.sets} no total</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display uppercase text-2xl"><span className="title-slash">Conquistas</span></h2>
          <span className="num text-haze text-sm">{unlocked}/{ach.length}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {ach.map(a => (
            <div key={a.id} className={`rounded-xl p-3 border ${a.done ? 'border-white/20 bg-white/5' : 'border-white/5 bg-black/30'}`}>
              <div className={`size-10 rounded-full grid place-items-center bg-gradient-to-br ${a.done ? TIER[a.tier] : 'from-white/10 to-white/5'}`}>
                {a.done ? <Award size={20} className="text-night" /> : <Lock size={16} className="text-white/40" />}
              </div>
              <p className={`font-hud font-bold mt-2 leading-tight ${a.done ? '' : 'text-white/60'}`}>{a.title}</p>
              <p className="text-[11px] text-haze leading-snug mt-0.5">{a.desc}</p>
              {!a.done && <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-violet" style={{ width: `${a.progress * 100}%` }} /></div>}
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-4">
        <h2 className="font-display uppercase text-2xl"><span className="title-slash">Recordes</span></h2>
        {rec.best.length ? (
          <ul className="mt-3 divide-y divide-white/5">
            {rec.best.slice(0, 12).map((r: any) => (
              <li key={r.variant_id} className="flex items-center gap-3 py-2.5">
                <Medal size={18} className="text-gold shrink-0" />
                <div className="flex-1 min-w-0"><p className="font-hud font-bold leading-tight truncate">{r.exercise}</p><p className="text-[11px] text-haze truncate">{r.equipment}</p></div>
                <p className="num text-right"><b className="text-lg">{nf(r.load)}</b> <span className="text-xs text-haze">{r.unit}</span><br /><span className="text-[11px] text-haze">× {r.reps} · {r.date.slice(8, 10)}/{r.date.slice(5, 7)}</span></p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-haze mt-2">Seus recordes aparecem aqui depois das primeiras missões com unidade confirmada.</p>}
      </section>
    </div>
  );
}
