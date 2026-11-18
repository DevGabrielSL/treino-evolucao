/* Planejamento local: modelos ficam no próprio estado da PWA e não no servidor. */
const MAX_TEMPLATES=30,MAX_EXERCISES=18;
const trimName=s=>typeof s==='string'?s.trim():'';
const uniqueIds=list=>new Set(list.map(x=>x.id));
export const getTemplates=doc=>doc.settings.templates||[];
function allVariants(doc){return new Set([...(doc.base?.entities?.exercise_variants||[]),...doc.overlay.exercise_variants].map(x=>x.id));}
function allSessions(doc){return [...(doc.base?.entities?.sessions||[]),...doc.overlay.sessions];}
function allSets(doc){return [...(doc.base?.entities?.sets||[]),...doc.overlay.sets];}
export function validateTemplates(doc){
 const arr=getTemplates(doc);
 if(!Array.isArray(arr)||arr.length>MAX_TEMPLATES)throw new Error('Quantidade de modelos inválida.');
 const ids=uniqueIds(arr),vIds=allVariants(doc);
 if(ids.size!==arr.length)throw new Error('Identificador de modelo duplicado.');
 for(const t of arr){
  if(!t||typeof t!=='object'||typeof t.id!=='string'||!t.id||t.id.length>180||!trimName(t.name)||t.name.length>80)throw new Error('Modelo de treino inválido.');
  if(!Array.isArray(t.items)||t.items.length>MAX_EXERCISES)throw new Error('Lista de exercícios do modelo inválida.');
  const used=new Set();
  for(const i of t.items){
    if(!i||!vIds.has(i.variant_id)||used.has(i.variant_id)||!Number.isInteger(i.target_sets)||i.target_sets<1||i.target_sets>12||i.target_reps!==null&&(!Number.isInteger(i.target_reps)||i.target_reps<1||i.target_reps>100))throw new Error('Exercício/objetivo inválido no modelo.');
    used.add(i.variant_id);
  }
 }
 return true;
}
export function addTemplate(doc,{id,name}){
 const n=trimName(name);if(n.length<2||n.length>80)throw new Error('Nome do modelo: 2 a 80 caracteres.');
 const arr=(doc.settings.templates??=[]);if(arr.length>=MAX_TEMPLATES||arr.some(t=>t.id===id))throw new Error('Limite de modelos atingido.');
 arr.push({id,name:n,items:[],created_at:new Date().toISOString()});
}
export function renameTemplate(doc,id,name){const t=getTemplates(doc).find(t=>t.id===id),n=trimName(name);if(!t)throw new Error('Modelo não encontrado.');if(n.length<2||n.length>80)throw new Error('Nome do modelo: 2 a 80 caracteres.');t.name=n;}
export function addTemplateItem(doc,id,{variant_id,target_sets,target_reps}){
 const t=getTemplates(doc).find(t=>t.id===id);
 if(!t)throw new Error('Modelo não encontrado.');
 if(!allVariants(doc).has(variant_id))throw new Error('Exercício inexistente.');
 if(t.items.some(i=>i.variant_id===variant_id))throw new Error('Exercício já está no modelo.');
 if(t.items.length>=MAX_EXERCISES)throw new Error('Máximo de exercícios no modelo atingido.');
 if(!Number.isInteger(target_sets)||target_sets<1||target_sets>12||target_reps!==null&&(!Number.isInteger(target_reps)||target_reps<1||target_reps>100))throw new Error('Meta de séries/repetições inválida.');
 t.items.push({variant_id,target_sets,target_reps});
}
export function removeTemplateItem(doc,id,variant_id){const t=getTemplates(doc).find(x=>x.id===id);if(!t)throw new Error('Modelo não encontrado.');if(!t.items.some(x=>x.variant_id===variant_id))throw new Error('Exercício não encontrado no modelo.');t.items=t.items.filter(x=>x.variant_id!==variant_id);}
export function moveTemplateItem(doc,id,variant_id,direction){const t=getTemplates(doc).find(x=>x.id===id);if(!t||![-1,1].includes(direction))throw new Error('Movimentação inválida.');const old=t.items.findIndex(x=>x.variant_id===variant_id),to=old+direction;if(old<0||to<0||to>=t.items.length)return false;[t.items[old],t.items[to]]=[t.items[to],t.items[old]];return true;}
export function deleteTemplate(doc,id){const arr=getTemplates(doc);if(!arr.some(t=>t.id===id))throw new Error('Modelo não encontrado.');doc.settings.templates=arr.filter(t=>t.id!==id);}
export function createTemplateFromSession(doc,{id,session_id,name}){
 const session=allSessions(doc).find(s=>s.id===session_id);
 if(!session||session.status!=='completed')throw new Error('Somente sessões concluídas podem virar modelos.');
 const sets=allSets(doc).filter(s=>s.session_id===session.id&&!s.finisher_key);if(!sets.length)throw new Error('A sessão não tem exercícios registrados.');
 addTemplate(doc,{id,name:name??session.name});
 const ordered=[];for(const s of sets){if(!ordered.includes(s.variant_id))ordered.push(s.variant_id);}
 for(const variant_id of ordered.slice(0,MAX_EXERCISES)){
  const effort=sets.filter(s=>s.variant_id===variant_id&&s.set_type==='effective');
  const relevant=effort.length?effort:sets.filter(s=>s.variant_id===variant_id);
  const reps=relevant.map(x=>x.repetitions).find(x=>Number.isInteger(x)&&x>0)??null;
  addTemplateItem(doc,id,{variant_id,target_sets:Math.min(12,Math.max(1,relevant.length)),target_reps:reps});
 }
}
export function startTemplateSession(doc,{template_id,session_id,date}){
 const t=getTemplates(doc).find(t=>t.id===template_id);
 if(!t||!t.items.length)throw new Error('Adicione exercícios ao modelo antes de iniciar.');
 if(doc.overlay.sessions.some(s=>s.status==='in_progress'))throw new Error('Conclua o treino em andamento primeiro.');
 if(!/^\d{4}-\d\d-\d\d$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Data inválida.');
 if(allSessions(doc).some(s=>s.id===session_id))throw new Error('Identificador de sessão já utilizado.');
 const planned_variant_ids=t.items.map(i=>i.variant_id);
 doc.overlay.sessions.push({id:session_id,date,name:t.name,status:'in_progress',started_at:new Date().toISOString(),duration_minutes:null,body_weight_kg:null,lower_back_pain_before:null,lower_back_pain_after:null,notes:'',planned_variant_ids,provenance:{source:'android_local',template_id}});
}
