/* Treino & Evolução — Etapa 0: diagnóstico somente leitura.
 * Não importa, não altera documentos locais e não escreve no Google Sheets.
 * NUNCA adicionar fixtures pessoais a este repositório público.
 */
import {readRowSets, sessionKey, variantKey} from '../integration/sheet_sync_core.js';

const n = v => String(v??'').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
const val = v => {
 const raw=String(v??'').trim();
 if(!raw) return '';
 const range=raw.match(/^(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)$/);
 if(range)return String((Number(range[1].replace(',','.'))+Number(range[2].replace(',','.')))/2);
 return /^[-+]?\d+(?:[.,]\d+)?$/.test(raw)?String(Number(raw.replace(',','.'))):n(raw);
};
const group=(doc,key)=>[...(doc?.base?.entities?.[key]||[]),...(doc?.overlay?.[key]||[])];
const recordKey=(x)=>[
 x.date,n(x.session_name),n(x.exercise),n(x.equipment),n(x.unit),
 val(x.set_number),val(x.load),val(x.reps),val(x.rir),val(x.rpe),n(x.type)
].join('\u001f');

export function inspectSyncPreflight(doc, raw){
 const rows=readRowSets(raw);
 const sessions=group(doc,'sessions'), sets=group(doc,'sets');
 const exercises=new Map(group(doc,'exercises').map(x=>[x.id,x]));
 const variants=new Map(group(doc,'exercise_variants').map(x=>[x.id,x]));
 const sessionById=new Map(sessions.map(x=>[x.id,x]));
 const remoteSets=rows.Series.slice(1).map((r,i)=>({r,row:i+2})).filter(x=>String(x.r?.[0]??'').trim());
 const setsWithKeys=sets.map(s=>{
   const ses=sessionById.get(s.session_id),ex=exercises.get(s.exercise_id),v=variants.get(s.variant_id);
   if(!ses||!ex||!v)return {set:s,key:null};
   return {set:s,key:recordKey({date:s.date,session_name:ses.name,exercise:ex.name,equipment:v.equipment_or_variation||'Variação não informada',unit:v.unit||'reps',set_number:s.set_number,load:s.load_value,reps:s.repetitions,rir:s.rir,rpe:s.rpe,type:({effective:'Efetiva',warmup:'Aquecimento',drop_set:'Drop set',back_off:'Back off',core:'Core',ramp_up:'Rampa',extra:'Extra',extended:'Estendida'})[s.set_type]||s.set_type})};
 });
 const reviewed=[];
 const remoteKeys=new Map();
 let missingProvenance=0,changedImported=0,repeatIdentity=0;
 for(const {r,row} of remoteSets){
   const key=recordKey({date:r[0],session_name:r[1],exercise:r[2],equipment:r[3]||'Variação não informada',unit:r[7]||'reps',set_number:r[5],load:r[6],reps:r[8],rir:r[9],rpe:r[10],type:r[4]});
   const id=String(r[14]??'').trim();
   const identified=setsWithKeys.filter(({set})=>set.provenance?.sheet==='Series'&&set.provenance?.row===row||(id&&set.id===id));
   if(identified.length>1){repeatIdentity++;reviewed.push({sheet:'Series',row,reason:'identidade_repetida'});continue;}
   if(identified.length===1){
     const same=identified[0].key===key;
     if(!same){changedImported++;reviewed.push({sheet:'Series',row,reason:'alteracao_remota'});}
     continue;
   }
   const candidates=setsWithKeys.filter(x=>!x.set.provenance?.sheet&&x.key===key);
   if(candidates.length){missingProvenance++;reviewed.push({sheet:'Series',row,reason:'possivel_duplicacao_historica'});}
   if(remoteKeys.has(key)){// duas séries idênticas no Sheets podem ser legítimas: nunca mesclar automaticamente
     reviewed.push({sheet:'Series',row,reason:'series_remotas_equivalentes'});
   }else remoteKeys.set(key,row);
 }
 const sessionKeyCounts=new Map();
 for(const s of sessions){const key=sessionKey(s.date,s.name);sessionKeyCounts.set(key,(sessionKeyCounts.get(key)||0)+1);}
 const overlappingSessions=[...sessionKeyCounts.values()].filter(count=>count>1).length;
 const counts={
   remote:{sessions:rows.Treinos.slice(1).filter(r=>r?.[0]).length,sets:remoteSets.length,weigh_ins:rows.Peso.slice(1).filter(r=>r?.[0]).length},
   local:{sessions:sessions.length,sets:sets.length,weigh_ins:group(doc,'weigh_ins').length},
   missingProvenance,changedImported,repeatIdentity,overlappingSessions
 };
 return {counts,review:reviewed,safeForUnattendedMigration: reviewed.length===0&&overlappingSessions===0};
}

export function summarizeForPublicCI(result){
 // Somente contagens, jamais nomes de exercícios, treinos ou datas pessoais.
 return {safeForUnattendedMigration:result.safeForUnattendedMigration,
   ambiguousRows:result.review.length,
   overlappingSessions:result.counts.overlappingSessions,
   changedImported:result.counts.changedImported,
   missingProvenance:result.counts.missingProvenance};
}
