// Mapa original de uma cidade litorânea fictícia. Cada distrito é um deck de treino.
import type React from 'react';
import { motion } from 'motion/react';

export const DISTRICTS = [
  { name: 'Orla do Sol', x: 236, y: 212 },
  { name: 'Porto Neon', x: 282, y: 74 },
  { name: 'Terraço Central', x: 118, y: 104 },
  { name: 'Marina Oeste', x: 92, y: 222 },
];
const HOME = { x: 168, y: 160 };

type Pin = { cover: string; doneThisWeek: boolean; control: number };

// Quarteirões: [x, y, largura, altura, marco que acende (índice em CITY_UNLOCKS)]
const BLOCKS: number[][] = [[40, 30, 50, 34, 8], [110, 40, 40, 28, 5], [170, 24, 60, 40, 1], [60, 150, 46, 30, 0], [140, 200, 50, 34, 7], [200, 120, 44, 52, 5], [30, 250, 38, 30, 4], [250, 160, 30, 30, 7]];
const WIN = ['#ffc54d', '#1ee8d6', '#ff2e93'];

function Windows({ x, y, w, h, seed }: { x: number; y: number; w: number; h: number; seed: number }) {
  const cells: React.ReactElement[] = [];
  for (let r = 0; r < Math.floor((h - 6) / 7); r++) for (let c = 0; c < Math.floor((w - 6) / 7); c++) {
    const k = (r * 7 + c * 13 + seed * 5) % 9; if (k > 4) continue;
    cells.push(<rect key={`${r}-${c}`} x={x + 4 + c * 7} y={y + 4 + r * 7} width="3.2" height="3.2" rx=".6" fill={WIN[k % 3]} opacity={.55 + (k % 3) * .15} />);
  }
  return <g filter="url(#glow)">{cells}</g>;
}

export function CityMap({ pins, selected, recommended, onSelect, lit = 0 }: { pins: Pin[]; selected: number; recommended: number; onSelect: (i: number) => void; lit?: number }) {
  const target = DISTRICTS[selected];
  const on = (k: number) => lit > k;
  return (
    <div className="relative rounded-[22px] overflow-hidden border border-white/10 shadow-[0_24px_60px_-24px_rgba(30,232,214,.45)]">
      <svg viewBox="0 0 360 300" className="block w-full h-auto select-none">
        <defs>
          <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#123a5a" /><stop offset="1" stopColor="#2a0f4a" /></linearGradient>
          <linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d1030" /><stop offset="1" stopColor="#140a22" /></linearGradient>
          <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)"><path d="M16 0H0V16" fill="none" stroke="rgba(191,174,211,.10)" strokeWidth="1" /></pattern>
          <clipPath id="landclip"><path id="coast" d="M0 0 H300 C 318 30, 300 52, 316 80 C 330 104, 312 132, 300 150 C 286 176, 300 204, 290 232 C 282 258, 250 276, 220 300 H0 Z" /></clipPath>
          <radialGradient id="districtGlow"><stop offset="0" stopColor="#1ee8d6" stopOpacity=".55" /><stop offset=".55" stopColor="#ff2e93" stopOpacity=".18" /><stop offset="1" stopColor="#ff2e93" stopOpacity="0" /></radialGradient>
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
          {BLOCKS.map(([x, y, w, h, k], i) => (
            <g key={i} data-lit={on(k) ? 'on' : 'off'}>
              <rect x={x} y={y} width={w} height={h} rx="3" fill={on(k) ? 'rgba(141,92,255,.24)' : 'rgba(141,92,255,.08)'} stroke={on(k) ? 'rgba(255,197,77,.55)' : 'rgba(141,92,255,.18)'} />
              {on(k) && <Windows x={x} y={y} w={w} h={h} seed={i} />}
            </g>
          ))}
          {/* arranha-céu neon */}
          {on(8) && <g filter="url(#glow)"><rect x="56" y="10" width="16" height="44" rx="2" fill="#1a0b2e" stroke="#ff2e93" strokeWidth="1.5" /><motion.rect x="60" y="14" width="8" height="3" fill="#1ee8d6" animate={{ y: [14, 46, 14] }} transition={{ duration: 6, repeat: Infinity }} /></g>}
          {/* letreiro */}
          {on(9) && <motion.text x="150" y="292" textAnchor="middle" fontFamily="Anton" fontSize="13" letterSpacing="2" fill="#ff2e93" filter="url(#glow)" animate={{ opacity: [1, .55, 1, 1] }} transition={{ duration: 3, repeat: Infinity }}>COSTA DO SOL</motion.text>}
          {/* parque */}
          <ellipse cx="190" cy="60" rx="26" ry="16" fill="rgba(124,242,154,.12)" stroke="rgba(124,242,154,.3)" />
          {/* avenidas neon */}
          <g filter="url(#glow)" fill="none" strokeLinecap="round">
            <path d="M0 140 C 80 130, 160 170, 300 150" stroke="#ff2e93" strokeWidth="3" opacity=".85" />
            <path d="M150 0 C 160 90, 150 200, 200 300" stroke="#1ee8d6" strokeWidth="2.5" opacity=".75" />
            <path d="M20 60 L 300 90" stroke="#ffc54d" strokeWidth={on(2) ? 2.6 : 1.2} opacity={on(2) ? .9 : .3} />
            <path d="M40 300 C 70 240, 60 190, 110 150" stroke="#ff6b3d" strokeWidth="1.6" opacity=".55" />
          </g>
        </g>
        {/* roda-gigante do píer */}
        {on(3) && (
          <g filter="url(#glow)">
            <path d="M296 196 H 336" stroke="#ffc54d" strokeWidth="3" />
            <g>
              <animateTransform attributeName="transform" type="rotate" from="0 326 176" to="360 326 176" dur="14s" repeatCount="indefinite" />
              <circle cx="326" cy="176" r="15" fill="none" stroke="#ff2e93" strokeWidth="1.6" />
              {[0, 45, 90, 135].map(a => <line key={a} x1={326 - 15 * Math.cos(a * Math.PI / 180)} y1={176 - 15 * Math.sin(a * Math.PI / 180)} x2={326 + 15 * Math.cos(a * Math.PI / 180)} y2={176 + 15 * Math.sin(a * Math.PI / 180)} stroke="#1ee8d6" strokeWidth=".8" />)}
            </g>
            <path d="M318 196 L 326 176 L 334 196" stroke="#fff4e6" strokeWidth="1.2" fill="none" />
          </g>
        )}
        {/* farol da orla */}
        {on(6) && (
          <g>
            <path d="M290 248 L 360 226 L 360 262 Z" fill="rgba(255,197,77,.18)">
              <animateTransform attributeName="transform" type="rotate" values="-25 290 248;25 290 248;-25 290 248" dur="5s" repeatCount="indefinite" />
            </path>
            <path d="M286 262 L 288 244 H 292 L 294 262 Z" fill="#fff4e6" stroke="#ff2e93" strokeWidth=".8" />
            <circle cx="290" cy="245" r="2.6" fill="#ffc54d" filter="url(#glow)" />
          </g>
        )}
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
          const d = DISTRICTS[i], on = i === selected, rec = i === recommended, c = Math.max(0, Math.min(1, p.control || 0));
          const arc = 2 * Math.PI * 28, label = d.name + (c > 0 ? ` ${Math.round(c * 100)}%` : '');
          return (
            <g key={i} onClick={() => onSelect(i)} className="cursor-pointer" role="button" aria-label={`Distrito ${d.name}, domínio ${Math.round(c * 100)}%`} data-control={Math.round(c * 100)}>
              {/* brilho do bairro: cresce com o domínio (missões nas últimas 4 semanas) */}
              <circle cx={d.x} cy={d.y} r={30 + c * 16} fill="url(#districtGlow)" opacity={.15 + c * .75} />
              {rec && <motion.circle cx={d.x} cy={d.y} r="22" fill="none" stroke="#ffc54d" strokeWidth="2" animate={{ r: [22, 34], opacity: [.9, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />}
              <circle cx={d.x} cy={d.y} r="28" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3" />
              {c > 0 && <motion.circle cx={d.x} cy={d.y} r="28" fill="none" stroke="#1ee8d6" strokeWidth="3" strokeLinecap="round" transform={`rotate(-90 ${d.x} ${d.y})`}
                strokeDasharray={arc} initial={{ strokeDashoffset: arc }} animate={{ strokeDashoffset: arc * (1 - c) }} transition={{ duration: 1, delay: .2 + i * .1 }} filter="url(#glow)" />}
              <circle cx={d.x} cy={d.y} r="23" fill="#0b0716" stroke={on ? '#ffc54d' : rec ? '#ff6b3d' : 'rgba(255,255,255,.35)'} strokeWidth={on ? 3.5 : 2} />
              <image href={p.cover} x={d.x - 30} y={d.y - 20} width="60" height="40" preserveAspectRatio="xMidYMid slice" clipPath={`url(#pinclip${i})`} />
              {p.doneThisWeek && <g transform={`translate(${d.x + 16} ${d.y - 16})`}><circle r="8" fill="#7cf29a" /><path d="M-3.5 0 L -1 2.6 L 3.8 -2.6" stroke="#0b0716" strokeWidth="2" fill="none" /></g>}
              <g transform={`translate(${d.x} ${d.y + 40})`}>
                <rect x={-label.length * 3.1 - 6} y="-9" width={label.length * 6.2 + 12} height="15" rx="3" fill={on ? '#ffc54d' : 'rgba(11,7,22,.85)'} />
                <text textAnchor="middle" y="2.5" fontFamily="Barlow Condensed" fontWeight="700" fontSize="10.5" letterSpacing=".6" fill={on ? '#1a0620' : '#fff4e6'}>{d.name.toUpperCase()}{c > 0 && <tspan fill={on ? '#1a0620' : '#1ee8d6'}>{` ${Math.round(c * 100)}%`}</tspan>}</text>
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
