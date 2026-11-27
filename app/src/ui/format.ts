export const nf = (n: number, max = 1) => Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: max }) : '—';
export const clock = (ms: number | null) => { if (ms == null) return '00:00'; const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(r).padStart(2, '0'); };
/** Hora local (HH:MM) de um instante ISO; '' se inválido. */
export const hhmm = (iso?: string | null) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };
export const art = (src?: string | null) => src ? src.replace(/^\.\//, './') : null;
/** Nome do exercício sem o equipamento (o equipamento já aparece embaixo). Só muda a exibição; o dado fica igual. */
const EQUIP_WORDS = ['barra v', 'barra w', 'barra reta', 'barra livre', 'polia alta', 'polia baixa', 'polia', 'halteres', 'halter', 'maquina articulada', 'maquina', 'smith', 'corda', 'com anilhas', 'anilhas', 'apoio no peito', '45°'];
const fold = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function exName(name?: string | null, equipment?: string | null): string {
  const n = String(name || ''); if (!n) return '';
  const eq = fold(String(equipment || ''));
  let out = fold(n), keep = n;
  for (const w of EQUIP_WORDS) {
    if (!eq.includes(w)) continue;
    const re = new RegExp(`\\s*\\b(?:na|no|com|em|de)?\\s*${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g');
    let m: RegExpExecArray | null; const cuts: [number, number][] = [];
    while ((m = re.exec(out))) cuts.push([m.index, m.index + m[0].length]);
    for (const [a, b] of cuts.reverse()) { out = out.slice(0, a) + out.slice(b); keep = keep.slice(0, a) + keep.slice(b); }
  }
  keep = keep.replace(/\s{2,}/g, ' ').trim();
  return keep.length >= 3 ? keep : n;
}
