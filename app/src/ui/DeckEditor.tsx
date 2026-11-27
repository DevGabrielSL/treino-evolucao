// Editor de deck: incluir, tirar e reordenar exercícios; séries e faixa de cada um.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { customOf, customOutdated, deckEntries, refForOption, resetDeck, resolveEntry, saveDeck, validateEntries, type DeckEntry } from '../engine/decks';
import { getState } from '../engine/store';
import { ExercisePicker, type PickOption } from './ExercisePicker';
import { ExerciseVisual } from './ExerciseVisual';
import { ask } from './Dialog';
import { exName } from './format';
import { sfx } from '../fx/sfx';

export function DeckEditor({ deck, model, onClose, onError }: { deck: any; model: any; onClose: () => void; onError: (e: any) => void }) {
  const [list, setList] = useState<DeckEntry[]>(() => deckEntries(deck.id, model).map(e => ({ ...e })));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const isCustom = !!customOf(getState().doc?.settings, deck.id);
  const outdated = customOutdated(getState().doc?.settings, deck.id);
  const rows = useMemo(() => list.map(e => ({ e, item: resolveEntry(model.entities, e) })), [list, model]);
  const exclude = useMemo(() => new Set(rows.map(r => r.item?.variant_id).filter(Boolean) as string[]), [rows]);

  const patch = (i: number, p: Partial<DeckEntry>) => setList(l => l.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => setList(l => { const n = [...l], j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const pick = (o: PickOption) => {
    const timed = o.unit === 'segundos';
    setList(l => [...l, { ref: refForOption(o), sets: 3, min: timed ? 30 : 8, max: timed ? 60 : 12 }]);
    setPicking(false); sfx.tap();
  };
  const save = async () => {
    if (busy) return;
    try { validateEntries(list); setBusy(true); await saveDeck(deck.id, list); sfx.set(); onClose(); }
    catch (e) { onError(e); } finally { setBusy(false); }
  };
  const restore = async () => {
    if (!(await ask(`Voltar o deck "${deck.title}" para a versão original? A sua edição será descartada.`, { ok: 'Restaurar', danger: true }))) return;
    try { setBusy(true); await resetDeck(deck.id); onClose(); } catch (e) { onError(e); } finally { setBusy(false); }
  };

  return createPortal(
    <motion.div className="fixed inset-0 z-[60] flex flex-col justify-end max-w-lg mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/85" onClick={onClose} />
      <motion.div role="dialog" aria-label="Editar deck" className="relative flex flex-col max-h-[94dvh] rounded-t-[26px] bg-dusk border-t border-white/10 overflow-hidden"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
        <button onClick={onClose} aria-label="Fechar editor" className="absolute right-3 top-3 z-10 size-10 grid place-items-center rounded-full bg-black/60"><X /></button>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar px-4 pt-5 pb-6">
        <p className="chip text-gold text-sm">Editar deck {String(deck.index + 1).padStart(2, '0')}{isCustom ? ' · personalizado' : ''}</p>
        <h2 className="font-display uppercase text-3xl leading-[1.1] sunset-text pr-10">{deck.title}</h2>
        <p className="text-[12px] text-haze mt-1">Vale para as próximas missões deste deck. O histórico e o nome do deck não mudam.</p>
        {outdated && !picking && (
          <div className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-3" data-testid="deck-outdated">
            <p className="text-sm">O deck padrão foi atualizado depois da sua edição. Esta lista é a sua versão antiga.</p>
            <button onClick={restore} disabled={busy} className="mt-2 w-full h-10 rounded-lg bg-gold text-night chip text-sm flex items-center justify-center gap-2"><RotateCcw size={14} /> Usar o deck atualizado</button>
          </div>
        )}

        {picking ? (
          <div className="mt-4">
            <button onClick={() => setPicking(false)} className="chip text-sm text-haze mb-2">← Voltar à lista</button>
            <ExercisePicker model={model} exclude={exclude} onPick={pick} hint="Entra no fim do deck com 3 séries; ajuste depois." />
          </div>
        ) : (
          <>
            <ol className="mt-4 space-y-2" data-testid="deck-editor-list">
              {rows.map(({ e, item }, i) => {
                const timed = item?.dose?.unit === 'segundos';
                return (
                  <li key={e.ref} className="panel p-2.5" data-testid="deck-row">
                    <div className="flex items-center gap-2.5">
                      <span className="num font-extrabold text-lg w-6 text-center text-white/30">{i + 1}</span>
                      <div className="duotone-wrap size-11 rounded-lg shrink-0 bg-plum"><ExerciseVisual name={item?.name} equipment={item?.equipment} size="sm" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-hud font-bold leading-tight truncate">{item?.name ? exName(item.name, item.equipment) : 'Exercício indisponível'}</p>
                        <p className="text-[11px] text-haze truncate">{item?.equipment || 'Remova este item'}</p>
                      </div>
                      <button aria-label={`Subir ${item?.name}`} disabled={i === 0} onClick={() => move(i, -1)} className="size-8 grid place-items-center rounded-md bg-white/10 disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button aria-label={`Descer ${item?.name}`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="size-8 grid place-items-center rounded-md bg-white/10 disabled:opacity-30"><ArrowDown size={14} /></button>
                      <button aria-label={`Remover ${item?.name}`} disabled={rows.length <= 1} onClick={() => setList(l => l.filter((_, k) => k !== i))} className="size-8 grid place-items-center rounded-md bg-pink/15 text-pink disabled:opacity-30"><Trash2 size={14} /></button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 pl-8">
                      <span className="chip text-[11px] text-haze">Séries</span>
                      <button aria-label={`Menos séries ${item?.name}`} disabled={e.sets <= 1} onClick={() => patch(i, { sets: e.sets - 1 })} className="size-8 rounded-md bg-white/10 grid place-items-center disabled:opacity-30"><Minus size={14} /></button>
                      <span className="num font-extrabold w-5 text-center">{e.sets}</span>
                      <button aria-label={`Mais séries ${item?.name}`} disabled={e.sets >= 10} onClick={() => patch(i, { sets: e.sets + 1 })} className="size-8 rounded-md bg-white/10 grid place-items-center disabled:opacity-30"><Plus size={14} /></button>
                      <span className="chip text-[11px] text-haze ml-auto">{timed ? 'Segundos' : 'Reps'}</span>
                      <input inputMode="numeric" aria-label={`Mínimo ${item?.name}`} value={e.min} onChange={ev => patch(i, { min: Number(ev.target.value.replace(/\D/g, '')) || 0 })} className="num w-12 h-8 rounded-md bg-black/40 border border-white/10 text-center" />
                      <span className="text-haze">–</span>
                      <input inputMode="numeric" aria-label={`Máximo ${item?.name}`} value={e.max} onChange={ev => patch(i, { max: Number(ev.target.value.replace(/\D/g, '')) || 0 })} className="num w-12 h-8 rounded-md bg-black/40 border border-white/10 text-center" />
                    </div>
                  </li>
                );
              })}
            </ol>
            <button onClick={() => setPicking(true)} disabled={rows.length >= 18} className="mt-3 w-full h-12 rounded-xl border-2 border-dashed border-aqua/50 text-aqua chip text-sm flex items-center justify-center gap-2 disabled:opacity-40"><Plus size={16} /> Adicionar exercício ao deck</button>
            {isCustom && <button onClick={restore} disabled={busy} className="mt-2 w-full h-11 rounded-xl bg-white/5 chip text-sm text-haze flex items-center justify-center gap-2"><RotateCcw size={14} /> Restaurar deck original</button>}
          </>
        )}

        </div>
        {!picking && (
          <div className="shrink-0 border-t border-white/10 bg-dusk p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
            <p className="num text-center text-xs text-haze mb-2">{rows.length} exercícios · {list.reduce((n, e) => n + e.sets, 0)} séries</p>
            <button onClick={save} disabled={busy} className="btn-sunset w-full h-14 rounded-xl text-2xl disabled:opacity-40">Salvar deck</button>
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
