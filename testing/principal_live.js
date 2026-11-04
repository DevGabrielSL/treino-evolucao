import {sameLoadVariant} from './principal_unit.js?v=155';
const working=new Set(['effective','core','back_off']);
const unique=sets=>{const seen=new Set();return sets.filter(s=>{if(s.id&&seen.has(s.id))return false;if(s.id)seen.add(s.id);return true;});};
const targetFor=(session,id)=>{const n=session.planned_guidance?.[id]?.sets;return Number.isInteger(n)&&n>0&&n<=20?(session.status==='in_progress'?Math.max(3,n):n):null;};
const plannedId = row => row.planned_variant_id || row.variant_id;
const slotIds = (session, id) => [id, ...(session.prior_planned_variants?.[id] || [])];
const skippedFor = (session, id) => session.skipped_series?.[id] || 0;
const belongs = (session, id, row) => slotIds(session, id).includes(plannedId(row));

export function changeWorkoutPlan(doc, {sessionId, current, replacement, action}) {
 const session = doc.overlay.sessions.find(s => s.id === sessionId && s.status === 'in_progress');
 if (!session?.planned_variant_ids?.includes(current)) throw new Error('Exercício fora do roteiro atual.');
 const entities = {
  sessions: [...(doc.base?.entities?.sessions || []), ...doc.overlay.sessions],
  sets: [...(doc.base?.entities?.sets || []), ...doc.overlay.sets],
  exercise_variants: [...(doc.base?.entities?.exercise_variants || []), ...doc.overlay.exercise_variants]
 };
 const state = liveGuidance(session, current, entities);
 if (action === 'undo-skip') {
  if (state.skipped) session.skipped_series[current] = state.skipped - 1;
  return;
 }
 if (state.target !== null && state.resolved >= state.target) throw new Error('Todas as séries planejadas já foram resolvidas.');
 if (action === 'skip') {
  if (state.target === null) throw new Error('Este exercício não tem meta de séries.');
  session.skipped_series = {...session.skipped_series, [current]: state.skipped + 1};
  return;
 }
 const occupied = session.planned_variant_ids.flatMap(id => slotIds(session, id));
 if (action !== 'swap' || occupied.includes(replacement) ||
     !entities.exercise_variants.some(v => v.id === replacement)) {
  throw new Error('Escolha um exercício que ainda não esteja no roteiro.');
 }
 session.planned_variant_ids = session.planned_variant_ids.map(id => id === current ? replacement : id);
 session.prior_planned_variants = {...session.prior_planned_variants, [replacement]: slotIds(session, current)};
 session.skipped_series = {...session.skipped_series, [replacement]: state.skipped};
 if (session.planned_guidance?.[current]) {
  session.planned_guidance = {...session.planned_guidance, [replacement]: {...session.planned_guidance[current]}};
 }
}
export function liveGuidance(session,variantId,entities){
 const all=unique((entities.sets||[]).filter(s=>s.session_id===session.id));
 const current=all.filter(s=>s.variant_id===variantId),count=all.filter(s=>belongs(session,variantId,s)&&working.has(s.set_type)).length;
 const skipped=skippedFor(session,variantId),resolved=count+skipped;
 const target=targetFor(session,variantId),saved=session.planned_guidance?.[variantId]||null;
 const dose=saved&&target!==null?{...saved,sets:target,label:`Sugestão: ${target} série(s) de ${saved.min}–${saved.max} ${saved.unit}`} :saved;
 const ids=[...new Set(session.planned_variant_ids||[])];
 const reached=ids.filter(id=>{const target=targetFor(session,id);return target!==null&&all.filter(s=>belongs(session,id,s)&&working.has(s.set_type)).length>=target;}).length;
 const latest=[...current].sort((a,b)=>(b.set_number||0)-(a.set_number||0)).find(s=>working.has(s.set_type))||null;
 const completed=new Set((entities.sessions||[]).filter(s=>s.status==='completed'&&s.id!==session.id&&s.date<=session.date).map(s=>s.id));
 const variants = new Map((entities.exercise_variants || []).map(v => [v.id, v]));
 const selected = variants.get(variantId);
 const reference = (entities.sets || []).filter(s =>
  completed.has(s.session_id) && working.has(s.set_type) &&
  typeof s.load_value === 'number' && Number.isFinite(s.load_value) &&
  (!selected || !s.load_unit_original || s.load_unit_original === selected.unit) &&
  (s.variant_id === variantId || sameLoadVariant(selected, variants.get(s.variant_id)))
 ).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.set_number||0)-(a.set_number||0))[0]||null;
 let message=target===null?'Sem meta salva para este exercício. Registre o que realizar e escolha quando avançar.':resolved>=target?(skipped?'Séries planejadas resolvidas.':'Quantidade sugerida atingida. Revise como se sente e avance quando desejar.'):`Próxima série de trabalho: ${resolved+1} de ${target}. Registre somente depois de realizar.`;
 if(latest?.rir===0)message+=' Na última série você informou RIR 0. Não há aumento automático de carga.';
 if(latest&&dose?.unit==='repetições'&&Number.isInteger(latest.repetitions)&&(latest.repetitions<dose.min||latest.repetitions>dose.max))message+=' As repetições ficaram fora da faixa sugerida; revise o esforço antes de continuar.';
 return {count,skipped,resolved,target,dose,latest,reference,reached,total:ids.length,warmups:current.filter(s=>s.set_type==='warmup').length,message};
}
export function nextPending(session,current,entities){
 const ids=[...new Set(session.planned_variant_ids||[])];if(!ids.length)return null;
 const start=ids.indexOf(current);for(let i=1;i<=ids.length;i++){const id=ids[(start+i+ids.length)%ids.length];if(id===current)continue;const state=liveGuidance(session,id,entities);if(state.target===null||state.resolved<state.target)return id;}
 return null;
}
