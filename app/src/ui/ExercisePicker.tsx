// Seletor de exercícios: os seus primeiro, depois o catálogo (decks e peso corporal/tempo).
import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { catalogItems } from '../legacy/principal_presets.js';
import { homeCatalog } from '../engine/home';
import { ExerciseVisual } from './ExerciseVisual';

export type PickOption = { key: string; name: string; equipment: string; unit: string; mine: boolean; item: any };
// Outros nomes usados na academia, para a busca achar.
const ALIASES: Record<string, string> = { 'crucifixo inverso': 'voador inverso peck deck inverso', 'voador (peck deck)': 'crucifixo maquina', 'remada alta (upright row)': 'remada alta em pe',
  'pull over na polia': 'pullover pulldown', 'puxada alta': 'pulldown puxador', 'cadeira flexora': 'flexora', 'mesa flexora': 'flexora deitada', 'elevacao pelvica': 'hip thrust', 'agachamento hack': 'hack' };
const norm = (x: string) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function ExercisePicker({ model, exclude, busy, onPick, hint }: { model: any; exclude: Set<string>; busy?: boolean; onPick: (o: PickOption) => void; hint?: string }) {
  const [q, setQ] = useState('');
  const options = useMemo(() => {
    const used = new Set<string>();
    const mine: PickOption[] = model.entities.exercise_variants.filter((v: any) => !exclude.has(v.id)).map((v: any) => {
      const e = model.exerciseMap.get(v.exercise_id); if (!e) return null;
      used.add(norm(e.name) + '|' + norm(v.equipment_or_variation));
      return { key: v.id, name: e.name, equipment: v.equipment_or_variation, unit: v.unit, mine: true, item: { variant_id: v.id, unit: v.unit, is_catalog: false } };
    }).filter(Boolean);
    const known = new Set(model.entities.exercise_variants.map((v: any) => v.id));
    const catalog: PickOption[] = [...catalogItems(), ...homeCatalog(model.entities)].filter((i: any) => !exclude.has(i.variant_id) && !known.has(i.variant_id) && !used.has(norm(i.name) + '|' + norm(i.equipment)))
      .map((i: any) => ({ key: i.variant_id, name: i.name, equipment: i.equipment, unit: i.unit, mine: false, item: { ...i, is_catalog: true } }));
    const words = norm(q).split(/\s+/).filter(Boolean);
    return [...mine, ...catalog].filter(o => { const hay = norm(`${o.name} ${o.equipment} ${ALIASES[norm(o.name)] || ''}`); return words.every(w => hay.includes(w)); })
      .sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 80);
  }, [model, exclude, q]);
  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl bg-black/40 border border-white/10 px-3"><Search size={16} className="text-haze" /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar exercício ou equipamento" aria-label="Buscar exercício" className="flex-1 bg-transparent py-2.5 outline-none" /></div>
      {hint && <p className="text-[11px] text-haze mt-2">{hint}</p>}
      <ul className="mt-2 max-h-[52vh] overflow-y-auto no-scrollbar space-y-1.5">
        {options.map(o => (
          <li key={o.key}><button disabled={busy} onClick={() => onPick(o)} className="w-full flex items-center gap-3 rounded-xl bg-white/5 p-2 text-left disabled:opacity-50">
            <div className="duotone-wrap size-11 rounded-lg shrink-0"><ExerciseVisual name={o.name} equipment={o.equipment} size="sm" /></div>
            <span className="flex-1 min-w-0"><b className="font-hud block truncate">{o.name}</b><span className="text-[11px] text-haze truncate block">{o.equipment} · {o.unit === 'a confirmar' ? 'unidade a confirmar' : o.unit}</span></span>
            {!o.mine && <span className="chip text-[10px] text-aqua shrink-0">catálogo</span>}
            <Plus size={18} className="text-aqua shrink-0" />
          </button></li>
        ))}
        {!options.length && <p className="text-sm text-haze text-center py-6">Nada encontrado. Cadastre um exercício novo no app Modelos do Celular.</p>}
      </ul>
    </div>
  );
}
