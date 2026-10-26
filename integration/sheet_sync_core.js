import {reconcileImportedRows,requireRemoteUpToDate} from './remote_reconcile.js';
import {matchLegacySeries,matchLegacySessions,matchLegacyWeights} from './legacy_identity.js';
/* Google Sheets adapter: pure transformations. No identity secrets or personal datasets. */
export const SYNC_SCHEMA='treino-sheets-sync-v1';
export const COLUMN_IDS=Object.freeze({Treinos:9,Series:14,Peso:6}); // 0-based: J,O,G
const norm=s=>String(s??'').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
const str=v=>String(v??'').trim();
const number=(value,{positive=false}={})=>{
  if(value===null||value===undefined||str(value)==='')return null;
  const s=str(value).replace(/\s/g,'').replace(',','.');const v=Number(s);
  if(!Number.isFinite(v)||v<0||(positive&&v<=0))throw new Error('Valor numérico inválido: '+String(value));
  return v;
};
/** RIR pode ser uma faixa na planilha (por exemplo, 1-2).
 * O valor original fica preservado e o ponto médio é somente uma estimativa numérica. */
export function parseReportedRir(value){
 const raw=str(value);
 if(!raw)return {value:null,reported:null,estimated:false};
 const m=raw.match(/^(\d+(?:[.,]\d+)?)\s*(?:-|–|—|a)\s*(\d+(?:[.,]\d+)?)$/i);
 if(m){
  const low=Number(m[1].replace(',','.')),high=Number(m[2].replace(',','.'));
  if(low<0||high>30||high<low)throw new Error('Intervalo de RIR inválido: '+raw);
  return {value:Number(((low+high)/2).toFixed(4)),reported:raw,estimated:true};
 }
 const single=number(value);
 if(single===null||single>30)throw new Error('RIR inválido: '+raw);
 return {value:single,reported:raw,estimated:false};
}
function date(s){const v=str(s);if(!/^\d{4}-\d\d-\d\d$/.test(v)||Number.isNaN(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw new Error('Data inválida na planilha: '+v);return v;}
const kind=x=>({'efetiva':'effective','aquecimento':'warmup','core':'core','drop set':'drop_set','back off':'back_off','rampa':'ramp_up','extra':'extra','estendida':'extended'}[norm(x)]||'other');
const status=x=>({'concluido':'completed','em andamento':'in_progress','planejado':'planned','cancelado':'cancelled'}[norm(x)]||null);
export function sessionKey(d,n){return date(d)+'|'+norm(n);}
export function variantKey(name,equipment,unit){return [norm(name),norm(equipment||'Variação não informada'),norm(unit||'reps')].join('|');}
export function readRowSets(raw){
  const obj={};for(const t of ['Treinos','Series','Peso']){const values=Array.isArray(raw[t])?raw[t]:raw[t]?.values;if(!Array.isArray(values))throw new Error('Aba obrigatória ausente: '+t);obj[t]=values;}
  for(const [t,header] of [['Treinos','Data'],['Series','Data'],['Peso','Data']])if(norm(obj[t][0]?.[0])!==norm(header))throw new Error('Cabeçalho incorreto: '+t);
  for(const t of ['Treinos','Series','Peso']){const seen=new Set();for(const r of obj[t].slice(1)){const id=str(r?.[COLUMN_IDS[t]]);if(!id)continue;if(seen.has(id))throw new Error('ID de aplicativo duplicado no Google Sheets ('+t+'): '+id);seen.add(id);}}
  return obj;
}
/** A projection does not edit the Google Sheet and does not overwrite historical rows. */
export function previewRemote(doc,raw){
 const rows=readRowSets(raw),existing={sessions:[...(doc.base?.entities?.sessions||[]),...doc.overlay.sessions],sets:[...(doc.base?.entities?.sets||[]),...doc.overlay.sets],weigh_ins:[...(doc.base?.entities?.weigh_ins||[]),...doc.overlay.weigh_ins]};
 const legacyLinks=matchLegacySeries(doc,rows.Series,setValues);
 const legacySessionLinks=matchLegacySessions(doc,rows.Treinos,sessionValues);
 const legacyWeightLinks=matchLegacyWeights(doc,rows.Peso);
 const legacyRows=new Set(legacyLinks.map(x=>x.row));
 const haveProvenance=(list,sheet,row)=>list.some(v=>v.provenance?.sheet===sheet&&v.provenance?.row===row);
 const haveId=(list,id)=>Boolean(id)&&list.some(v=>v.id===id);
 const matches={Treinos:[],Series:[],Peso:[]},counts={Treinos:0,Series:0,Peso:0};
 const remoteKeys={Treinos:new Set(),Series:new Set(),Peso:new Set()};
 for(const t of ['Treinos','Series','Peso'])for(let i=1;i<rows[t].length;i++){
   const r=rows[t][i];if(!str(r?.[0]))continue;
   const row=i+1,id=str(r[COLUMN_IDS[t]]),key=t==='Treinos'?sessionKey(r[0],r[2]):t==='Series'?`${row}|${str(r[1])}`:date(r[0])+'|'+row;
   if(remoteKeys[t].has(key)&&t==='Treinos')throw new Error('Sessões repetidas com mesma data e nome na planilha: '+key);
   remoteKeys[t].add(key);
   const collection={Treinos:existing.sessions,Series:existing.sets,Peso:existing.weigh_ins}[t];
   let present=haveProvenance(collection,t,row)||haveId(collection,id);
   if(t==='Series')present ||=legacyRows.has(row);
   if(t==='Treinos')present ||=collection.some(s=>sessionKey(s.date,s.name)===key);
   if(t==='Peso')present ||=collection.some(w=>w.date===date(r[0])&&w.weight_kg===number(r[1],{positive:true}));
   if(!present){counts[t]++;matches[t].push({row,record:r});}
 }
 return {counts,newRows:matches,legacyLinks,legacySessionLinks,legacyWeightLinks,remoteCounts:Object.fromEntries(['Treinos','Series','Peso'].map(t=>[t,rows[t].slice(1).filter(r=>str(r?.[0])).length]))};
}
export function sessionValues(s){
 if(!s?.id||!s.name||!s.date)throw new Error('Sessão local incompleta');
 const labels={completed:'Concluído',planned:'Planejado',in_progress:'Em andamento',cancelled:'Cancelado'};
 const dow=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][new Date(s.date+'T12:00:00Z').getUTCDay()];
 return [date(s.date),s.weekday_reported||dow,s.name,labels[s.status]||'Planejado',s.duration_minutes??'',s.body_weight_kg??'',s.lower_back_pain_before??'',s.lower_back_pain_after??'',s.notes||'',s.id];
}
export function setValues(s,entities){
 if(!s?.id||!s.session_id)throw new Error('Série incompleta');
 const session=entities.sessions.find(x=>x.id===s.session_id),ex=entities.exercises.find(x=>x.id===s.exercise_id),v=entities.exercise_variants.find(x=>x.id===s.variant_id);
 if(!session||!ex||!v)throw new Error('Série com ligação inexistente');
 const labels={effective:'Efetiva',warmup:'Aquecimento',core:'Core',drop_set:'Drop set',back_off:'Back off',ramp_up:'Rampa',extra:'Extra',extended:'Estendida',other:'Outra'};
 return [date(s.date),session.name,ex.name,v.equipment_or_variation||'',labels[s.set_type]||'Outra',s.set_number??'',s.load_value??'',v.unit||'',s.repetitions??'',s.rir??'',s.rpe??'',s.legacy_volume_index??(Number.isFinite(s.load_value)&&Number.isFinite(s.repetitions)?Number((s.load_value*s.repetitions).toFixed(3)):''),s.discomfort??'',s.notes||'',s.id];
}
export function weightValues(w,{initial=null,goal=null}={}){
 if(!w?.id)throw new Error('Pesagem sem identificador');
 const current=number(w.weight_kg,{positive:true}),target=w.goal_weight_kg_reported??goal;return [date(w.date),current,target??'',initial===null?'':Number((current-initial).toFixed(3)),target==null?'':Number((current-target).toFixed(3)),w.notes||'',w.id];
}
/** Only local overlay records are candidates. An imported row is NEVER uploaded back. */
export function planOutbound(doc,raw){
 const rows=readRowSets(raw);requireRemoteUpToDate(doc,rows);
 const remote=new Set(),plan={Treinos:[],Series:[],Peso:[]};
 for(const t of ['Treinos','Series','Peso'])for(const r of rows[t].slice(1)){const id=str(r?.[COLUMN_IDS[t]]);if(id)remote.add(t+':'+id);}
 const matchedSessionIds=new Set(matchLegacySessions(doc,rows.Treinos,sessionValues).filter(x=>x.collection==='overlay').map(x=>x.id));
 const matchedWeightIds=new Set(matchLegacyWeights(doc,rows.Peso).filter(x=>x.collection==='overlay').map(x=>x.id));
 const seenSessions=new Set(rows.Treinos.slice(1).filter(r=>str(r?.[0])).map(r=>sessionKey(r[0],r[2])));
 const sessions=[...(doc.base?.entities?.sessions||[]),...doc.overlay.sessions];
 const localSessions=doc.overlay.sessions.filter(s=>!s.provenance?.sheet&&!matchedSessionIds.has(s.id)&&s.status==='completed');
 for(const s of localSessions){if(remote.has('Treinos:'+s.id))continue;if(seenSessions.has(sessionKey(s.date,s.name)))throw new Error('Conflito: sessão com mesma data e nome já existe no Sheets. Revise antes de sincronizar: '+s.date+' '+s.name);plan.Treinos.push({id:s.id,values:sessionValues(s)});}
 const entities={sessions,sets:[...(doc.base?.entities?.sets||[]),...doc.overlay.sets],exercises:[...(doc.base?.entities?.exercises||[]),...doc.overlay.exercises],exercise_variants:[...(doc.base?.entities?.exercise_variants||[]),...doc.overlay.exercise_variants]};
 const matchedLegacyIds=new Set(matchLegacySeries(doc,rows.Series,setValues).filter(x=>x.collection==='overlay').map(x=>x.id));
 const done=new Set(sessions.filter(s=>s.status==='completed').map(s=>s.id));
 for(const s of doc.overlay.sets.filter(s=>!s.provenance?.sheet&&!matchedLegacyIds.has(s.id)&&done.has(s.session_id))){if(!remote.has('Series:'+s.id))plan.Series.push({id:s.id,values:setValues(s,entities)});}
 const weights=rows.Peso.slice(1).filter(r=>str(r?.[0]));
 const initial=weights.length?number(weights[0][1],{positive:true}):null,goal=weights.length?number(weights[0][2]):null;
 for(const w of doc.overlay.weigh_ins.filter(w=>!w.provenance?.sheet&&!matchedWeightIds.has(w.id))){
  if(remote.has('Peso:'+w.id))continue;
  if(weights.some(r=>r[0]===w.date&&number(r[1],{positive:true})===w.weight_kg))throw new Error('Conflito: pesagem idêntica já existe no Sheets.');
  plan.Peso.push({id:w.id,values:weightValues(w,{initial,goal})});
 }
 return plan;
}
/** Read-only parsing of previously missing sheet rows; before importing, validate the resulting app document. */
export function stageInbound(doc,raw){
 const view=previewRemote(doc,raw),next=structuredClone(doc),add={sessions:0,sets:0,exercises:0,exercise_variants:0,weigh_ins:0};
 const ent=c=>[...(next.base?.entities?.[c]||[]),...next.overlay[c]];
 // Only annotate overlay objects; historical base stays immutable.
 for(const [collection,links,tab] of [['sessions',view.legacySessionLinks,'Treinos'],['weigh_ins',view.legacyWeightLinks,'Peso']]){
  for(const link of links){if(link.collection!=='overlay')continue;
   const local=next.overlay[collection].find(x=>x.id===link.id);
   if(!local)throw new Error('Registro local alterado durante a reconciliação: '+link.id);
   local.provenance={...(local.provenance||{}),sheet:tab,row:link.row,matched_legacy:true};
  }
 }
 // Link uniquely matching legacy overlay rows without deleting or re-creating any series.
 for(const link of view.legacyLinks){if(link.collection!=='overlay')continue;
  const local=next.overlay.sets.find(s=>s.id===link.id);
  if(!local)throw new Error('Registro local alterado durante a reconciliação: '+link.id);
  local.provenance={...(local.provenance||{}),sheet:'Series',row:link.row,matched_legacy:true};
 }
 const oldSessions=new Map(ent('sessions').map(s=>[sessionKey(s.date,s.name),s]));
 for(const {row,record:r} of view.newRows.Treinos){const sessionStatus=status(r[3]);if(!sessionStatus)throw new Error('Status desconhecido em Treinos, linha '+row);
  const id=str(r[9])||'sheet_session_'+row;
  const s={id,date:date(r[0]),name:str(r[2]),status:sessionStatus,duration_minutes:number(r[4]),body_weight_kg:number(r[5]),lower_back_pain_before:number(r[6]),lower_back_pain_after:number(r[7]),notes:str(r[8]),weekday_reported:str(r[1]),provenance:{sheet:'Treinos',row}};
  next.overlay.sessions.push(s);oldSessions.set(sessionKey(s.date,s.name),s);add.sessions++;
 }
 const exercises=new Map(ent('exercises').map(x=>[norm(x.name),x]));
 const variants=new Map(ent('exercise_variants').map(v=>[variantKey(ent('exercises').find(x=>x.id===v.exercise_id)?.name,v.equipment_or_variation,v.unit),v]));
 for(const {row,record:r} of view.newRows.Series){const sk=sessionKey(r[0],r[1]),sess=oldSessions.get(sk);if(!sess)throw new Error('A série da linha '+row+' não tem sessão correspondente. Não é seguro importar automaticamente.');
  const exName=str(r[2]);if(!exName)throw new Error('Exercício ausente na linha '+row);
  let exercise=exercises.get(norm(exName));if(!exercise){exercise={id:'sheet_exercise_'+row,name:exName,muscle_group:null,classification_verified:false,notes:null};next.overlay.exercises.push(exercise);exercises.set(norm(exName),exercise);add.exercises++;}
  const key=variantKey(exName,str(r[3]),str(r[7]));let variant=variants.get(key);if(!variant){variant={id:'sheet_variant_'+row,exercise_id:exercise.id,equipment_or_variation:str(r[3])||'Variação não informada',unit:str(r[7])||'reps',unit_confirmed:Boolean(str(r[7])),comparison_policy:'match_same_variant_only'};next.overlay.exercise_variants.push(variant);variants.set(key,variant);add.exercise_variants++;}
  const reportedRir=parseReportedRir(r[9]);
  const set={id:str(r[14])||'sheet_set_'+row,date:date(r[0]),session_id:sess.id,exercise_id:exercise.id,variant_id:variant.id,set_type:kind(r[4]),set_number:number(r[5]),load_value:number(r[6]),repetitions:number(r[8]),rir:reportedRir.value,rpe:number(r[10]),legacy_volume_index:number(r[11]),discomfort:str(r[12])||null,notes:str(r[13]),provenance:{sheet:'Series',row,...(reportedRir.estimated?{rir_reported_text:reportedRir.reported,rir_estimated_midpoint:true}:{})}};
  if(set.repetitions!==null&&!Number.isInteger(set.repetitions))throw new Error('Repetições decimais na linha '+row);
  next.overlay.sets.push(set);add.sets++;
 }
 for(const {row,record:r} of view.newRows.Peso){const w={id:str(r[6])||'sheet_weight_'+row,date:date(r[0]),weight_kg:number(r[1],{positive:true}),goal_weight_kg_reported:number(r[2]),notes:str(r[5]),provenance:{sheet:'Peso',row}};next.overlay.weigh_ins.push(w);add.weigh_ins++;}
 const reconciliation=reconcileImportedRows(next,raw);
 return {next:reconciliation.next,add,reconciled:reconciliation.metrics,linked_legacy_sets:view.legacyLinks.length,linked_legacy_sessions:view.legacySessionLinks.length,linked_legacy_weights:view.legacyWeightLinks.length,remoteCounts:view.remoteCounts};
}
/** Detect local edits after an app-generated record has already been uploaded. */
export function detectOutboundDrift(doc,raw){
 const rows=readRowSets(raw),entities={sessions:[...(doc.base?.entities?.sessions||[]),...doc.overlay.sessions],
  exercises:[...(doc.base?.entities?.exercises||[]),...doc.overlay.exercises],
  exercise_variants:[...(doc.base?.entities?.exercise_variants||[]),...doc.overlay.exercise_variants]};
 const specs={Treinos:{list:doc.overlay.sessions,serialize:x=>sessionValues(x),check:[0,2,3,4,5,6,7,8]},
  Series:{list:doc.overlay.sets,serialize:x=>setValues(x,entities),check:[0,1,2,3,4,5,6,7,8,9,10,12,13]},
  Peso:{list:doc.overlay.weigh_ins,serialize:x=>weightValues(x),check:[0,1,2,5]}};
 const normalized=x=>{const t=String(x??'').trim();if(!t)return '';if(/^[-+]?\d+(?:[.,]\d+)?$/.test(t))return String(Number(t.replace(',','.')));return t;};
 const conflicts=[];
 for(const [tab,{list,serialize,check}] of Object.entries(specs)){
  const remote=new Map(rows[tab].slice(1).filter(r=>str(r?.[COLUMN_IDS[tab]])).map(r=>[str(r[COLUMN_IDS[tab]]),r]));
  const initialWeight=rows.Peso.length>1?number(rows.Peso[1][1],{positive:true}):null;
  const goalWeight=rows.Peso.length>1?number(rows.Peso[1][2]):null;
  for(const local of list.filter(x=>!x.provenance?.sheet)){const r=remote.get(local.id);if(!r)continue;
   const expected=tab==='Peso'?weightValues(local,{initial:initialWeight,goal:goalWeight}):serialize(local);
   if(check.some(i=>normalized(expected[i])!==normalized(r[i])))conflicts.push({tab,id:local.id});
  }
 }
 return conflicts;
}
