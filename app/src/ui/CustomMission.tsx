// Missão personalizada: o "assistente" do app atual em forma de painel de missão.
import { useState } from 'react';
import { motion } from 'motion/react';
import { Play, RefreshCw, Sparkles, X } from 'lucide-react';
import { buildCustomPlan, startPlan, replacementFor, type Readiness } from '../engine/workout';
import { groupLabel } from '../legacy/coach_logic.js';
import { ExerciseVisual } from './ExerciseVisual';
import { Sheet } from './Sheet';
import { asset } from './assets';
import { nf } from './format';

const GROUPS = [['peito', 'Peito'], ['costas', 'Costas'], ['pernas', 'Pernas'], ['ombros', 'Ombros'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps'], ['core', 'Core']];
const COVER: Record<string, string> = { peito: '01', biceps: '01', costas: '02', triceps: '02', ombros: '03', core: '03', pernas: '04' };
const Q: { key: keyof Readiness; label: string; opts: [string, string][] }[] = [
  { key: 'fatigue', label: 'Cansaço', opts: [['unknown', '—'], ['low', 'Baixo'], ['moderate', 'Moderado'], ['high', 'Alto']] },
  { key: 'recovery', label: 'Recuperação', opts: [['unknown', '—'], ['good', 'Boa'], ['partial', 'Parcial'], ['poor', 'Ruim']] },
  { key: 'pain', label: 'Dor durante o movimento?', opts: [['unknown', '—'], ['no', 'Não'], ['yes', 'Sim']] },
];

export function CustomMission({ model, active, onClose, onStarted, onError }: { model: any; active: any; onClose: () => void; onStarted: (deck: any) => void; onError: (e: any) => void }) {
  const [groups, setGroups] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [ready, setReady] = useState<Readiness>({ fatigue: 'unknown', recovery: 'unknown', area: 'all', pain: 'unknown' });
  const [plan, setPlan] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<any>) => { if (busy) return; setBusy(true); try { await fn(); } catch (e) { onError(e); } finally { setBusy(false); } };
  const toggle = (g: string) => { setPlan(null); setGroups(x => x.includes(g) ? x.filter(y => y !== g) : [...x, g]); };
  const deckFor = (p: any) => { const title = groupLabel(p.groups); const items = p.items; const sets = items.reduce((n: number, x: any) => n + (x.dose?.sets || 3), 0); return { id: 'custom', index: -1, title, district: 'Missão personalizada', cover: asset(`deck-cover-${COVER[p.groups[0]] || '01'}.webp`), items, sets, xp: sets * 10 + 100 }; };
  return (
    <Sheet onClose={onClose} title="Missão personalizada">
      <div className="max-h-[74vh] overflow-y-auto no-scrollbar -mx-4 px-4 space-y-4 pb-2">
        {!plan ? (
          <>
            <div>
              <p className="hud-label text-[10px] text-haze">Foco</p>
              <div className="flex flex-wrap gap-2 mt-2">{GROUPS.map(([k, l]) => <button key={k} onClick={() => toggle(k)} className={`chip text-sm rounded-full px-3.5 py-2 border ${groups.includes(k) ? 'bg-gold text-night border-gold' : 'bg-white/5 border-white/10'}`}>{l}</button>)}</div>
            </div>
            <div>
              <p className="hud-label text-[10px] text-haze">Tempo disponível</p>
              <div className="grid grid-cols-5 gap-1.5 mt-2">{[null, 30, 45, 60, 90].map(m => <button key={String(m)} onClick={() => setMinutes(m)} className={`h-10 rounded-lg num font-bold text-sm ${minutes === m ? 'bg-aqua text-night' : 'bg-white/10'}`}>{m ? m + ' min' : 'Livre'}</button>)}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3 space-y-3">
              <p className="hud-label text-[10px] text-pink">Como você está hoje?</p>
              {Q.map(q => (
                <div key={q.key}><p className="text-sm">{q.label}</p>
                  <div className="flex gap-1.5 mt-1">{q.opts.map(([v, l]) => <button key={v} onClick={() => { setPlan(null); setReady({ ...ready, [q.key]: v }); }} className={`flex-1 h-9 rounded-lg text-sm font-hud font-semibold ${ready[q.key] === v ? (q.key === 'pain' && v === 'yes' ? 'bg-pink text-night' : 'bg-cream text-night') : 'bg-black/40'}`}>{l}</button>)}</div>
                </div>
              ))}
              <div><p className="text-sm">Região mais cansada</p>
                <select value={ready.area} onChange={e => setReady({ ...ready, area: e.target.value })} className="mt-1 w-full rounded-lg bg-black/40 px-3 py-2"><option value="all">Geral / nenhuma específica</option>{GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </div>
              <p className="text-[11px] text-haze">Relato temporário para ajustar a sugestão; não é avaliação médica.</p>
            </div>
            <button disabled={busy || !groups.length} onClick={() => run(async () => { const p = await buildCustomPlan(groups.join(' e '), minutes, ready); if (p.adjustment?.blocked) throw new Error(p.adjustment.summary); if (!p.items.length) throw new Error('Não há exercícios desse grupo no seu histórico. Cadastre variações no app Modelos do Celular.'); setPlan(p); })}
              className="btn-sunset w-full h-14 rounded-xl text-2xl flex items-center justify-center gap-2 disabled:opacity-40"><Sparkles size={20} /> {busy ? 'Montando…' : 'Montar missão'}</button>
          </>
        ) : (
          <>
            <div>
              <p className="chip text-gold text-sm">Proposta do assistente</p>
              <h3 className="font-display uppercase text-3xl leading-[1.1] sunset-text">{groupLabel(plan.groups)}</h3>
              <p className="text-xs text-haze mt-1">{plan.adjustment.summary}</p>
              {plan.short > 0 && <p className="text-xs text-gold mt-1">Faltam {plan.short} opções compatíveis; cadastre outras variações se quiser.</p>}
              {(plan.notes || []).map((n: string) => <p key={n} className="text-xs text-haze mt-1">{n}</p>)}
            </div>
            <ol className="space-y-2">
              {plan.items.map((it: any, i: number) => (
                <motion.li key={it.variant_id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .04 }} className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
                  <div className="duotone-wrap size-12 rounded-lg shrink-0"><ExerciseVisual name={it.name} equipment={it.equipment} size="sm" /></div>
                  <div className="flex-1 min-w-0"><p className="font-hud font-bold leading-tight truncate">{it.name}</p><p className="text-[11px] text-haze truncate">{it.equipment}{it.last ? ` · últ. ${nf(it.last.load_value)} ${it.unit}` : ''}</p><p className="num text-[11px] text-gold">{it.dose?.label?.replace('Sugestão: ', '')}</p></div>
                  <button aria-label="Trocar sugestão" onClick={() => { const r = replacementFor(plan, i); if (!r) return onError(new Error('Não há outra opção cadastrada para esse grupo.')); const items = [...plan.items]; items[i] = r; setPlan({ ...plan, items }); }} className="size-9 grid place-items-center rounded-lg bg-white/10"><RefreshCw size={15} /></button>
                  <button aria-label="Remover sugestão" onClick={() => setPlan({ ...plan, items: plan.items.filter((_: any, k: number) => k !== i) })} className="size-9 grid place-items-center rounded-lg bg-white/10 text-pink"><X size={15} /></button>
                </motion.li>
              ))}
            </ol>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button onClick={() => setPlan(null)} className="px-4 rounded-xl bg-white/10 chip text-sm">Refazer</button>
              <button disabled={busy || !!active || !plan.items.length} onClick={() => run(async () => { await startPlan(plan, model); onStarted(deckFor(plan)); onClose(); })} className="btn-sunset h-14 rounded-xl text-2xl flex items-center justify-center gap-2 disabled:opacity-40"><Play size={20} className="fill-current" /> {active ? 'Missão em andamento' : 'Iniciar'}</button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
