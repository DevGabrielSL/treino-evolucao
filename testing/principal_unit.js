const equipmentKey = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export function sameLoadVariant(a, b) {
 if (!a || !b || a.exercise_id !== b.exercise_id || a.unit !== b.unit) return false;
 const equipment = equipmentKey(a.equipment_or_variation);
 return a.unit_confirmed === true && b.unit_confirmed === true && Boolean(equipment)
  && equipment === equipmentKey(b.equipment_or_variation);
}

export function confirmSessionVariant(doc,{sessionId,sourceId,newId,equipment,unit}){
 const name=String(equipment||'').trim();
 if(!['kg','kg/lado','kg/halter','plaquetas','peso corporal'].includes(unit)||!name||name.length>100)throw new Error('Informe o equipamento e selecione a unidade usada.');
 const session=doc.overlay.sessions.find(x=>x.id===sessionId&&x.status==='in_progress');
 const all=[...(doc.base?.entities?.exercise_variants||[]),...doc.overlay.exercise_variants];
 const source=all.find(x=>x.id===sourceId);
 if(!session||!source||!session.planned_variant_ids?.includes(sourceId)||!newId||all.some(x=>x.id===newId))throw new Error('Exercício do treino indisponível.');
 const candidate={id:newId,exercise_id:source.exercise_id,equipment_or_variation:name,unit,unit_confirmed:true,comparison_group_id:newId,comparison_policy:'match_same_variant_only',provenance:{source:'android_local'}};
 const existing = all.find(v => sameLoadVariant(v, candidate) &&
  (v.id === sourceId || !session.planned_variant_ids.includes(v.id)));
 const variant = existing || candidate;
 if (variant.id === sourceId) return variant;
 if (!existing) doc.overlay.exercise_variants.push(variant);
 session.planned_variant_ids=session.planned_variant_ids.map(x=>x===sourceId?variant.id:x);
 if(session.planned_guidance?.[sourceId])session.planned_guidance={...session.planned_guidance,[variant.id]:{...session.planned_guidance[sourceId]}};
 return variant;
}
