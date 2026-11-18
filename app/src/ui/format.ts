export const nf = (n: number, max = 1) => Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: max }) : '—';
export const clock = (ms: number | null) => { if (ms == null) return '00:00'; const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(r).padStart(2, '0'); };
export const art = (src?: string | null) => src ? src.replace(/^\.\//, './') : null;
