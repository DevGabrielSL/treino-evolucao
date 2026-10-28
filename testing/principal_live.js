const working=new Set(['effective','core','back_off']);
const unique=sets=>{const seen=new Set();return sets.filter(s=>{if(s.id&&seen.has(s.id))return false;if(s.id)seen.add(s.id);return true;});};
const targetFor=(session,id)=>{const n=session.planned_guidance?.[id]?.sets;return Number.isInteger(n)&&n>0&&n<=20?(session.status==='in_progress'?Math.max(3,n):n):null;};
export function liveGuidance(session,variantId,entities){
 const all=unique((entities.sets||[]).filter(s=>s.session_id===session.id));
 const current=all.filter(s=>s.variant_id===variantId),count=current.filter(s=>working.has(s.set_type)).length;
 const target=targetFor(session,variantId),saved=session.planned_guidance?.[variantId]||null;
 const dose=saved&&target!==null?{...saved,sets:target,label:`Sugestão: ${target} série(s) de ${saved.min}–${saved.max} ${saved.unit}`} :saved;
 const ids=[...new Set(session.planned_variant_ids||[])];
 const reached=ids.filter(id=>{const target=targetFor(session,id);return target!==null&&all.filter(s=>s.variant_id===id&&working.has(s.set_type)).length>=target;}).length;
 const latest=[...current].sort((a,b)=>(b.set_number||0)-(a.set_number||0)).find(s=>working.has(s.set_type))||null;
 const completed=new Set((entities.sessions||[]).filter(s=>s.status==='completed'&&s.id!==session.id&&s.date<=session.date).map(s=>s.id));
 const reference=(entities.sets||[]).filter(s=>completed.has(s.session_id)&&s.variant_id===variantId&&working.has(s.set_type)).sort((a,b)=>String(b.date).localeCompare(String(a.date))||(b.set_number||0)-(a.set_number||0))[0]||null;
 let message=target===null?'Sem meta salva para este exercício. Registre o que realizar e escolha quando avançar.':count>=target?'Quantidade sugerida atingida. Revise como se sente e avance quando desejar.':`Próxima série de trabalho: ${count+1} de ${target}. Registre somente depois de realizar.`;
 if(latest?.rir===0)message+=' Na última série você informou RIR 0. Não há aumento automático de carga.';
 if(latest&&dose?.unit==='repetições'&&Number.isInteger(latest.repetitions)&&(latest.repetitions<dose.min||latest.repetitions>dose.max))message+=' As repetições ficaram fora da faixa sugerida; revise o esforço antes de continuar.';
 return {count,target,dose,latest,reference,reached,total:ids.length,warmups:current.filter(s=>s.set_type==='warmup').length,message};
}
export function nextPending(session,current,entities){
 const ids=[...new Set(session.planned_variant_ids||[])];if(!ids.length)return null;
 const start=ids.indexOf(current);for(let i=1;i<=ids.length;i++){const id=ids[(start+i+ids.length)%ids.length];if(id===current)continue;const state=liveGuidance(session,id,entities);if(state.target===null||state.count<state.target)return id;}
 return null;
}
