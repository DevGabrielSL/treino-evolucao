// Ajudas da academia durante o treino: anilhas por lado, previsão de término e nota do aparelho.
import { perform } from './store';

/** Anilhas comuns em academia (kg). */
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
/** Barra olímpica padrão. */
export const BAR_KG = 20;

/** Divide um peso por lado nas anilhas disponíveis (maiores primeiro). `rest` > 0 quando não fecha exato. */
export function platesFor(perSide: number) {
  const out: number[] = [];
  let left = Math.round(perSide * 100) / 100;
  if (!(left > 0)) return { plates: out, rest: 0 };
  for (const p of PLATES) while (left + 1e-9 >= p) { out.push(p); left = Math.round((left - p) * 100) / 100; }
  return { plates: out, rest: left };
}

const fold = (x: string) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/**
 * Linha de anilhas para mostrar junto da carga, ou null quando não se aplica.
 * - kg/lado (máquina com anilhas ou barra registrada por lado): a carga já é por lado.
 * - kg com barra livre: (total − barra de 20 kg) ÷ 2.
 */
export function plateLine(unit: string, equipment: string, load: number): string | null {
  if (!Number.isFinite(load) || load <= 0) return null;
  let perSide: number;
  if (unit === 'kg/lado') perSide = load;
  else if (unit === 'kg' && /barra livre/.test(fold(equipment))) {
    if (load < BAR_KG) return null;
    if (load === BAR_KG) return 'Só a barra (20 kg)';
    perSide = (load - BAR_KG) / 2;
  } else return null;
  const { plates, rest } = platesFor(perSide);
  if (!plates.length) return null;
  const list = plates.map(fmt).join(' + ');
  return `${unit === 'kg/lado' ? 'Anilhas' : 'Por lado (barra 20 kg)'}: ${list}${rest > 0 ? ` (faltam ${fmt(rest)} kg)` : ''}`;
}

/**
 * Previsão de término pelo ritmo do treino: tempo médio entre séries registradas × séries que faltam.
 * Só com 3+ séries registradas (ritmo confiável) e se ainda faltar alguma.
 */
export function finishEstimate(recordedAt: string[], remaining: number, now = Date.now()): number | null {
  const ts = recordedAt.map(x => Date.parse(x)).filter(Number.isFinite).sort((a, b) => a - b);
  if (ts.length < 3 || remaining <= 0) return null;
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).filter(g => g > 0 && g < 20 * 60000); // ignora pausas longas
  if (gaps.length < 2) return null;
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return now + avg * remaining;
}

// ---------------- nota do aparelho (regulagem do banco, pino, pegada)

export const noteFor = (settings: any, variantId?: string | null) => String(settings?.machine_notes?.[variantId || ''] || '');

export async function setMachineNote(variantId: string, text: string) {
  const t = String(text || '').trim();
  if (t.length > 140) throw new Error('Nota muito longa (até 140 caracteres).');
  await perform(d => {
    const notes = { ...(d.settings.machine_notes || {}) };
    if (t) notes[variantId] = t; else delete notes[variantId];
    d.settings.machine_notes = notes;
  }, t ? 'Nota do aparelho salva.' : 'Nota do aparelho apagada.');
}
