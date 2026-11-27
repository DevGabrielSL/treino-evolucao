import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, ChevronRight, Copy, Pencil, Play, Search, Share2, Trash2, TrendingUp } from 'lucide-react';
import { shareMission } from '../fx/shareCard';
import { searchHistory, compareHistoryPeriods, defaultHistoryFilters } from '../legacy/history.js';
import { classifyExercise } from '../legacy/balanced_coach.js';
import { loadUnits } from '../legacy/principal_unit.js';
import { deleteSet, editSession, editSet, isLocalSession, isLocalSet, repeatSession, templateFromSession } from '../engine/edits';
import { activeSession } from '../engine/workout';
import { ExerciseVisual } from './ExerciseVisual';
import { Sheet } from './Sheet';
import { ask } from './Dialog';
import { clock, nf, hhmm, exName } from './format';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const STATUS: Record<string, [string, string]> = { completed: ['Concluída', 'text-cash bg-cash/15'], cancelled: ['Abandonada', 'text-pink bg-pink/15'], in_progress: ['Em andamento', 'text-gold bg-gold/15'], planned: ['Planejada', 'text-aqua bg-aqua/15'] };
const GROUP_COLOR: Record<string, string> = { peito: '#ff2e93', costas: '#1ee8d6', pernas: '#ffc54d', ombros: '#8d5cff', biceps: '#ff6b3d', triceps: '#7cf29a', core: '#bfaed3' };

type Props = { model: any; onError: (e: any) => void; onGoWorkout: () => void };

export function HistoryScreen({ model, onError, onGoWorkout }: Props) {
  const [view, setView] = useState<'diario' | 'evolucao'>('diario');
  return (
    <div className="px-4 pb-32 space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="font-display uppercase text-4xl leading-[1.1]"><span className="title-slash">{view === 'diario' ? 'Diário' : 'Evolução'}</span></h1>
        <div className="grid grid-cols-2 rounded-xl bg-black/40 p-1">
          {(['diario', 'evolucao'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`relative chip text-xs px-3 py-1.5 rounded-lg ${view === v ? 'text-night' : 'text-haze'}`}>
              {view === v && <motion.span layoutId="histtab" className="absolute inset-0 rounded-lg bg-cream" />}
              <span className="relative">{v === 'diario' ? 'Missões' : 'Cargas'}</span>
            </button>
          ))}
        </div>
      </div>
      {view === 'diario' ? <Journal model={model} onError={onError} onGoWorkout={onGoWorkout} /> : <Progress model={model} />}
    </div>
  );
}

function sessionStats(model: any, id: string) {
  const sets = model.sets.filter((s: any) => s.session_id === id);
  const work = sets.filter((s: any) => ['effective', 'core', 'back_off'].includes(s.set_type));
  const volume = work.reduce((n: number, s: any) => n + (/^kg/.test(s.load_unit_original || '') && typeof s.load_value === 'number' ? s.load_value * (s.repetitions || 0) : 0), 0);
  const groups = [...new Set(sets.map((s: any) => classifyExercise(model.exerciseMap.get(s.exercise_id))).filter(Boolean))] as string[];
  return { sets, work: work.length, volume, groups };
}

function Journal({ model, onError, onGoWorkout }: Props) {
  const [filters, setFilters] = useState<any>(defaultHistoryFilters());
  const [limit, setLimit] = useState(20);
  const [open, setOpen] = useState<string | null>(null);
  const result = useMemo(() => searchHistory(model, { ...filters, page: 0 }, undefined, 100), [model, filters]);
  const compare = useMemo(() => compareHistoryPeriods(model, '30'), [model]);
  const rows = result.rows.slice(0, limit);
  let lastMonth = '';
  return (
    <>
      {compare && (
        <section className="grid grid-cols-3 gap-2">
          {[['Missões', compare.current.completed, compare.previous.completed], ['Séries', compare.current.sets, compare.previous.sets], ['Exercícios', compare.current.exercises, compare.previous.exercises]].map(([k, cur, prev]: any) => {
            const d = cur - prev;
            return (
              <div key={k} className="panel p-3">
                <p className="hud-label text-[10px] text-haze">{k} · 30 dias</p>
                <p className="num text-2xl font-extrabold mt-0.5">{cur}</p>
                <p className={`num text-xs ${d > 0 ? 'text-cash' : d < 0 ? 'text-pink' : 'text-haze'}`}>{d > 0 ? '▲' : d < 0 ? '▼' : '='} {Math.abs(d)} vs anterior</p>
              </div>
            );
          })}
        </section>
      )}

      <div className="panel p-2 flex items-center gap-2">
        <Search size={18} className="text-haze ml-2" />
        <input value={filters.query} onChange={e => { setFilters({ ...filters, query: e.target.value }); setLimit(20); }} placeholder="Buscar treino ou exercício" className="flex-1 bg-transparent outline-none py-2 text-[15px] placeholder:text-haze/60" />
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {[['all', 'Tudo'], ['30', '30 dias'], ['90', '90 dias'], ['180', '6 meses']].map(([v, l]) => (
          <Chip key={v} on={filters.period === v} onClick={() => setFilters({ ...filters, period: v })}>{l}</Chip>
        ))}
        <span className="w-px bg-white/10 shrink-0" />
        {[['all', 'Todas'], ['completed', 'Concluídas'], ['cancelled', 'Abandonadas']].map(([v, l]) => (
          <Chip key={v} on={filters.status === v} onClick={() => setFilters({ ...filters, status: v })}>{l}</Chip>
        ))}
      </div>

      {result.error && <p className="text-pink text-sm">{result.error}</p>}
      {!rows.length && <div className="panel p-6 text-center text-haze">Nenhuma missão encontrada com esses filtros.</div>}

      <ol className="space-y-2">
        {rows.map((s: any, i: number) => {
          const month = s.date.slice(0, 7), st = sessionStats(model, s.id), header = month !== lastMonth; lastMonth = month;
          const [label, cls] = STATUS[s.status] || ['—', 'text-haze'];
          return (
            <li key={s.id}>
              {header && <p className="hud-label text-[11px] text-aqua mt-4 mb-2">{MONTHS[Number(s.date.slice(5, 7)) - 1]} {s.date.slice(0, 4)}</p>}
              <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 8) * .03 }}
                onClick={() => setOpen(s.id)} className="panel w-full flex items-center gap-3 p-3 text-left">
                <div className="w-12 shrink-0 text-center rounded-lg bg-black/40 py-1.5">
                  <p className="font-display text-2xl leading-none">{s.date.slice(8, 10)}</p>
                  <p className="hud-label text-[9px] text-haze">{MONTHS[Number(s.date.slice(5, 7)) - 1]}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-hud font-bold text-[17px] leading-tight truncate">{s.name}</p>
                  <p className="num text-xs text-haze mt-0.5">{st.work} séries · {nf(st.volume, 0)} kg{s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}</p>
                  <div className="flex gap-1 mt-1.5">{st.groups.map(g => <span key={g} className="h-1.5 w-5 rounded-full" style={{ background: GROUP_COLOR[g] }} title={g} />)}</div>
                </div>
                <span className={`chip text-[10px] rounded px-1.5 py-0.5 ${cls}`}>{label}</span>
                <ChevronRight size={18} className="text-haze" />
              </motion.button>
            </li>
          );
        })}
      </ol>
      {result.total > limit && <button onClick={() => setLimit(l => l + 20)} className="w-full h-12 rounded-xl bg-white/5 border border-white/10 chip text-sm">Carregar mais ({result.total - limit})</button>}
      <p className="text-center text-xs text-haze">{result.total} missões no registro</p>

      <AnimatePresence>{open && <SessionSheet model={model} id={open} onClose={() => setOpen(null)} onError={onError} onGoWorkout={onGoWorkout} />}</AnimatePresence>
    </>
  );
}

function Chip({ on, onClick, children }: any) {
  return <button onClick={onClick} className={`shrink-0 chip text-xs rounded-full px-3 py-1.5 border ${on ? 'bg-gold text-night border-gold' : 'bg-white/5 border-white/10 text-haze'}`}>{children}</button>;
}

function SessionSheet({ model, id, onClose, onError, onGoWorkout }: { model: any; id: string; onClose: () => void; onError: (e: any) => void; onGoWorkout: () => void }) {
  const s = model.entities.sessions.find((x: any) => x.id === id);
  const [edit, setEdit] = useState<any>(null);
  const [rename, setRename] = useState(false);
  const [name, setName] = useState(s?.name || ''), [notes, setNotes] = useState(s?.notes || '');
  if (!s) return null;
  const st = sessionStats(model, id);
  const byVariant = new Map<string, any[]>();
  for (const row of [...st.sets].sort((a: any, b: any) => (a.recorded_at || '').localeCompare(b.recorded_at || '') || (a.set_number || 0) - (b.set_number || 0))) {
    const list = byVariant.get(row.variant_id) || []; list.push(row); byVariant.set(row.variant_id, list);
  }
  const run = async (fn: () => Promise<any>) => { try { await fn(); } catch (e) { onError(e); } };
  const local = isLocalSession(id);
  return (
    <Sheet onClose={onClose} title={s.date.split('-').reverse().join('/')}>
      <div className="max-h-[72vh] overflow-y-auto no-scrollbar -mx-4 px-4">
        {rename ? (
          <div className="space-y-2 mb-3">
            <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5" aria-label="Nome do treino" />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Observações" className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm" aria-label="Observações" />
            <div className="grid grid-cols-2 gap-2"><button onClick={() => setRename(false)} className="h-11 rounded-xl bg-white/10 chip">Cancelar</button><button onClick={() => run(async () => { await editSession(id, name, notes); setRename(false); })} className="h-11 rounded-xl btn-sunset">Salvar</button></div>
          </div>
        ) : (
          <div className="flex items-start gap-2 mb-3">
            <div className="flex-1"><p className="font-display uppercase text-2xl leading-tight">{s.name}</p>{hhmm(s.started_at) && <p className="num text-xs text-gold mt-0.5" data-testid="session-hours">Início {hhmm(s.started_at)}{hhmm(s.finished_at) ? ` · fim ${hhmm(s.finished_at)}` : ''}</p>}{s.notes && <p className="text-xs text-haze mt-1 line-clamp-3">{s.notes}</p>}</div>
            {local && <button onClick={() => setRename(true)} aria-label="Editar nome e observações" className="size-9 grid place-items-center rounded-lg bg-white/10"><Pencil size={16} /></button>}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[['Séries', st.work], ['Volume', `${nf(st.volume, 0)} kg`], ['Duração', s.duration_minutes != null ? clock(s.duration_minutes * 60000) : '—']].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-black/40 p-2 text-center"><p className="num text-lg font-extrabold">{v}</p><p className="hud-label text-[9px] text-haze">{k}</p></div>
          ))}
        </div>
        <div className="space-y-3">
          {[...byVariant.entries()].map(([vid, rows]) => {
            const v = model.variantMap.get(vid), ex = model.exerciseMap.get(v?.exercise_id);
            return (
              <div key={vid} className="rounded-xl bg-white/5 overflow-hidden">
                <div className="flex items-center gap-3 p-2">
                  <div className="duotone-wrap size-11 rounded-lg shrink-0"><ExerciseVisual name={ex?.name} equipment={v?.equipment_or_variation} size="sm" /></div>
                  <div className="min-w-0"><p className="font-hud font-bold leading-tight truncate">{exName(ex?.name, v?.equipment_or_variation)}</p><p className="text-[11px] text-haze truncate">{v?.equipment_or_variation}</p></div>
                </div>
                <ul className="px-2 pb-2 space-y-1">
                  {rows.map((r: any, i: number) => (
                    <li key={r.id} className="flex items-center gap-2 rounded-lg bg-black/30 px-2 py-1.5">
                      <span className={`num text-[11px] font-bold rounded px-1.5 ${r.set_type === 'warmup' ? 'bg-aqua/20 text-aqua' : r.set_type === 'drop_set' ? 'bg-violet/25 text-violet' : 'bg-gold/20 text-gold'}`}>{r.set_type === 'warmup' ? 'AQ' : r.set_type === 'drop_set' ? 'DROP' : `S${i + 1}`}</span>
                      <span className="num font-bold flex-1">{r.duration_ms != null ? `⏱ ${nf(r.duration_ms / 1000, 1)} s` : <>{r.load_value != null ? nf(r.load_value) : '—'} <span className="text-xs text-haze">{r.load_unit_original}</span> × {r.repetitions ?? '—'}{r.rir != null && <span className="text-[11px] text-aqua ml-1.5">RIR {r.rir}</span>}</>}</span>
                      {isLocalSet(r.id) && <>
                        {r.duration_ms == null && <button onClick={() => setEdit({ id: r.id, unit: r.load_unit_original || v?.unit, load: String(r.load_value ?? ''), reps: String(r.repetitions ?? ''), type: r.set_type })} aria-label="Corrigir série" className="size-8 grid place-items-center rounded-md bg-white/10"><Pencil size={14} /></button>}
                        <button onClick={() => run(async () => { if (await ask('Remover esta série do treino local?', { ok: 'Remover', danger: true })) await deleteSet(r.id); })} aria-label="Remover série" className="size-8 grid place-items-center rounded-md bg-white/10 text-pink"><Trash2 size={14} /></button>
                      </>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {edit && (
          <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 p-3 space-y-2">
            <p className="hud-label text-gold text-[11px]">Corrigir série</p>
            <div className="grid grid-cols-2 gap-2">
              <input inputMode="decimal" value={edit.load} onChange={e => setEdit({ ...edit, load: e.target.value })} className="num rounded-lg bg-black/40 px-3 py-2 text-lg" aria-label="Carga" />
              <input inputMode="numeric" value={edit.reps} onChange={e => setEdit({ ...edit, reps: e.target.value })} className="num rounded-lg bg-black/40 px-3 py-2 text-lg" aria-label="Repetições" />
              <select value={edit.unit} onChange={e => setEdit({ ...edit, unit: e.target.value, load: '' })} className="rounded-lg bg-black/40 px-3 py-2" aria-label="Unidade">{loadUnits.map((u: string) => <option key={u}>{u}</option>)}</select>
              <select value={edit.type} onChange={e => setEdit({ ...edit, type: e.target.value })} className="rounded-lg bg-black/40 px-3 py-2" aria-label="Tipo"><option value="effective">Trabalho</option><option value="warmup">Aquecimento</option><option value="drop_set">Drop</option><option value="other">Outro</option></select>
            </div>
            <div className="grid grid-cols-2 gap-2"><button onClick={() => setEdit(null)} className="h-11 rounded-xl bg-white/10 chip">Cancelar</button><button onClick={() => run(async () => { await editSet(edit.id, edit.unit, edit); setEdit(null); })} className="h-11 rounded-xl btn-sunset">Salvar</button></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-4 mb-2">
          {s.status === 'completed' && <button disabled={!!activeSession(model)} onClick={() => run(async () => { await repeatSession(id); onClose(); onGoWorkout(); })} className="h-12 rounded-xl btn-sunset text-lg flex items-center justify-center gap-1.5 disabled:opacity-40"><Play size={16} className="fill-current" />Repetir</button>}
          <button onClick={() => run(async () => { await templateFromSession(id, s.name); onClose(); })} className="h-12 rounded-xl bg-white/10 chip text-sm flex items-center justify-center gap-1.5"><Copy size={15} />Salvar como modelo</button>
          {s.status === 'completed' && <button onClick={() => run(() => shareMission(model, id))} className="col-span-2 h-12 rounded-xl bg-white/10 chip text-sm flex items-center justify-center gap-1.5"><Share2 size={15} />Compartilhar cartão da missão</button>}
        </div>
      </div>
    </Sheet>
  );
}

/* ---------- Evolução de cargas por exercício ---------- */
function Progress({ model }: { model: any }) {
  const options = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of model.eff) if (typeof s.load_value === 'number' && s.load_value > 0) counts.set(s.variant_id, (counts.get(s.variant_id) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => { const v = model.variantMap.get(id); return { id, n, v, ex: model.exerciseMap.get(v?.exercise_id) }; }).filter(o => o.v);
  }, [model]);
  const [sel, setSel] = useState<string>(options[0]?.id || '');
  const cur = options.find(o => o.id === sel) || options[0];
  if (!cur) return <div className="panel p-6 text-center text-haze">Registre séries de trabalho com carga para ver sua evolução.</div>;
  const perSession = new Map<string, { date: string; top: number; reps: number; e1rm: number }>();
  for (const s of model.eff.filter((x: any) => x.variant_id === cur.id && typeof x.load_value === 'number')) {
    const e1rm = s.load_value * (1 + (s.repetitions || 0) / 30);
    const old = perSession.get(s.session_id);
    if (!old || s.load_value > old.top) perSession.set(s.session_id, { date: s.date, top: s.load_value, reps: s.repetitions, e1rm: Math.max(e1rm, old?.e1rm || 0) });
  }
  const pts = [...perSession.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
  const best = Math.max(...pts.map(p => p.top)), first = pts[0], last = pts.at(-1)!;
  const W = 340, H = 170, lo = Math.min(...pts.map(p => p.top)) * .95, hi = Math.max(...pts.map(p => p.e1rm)) * 1.03;
  const x = (i: number) => pts.length < 2 ? W / 2 : 18 + (i * (W - 36)) / (pts.length - 1), y = (v: number) => H - 20 - ((v - lo) / Math.max(1, hi - lo)) * (H - 40);
  const path = (k: 'top' | 'e1rm') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  return (
    <>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {options.slice(0, 24).map(o => (
          <button key={o.id} onClick={() => setSel(o.id)} className={`shrink-0 w-24 rounded-xl overflow-hidden border-2 text-left ${o.id === cur.id ? 'border-gold' : 'border-white/10'}`}>
            <div className="duotone-wrap h-14"><ExerciseVisual name={o.ex?.name} equipment={o.v?.equipment_or_variation} size="sm" /></div>
            <p className="font-hud font-semibold text-[12px] leading-tight px-1.5 py-1 line-clamp-2 bg-black/60">{exName(o.ex?.name, o.v?.equipment_or_variation)}</p>
          </button>
        ))}
      </div>
      <section className="panel p-4">
        <p className="chip text-aqua text-xs">{cur.v.equipment_or_variation} · {cur.v.unit}</p>
        <h2 className="font-display uppercase text-3xl leading-[1.1]">{exName(cur.ex?.name, cur.v?.equipment_or_variation)}</h2>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[['Recorde', nf(best)], ['Última', nf(last.top)], ['Evolução', `${last.top - first.top >= 0 ? '+' : ''}${nf(last.top - first.top)}`]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-black/40 p-2 text-center"><p className={`num text-xl font-extrabold ${k === 'Evolução' && last.top > first.top ? 'text-cash' : ''}`}>{v}</p><p className="hud-label text-[9px] text-haze">{k} ({cur.v.unit})</p></div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-4">
          <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff2e93" stopOpacity=".35" /><stop offset="1" stopColor="#ff2e93" stopOpacity="0" /></linearGradient></defs>
          {[0, .5, 1].map(f => <line key={f} x1="10" x2={W - 10} y1={20 + f * (H - 40)} y2={20 + f * (H - 40)} stroke="rgba(255,255,255,.07)" />)}
          {pts.length > 1 && <path d={`${path('top')} L${x(pts.length - 1)},${H - 20} L${x(0)},${H - 20} Z`} fill="url(#area)" />}
          <path d={path('e1rm')} fill="none" stroke="#1ee8d6" strokeWidth="1.5" strokeDasharray="4 4" opacity=".7" />
          <motion.path d={path('top')} fill="none" stroke="#ffc54d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
          {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.top)} r={p.top === best ? 5 : 3} fill={p.top === best ? '#ffc54d' : '#0b0716'} stroke="#ffc54d" strokeWidth="2" />)}
          <text x="12" y={H - 4} fontSize="10" fill="#bfaed3" fontFamily="Barlow Condensed">{first.date.slice(8, 10)}/{first.date.slice(5, 7)}</text>
          <text x={W - 12} y={H - 4} fontSize="10" fill="#bfaed3" textAnchor="end" fontFamily="Barlow Condensed">{last.date.slice(8, 10)}/{last.date.slice(5, 7)}</text>
        </svg>
        <p className="text-[11px] text-haze mt-1 flex items-center gap-3"><span><span className="text-gold">━</span> Maior carga do treino</span><span><span className="text-aqua">┅</span> 1RM estimado (Epley)</span></p>
        <p className="text-[11px] text-haze mt-2 flex items-center gap-1"><TrendingUp size={12} /> {cur.n} séries de trabalho · {pts.length} treinos no gráfico · <CalendarDays size={12} /> só treinos concluídos</p>
      </section>
    </>
  );
}
