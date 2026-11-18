// Cenário de fundo original: céu ao entardecer, sol listrado, skyline e palmeiras em silhueta.
import { memo } from 'react';

function rng(seed: number) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

const Skyline = memo(function Skyline() {
  const r = rng(42), blocks: { x: number; w: number; h: number }[] = [];
  for (let x = 0; x < 420;) { const w = 14 + r() * 26, h = 40 + r() * (r() > .85 ? 150 : 80); blocks.push({ x, w, h }); x += w + 2; }
  return (
    <svg viewBox="0 0 420 220" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 w-full h-[34vh]">
      <defs>
        <linearGradient id="bld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1342" /><stop offset="1" stopColor="#0b0716" /></linearGradient>
        <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe08a" /><stop offset=".5" stopColor="#ff6b3d" /><stop offset="1" stopColor="#ff2e93" /></linearGradient>
        <mask id="sunmask"><rect width="420" height="220" fill="#fff" />{[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x="0" y={118 + i * 9} width="420" height={1.5 + i * .9} fill="#000" />)}</mask>
      </defs>
      <circle cx="300" cy="140" r="62" fill="url(#sun)" mask="url(#sunmask)" opacity=".55" />
      {blocks.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={220 - b.h} width={b.w} height={b.h} fill="url(#bld)" />
          {Array.from({ length: Math.floor(b.h / 12) }, (_, k) => r() > .72 && (
            <rect key={k} x={b.x + 3 + (r() > .5 ? b.w / 2 : 0)} y={220 - b.h + 6 + k * 12} width="3" height="4" fill={r() > .5 ? '#ffc54d' : '#1ee8d6'} opacity=".7" />
          ))}
        </g>
      ))}
      {/* palmeiras */}
      {[[18, 1], [70, .8], [372, 1.1]].map(([x, s], i) => (
        <g key={i} transform={`translate(${x} ${220}) scale(${s})`} fill="#07040f">
          <path d="M-2 0 C 0 -40, 4 -80, 10 -112 L 14 -112 C 9 -80, 6 -40, 4 0 Z" />
          <path d="M12 -112 C -10 -122, -30 -116, -44 -100 C -26 -110, -8 -110, 12 -108 Z" />
          <path d="M12 -112 C 30 -126, 52 -122, 64 -104 C 46 -114, 30 -114, 12 -108 Z" />
          <path d="M12 -112 C 4 -136, -12 -146, -30 -146 C -12 -136, 0 -126, 10 -110 Z" />
          <path d="M12 -112 C 24 -138, 42 -146, 58 -140 C 40 -134, 26 -124, 14 -110 Z" />
          <path d="M12 -112 C 0 -110, -16 -98, -22 -78 C -10 -94, 2 -104, 12 -108 Z" />
          <path d="M12 -112 C 26 -108, 40 -96, 44 -78 C 34 -94, 22 -104, 12 -108 Z" />
        </g>
      ))}
    </svg>
  );
});

export function Sky({ dim = false }: { dim?: boolean }) {
  return (
    <div className="sky" aria-hidden="true">
      <div className="absolute -inset-[20%] animate-[drift_26s_ease-in-out_infinite_alternate] bg-[radial-gradient(40%_30%_at_70%_20%,rgba(141,92,255,.22),transparent),radial-gradient(35%_25%_at_20%_60%,rgba(255,46,147,.16),transparent)]" />
      <div className={`absolute inset-0 transition-opacity duration-700 ${dim ? 'opacity-25' : 'opacity-60'}`}><Skyline /></div>
      <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-gradient-to-t from-night via-night/60 to-transparent" />
    </div>
  );
}
