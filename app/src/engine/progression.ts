// Sugestão de progressão de carga (dupla progressão). OPCIONAL e desligada por padrão:
// o app nunca muda a carga sozinho; a sugestão só aparece se a pessoa ativar em Ajustes
// e só vira valor no campo se ela tocar em "Usar".
//
// Regra (inspirada na recomendação do ACSM de 2009: subir 2–10% quando a carga atual já
// permite 1–2 repetições acima do alvo):
//  • Todas as séries de trabalho na carga mais alta da última vez chegaram ao topo da faixa
//    e sobraram repetições (RIR ≥ 1 informado)  → sugere subir um degrau.
//  • Chegaram ao topo, mas sem RIR informado    → sugere subir só se isso se repetiu em 2 treinos
//    seguidos; senão pede confirmação.
//  • Chegaram ao topo no limite (RIR 0) ou ficaram abaixo da faixa → mantém a carga.
import { sameLoadVariant } from '../legacy/principal_unit.js';

const KEY = 'treino-evolucao-progressao-v1';
export function progressionOn() { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } }
export function setProgression(on: boolean) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* sem armazenamento */ } }

const LOAD_UNITS = new Set(['kg', 'kg/lado', 'kg/halter', 'plaquetas']);

/** Menor salto prático para cada tipo de carga. */
export function loadStep(unit: string, load: number) {
  if (unit === 'plaquetas') return 1;
  if (unit === 'kg/halter') return 2;
  if (unit === 'kg/lado') return load >= 30 ? 2.5 : 1.25;
  return load >= 80 ? 5 : 2.5;
}

export type Hint = {
  kind: 'subir' | 'confirmar' | 'manter' | 'reduzir';
  unit: string; current: number; next: number; pct: number;
  min: number; max: number; title: string; detail: string;
};

type Dose = { min?: number; max?: number; unit?: string } | null | undefined;

function evaluate(sets: any[], max: number) {
  const top = Math.max(...sets.map(s => s.load_value));
  const atTop = sets.filter(s => s.load_value === top);
  const reached = atTop.length >= 2 && atTop.every(s => Number(s.repetitions) >= max);
  const rirs = atTop.map(s => s.rir).filter((r: any) => typeof r === 'number' && Number.isFinite(r));
  return { top, atTop, reached, rirKnown: rirs.length === atTop.length && rirs.length > 0, minRir: rirs.length ? Math.min(...rirs) : null, reps: atTop.map(s => Number(s.repetitions)) };
}

/**
 * @param variantId variante do exercício
 * @param dose faixa de repetições planejada ({min, max, unit: 'repetições'})
 * @param entities histórico completo
 * @param opts.excludeSession sessão em andamento (não entra na análise)
 * @param opts.today data limite
 */
export function progressionHint(variantId: string, dose: Dose, entities: any, opts: { excludeSession?: string; today?: string } = {}): Hint | null {
  if (!dose || dose.unit !== 'repetições' || !Number.isFinite(dose.min) || !Number.isFinite(dose.max)) return null;
  const min = Number(dose.min), max = Number(dose.max);
  const variants = new Map((entities.exercise_variants || []).map((v: any) => [v.id, v]));
  const variant: any = variants.get(variantId);
  if (!variant || variant.unit_confirmed !== true || !LOAD_UNITS.has(variant.unit)) return null;
  const unit = variant.unit;
  const done = new Map((entities.sessions || []).filter((s: any) => s.status === 'completed' && s.id !== opts.excludeSession && (!opts.today || s.date <= opts.today)).map((s: any) => [s.id, s]));
  const rows = (entities.sets || []).filter((s: any) => done.has(s.session_id) && s.set_type === 'effective' &&
    typeof s.load_value === 'number' && s.load_value > 0 && Number.isInteger(s.repetitions) && s.repetitions > 0 &&
    (!s.load_unit_original || s.load_unit_original === unit) &&
    (s.variant_id === variantId || sameLoadVariant(variant, variants.get(s.variant_id))));
  const bySession = new Map<string, any[]>();
  for (const r of rows) { if (!bySession.has(r.session_id)) bySession.set(r.session_id, []); bySession.get(r.session_id)!.push(r); }
  const order = [...bySession.keys()].sort((a, b) => {
    const A: any = done.get(a), B: any = done.get(b);
    return String(B.date).localeCompare(String(A.date)) || String(B.finished_at || '').localeCompare(String(A.finished_at || ''));
  });
  if (!order.length) return null;
  const last = evaluate(bySession.get(order[0])!, max);
  const prev = order[1] ? evaluate(bySession.get(order[1])!, max) : null;
  const step = loadStep(unit, last.top);
  const next = Math.round((last.top + step) * 100) / 100;
  const pct = Math.round((step / last.top) * 100);
  const base = { unit, current: last.top, min, max };
  const big = pct > 10 ? ` O salto é de ${pct}%: é normal voltar para ${min} repetições e subir de novo.` : '';
  const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const u = unit === 'plaquetas' ? (next === 1 ? 'placa' : 'placas') : unit;

  if (last.reached && last.rirKnown && (last.minRir as number) >= 1) {
    return { ...base, kind: 'subir', next, pct, title: `Suba para ${fmt(next)} ${u}`, detail: `Na última vez você fez ${last.reps.join(', ')} reps com ${fmt(last.top)} ${unit} e ainda sobraram repetições. Comece em ${min} e vá subindo até ${max}.${big}` };
  }
  if (last.reached && last.minRir === 0) {
    return { ...base, kind: 'manter', next: last.top, pct: 0, title: `Mantenha ${fmt(last.top)} ${unit}`, detail: `Você chegou a ${max} reps, mas no limite (RIR 0). Repita a carga até sobrarem 1–2 repetições com boa técnica.` };
  }
  if (last.reached) {
    if (prev?.reached && prev.top >= last.top) {
      return { ...base, kind: 'subir', next, pct, title: `Suba para ${fmt(next)} ${u}`, detail: `Você chegou ao topo da faixa (${max} reps) com ${fmt(last.top)} ${unit} em 2 treinos seguidos. Comece em ${min} e vá subindo até ${max}.${big}` };
    }
    return { ...base, kind: 'confirmar', next, pct, title: `Topo da faixa com ${fmt(last.top)} ${unit}`, detail: `Se sobraram 1–2 repetições com boa técnica, tente ${fmt(next)} ${u}; se foi no limite, repita a carga. Informar o RIR deixa a sugestão mais precisa.` };
  }
  if (last.atTop.length < 2 && last.reps.every(r => r >= max)) {
    return { ...base, kind: 'manter', next: last.top, pct: 0, title: `Mantenha ${fmt(last.top)} ${unit}`, detail: `Só houve 1 série de trabalho com essa carga na última vez. Faça pelo menos 2 para a sugestão avaliar se dá para subir.` };
  }
  const below = last.reps.filter(r => r < min).length > last.reps.length / 2;
  // Redução: repetições baixas (abaixo da faixa) ou falha (RIR 0) em 2+ séries sem chegar ao topo.
  const rirs = last.atTop.map((s: any) => s.rir).filter((r: any) => typeof r === 'number');
  const failures = rirs.filter((r: number) => r === 0).length;
  if (below || failures >= 2) {
    const avg = last.reps.reduce((a, b) => a + b, 0) / last.reps.length;
    const down = loadStep(unit, Math.max(0, last.top - 0.01));
    const cut = below && min - avg >= 3 ? Math.max(down, Math.round((last.top * 0.1) / down) * down) : down;
    const lower = Math.round((last.top - cut) * 100) / 100;
    if (lower > 0) {
      const dpct = Math.round((cut / last.top) * 100);
      return {
        ...base, kind: 'reduzir', next: lower, pct: -dpct, title: `Reduza para ${fmt(lower)} ${unit === 'plaquetas' ? (lower === 1 ? 'placa' : 'placas') : unit}`,
        detail: below
          ? `Na última vez as repetições ficaram abaixo da faixa (${last.reps.join(', ')} com ${fmt(last.top)} ${unit}). Reduzindo ~${dpct}%, você volta para ${min}–${max} com boa técnica e depois sobe de novo.`
          : `Você chegou na falha (RIR 0) em ${failures} séries sem chegar a ${max} reps (${last.reps.join(', ')}). Reduzindo ~${dpct}%, dá para treinar com 1–2 repetições em reserva.`,
      };
    }
  }
  return {
    ...base, kind: 'manter', next: last.top, pct: 0, title: `Mantenha ${fmt(last.top)} ${unit}`,
    detail: below ? `As repetições ficaram abaixo de ${min}. Mantenha a carga (ou reduza, se a técnica caiu) até voltar para a faixa ${min}–${max}.`
      : `Busque +1 repetição por série até fazer ${max} em todas (última vez: ${last.reps.join(', ')}).`,
  };
}
