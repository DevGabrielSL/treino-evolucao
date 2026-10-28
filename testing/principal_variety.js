import {balancedPlan as basePlan} from './balanced_coach.js';
import {attachDose,doseFor} from './principal_dose.js';
import {expandArmRequest,armSlots} from './principal_intent.js';
const norm=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const labels={horizontal:'Remada horizontal',vertical:'Puxada vertical',extension:'Extensão de ombro',press:'Pressão',fly:'Adução de braços',overhead:'Acima da cabeça',lateral:'Elevação lateral',rear:'Ombro posterior',knee:'Dominante de joelho',hip:'Dominante de quadril',curl:'Flexão de joelho',calf:'Panturrilha',anti:'Estabilização do core',flexion:'Flexão do tronco',other:'Padrão não identificado'};
export function movement(item){
 const n=norm(item.name),g=item.group;
 if(g==='costas')return /pullover|pulldown.*reto/.test(n)?'extension':/remada/.test(n)?'horizontal':/puxad|barra fixa/.test(n)?'vertical':'other';
 if(g==='peito')return /supino|chest press/.test(n)?'press':/voador|crucifixo|peck deck/.test(n)?'fly':'other';
 if(g==='ombros')return /inverso|face pull/.test(n)?'rear':/lateral/.test(n)?'lateral':/desenvolvimento/.test(n)?'overhead':'other';
 if(g==='triceps')return /acima da cabeca|francesa/.test(n)?'overhead':/polia|testa|triceps/.test(n)?'extension':'other';
 if(g==='pernas')return /panturrilha/.test(n)?'calf':/flexora/.test(n)?'curl':/stiff|terra|pelvica/.test(n)?'hip':/agachamento|leg press|extensora|afundo/.test(n)?'knee':'other';
 if(g==='core')return /prancha|pallof|bird dog|dead bug/.test(n)?'anti':/abdominal/.test(n)?'flexion':'other';
 return 'other';
}
function choose(options,selected,group,recent){
 const names=new Set(selected.map(x=>norm(x.name)));
 const available=options.filter(x=>x.group===group&&!names.has(norm(x.name)));
 const count=p=>selected.filter(x=>x.group===group&&movement(x)===p).length;
 return available.map((x,index)=>({x,index,p:movement(x)})).sort((a,b)=>
  (a.p==='other')-(b.p==='other')||count(a.p)-count(b.p)||
  // Keep registered variations ahead of generic entries within the same pattern.
  Number(a.x.is_catalog)-Number(b.x.is_catalog)||
  (Number(b.x.bonus)||0)-(Number(a.x.bonus)||0)||
  Number(recent.has(a.x.variant_id))-Number(recent.has(b.x.variant_id))||a.index-b.index)[0]?.x||null;
}
const movementLabelFor=item=>item.group==='triceps'&&movement(item)==='extension'?'Extensão de cotovelo':labels[movement(item)];
export function balancedPlan(entities,groups,message,options){
 const plan=basePlan(entities,groups,expandArmRequest(message),options);
 const completed=(entities.sessions||[]).filter(x=>x.status==='completed'&&x.date<=plan.history.today).sort((a,b)=>b.date.localeCompare(a.date));
 const recent=new Set((entities.sets||[]).filter(x=>x.session_id===completed[0]?.id&&x.set_type!=='warmup').map(x=>x.variant_id));
 const armGroups=plan.adjustment.blocked?null:armSlots(message,plan);
 const slots=armGroups?armGroups.map(group=>({group})):plan.items;
 const items=[];for(const slot of slots){const next=choose(plan.options,items,slot.group,recent);if(next)items.push({...next,movementLabel:movementLabelFor(next)});}
 return attachDose({...plan,items,short:armGroups?slots.length-items.length:plan.short,recentVariants:[...recent]},entities);
}
export function replacementFor(plan,index){
 const current=plan.items[index];if(!current)return null;
 const next=choose(plan.options,plan.items,current.group,new Set(plan.recentVariants||[]));
 if(!next)return null;
 const dose=doseFor(next,plan);dose.sets=Math.max(3,Math.min(dose.sets,current.dose?.sets||dose.sets));dose.label=`Sugestão: ${dose.sets} série(s) de ${dose.min}–${dose.max} ${dose.unit}`;
 return {...next,movementLabel:movementLabelFor(next),dose};
}
