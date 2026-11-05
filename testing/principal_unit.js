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
 if(session.prior_planned_variants?.[sourceId] || session.skipped_series?.[sourceId]){
  session.prior_planned_variants={...session.prior_planned_variants,[variant.id]:[sourceId,...(session.prior_planned_variants?.[sourceId]||[])]};
  session.skipped_series={...session.skipped_series,[variant.id]:session.skipped_series?.[sourceId]||0};
 }
 if(session.planned_guidance?.[sourceId])session.planned_guidance={...session.planned_guidance,[variant.id]:{...session.planned_guidance[sourceId]}};
 return variant;
}

export const loadUnits = ['kg', 'kg/lado', 'kg/halter', 'plaquetas', 'peso corporal'];

function validateDropCorrection(rows, row, unit, originalUnit, changes) {
 const parent = row.set_type === 'drop_set'
  ? rows.find(s => s.session_id === row.session_id && s.set_type === 'effective' && row.notes === 'Drop de ' + s.id)
  : row;
 if (!parent) return;
 const parts = rows.filter(s => s.session_id === parent.session_id && s.set_type === 'drop_set' &&
  s.notes === 'Drop de ' + parent.id).sort((a, b) => a.set_number - b.set_number);
 if (!parts.length) return;
 if (unit !== originalUnit || changes.set_type !== row.set_type) {
  throw new Error('A unidade e o tipo fazem parte do drop set. Corrija a carga, as repetições ou o RIR.');
 }
 const loads = [parent, ...parts].map(s => s.id === row.id ? changes.load_value : s.load_value);
 if (loads.some((load, i) => !Number.isFinite(load) || (i > 0 && load >= loads[i - 1]))) {
  throw new Error('Cada redução precisa ter carga menor que a etapa anterior.');
 }
}

export function correctLocalSetUnit(doc, setId, unit, newId, changes, mutateSet) {
 const row = doc.overlay.sets.find(s => s.id === setId);
 const variants = [...(doc.base?.entities?.exercise_variants || []), ...doc.overlay.exercise_variants];
 const source = row && variants.find(v => v.id === row.variant_id);
 if (!source) throw new Error('Esta série local não está disponível.');
 validateDropCorrection(doc.overlay.sets, row, unit, row.load_unit_original || source.unit, changes);
 if (unit === (row.load_unit_original || source.unit) && unit === source.unit) {
  mutateSet(doc, setId, changes);
  return;
 }
 if (!loadUnits.includes(unit) || changes.load_value == null) {
  throw new Error('Informe a unidade e o valor correto da carga.');
 }
 const candidate = {
  ...source, id: newId, unit, unit_confirmed: true, comparison_group_id: newId,
  comparison_policy: 'match_same_variant_only', provenance: {source: 'android_local'}
 };
 const existing = variants.find(v => sameLoadVariant(v, candidate));
 if (!existing && (!newId || variants.some(v => v.id === newId))) {
  throw new Error('Identificador de variante inválido.');
 }
 mutateSet(doc, setId, changes);
 if (!existing) doc.overlay.exercise_variants.push(candidate);
 row.planned_variant_id ??= row.variant_id;
 row.variant_id = (existing || candidate).id;
 row.load_unit_original = unit;
}
