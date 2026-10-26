/* Etapa 2: conciliação por campo de dados importados do Google Sheets.
 * Não faz requisições ou escrituras na planilha. Não contém histórico pessoal.
 * Uma referência anterior é exigida antes de aplicar diferenças automaticamente.
 */
const norm=v=>String(v??'').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
const text=v=>String(v??'').trim();
const numeric=(v)=>{
 if(v===null||v===undefined||text(v)==='')return null;
 const s=text(v).replace(/\s/g,'').replace(',','.');
 const n=Number(s);if(!Number.isFinite(n)||n<0)throw new Error('Número inválido na conciliação');
 return n;
};
const rirNumeric=v=>{
 const raw=text(v),m=raw.match(/^(\d+(?:[.,]\d+)?)\s*[-–—a]\s*(\d+(?:[.,]\d+)?)$/i);
 if(m){const a=Number(m[1].replace(',','.')),b=Number(m[2].replace(',','.'));
  if(b<a||b>30)throw new Error('Faixa de RIR inválida na conciliação');
  return (a+b)/2;}
 const value=numeric(v);
 if(value!==null&&value>30)throw new Error('RIR inválido na conciliação');
 return value;
};
const kind=v=>({'efetiva':'effective','aquecimento':'warmup','core':'core','drop set':'drop_set','back off':'back_off','rampa':'ramp_up','extra':'extra','estendida':'extended'}[norm(v)]||'other');
const status=v=>({'concluido':'completed','em andamento':'in_progress','planejado':'planned','cancelado':'cancelled'}[norm(v)]||null);
const normValue=v=>typeof v==='string'?text(v):v??null;
const equal=(a,b)=>Object.is(normValue(a),normValue(b));
const fields={
 Treinos:['status','duration_minutes','body_weight_kg','lower_back_pain_before','lower_back_pain_after','notes'],
 Series:['load_value','repetitions','rir','rpe','legacy_volume_index','discomfort','notes'],
 Peso:['weight_kg','goal_weight_kg_reported','notes']
};
const localEntities=(doc,key)=>[...(doc.base?.entities?.[key]||[]),...(doc.overlay?.[key]||[])];
function state(tab,local,row,ent){
 if(tab==='Treinos'){
  return {identity:[text(row?.[0]),norm(row?.[2])].join('|'),
    remote:{status:status(row?.[3]),duration_minutes:numeric(row?.[4]),body_weight_kg:numeric(row?.[5]),
      lower_back_pain_before:numeric(row?.[6]),lower_back_pain_after:numeric(row?.[7]),notes:text(row?.[8])},
    own:{status:local.status,duration_minutes:local.duration_minutes??null,body_weight_kg:local.body_weight_kg??null,
      lower_back_pain_before:local.lower_back_pain_before??null,lower_back_pain_after:local.lower_back_pain_after??null,notes:text(local.notes)}};
 }
 if(tab==='Peso'){
  return {identity:text(row?.[0]),
    remote:{weight_kg:numeric(row?.[1]),goal_weight_kg_reported:numeric(row?.[2]),notes:text(row?.[5])},
    own:{weight_kg:local.weight_kg,goal_weight_kg_reported:local.goal_weight_kg_reported??null,notes:text(local.notes)}};
 }
 const session=ent.sessions.get(local.session_id),exercise=ent.exercises.get(local.exercise_id),variant=ent.variants.get(local.variant_id);
 if(!session||!exercise||!variant)throw new Error('Série local com referências ausentes na conciliação');
 const localKey=[local.date,norm(session.name),norm(exercise.name),norm(variant.equipment_or_variation||'Variação não informada'),norm(variant.unit||'reps'),norm(local.set_type),numeric(local.set_number)].join('|');
 const remoteKey=[text(row?.[0]),norm(row?.[1]),norm(row?.[2]),norm(row?.[3]||'Variação não informada'),norm(row?.[7]||'reps'),kind(row?.[4]),numeric(row?.[5])].join('|');
 return {identity:remoteKey,expectedIdentity:localKey,
   remote:{load_value:numeric(row?.[6]),repetitions:numeric(row?.[8]),rir:rirNumeric(row?.[9]),rpe:numeric(row?.[10]),legacy_volume_index:numeric(row?.[11]),discomfort:text(row?.[12])||null,notes:text(row?.[13])},
   own:{load_value:local.load_value??null,repetitions:local.repetitions??null,rir:local.rir??null,rpe:local.rpe??null,
       legacy_volume_index:local.legacy_volume_index??null,discomfort:text(local.discomfort)||null,notes:text(local.notes)}};
}
const identifier=(tab,row)=>text(row?.[{Treinos:9,Series:14,Peso:6}[tab]]);
const entities=doc=>({
 sessions:new Map(localEntities(doc,'sessions').map(x=>[x.id,x])),
 exercises:new Map(localEntities(doc,'exercises').map(x=>[x.id,x])),
 variants:new Map(localEntities(doc,'exercise_variants').map(x=>[x.id,x]))
});
/** Return a new object; either every eligible field reconciles or an error
 * prevents the entire import from being committed. A baseline never comes
 * from an unverified divergent first read.
 */
export function reconcileImportedRows(doc,raw){
 const next=structuredClone(doc);
 const indexes=entities(next);
 const metrics={baselineInitialized:0,rowsUpdated:0,fieldsUpdated:0,unchanged:0,localEditsPending:0};
 for(const [tab,key] of [['Treinos','sessions'],['Series','sets'],['Peso','weigh_ins']]){
  const values=Array.isArray(raw?.[tab])?raw[tab]:raw?.[tab]?.values;
  if(!Array.isArray(values)||!values.length)throw new Error('Aba ausente na conciliação: '+tab);
  for(const local of localEntities(next,key)){
   if(local.provenance?.sheet!==tab)continue;
   const sheetRow=local.provenance.row;
   if(!Number.isInteger(sheetRow)||sheetRow<2)throw new Error('Linha de origem inválida para '+tab);
   const row=values[sheetRow-1];
   if(!row||!text(row[0]))throw new Error('Linha importada desapareceu do Sheets: '+tab+' '+sheetRow+'. Revisão necessária.');
   const remoteId=identifier(tab,row);
   if(remoteId&&remoteId!==local.id)throw new Error('Identificador alterado no Sheets: '+tab+' '+sheetRow+'. Revisão necessária.');
   const comparison=state(tab,local,row,indexes);
   const wanted=comparison.expectedIdentity??(tab==='Treinos'?[local.date,norm(local.name)].join('|'):local.date);
   if(wanted!==comparison.identity)throw new Error('Identidade de registro alterada no Sheets: '+tab+' '+sheetRow+'. Revisão necessária.');
   if(tab==='Treinos'&&comparison.remote.status===null)throw new Error('Status não reconhecido na planilha, linha '+sheetRow);
   if(tab==='Series'&&comparison.remote.repetitions!==null&&!Number.isInteger(comparison.remote.repetitions))throw new Error('Repetições inválidas na planilha, linha '+sheetRow);
   const baseline=local.provenance.remote_state_v1;
   if(!baseline){
    // Old backups sometimes omit optional fields entirely. Initializing a
    // genuinely absent field loses no previous observation. Explicit null,
    // zero or user-provided text is NOT treated as absent.
    const different=fields[tab].filter(f=>local[f]!==undefined&&!equal(comparison.own[f],comparison.remote[f]));
    if(different.length)throw new Error('Registro antigo sem referência de sincronização e com diferenças em '+tab+' linha '+sheetRow+' ('+different.join(', ')+'). Revisão manual necessária; nada foi sobrescrito.');
    for(const field of fields[tab]){
      if(local[field]===undefined&&comparison.remote[field]!==null){
        local[field]=comparison.remote[field];
        metrics.fieldsUpdated++;
      }
    }
    local.provenance.remote_state_v1={identity:wanted,fields:structuredClone(comparison.remote)};
    metrics.baselineInitialized++;continue;
   }
   if(baseline.identity!==wanted||!baseline.fields)throw new Error('Referência de sincronização incompatível em '+tab+' linha '+sheetRow);
   let changed=0,rirUpdated=false;
   for(const field of fields[tab]){
    const ancestor=baseline.fields[field]??null,own=comparison.own[field]??null,current=comparison.remote[field]??null;
    const ownDiff=!equal(own,ancestor),remoteDiff=!equal(current,ancestor);
    if(ownDiff&&!remoteDiff)metrics.localEditsPending++;
    if(ownDiff&&remoteDiff&&!equal(own,current))throw new Error('Conflito: '+tab+' linha '+sheetRow+' campo '+field+' alterado tanto no Android quanto no Sheets. Revise antes de sincronizar.');
    if(remoteDiff&&!ownDiff){local[field]=current;changed++;metrics.fieldsUpdated++;if(field==='rir')rirUpdated=true;}
   }
   if(tab==='Series'&&rirUpdated){
     // A historical range is never invented from a midpoint.
     const r=text(row?.[9]);
     const isRange=/^\d+(?:[.,]\d+)?\s*[-–—a]\s*\d+(?:[.,]\d+)?$/i.test(r);
     if(isRange){local.provenance.rir_reported_text=r;local.provenance.rir_estimated_midpoint=true;}
     else {delete local.provenance.rir_reported_text;delete local.provenance.rir_estimated_midpoint;}
   }
   local.provenance.remote_state_v1={identity:wanted,fields:structuredClone(comparison.remote)};
   if(changed)metrics.rowsUpdated++;else metrics.unchanged++;
  }
 }
 return {next,metrics};
}
/** Prevent appending more data if imported records are out of date.
 * The user must run a full import first. This function does not mutate doc.
 */
export function requireRemoteUpToDate(doc,raw){
 const {metrics}=reconcileImportedRows(doc,raw);
 if(metrics.rowsUpdated>0)throw new Error('A planilha contém alterações em registros antigos. Importe as novidades antes de enviar novas séries.');
 if(metrics.localEditsPending>0)throw new Error('Há alterações locais em registros já importados. O envio de edições precisa de conciliação; nenhuma mudança foi enviada.');
 return true;
}
