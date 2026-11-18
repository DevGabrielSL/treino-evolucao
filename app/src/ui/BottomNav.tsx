import { motion } from 'motion/react';
import { Map, History, UserRound, Smartphone } from 'lucide-react';

export type Tab = 'missoes' | 'historico' | 'personagem' | 'mais';
const items: { id: Tab; label: string; icon: any }[] = [
  { id: 'missoes', label: 'Missões', icon: Map },
  { id: 'historico', label: 'Histórico', icon: History },
  { id: 'personagem', label: 'Personagem', icon: UserRound },
  { id: 'mais', label: 'Celular', icon: Smartphone },
];

export function BottomNav({ tab, onTab, live }: { tab: Tab; onTab: (t: Tab) => void; live: boolean }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 px-3 bg-night/80 backdrop-blur-xl border-t border-white/10">
      <div className="grid grid-cols-4 max-w-lg mx-auto">
        {items.map(({ id, label, icon: Icon }) => {
          const on = tab === id;
          return (
            <button key={id} onClick={() => onTab(id)} className="relative flex flex-col items-center gap-1 py-1.5" aria-current={on ? 'page' : undefined}>
              {on && <motion.span layoutId="navglow" className="absolute inset-x-3 -top-2 h-0.5 rounded-full bg-gradient-to-r from-pink to-gold shadow-[0_0_12px_#ff2e93]" />}
              <span className="relative">
                <Icon size={22} strokeWidth={on ? 2.4 : 1.8} className={on ? 'text-gold' : 'text-haze'} />
                {id === 'missoes' && live && <span className="absolute -right-1.5 -top-1 size-2.5 rounded-full bg-pink animate-pulse shadow-[0_0_8px_#ff2e93]" />}
              </span>
              <span className={`chip text-[11px] ${on ? 'text-cream' : 'text-haze'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
