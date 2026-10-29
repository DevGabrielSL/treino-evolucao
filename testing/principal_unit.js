export function confirmSessionVariant(doc,{sessionId,sourceId,newId,equipment,unit}){
 const name=String(equipment||'').trim();
 if(!['kg','kg/lado','kg/halter','plaquetas','peso corporal'].includes(unit)||!name||name.length>100)throw new Error('Informe o equipamento e selecione a unidade usada.');
 const session=doc.overlay.sessions.find(x=>x.id===sessionId&&x.status==='in_progress');
 const all=[...(doc.base?.entities?.exercise_variants||[]),...doc.overlay.exercise_variants];
 const source=all.find(x=>x.id===sourceId);
 if(!session||!source||!session.planned_variant_ids?.includes(sourceId)||!newId||all.some(x=>x.id===newId))throw new Error('Exercício do treino indisponível.');
 const variant={id:newId,exercise_id:source.exercise_id,equipment_or_variation:name,unit,unit_confirmed:true,comparison_group_id:newId,comparison_policy:'match_same_variant_only',provenance:{source:'android_local'}};
 doc.overlay.exercise_variants.push(variant);
 session.planned_variant_ids=session.planned_variant_ids.map(x=>x===sourceId?newId:x);
 if(session.planned_guidance?.[sourceId])session.planned_guidance={...session.planned_guidance,[newId]:{...session.planned_guidance[sourceId]}};
 return variant;
}
