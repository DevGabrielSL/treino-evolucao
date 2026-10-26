/* Etapa 5: interpretar o plano local sem modificar registros ou fazer rede. */
const normal=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g,' ');
const textFields=obj=>obj&&typeof obj==='object'?Object.values(obj).filter(x=>typeof x==='string').map(String):[];
const escapeRegExp=s=>s.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
const nameMatches=(name,pattern)=>name===pattern||name.startsWith(pattern+' ')||name.endsWith(' '+pattern);
function explicitExclusions(lines){
 const names=new Set();
 for(const line of lines){
  const parts=normal(line).split(/[.;]/).map(x=>x.trim()).filter(Boolean);
  for(const part of parts){
   const m=part.match(/(?:^|:\s*)(.+?)\s+(?:fora do programa|fora do treino|excluidos?|removidos?|suspensos?)\b/);
   if(!m)continue;
   const raw=m[1].replace(/^(?:core|exercicios?|preferencias?)\s*:\s*/,'');
   for(const x of raw.split(/,|\s+e\s+/).map(normal).filter(Boolean)){
    if(x.length>=4&&x.length<=46&&!/(?:conforme|prioridade|lombar|semana|de acordo|carga)/.test(x))names.add(x);
   }
  }
 }
 return names;
}
export function buildCoachPolicy(entities={},settings={}){
 const entries=[...(entities.plan_parameters||[]),...(entities.training_rules||[]),...(entities.weekly_schedule||[])];
 const lines=entries.flatMap(textFields);
 const exclusions=explicitExclusions(lines);
 for(const excluded of settings.excluded_exercises||[])if(normal(excluded).length>=3)exclusions.add(normal(excluded));
 const preferred=new Set((settings.preferred_exercises||[]).map(normal).filter(Boolean));
 const recentSessions=(entities.sessions||[]).filter(s=>s.status==='completed').sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,12);
 const recentNotes=recentSessions.map(x=>normal(x.notes||'')).filter(Boolean);
 const knownNames=(entities.exercises||[]).map(x=>normal(x.name)).filter(x=>x.length>=3);
 for(const note of recentNotes){
  for(const name of knownNames){
   const re=new RegExp('(?:^|[.;\\s])'+escapeRegExp(name)+'\\s+(?:foi\\s+)?(?:removido|removida|suspenso|suspensa|excluido|excluida)\\b');
   if(re.test(note))exclusions.add(name);
  }
 }
 const all=lines.map(normal).join(' · ');
 const rirLine=lines.find(line=>/rir\s+alvo|repeticoes?\s+em\s+reserva/i.test(normal(line)))||'';
 const range=normal(rirLine).match(/(\d{1,2})\s*[–—-]\s*(\d{1,2})/);
 const rirTarget=range&&Number(range[1])<=Number(range[2])&&Number(range[2])<=10?[Number(range[1]),Number(range[2])]:null;
 const bicepsFirst=all.includes('biceps antes')||all.includes('biceps antes de');
 const noMachineComparison=all.includes('nao comparar plaquetas')||all.includes('nao comparar cargas');
 const progressionReps=all.includes('subir reps')||all.includes('subir repeticoes')||all.includes('progredir repeticoes');
 const lumbarCaution=all.includes('lombar')&&/(dor|irradiad|sintomas)/.test(all);
 const priorityWords=normal(lines.find(x=>/^(prioridades|objetivo principal)/i.test(normal(x)))||'');
 const evaluate=(exercise,variant)=>{
  const n=normal(exercise?.name||'');
  if([...exclusions].some(p=>nameMatches(n,p)))return {blocked:true,reason:'excluido_pelo_plano'};
  let bonus=0;
  if([...preferred].some(p=>nameMatches(n,p)))bonus+=35;
  if(priorityWords.includes('ombro')&&/desenvolvimento|elevacao lateral|voador inverso/.test(n))bonus+=3;
  if(priorityWords.includes('core')&&/prancha|abdominal/.test(n))bonus+=3;
  return {blocked:false,bonus};
 };
 const orderGroups=groups=>{
  const list=[...groups];
  if(bicepsFirst&&list.includes('biceps')&&list.includes('ombros')){
   list.splice(list.indexOf('biceps'),1);list.splice(list.indexOf('ombros'),0,'biceps');
  }
  return list;
 };
 const notes=[];
 if(rirTarget)notes.push('RIR geral de referência: '+rirTarget.join('–')+' (ajuste à execução e ao esforço real).');
 if(progressionReps)notes.push('Progredir primeiro nas repetições da faixa antes de aumentar a carga.');
 if(noMachineComparison)notes.push('Compare cargas apenas dentro da mesma variação e equipamento; não equipare plaquetas de máquinas diferentes.');
 if(lumbarCaution)notes.push('Se houver dor aguda, irradiada ou sintomas neurológicos, interrompa e procure avaliação profissional, sem treinar por cima dos sintomas.');
 if(exclusions.size)notes.push(exclusions.size+' exercício(s) excluído(s) por regras ou preferências.');
 return {evaluate,orderGroups,rirTarget,excluded:[...exclusions],notes,hasPlan:entries.length>0};
}
