// Mapa original de uma cidade litorânea fictícia. Cada distrito é um deck de treino.
import { motion } from 'motion/react';

export const DISTRICTS = [
  { name: 'Orla do Sol', x: 236, y: 212 },
  { name: 'Porto Neon', x: 282, y: 74 },
  { name: 'Terraço Central', x: 118, y: 104 },
  { name: 'Marina Oeste', x: 92, y: 222 },
];
const HOME = { x: 168, y: 160 };

type Pin = { cover: string; doneThisWeek: boolean };

export function CityMap({ pins, selected, recommended, onSelect }: { pins: Pin[]; selected: number; recommended: number; onSelect: (i: number) => void }) {
  const target = DISTRICTS[selected];
  return (
    <div className="relative rounded-[22px] overflow-hidden border border-white/10 shadow-[0_24px_60px_-24px_rgba(30,232,214,.45)]">
      <svg viewBox="0 0 360 300" className="block w-full h-auto select-none">
        <defs>
          <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#123a5a" /><stop offset="1" stopColor="#2a0f4a" /></linearGradient>
          <linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d1030" /><stop offset="1" stopColor="#140a22" /></linearGradient>
          <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)"><path d="M16 0H0V16" fill="none" stroke="rgba(191,174,211,.10)" strokeWidth="1" /></pattern>
          <clipPath id="landclip"><path id="coast" d="M0 0 H300 C 318 30, 300 52, 316 80 C 330 104, 312 132, 300 150 C 286 176, 300 204, 290 232 C 282 258, 250 276, 220 300 H0 Z" /></clipPath>
          <filter id="glow"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          {pins.map((_, i) => <clipPath key={i} id={`pinclip${i}`}><circle cx={DISTRICTS[i].x} cy={DISTRICTS[i].y} r="19" /></clipPath>)}
        </defs>
        <rect width="360" height="300" fill="url(#sea)" />
        {/* ondas */}
        {[0, 1, 2, 3, 4].map(i => (
          <motion.path key={i} d={`M ${300 + i * 8} ${20 + i * 55} q 10 -4 20 0 t 20 0`} fill="none" stroke="rgba(30,232,214,.35)" strokeWidth="1.2"
            animate={{ x: [0, 6, 0], opacity: [.2, .6, .2] }} transition={{ duration: 4 + i, repeat: Infinity }} />
        ))}
        <g clipPath="url(#landclip)">
          <rect width="360" height="300" fill="url(#land)" />
          <rect width="360" height="300" fill="url(#grid)" />
          {/* quarteirões */}
          {[[40, 30, 50, 34], [110, 40, 40, 28], [170, 24, 60, 40], [60, 150, 46, 30], [140, 200, 50, 34], [200, 120, 44, 52], [30, 250, 38, 30], [250, 160, 30, 30]].map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx="3" fill="rgba(141,92,255,.10)" stroke="rgba(141,92,255,.22)" />
          ))}
          {/* parque */}
          <ellipse cx="190" cy="60" rx="26" ry="16" fill="rgba(124,242,154,.12)" stroke="rgba(124,242,154,.3)" />
          {/* avenidas neon */}
          <g filter="url(#glow)" fill="none" strokeLinecap="round">
            <path d="M0 140 C 80 130, 160 170, 300 150" stroke="#ff2e93" strokeWidth="3" opacity=".85" />
            <path d="M150 0 C 160 90, 150 200, 200 300" stroke="#1ee8d6" strokeWidth="2.5" opacity=".75" />
            <path d="M20 60 L 300 90" stroke="#ffc54d" strokeWidth="1.6" opacity=".55" />
            <path d="M40 300 C 70 240, 60 190, 110 150" stroke="#ff6b3d" strokeWidth="1.6" opacity=".55" />
          </g>
        </g>
        {/* calçadão */}
        <use href="#coast" fill="none" stroke="#ffc54d" strokeWidth="2.5" strokeDasharray="1 5" strokeLinecap="round" opacity=".7" />

        {/* rota até o destino */}
        <motion.path key={selected} d={`M ${HOME.x} ${HOME.y} Q ${(HOME.x + target.x) / 2} ${Math.min(HOME.y, target.y) - 40} ${target.x} ${target.y}`}
          fill="none" stroke="#fff4e6" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: .9, strokeDashoffset: [0, -24] }}
          transition={{ pathLength: { duration: .7 }, strokeDashoffset: { duration: 1, repeat: Infinity, ease: 'linear' } }} />
        {/* você */}
        <g transform={`translate(${HOME.x} ${HOME.y})`}>
          <motion.circle r="12" fill="rgba(30,232,214,.25)" animate={{ r: [8, 16, 8], opacity: [.6, 0, .6] }} transition={{ duration: 2, repeat: Infinity }} />
          <path d="M0 -7 L 6 6 L 0 3 L -6 6 Z" fill="#1ee8d6" stroke="#0b0716" strokeWidth="1.5" />
        </g>

        {pins.map((p, i) => {
          const d = DISTRICTS[i], on = i === selected, rec = i === recommended;
          return (
            <g key={i} onClick={() => onSelect(i)} className="cursor-pointer" role="button" aria-label={`Distrito ${d.name}`}>
              {rec && <motion.circle cx={d.x} cy={d.y} r="22" fill="none" stroke="#ffc54d" strokeWidth="2" animate={{ r: [22, 34], opacity: [.9, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />}
              <circle cx={d.x} cy={d.y} r="23" fill="#0b0716" stroke={on ? '#ffc54d' : rec ? '#ff6b3d' : 'rgba(255,255,255,.35)'} strokeWidth={on ? 3.5 : 2} />
              <image href={p.cover} x={d.x - 30} y={d.y - 20} width="60" height="40" preserveAspectRatio="xMidYMid slice" clipPath={`url(#pinclip${i})`} />
              {p.doneThisWeek && <g transform={`translate(${d.x + 16} ${d.y - 16})`}><circle r="8" fill="#7cf29a" /><path d="M-3.5 0 L -1 2.6 L 3.8 -2.6" stroke="#0b0716" strokeWidth="2" fill="none" /></g>}
              <g transform={`translate(${d.x} ${d.y + 36})`}>
                <rect x={-d.name.length * 3.1 - 6} y="-9" width={d.name.length * 6.2 + 12} height="15" rx="3" fill={on ? '#ffc54d' : 'rgba(11,7,22,.85)'} />
                <text textAnchor="middle" y="2.5" fontFamily="Barlow Condensed" fontWeight="700" fontSize="10.5" letterSpacing=".6" fill={on ? '#1a0620' : '#fff4e6'}>{d.name.toUpperCase()}</text>
              </g>
            </g>
          );
        })}
      </svg>
      {/* moldura de minimapa */}
      <div className="pointer-events-none absolute inset-2 border border-white/10 rounded-[16px]" />
      {['left-2 top-2 border-l-2 border-t-2', 'right-2 top-2 border-r-2 border-t-2', 'left-2 bottom-2 border-l-2 border-b-2', 'right-2 bottom-2 border-r-2 border-b-2'].map(c => <span key={c} className={`pointer-events-none absolute size-4 border-aqua/80 ${c}`} />)}
      <div className="absolute left-4 top-3 hud-label text-[10px] text-aqua flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-aqua animate-pulse" />Mapa · toque num distrito</div>
      <div className="absolute right-4 top-2.5 size-7 rounded-full bg-night/80 border border-white/20 grid place-items-center font-hud font-bold text-xs text-pink">N</div>
    </div>
  );
}
