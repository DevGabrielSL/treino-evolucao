export const nf = (n: number, max = 1) => Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: max }) : '—';
export const clock = (ms: number | null) => { if (ms == null) return '00:00'; const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(r).padStart(2, '0'); };
/** Hora local (HH:MM) de um instante ISO; '' se inválido. */
export const hhmm = (iso?: string | null) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };
export const art = (src?: string | null) => src ? src.replace(/^\.\//, './') : null;
