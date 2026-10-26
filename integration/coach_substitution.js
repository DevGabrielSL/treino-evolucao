/* Substituição segura durante sessão local em andamento.
 * Não edita séries já salvas, somente a ordem dos exercícios planejados.
 */
export function replaceCoachVariant(doc,sessionId,currentId,nextId){
 const session=doc?.overlay?.sessions?.find(s=>s.id===sessionId&&s.status==='in_progress');
 if(!session)throw new Error('Só é possível substituir exercícios durante um treino local em andamento.');
 const ids=session.planned_variant_ids;
 if(!Array.isArray(ids)||!ids.includes(currentId))throw new Error('O exercício atual não está no roteiro desta sessão.');
 const available=[...(doc.base?.entities?.exercise_variants||[]),...(doc.overlay?.exercise_variants||[])];
 if(!available.some(x=>x.id===nextId))throw new Error('A variação de substituição não existe no histórico local.');
 if(ids.includes(nextId))return {selected:nextId,mode:'select',changed:false};
 if(ids.length>=16)throw new Error('O roteiro já tem 16 variações. Revise antes de adicionar outra.');
 const at=ids.indexOf(currentId);
 const hasSets=(doc.overlay?.sets||[]).some(s=>s.session_id===sessionId&&s.variant_id===currentId);
 if(hasSets)ids.splice(at+1,0,nextId);
 else ids[at]=nextId;
 return {selected:nextId,mode:hasSets?'added_after':'replaced',changed:true};
}
