/* Edição de registros locais: operações puras, sem dependência da interface. */
export function mutateLocalSet(doc,id,changes){
 const row=doc.overlay.sets.find(s=>s.id===id);
 if(!row)throw new Error('Esta série é importada ou não existe. Somente séries locais podem ser corrigidas.');
 const next={...row,...changes};
 if(!['effective','warmup','core','drop_set','other'].includes(next.set_type))throw new Error('Tipo de série inválido.');
 if(next.load_value!==null&&(!Number.isFinite(next.load_value)||next.load_value<0||next.load_value>10000))throw new Error('Carga inválida.');
 if(next.repetitions!==null&&(!Number.isInteger(next.repetitions)||next.repetitions<0||next.repetitions>500))throw new Error('Repetições inválidas.');
 if(['effective','warmup','drop_set'].includes(next.set_type)&&(!Number.isInteger(next.repetitions)||next.repetitions<1))throw new Error('Informe pelo menos uma repetição.');
 if(next.rir!==null&&(!Number.isFinite(next.rir)||next.rir<0||next.rir>30))throw new Error('RIR inválido.');
 for(const key of ['load_value','repetitions','rir','set_type'])row[key]=next[key];
}
export function mutateLocalSession(doc,id,{name,notes}){
 const row=doc.overlay.sessions.find(s=>s.id===id);
 if(!row)throw new Error('Sessão importada: os dados originais são preservados.');
 if(typeof name!=='string'||!name.trim()||name.trim().length>100)throw new Error('Nome de sessão inválido.');
 if(typeof notes!=='string'||notes.length>500)throw new Error('Observações inválidas.');
 row.name=name.trim();row.notes=notes.trim();
}
export function repeatSessionAsDraft(doc,sessionId,newId,date){
 const source=[...(doc.base?.entities?.sessions||[]),...doc.overlay.sessions].find(s=>s.id===sessionId);
 if(!source||source.status!=='completed')throw new Error('Selecione uma sessão concluída para repetir.');
 if(doc.overlay.sessions.some(s=>s.status==='in_progress'))throw new Error('Conclua o treino em andamento antes de repetir outro.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Data inválida.');
 if([...(doc.base?.entities?.sessions||[]),...doc.overlay.sessions].some(s=>s.id===newId))throw new Error('Identificador de sessão já utilizado.');
 const planned_variant_ids=[...new Set([...(Array.isArray(source.planned_variant_ids)?source.planned_variant_ids:[]),...[...(doc.base?.entities?.sets||[]),...doc.overlay.sets].filter(s=>s.session_id===source.id&&!s.finisher_key).map(s=>s.variant_id)])];
 doc.overlay.sessions.push({id:newId,date,name:source.name,planned_variant_ids,status:'in_progress',started_at:new Date().toISOString(),duration_minutes:null,body_weight_kg:null,lower_back_pain_before:null,lower_back_pain_after:null,notes:'',provenance:{source:'android_local',repeated_from_session_id:source.id}});
 return newId;
}
