import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, Clock3, Crosshair, Flame, Play, Target, Trophy, X } from 'lucide-react';
import { PRESET_DECKS, DECK_TITLES, planFor, startMission } from '../engine/workout';
import { ExerciseVisual } from './ExerciseVisual';
import { records, weeklyRhythm } from '../game/progress';
import { CityMap, DISTRICTS } from './CityMap';
import { sfx } from '../fx/sfx';
import { asset } from './assets';
import { CustomMission } from './CustomMission';
import { Sparkles } from 'lucide-react';
import { nf } from './format';
import { cityLights, districtControl } from '../game/season';
import { SeasonCard } from './SeasonPanel';
import { progressionHint, progressionOn } from '../engine/progression';

type Props = { model: any; goal: number; active: any; onResume: () => void; onError: (e: any) => void; onStarted: (deck: any) => void };

function daysAgo(date?: string) {
  if (!date) return null;
  const d = Math.round((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(date)) / 86400000);
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
}

export function MissionsScreen({ model, goal, active, onResume, onError, onStarted }: Props) {
  const [briefing, setBriefing] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState(false);
  const [starting, setStarting] = useState(false);
  const entities = model.entities;

  const decks = useMemo(() => PRESET_DECKS.map((d: any, i: number) => {
    const last = entities.sessions.filter((s: any) => s.status === 'completed' && s.name === d.name).map((s: any) => s.date).sort().at(-1);
    return { ...d, index: i, title: DECK_TITLES[i] || d.name, cover: asset(`deck-cover-0${i + 1}.webp`), sets: d.items.length * 3, xp: d.items.length * 3 * 10 + 100, last };
  }), [entities]);

  // Próxima missão: o deck seguinte ao último concluído (rodízio), ou o primeiro.
  const featured = useMemo(() => {
    const lastDone = entities.sessions.filter((s: any) => s.status === 'completed').sort((a: any, b: any) => String(b.date + b.finished_at).localeCompare(String(a.date + a.finished_at))).find((s: any) => decks.some((d: any) => d.name === s.name));
    const idx = lastDone ? (decks.findIndex((d: any) => d.name === lastDone.name) + 1) % decks.length : 0;
    return decks[idx];
  }, [decks, entities]);
  const sel = decks[selected ?? featured.index];

  const rhythm = weeklyRhythm(entities, goal);
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toLocaleDateString('en-CA'); })();
  const weekSets = model.eff.filter((s: any) => s.date >= weekStart).length;
  const weekPR = records(entities).events.some((e: any) => e.date >= weekStart);
  const control = useMemo(() => districtControl(entities), [entities]);
  const city = cityLights(entities.sessions.filter((s: any) => s.status === 'completed').length);

  async function go(deck: any) {
    if (starting) return;
    setStarting(true);
    try { await startMission(deck.id, model); setBriefing(null); onStarted(deck); } catch (e) { onError(e); } finally { setStarting(false); }
  }

  return (
    <div className="px-4 pb-32 space-y-5">
      {active && (
        <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onClick={onResume}
          className="panel w-full flex items-center gap-3 p-3 text-left border-pink/40 shadow-[0_0_30px_-8px_#ff2e93]">
          <span className="grid place-items-center size-11 rounded-xl bg-pink/20 text-pink"><Crosshair className="animate-pulse" /></span>
          <span className="flex-1 min-w-0">
            <span className="hud-label text-pink text-[10px]">Missão em andamento</span>
            <span className="block font-hud font-bold text-lg truncate">{active.name}</span>
          </span>
          <span className="chip text-gold flex items-center gap-1 text-sm">Voltar <ChevronRight size={18} /></span>
        </motion.button>
      )}

      {/* Mapa da cidade */}
      <section>
        <CityMap pins={decks.map((d: any, i: number) => ({ cover: d.cover, doneThisWeek: !!d.last && d.last >= weekStart, control: control[i] }))} lit={city.lit}
          selected={sel.index} recommended={featured.index} onSelect={(i) => { sfx.tap(); setSelected(i); }} />
        <div className="mt-2 flex items-center gap-2 px-1 text-[11px] chip" data-testid="city-lights">
          <span className="text-gold">Cidade {city.lit}/{city.total} luzes</span>
          <span className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden"><span className="block h-full bg-gradient-to-r from-gold to-pink" style={{ width: `${(city.lit / city.total) * 100}%` }} /></span>
          <span className="text-haze truncate">{city.next ? `${city.next.label} em ${city.missing} ${city.missing === 1 ? 'missão' : 'missões'}` : 'Cidade toda acesa'}</span>
        </div>
      </section>

      {/* Missão selecionada */}
      <AnimatePresence mode="wait">
        <motion.article key={sel.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22 }}
          className="relative overflow-hidden rounded-[22px] cut border border-white/10 shadow-[0_24px_60px_-20px_rgba(255,46,147,.55)] -mt-1">
          <div className="duotone-wrap h-44">
            <motion.img src={sel.cover} alt="" className="duotone size-full object-cover" initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 1.4, ease: 'easeOut' }} />
          </div>
          <div className="relative -mt-24 px-4 pb-4">
            <p className="chip text-gold text-sm flex items-center gap-2">Deck {String(sel.index + 1).padStart(2, '0')} · {DISTRICTS[sel.index].name}
              {sel.id === featured.id && <span className="rounded bg-aqua text-night px-1.5 text-[11px]">Recomendada</span>}</p>
            <h1 className="font-display uppercase text-[2.6rem] leading-[1.06] sunset-text">{sel.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Tag icon={Target}>{sel.items.length} alvos</Tag>
              <Tag icon={Flame}>{sel.sets} séries</Tag>
              <Tag icon={Trophy} gold>+{sel.xp} XP</Tag>
              {sel.last && <Tag icon={Clock3}>{daysAgo(sel.last)}</Tag>}
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <motion.button whileTap={{ scale: .97 }} disabled={!!active || starting} onClick={() => go(sel)} className="btn-sunset shine h-14 rounded-xl text-2xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:saturate-50">
                <Play className="fill-current" size={22} /> Iniciar missão
              </motion.button>
              <button onClick={() => { sfx.tap(); setBriefing(sel.index); }} className="h-14 px-4 rounded-xl bg-white/10 border border-white/15 chip text-sm backdrop-blur">Briefing</button>
            </div>
          </div>
        </motion.article>
      </AnimatePresence>

      <button onClick={() => { sfx.tap(); setCustom(true); }} className="panel w-full flex items-center gap-3 p-3 text-left">
        <span className="grid place-items-center size-11 rounded-xl bg-gradient-to-br from-violet to-pink"><Sparkles size={20} /></span>
        <span className="flex-1"><b className="font-display uppercase text-xl leading-[1.1] block">Missão personalizada</b><span className="text-xs text-haze">Escolha o foco e conte como está: o assistente monta o roteiro.</span></span>
        <ChevronRight className="text-haze" />
      </button>

      <SeasonCard model={model} goal={goal} />

      {/* Metas da semana */}
      <section className="panel p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display uppercase text-2xl"><span className="title-slash">Metas da semana</span></h2>
          <span className="num text-haze text-sm">{rhythm.streak > 0 ? `🔥 ${rhythm.streak} sem. seguidas` : 'Comece a sequência'}</span>
        </div>
        <div className="mt-3 space-y-3">
          <Objective label={`Concluir ${goal} missões`} value={rhythm.thisWeek} target={goal} xp={0} />
          <Objective label="Registrar 30 séries de trabalho" value={weekSets} target={30} xp={0} />
          <Objective label="Superar uma carga anterior" value={weekPR ? 1 : 0} target={1} xp={0} />
        </div>
      </section>

      <AnimatePresence>{custom && <CustomMission model={model} active={active} onClose={() => setCustom(false)} onStarted={onStarted} onError={onError} />}</AnimatePresence>
      <AnimatePresence>
        {briefing !== null && <Briefing deck={decks[briefing]} model={model} active={active} starting={starting} onClose={() => setBriefing(null)} onStart={go} />}
      </AnimatePresence>
    </div>
  );
}

function Tag({ icon: Icon, children, gold }: { icon: any; children: any; gold?: boolean }) {
  return <span className={`chip text-[12px] flex items-center gap-1 rounded-md px-2 py-1 backdrop-blur ${gold ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-black/40 text-cream border border-white/10'}`}><Icon size={13} />{children}</span>;
}

function Objective({ label, value, target }: { label: string; value: number; target: number; xp: number }) {
  const done = value >= target, p = Math.min(1, value / target);
  return (
    <div>
      <div className="flex justify-between items-center text-sm">
        <span className={`font-hud font-semibold text-[15px] ${done ? 'text-cash' : 'text-cream'}`}>{done ? '✓ ' : ''}{label}</span>
        <span className="num text-haze">{nf(Math.min(value, target), 0)}/{target}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div className={`h-full rounded-full ${done ? 'bg-cash' : 'bg-gradient-to-r from-violet via-pink to-flame'}`} initial={{ width: 0 }} animate={{ width: `${p * 100}%` }} transition={{ duration: .9 }} />
      </div>
    </div>
  );
}

function Briefing({ deck, model, active, starting, onClose, onStart }: any) {
  const plan = useMemo(() => planFor(deck.id, model), [deck.id, model]);
  const prog = progressionOn();
  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative max-h-[88vh] overflow-y-auto no-scrollbar rounded-t-[26px] bg-dusk border-t border-white/10"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
        <div className="relative duotone-wrap h-40"><img src={deck.cover} alt="" className="duotone size-full object-cover" /></div>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 size-10 grid place-items-center rounded-full bg-black/60"><X /></button>
        <div className="px-4 -mt-12 relative">
          <p className="chip text-gold text-sm">Briefing · Deck {String(deck.index + 1).padStart(2, '0')}</p>
          <h2 className="font-display uppercase text-4xl leading-none sunset-text">{deck.title}</h2>
          <p className="text-haze text-sm mt-2">3 séries de trabalho por alvo. Sem carga predefinida: use a que mantém a técnica, com repetições em reserva.</p>
        </div>
        <ol className="px-4 mt-4 space-y-2 pb-36">
          {plan.items.map((item: any, i: number) => {
            return (
              <motion.li key={item.variant_id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .05 * i }}
                className="panel flex items-center gap-3 p-2 pr-3">
                <span className="num font-extrabold text-2xl w-8 text-center text-white/30">{String(i + 1).padStart(2, '0')}</span>
                <div className="duotone-wrap size-14 rounded-lg shrink-0 bg-plum"><ExerciseVisual name={item.name} equipment={item.equipment} size="sm" /></div>
                <div className="min-w-0 flex-1">
                  <p className="font-hud font-bold text-[17px] leading-tight">{item.name}</p>
                  <p className="text-xs text-haze truncate">{item.equipment}</p>
                </div>
                <div className="text-right">
                  <p className="num font-bold text-gold">3×{item.dose?.min}–{item.dose?.max}</p>
                  {item.last && <p className="num text-[11px] text-haze">últ. {nf(item.last.load_value)} {item.unit}</p>}
                  {prog && (() => { const h = progressionHint(item.variant_id, item.dose, model.entities); return h?.kind === 'subir' ? <p className="num text-[11px] text-cash">↑ {nf(h.next)} {item.unit}</p> : null; })()}
                </div>
              </motion.li>
            );
          })}
        </ol>
        <div className="fixed bottom-0 inset-x-0 p-4 pb-[max(env(safe-area-inset-bottom),16px)] bg-gradient-to-t from-dusk via-dusk to-transparent">
          <button disabled={!!active || starting} onClick={() => onStart(deck)} className="btn-sunset w-full h-14 rounded-xl text-2xl flex items-center justify-center gap-2 disabled:opacity-40">
            <Play className="fill-current" size={22} /> {active ? 'Termine a missão atual' : 'Iniciar missão'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
