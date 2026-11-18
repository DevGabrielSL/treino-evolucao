import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore, onReward, type XpReward } from './engine/store';
import { activeSession } from './engine/workout';
import { xp, weeklyRhythm } from './game/progress';
import { TopHud } from './ui/Hud';
import { BottomNav, type Tab } from './ui/BottomNav';
import { MissionsScreen } from './ui/MissionsScreen';
import { WorkoutScreen } from './ui/WorkoutScreen';
import { CharacterScreen } from './ui/CharacterScreen';
import { HistoryScreen } from './ui/HistoryScreen';
import { PhoneScreen } from './ui/PhoneScreen';
import { DialogHost } from './ui/Dialog';
import { startSheets } from './engine/sheets';
import { useUpdateReady, applyUpdate } from './engine/updates';
import { RefreshCw } from 'lucide-react';
import { MissionComplete } from './ui/Rewards';
import { Sky } from './ui/Sky';
import { FxLayer } from './fx/FxLayer';
import { MissionIntro } from './ui/MissionIntro';
import { asset } from './ui/assets';

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('missoes');
  const [inWorkout, setInWorkout] = useState(true);
  const [intro, setIntro] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const updateReady = useUpdateReady();
  const toastMsg = useCallback((m: string) => { setNote(m); setTimeout(() => setNote(n => (n === m ? null : n)), 3200); }, []);
  useEffect(() => { if (store.status === 'ready') startSheets(); }, [store.status]);
  const [complete, setComplete] = useState<{ sessionId: string; reward: XpReward } | null>(null);
  const lastReward = useRef<XpReward>(null);

  useEffect(() => onReward((r) => { lastReward.current = r; }), []);
  const [minSplash, setMinSplash] = useState(true);
  useEffect(() => { const t = setTimeout(() => setMinSplash(false), 900); return () => clearTimeout(t); }, []);

  if (store.status === 'loading' || minSplash) return <Splash />;
  if (store.status === 'error') return <div className="p-6"><Sky /><p className="font-display text-2xl">Não foi possível abrir os dados</p><p className="text-haze mt-2">{store.error}</p></div>;

  const model = store.model, doc = store.doc;
  const goal = doc.settings.weekly_goal || 4;
  const active = activeSession(model);
  const showWorkout = tab === 'missoes' && active && inWorkout;
  const onError = (e: any) => { setError(e?.message || String(e)); setTimeout(() => setError(null), 4200); };
  const goWorkout = () => { setTab('missoes'); setInWorkout(true); window.scrollTo(0, 0); };

  return (
    <div className="max-w-lg mx-auto min-h-dvh relative">
      <Sky dim={!!showWorkout} />
      {showWorkout ? (
        <WorkoutScreen key={active.id} model={model} doc={doc} session={active} onExit={() => setInWorkout(false)} onError={onError}
          onFinished={(id) => { setComplete({ sessionId: id, reward: lastReward.current }); setInWorkout(true); }} />
      ) : (
        <>
          <TopHud xp={xp(model.entities)} rhythm={weeklyRhythm(model.entities, goal)} />
          <AnimatePresence mode="wait">
            <motion.main key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}>
              {tab === 'missoes' && <MissionsScreen model={model} goal={goal} active={active} onResume={() => setInWorkout(true)} onStarted={(deck) => { setIntro(deck); setInWorkout(true); }} onError={onError} />}
              {tab === 'personagem' && <CharacterScreen model={model} goal={goal} />}
              {tab === 'historico' && <HistoryScreen model={model} onError={onError} onGoWorkout={goWorkout} />}
              {tab === 'mais' && <PhoneScreen onError={onError} toast={toastMsg} onGoWorkout={goWorkout} />}
            </motion.main>
          </AnimatePresence>
          <BottomNav tab={tab} onTab={(t) => { setTab(t); if (t === 'missoes') setInWorkout(true); window.scrollTo(0, 0); }} live={!!active} />
        </>
      )}
      <AnimatePresence>{intro && <MissionIntro deck={intro} onDone={() => setIntro(null)} />}</AnimatePresence>
      <FxLayer />
      {import.meta.env.VITE_DEMO === "1" && !showWorkout && <div className="fixed left-1/2 -translate-x-1/2 bottom-[88px] z-[45] chip text-[10px] rounded-full bg-black/70 border border-white/15 px-3 py-1 text-haze pointer-events-none">Demonstração · dados fictícios</div>}
      <AnimatePresence>{complete && <MissionComplete data={complete} model={model} onClose={() => setComplete(null)} />}</AnimatePresence>
      <DialogHost />
      <AnimatePresence>
        {updateReady && !intro && (
          <motion.div initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }} role="status"
            className="fixed top-[max(env(safe-area-inset-top),8px)] inset-x-3 z-[88] max-w-lg mx-auto flex items-center gap-3 rounded-2xl bg-night/95 border border-aqua/50 px-3 py-2.5 shadow-[0_10px_40px_-10px_rgba(30,232,214,.6)]">
            <RefreshCw size={18} className="text-aqua shrink-0" />
            <span className="flex-1 text-sm leading-tight"><b className="font-hud text-[15px]">Nova versão pronta.</b><br /><span className="text-haze text-xs">{active ? 'Seu treino fica salvo; atualize quando quiser.' : 'Toque para carregar as novidades.'}</span></span>
            <button onClick={applyUpdate} className="chip text-xs rounded-lg bg-aqua text-night px-3 py-2">Atualizar</button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {note && !error && (
          <motion.div role="status" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-24 inset-x-4 z-[80] rounded-xl bg-[#0d2a2a] border border-aqua/50 px-4 py-3 text-sm shadow-2xl max-w-lg mx-auto">{note}</motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {error && (
          <motion.div role="alert" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-24 inset-x-4 z-[80] rounded-xl bg-[#3a0a1f] border border-pink/50 px-4 py-3 text-sm shadow-2xl">{error}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Splash() {
  return (
    <div className="min-h-dvh grid place-items-center text-center overflow-hidden">
      <Sky />
      <div>
        <motion.img src={asset("icon-mission-192.png")} alt="" width={96} height={96} className="mx-auto rounded-3xl shadow-[0_0_40px_rgba(255,46,147,.5)]"
          initial={{ scale: .4, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', damping: 12 }} />
        <motion.h1 className="font-display uppercase text-5xl leading-[1.08] sunset-text mt-5" initial={{ opacity: 0, letterSpacing: '.4em' }} animate={{ opacity: 1, letterSpacing: '0em' }} transition={{ delay: .2, duration: .7 }}>Treino &<br />Evolução</motion.h1>
        <div className="mx-auto mt-5 h-1 w-40 rounded-full bg-white/10 overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-pink to-gold" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1.1, repeat: Infinity }} /></div>
      </div>
    </div>
  );
}
