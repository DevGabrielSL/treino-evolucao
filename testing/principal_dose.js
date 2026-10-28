const normal=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const working=new Set(['effective','core','back_off']);
export function doseHistory(entities,today){
 const sessions=new Map((entities.sessions||[]).filter(s=>s.status==='completed'&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)&&s.date<=today).map(s=>[s.id,s]));
 const variants=new Map((entities.exercise_variants||[]).map(v=>[v.id,v]));
 const latest=new Map();
 for(const set of entities.sets||[]){const session=sessions.get(set.session_id),v=variants.get(set.variant_id);if(!session||!v||set.exercise_id!==v.exercise_id||set.date!==session.date||!working.has(set.set_type)||!Number.isInteger(set.repetitions)||set.repetitions<1||set.repetitions>100)continue;
  const old=latest.get(set.variant_id);if(!old||session.date>old.date||session.date===old.date&&session.id>old.sessionId)latest.set(set.variant_id,{date:session.date,sessionId:session.id});}
 const out={};for(const [id,last] of latest){const seen=new Set();const sets=(entities.sets||[]).filter(s=>{if(s.variant_id!==id||s.session_id!==last.sessionId||s.date!==last.date||s.exercise_id!==variants.get(id)?.exercise_id||!working.has(s.set_type)||!Number.isInteger(s.repetitions)||s.repetitions<1||s.repetitions>100||s.id&&seen.has(s.id))return false;if(s.id)seen.add(s.id);return true;});out[id]={...last,count:sets.length,reps:sets.map(s=>s.repetitions)};}
 return out;
}
export function doseFor(item,plan){
 const h=plan.doseHistory?.[item.variant_id];const reduced=plan.adjustment?.reduced;
 let sets=h?Math.min(3,h.count):2;if(reduced)sets=Math.min(sets,2);
 if(plan.adjustment?.fatigue==='high'||plan.adjustment?.recovery==='poor')sets=1;
 const timed=item.group==='core'&&/prancha/.test(normal(item.name));
 const isolation=['biceps','triceps','ombros','core'].includes(item.group)||/extensora|flexora|pullover|voador|crucifixo|panturrilha/.test(normal(item.name));
 let min=isolation?10:8,max=isolation?15:12,source='Faixa inicial do app; ajuste à sua técnica e objetivo.';
 const valid=h?.reps.filter(r=>r>=6&&r<=20)||[];
 if(h&&valid.length===h.reps.length&&valid.length){const reps=[...valid].sort((a,b)=>a-b);const center=reps[Math.floor(reps.length/2)];min=Math.max(6,center-2);max=Math.min(20,center+2);source='Faixa baseada na última sessão concluída desta mesma variação ('+h.date+').';}
 if(timed){min=20;max=30;source='Tempo inicial do app; encerre antes se perder a posição. Não registre segundos como repetições.';}
 return {sets,min,max,unit:timed?'segundos':'repetições',referenceDate:h?.date||null,source,effort:reduced?'Mantenha esforço confortável, sem buscar falha.':'Termine com repetições em reserva, sem buscar falha.',label:`Sugestão: ${sets} série(s) de ${min}–${max} ${timed?'segundos':'repetições'}`};
}
export function attachDose(plan,entities){
 const next={...plan,doseHistory:doseHistory(entities,plan.history.today)};
 next.items=plan.items.map(x=>({...x,dose:doseFor(x,next)}));
 const cap=plan.minutes===null?20:plan.minutes<=30?8:plan.minutes<=45?12:plan.minutes<=60?16:20;
 let total=next.items.reduce((sum,x)=>sum+x.dose.sets,0);
 // Retain at least one proposed set per exercise; never create recorded sets.
 for(let i=next.items.length-1;total>cap&&i>=0;i--){const x=next.items[i];while(total>cap&&x.dose.sets>1){x.dose.sets--;total--;}x.dose.label=`Sugestão: ${x.dose.sets} série(s) de ${x.dose.min}–${x.dose.max} ${x.dose.unit}`;}
 return next;
}
