import {validateRecovery} from './body.js';
import {validateTemplates} from './template_ops.js';
export const COLLECTIONS=['exercises','exercise_variants','sessions','sets','weigh_ins','goals','plan_parameters','training_rules','weekly_schedule'];
const DB_NAME='treino-evolucao-local-android-v1'; // Keep origin + database name: existing data remains readable.
const DB_STORE='documents';
const DB_VERSION=1;
const PRIMARY='primary';
const RECOVERY='recovery-before-import';
const CONFLICT='Os dados foram alterados em outra aba. Reabra ou atualize o aplicativo antes de salvar. Nenhuma alteração local foi sobrescrita.';
function requestPromise(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Falha no armazenamento.'));});}
export function openDB(){return new Promise((resolve,reject)=>{if(!globalThis.indexedDB){reject(new Error('Seu navegador não disponibilizou IndexedDB.'));return;}
 const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(DB_STORE))r.result.createObjectStore(DB_STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Erro ao abrir o banco local.'));r.onblocked=()=>reject(new Error('Feche outras abas do aplicativo e tente novamente.'));});}
/** Generation is managed by the IDB envelope, not stored in/exported with personal data. */
export async function readSnapshot(){const db=await openDB();try{const tx=db.transaction(DB_STORE,'readonly');const item=await requestPromise(tx.objectStore(DB_STORE).get(PRIMARY));return {document:item?.value??null,generation:item?.generation??0};}finally{db.close();}}
export async function readDocument(){return (await readSnapshot()).document;}
/** Escrita e leitura descartáveis, sem tocar no estado pessoal. */
export async function diagnoseIndexedDB(){
 const id='diagnostic-'+crypto.randomUUID(), value={ok:true,token:crypto.randomUUID()};
 const db=await openDB();
 try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction(DB_STORE,'readwrite'),os=tx.objectStore(DB_STORE);
   let passed=false;
   tx.oncomplete=()=>resolve(passed);
   tx.onerror=()=>reject(tx.error||new Error('IndexedDB: transação não concluída.'));
   tx.onabort=()=>reject(tx.error||new Error('IndexedDB: diagnóstico cancelado.'));
   os.put({id,value});
   const r=os.get(id);
   r.onsuccess=()=>{passed=Boolean(r.result?.value?.token===value.token);os.delete(id);if(!passed)tx.abort();};
   r.onerror=()=>tx.abort();
 });}finally{db.close();}
}

export async function hasRecovery(){const db=await openDB();try{return !!(await requestPromise(db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(RECOVERY)));}finally{db.close();}}
export async function readRecovery(){const db=await openDB();try{return (await requestPromise(db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(RECOVERY)))?.value??null;}finally{db.close();}}
/** An atomic compare-and-swap prevents multiple open tabs (or fast taps) from overwriting records. */
export async function saveSnapshot(doc,expectedGeneration,{preservePrevious=false}={}){
 validateDocument(doc);if(!Number.isInteger(expectedGeneration)||expectedGeneration<0)throw new Error('Revisão de armazenamento ausente.');const db=await openDB();
 try{return await new Promise((resolve,reject)=>{let conflict=null;const tx=db.transaction(DB_STORE,'readwrite'),store=tx.objectStore(DB_STORE);
  tx.oncomplete=()=>resolve(expectedGeneration+1);
  tx.onerror=()=>reject(conflict||tx.error||new Error('Falha ao salvar no dispositivo.'));
  tx.onabort=()=>reject(conflict||tx.error||new Error('Gravação cancelada.'));
  const req=store.get(PRIMARY);
  req.onerror=()=>{conflict=req.error||new Error('Erro ao verificar revisão.');tx.abort();};
  req.onsuccess=()=>{const previous=req.result;const currentGeneration=previous?.generation??0;
   if(currentGeneration!==expectedGeneration){conflict=new Error(CONFLICT);tx.abort();return;}
   if(preservePrevious&&previous?.value)store.put({id:RECOVERY,value:previous.value,created_at:new Date().toISOString()});
   store.put({id:PRIMARY,generation:expectedGeneration+1,value:doc});
  };
 });}finally{db.close();}
}
export function emptyDocument(){return {format:'treino-evolucao-android-v1',version:1,base:null,overlay:{exercises:[],exercise_variants:[],sessions:[],sets:[],weigh_ins:[]},settings:{weekly_goal:4,templates:[]},revision:0,updated_at:null,last_backup_revision:0,last_backup_at:null};}
export function fromLegacy(legacy){validateLegacy(legacy);const doc=emptyDocument();doc.base=structuredClone(legacy);return doc;}
function idsUnique(rows,name){const seen=new Set();for(const x of rows){if(!x||typeof x!=='object'||Array.isArray(x)||typeof x.id!=='string'||x.id.length>180||!x.id)throw new Error('Registro inválido em '+name);if(seen.has(x.id))throw new Error('ID duplicado em '+name+': '+x.id);seen.add(x.id);}return seen;}
const isISODate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00Z').getTime())&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
function checkRelationships(e){
 for(const s of e.sessions)if(s.duration_minutes!=null&&(typeof s.duration_minutes!=='number'||!Number.isFinite(s.duration_minutes)||s.duration_minutes<0))throw new Error('Duração inválida');
 for(const s of e.sets)if(s.rpe!=null&&(typeof s.rpe!=='number'||!Number.isFinite(s.rpe)||s.rpe<0||s.rpe>10))throw new Error('RPE inválido');
const ex=idsUnique(e.exercises,'exercises'),vr=idsUnique(e.exercise_variants,'exercise_variants'),se=idsUnique(e.sessions,'sessions');for(const k of ['sets','weigh_ins','goals','plan_parameters','training_rules','weekly_schedule'])idsUnique(e[k],k);
 const variants=new Map(e.exercise_variants.map(v=>[v.id,v]));const sessionsById=new Map(e.sessions.map(s=>[s.id,s]));for(const v of e.exercise_variants)if(!ex.has(v.exercise_id))throw new Error('Variante sem exercício: '+v.id);
 for(const s of e.sessions){if(!isISODate(s.date))throw new Error('Data inválida na sessão '+s.id);if(!['planned','in_progress','completed','cancelled'].includes(s.status))throw new Error('Status de sessão inválido: '+s.id);}
 for(const s of e.sets){if(!se.has(s.session_id)||!vr.has(s.variant_id)||!ex.has(s.exercise_id))throw new Error('Série com referência inexistente: '+s.id);const v=variants.get(s.variant_id);if(v.exercise_id!==s.exercise_id)throw new Error('Exercício incompatível com a variante na série '+s.id);if(!isISODate(s.date)||s.date!==sessionsById.get(s.session_id).date)throw new Error('Série com data diferente da sessão: '+s.id);if(!['effective','warmup','core','drop_set','back_off','extended','extra','ramp_up','other'].includes(s.set_type))throw new Error('Tipo de série inválido: '+s.id);if(s.load_value!==null&&(typeof s.load_value!=='number'||!Number.isFinite(s.load_value)||s.load_value<0))throw new Error('Carga inválida');if(s.rir!==null&&(typeof s.rir!=='number'||!Number.isFinite(s.rir)||s.rir<0||s.rir>30))throw new Error('RIR inválido');if(s.repetitions!==null&&(!Number.isInteger(s.repetitions)||s.repetitions<0))throw new Error('Repetições inválidas');}
 for(const w of e.weigh_ins)if(!isISODate(w.date)||typeof w.weight_kg!=='number'||!Number.isFinite(w.weight_kg)||w.weight_kg<=0||w.weight_kg>500)throw new Error('Pesagem inválida');}
export function validateLegacy(data){if(!data||data.app!=='treino-evolucao'||!String(data.schema_version).startsWith('2.')||!data.entities||typeof data.entities!=='object')throw new Error('Arquivo não é um estado operacional compatível da Etapa 2.');for(const c of COLLECTIONS)if(!Array.isArray(data.entities[c]))throw new Error('Coleção ausente: '+c);checkRelationships(data.entities);return true;}
export function merged(doc){const result={};for(const c of COLLECTIONS)result[c]=[...(doc.base?.entities?.[c]||[]),...(doc.overlay?.[c]||[])];return result;}
export function validateDocument(doc){if(!doc||doc.format!=='treino-evolucao-android-v1'||doc.version!==1||!doc.overlay||!doc.settings)throw new Error('Formato de backup incompatível.');if(doc.base)validateLegacy(doc.base);for(const c of ['exercises','exercise_variants','sessions','sets','weigh_ins'])if(!Array.isArray(doc.overlay[c]))throw new Error('Coleção local inválida: '+c);if(!Number.isInteger(doc.revision)||doc.revision<0||!Number.isInteger(doc.last_backup_revision)||doc.last_backup_revision<0||doc.last_backup_revision>doc.revision)throw new Error('Revisões do estado inválidas.');if(!Number.isInteger(doc.settings.weekly_goal)||doc.settings.weekly_goal<1||doc.settings.weekly_goal>14)throw new Error('Meta semanal inválida');checkRelationships(merged(doc));validateTemplates(doc);validateRecovery(doc);return true;}
export function commit(doc,mutate){const next=structuredClone(doc);mutate(next);next.revision++;next.updated_at=new Date().toISOString();validateDocument(next);return next;}
export function makeId(prefix){return prefix+'_'+crypto.randomUUID();}
export async function requestDurableStorage(){if(!navigator.storage?.persist)return null;return navigator.storage.persist();}
export async function storageInfo(){return {persistent:navigator.storage?.persisted?await navigator.storage.persisted():null,estimate:navigator.storage?.estimate?await navigator.storage.estimate():null};}
