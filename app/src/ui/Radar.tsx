import { motion } from 'motion/react';

// Radar dos atributos (nível relativo ao maior, e forma recente sobreposta).
export function Radar({ items }: { items: { short: string; level: number; form: number }[] }) {
  const n = items.length, cx = 150, cy = 140, R = 100, max = Math.max(5, ...items.map(i => i.level));
  const pt = (i: number, r: number) => [cx + Math.sin((i / n) * 2 * Math.PI) * r, cy - Math.cos((i / n) * 2 * Math.PI) * r];
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, R * v).join(',')).join(' ');
  return (
    <svg viewBox="0 0 300 285" className="w-full max-w-[320px] mx-auto">
      <defs><linearGradient id="rad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff2e93" stopOpacity=".75" /><stop offset="1" stopColor="#ffc54d" stopOpacity=".55" /></linearGradient></defs>
      {[.25, .5, .75, 1].map(f => <polygon key={f} points={poly(items.map(() => f))} fill="none" stroke="rgba(255,255,255,.12)" />)}
      {items.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,.08)" />; })}
      <motion.polygon points={poly(items.map(i => Math.min(1, i.form / 100)))} fill="rgba(30,232,214,.18)" stroke="#1ee8d6" strokeWidth="1.5" strokeDasharray="4 3"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .6 }} />
      <motion.polygon points={poly(items.map(i => i.level / max))} fill="url(#rad)" stroke="#ffc54d" strokeWidth="2"
        style={{ transformOrigin: `${cx}px ${cy}px` }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 14, delay: .15 }} />
      {items.map((it, i) => { const [x, y] = pt(i, R + 22); return (
        <g key={it.short}>
          <text x={x} y={y - 2} textAnchor="middle" fontFamily="Barlow Condensed" fontWeight="700" fontSize="12" fill="#bfaed3" letterSpacing="1">{it.short}</text>
          <text x={x} y={y + 12} textAnchor="middle" fontFamily="Anton" fontSize="14" fill="#fff4e6">{it.level}</text>
        </g>); })}
    </svg>
  );
}
