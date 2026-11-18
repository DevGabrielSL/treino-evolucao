/* Comandos locais da conversa. Não chamam serviços externos, não guardam token. */
import {mutateLocalSet} from './edit_ops.js';
const normalized=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g,' ');
export function parseCoachCommand(message){
 const source=String(message??'').trim(),msg=normalized(source);
 if(!msg)return {kind:'invalid'};
 if(/^(?:desfazer|desfaz|apagar|remover|excluir)(?:\s+(?:a\s+)?(?:ultima|ultimo)(?:\s+serie)?)?[.!]?$/.test(msg))return {kind:'undo'};
 const correction=source.match(/^\s*(?:corrigir|corrija|alterar|editar)\s+(?:(?:a|o)\s+)?(?:[uú]ltim[ao](?:\s+(?:s[eé]rie|registro))?\s*[:\-]?\s*)(.*)$/i);
 if(correction)return {kind:'correct',payload:correction[1].trim()};
 const substitution=source.match(/^\s*(?:substituir|trocar)\s+(?:.+?\s+)?(?:por|para)\s+(.+)$/i);
 if(substitution&&!msg.startsWith('trocar para '))return {kind:'replace',name:substitution[1].trim()};
 if(/^(?:proximo|proxima|avancar|seguir)(?:\s+exercicio)?[.!]?$/.test(msg))return {kind:'next'};
 if(/^(?:resumo|resumo do treino|quantas series|meu treino)[?!.]?$/.test(msg))return {kind:'summary'};
 if(/^(?:ajuda|comandos|como registrar)[?!.]?$/.test(msg))return {kind:'help'};
 const selection=source.match(/^\s*(?:selecionar|escolher|trocar\s+para|ir\s+para)\s+(.+)$/i);
 if(selection)return {kind:'select',name:selection[1].trim()};
 return {kind:'set',payload:source};
}
export function resolvePlannedExercise(query,ids,variantMap,exerciseMap){
 const input=normalized(query).replace(/[.!?]+$/,'');
 if(input.length<3)throw new Error('Informe ao menos três letras do nome do exercício.');
 const candidates=[...new Set(ids)].map(id=>{
  const variant=variantMap.get(id),ex=exerciseMap.get(variant?.exercise_id);
  return {id,exercise:normalized(ex?.name),equipment:normalized(variant?.equipment_or_variation)};
 }).filter(x=>x.exercise);
 const exact=candidates.filter(x=>x.exercise===input||`${x.exercise} ${x.equipment}`.trim()===input);
 const matched=exact.length?exact:candidates.filter(x=>x.exercise.includes(input)||(`${x.exercise} ${x.equipment}`).includes(input));
 if(!matched.length)throw new Error('Este exercício não está no roteiro. Escolha um dos botões da lista.');
 if(matched.length>1)throw new Error('Nome de exercício ambíguo. Selecione a variação exata na lista.');
 return matched[0].id;
}
function getDraft(doc,sessionId){
 const s=doc?.overlay?.sessions?.find(x=>x.id===sessionId);
 if(!s||s.status!=='in_progress')throw new Error('Somente séries de um treino local em andamento podem ser corrigidas por conversa.');
 return s;
}
export function lastDraftSet(doc,sessionId){
 getDraft(doc,sessionId);
 const rows=doc.overlay.sets;
 const last=[...rows].reverse().find(s=>s.session_id===sessionId&&s.provenance?.source==='android_local');
 if(last?.set_type==='drop_set'){
  return rows.find(s=>s.session_id===sessionId&&last.notes==='Drop de '+s.id)||last;
 }
 return last||null;
}
export function undoLastDraftSet(doc,sessionId){
 const s=lastDraftSet(doc,sessionId);
 if(!s)throw new Error('Ainda não existe uma série local para desfazer neste treino.');
 const index=doc.overlay.sets.findIndex(x=>x.id===s.id);
 if(index<0)throw new Error('Série não disponível.');
 doc.overlay.sets=doc.overlay.sets.filter(row=>row.id!==s.id&&
  !(row.session_id===sessionId&&row.set_type==='drop_set'&&row.notes==='Drop de '+s.id));
 return {id:s.id,variant_id:s.variant_id,set_number:s.set_number};
}
export function correctLastDraftSet(doc,sessionId,changes){
 const s=lastDraftSet(doc,sessionId);
 if(!s)throw new Error('Ainda não existe uma série local para corrigir neste treino.');
 mutateLocalSet(doc,s.id,changes);
 const updated=doc.overlay.sets.find(x=>x.id===s.id);
 if(Object.prototype.hasOwnProperty.call(changes,'notes'))updated.notes=changes.notes;
 return updated;
}
export function resumeSelectedVariant(doc,sessionId,plannedIds){
 const ids=Array.isArray(plannedIds)?plannedIds:[];
 const last=doc?.overlay?.sets?.slice().reverse().find(s=>s.session_id===sessionId&&ids.includes(s.variant_id));
 return last?.variant_id||ids[0]||'';
}
