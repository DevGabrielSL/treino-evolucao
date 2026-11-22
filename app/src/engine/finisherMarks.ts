// Bloco final sem meta fixa: a referência é a sua última execução (e o seu melhor).
// Só leitura do histórico; nada é gravado.

const WORK = new Set(['effective', 'core', 'back_off']);
const isKey = (s: any, key: 'abs' | 'plank') => s.finisher_key === key || s.exercise_id === 'exercise_finisher_' + key;

function seconds(s: any) {
  if (Number.isFinite(s.duration_ms)) return Math.max(0, s.duration_ms) / 1000;
  const m = /(\d+(?:\.\d+)?) segundos$/.exec(String(s.notes || ''));
  return m ? Number(m[1]) : 0;
}

export type Mark = { value: number; date: string } | null;

/** Total por sessão: repetições de trabalho (abdominal) ou segundos (prancha). */
export function finisherTotals(entities: any, key: 'abs' | 'plank', excludeSession?: string) {
  const done = new Map((entities.sessions || []).filter((s: any) => s.status === 'completed' && s.id !== excludeSession).map((s: any) => [s.id, s]));
  const totals = new Map<string, number>();
  for (const s of entities.sets || []) {
    if (!done.has(s.session_id) || !isKey(s, key)) continue;
    const v = key === 'plank' ? seconds(s) : WORK.has(s.set_type) ? Number(s.repetitions) || 0 : 0;
    totals.set(s.session_id, (totals.get(s.session_id) || 0) + v);
  }
  return [...totals.entries()].filter(([, v]) => v > 0).map(([id, value]) => ({ id, value: Math.round(value), session: done.get(id) as any }))
    .sort((a, b) => String(b.session.date).localeCompare(String(a.session.date)) || String(b.session.finished_at || '').localeCompare(String(a.session.finished_at || '')));
}

export function finisherMarks(entities: any, key: 'abs' | 'plank', excludeSession?: string): { last: Mark; best: Mark } {
  const list = finisherTotals(entities, key, excludeSession);
  if (!list.length) return { last: null, best: null };
  const best = list.reduce((a, b) => (b.value > a.value ? b : a));
  return { last: { value: list[0].value, date: list[0].session.date }, best: { value: best.value, date: best.session.date } };
}

/** Maior tempo em UMA série de prancha (bloco final ou prancha do treino em casa). */
export function plankBestSingle(entities: any, excludeSession?: string): Mark {
  const done = new Map((entities.sessions || []).filter((s: any) => s.status === 'completed' && s.id !== excludeSession).map((s: any) => [s.id, s]));
  let best: Mark = null;
  for (const s of entities.sets || []) {
    if (!done.has(s.session_id) || !(isKey(s, 'plank') || s.exercise_id === 'home_ex_prancha')) continue;
    const v = Math.round(seconds(s));
    if (v > 0 && (!best || v > best.value)) best = { value: v, date: (done.get(s.session_id) as any).date };
  }
  return best;
}
