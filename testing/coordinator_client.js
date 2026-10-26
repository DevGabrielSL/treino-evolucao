import {SHEET_ID,COORDINATOR_DEPLOYMENT_ID,COORDINATOR_ENABLED} from './sheets_config.js';
import {planOutbound,mergeKnownRemoteIds} from './sheet_sync_core.js';
import {locateWriteReceipt} from './write_receipt.js';
export function coordinatorReady(){return COORDINATOR_ENABLED===true&&typeof COORDINATOR_DEPLOYMENT_ID==='string'&&/^[A-Za-z0-9_-]{20,200}$/.test(COORDINATOR_DEPLOYMENT_ID);}
function failure(code,message){const e=new Error(message);e.code=code;return e;}
function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export async function operationDigest(op){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(op))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const messages={BUSY:'Outro cliente está sincronizando. Aguarde e tente novamente.',VERSION_CONFLICT:'Conflito de versão entre clientes. A operação foi preservada para revisão.',OPERATION_REUSED:'Conflito no identificador da operação. Revisão necessária.',UNCERTAIN:'O recibo do coordenador não pôde ser confirmado. Envios pausados para revisão.',EXTERNAL_CHANGE:'Alteração externa divergente na planilha. Revisão necessária.',COORDINATOR_DISABLED:'O coordenador está desativado no Google.',NOT_FOUND:'O coordenador ainda não encontrou o recibo solicitado.'};
export function validateCoordinatorResponse(execution){
 if(execution?.error||execution?.done!==true)throw failure('COORDINATOR_EXECUTION_ERROR','Não foi possível executar o coordenador no Google. Confira implantação, autorização e configuração.');
 const result=execution.response?.result;
 if(!result||result.protocol!==1||result.spreadsheetId!==SHEET_ID||result.environment!=='test')throw failure('COORDINATOR_INVALID_RESPONSE','Recibo de outro ambiente ou resposta inválida do coordenador. Revisão necessária.');
 if(result.ok!==true)throw failure('COORDINATOR_'+String(result.code||'ERROR'),messages[result.code]||'O coordenador recusou a operação. Confira a configuração e revise antes de reenviar.');
 return result;
}
function pendingState(doc){
 const state=doc.settings?.sheet_sync?.coordinator_v1;
 if(state===undefined)return {version:1,spreadsheet_id:SHEET_ID,pending:null};
 if(!state||state.version!==1||state.spreadsheet_id!==SHEET_ID||!Object.hasOwn(state,'pending'))throw failure('COORDINATOR_INVALID_QUEUE','Fila de outro destino ou formato inválido. Revisão necessária.');
 if(state.pending!==null){
  const op=state.pending;
  if(!op||op.protocol!==1||op.action!=='append'||typeof op.operationId!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(op.operationId)||!Number.isInteger(op.expectedRevision)||op.expectedRevision<0||!Array.isArray(op.records)||op.records.length<1||op.records.length>20)throw failure('COORDINATOR_INVALID_QUEUE','Operação pendente inválida. Revisão necessária.');
  if(Object.keys(op).some(k=>!['protocol','action','operationId','expectedRevision','records'].includes(k)))throw failure('COORDINATOR_INVALID_QUEUE','Campos desconhecidos na operação pendente. Revisão necessária.');
  const widths={Treinos:10,Series:15,Peso:7};const seen=new Set();
  for(const r of op.records){
   if(!r||!Object.hasOwn(widths,r.tab)||!Array.isArray(r.values)||r.values.length!==widths[r.tab]||r.values.some(v=>v!==null&&typeof v!=='string'&&(typeof v!=='number'||!Number.isFinite(v))))throw failure('COORDINATOR_INVALID_QUEUE','Registro pendente inválido. Revisão necessária.');
   const id=r.values.at(-1),key=r.tab+':'+id;if(typeof id!=='string'||!id||seen.has(key))throw failure('COORDINATOR_INVALID_QUEUE','Identidade pendente inválida. Revisão necessária.');seen.add(key);
   if(r.tab==='Peso'&&(r.values[3]!==''||r.values[4]!==''))throw failure('COORDINATOR_INVALID_QUEUE','A operação tentaria escrever nas fórmulas de pesagem. Revisão necessária.');
  }
 }
 return structuredClone(state);
}
function snapshot(result){
 if(!Number.isInteger(result.revision)||result.revision<0||!result.rows||['Treinos','Series','Peso'].some(t=>!Array.isArray(result.rows[t])))throw failure('COORDINATOR_INVALID_SNAPSHOT','Leitura inconsistente do coordenador. Revisão necessária.');
 return result;
}
/** Persistent operation queue. A pending request is replayed unchanged; success
 * is based on its captured values, never on a newer document revision.
 */
export async function runCoordinatorUpload(doc,{call,onState,onCheckpoint,verifyRows,makeOperationId=()=>crypto.randomUUID().replaceAll('-','')}={}){
 if(typeof call!=='function'||typeof onState!=='function'||typeof onCheckpoint!=='function'||typeof verifyRows!=='function')throw failure('COORDINATOR_PERSISTENCE_REQUIRED','A sincronização coordenada exige persistência da fila e dos recibos no dispositivo.');
 let local=structuredClone(doc),state=pendingState(local),written={Treinos:0,Series:0,Peso:0};
 const saveState=async next=>{try{await onState(structuredClone(next));}catch{throw failure('COORDINATOR_LOCAL_STORAGE','Recibo e fila não puderam ser salvos no dispositivo. Revisão necessária.');}state=structuredClone(next);local.settings.sheet_sync={...local.settings.sheet_sync,coordinator_v1:structuredClone(state)};};
 const saveKnown=async rows=>{const ledger=mergeKnownRemoteIds(local,rows);if(JSON.stringify(ledger)===JSON.stringify(local.settings.sheet_sync?.known_remote_ids_v1))return;try{await onCheckpoint(structuredClone(ledger));}catch{throw failure('COORDINATOR_LOCAL_STORAGE','Recibo de IDs não pôde ser salvo no dispositivo. Revisão necessária.');}local.settings.sheet_sync={...local.settings.sheet_sync,known_remote_ids_v1:ledger};};
 let current;
 for(let batches=0;batches<50;batches++){
  if(state.pending){
   const op=structuredClone(state.pending),reply=await call(op),receipt=reply.receipt;
   if(!receipt||receipt.operationId!==op.operationId||receipt.digest!==await operationDigest(op)||receipt.revision!==op.expectedRevision+1||!Array.isArray(receipt.applied))throw failure('COORDINATOR_INVALID_RECEIPT','Recibo divergente do conteúdo capturado da operação. Revisão necessária.');
   const expected=new Set(op.records.map(r=>r.tab+':'+r.values.at(-1))),applied=new Set();
   for(const r of receipt.applied){const key=r?.tab+':'+r?.id;if(!expected.has(key)||applied.has(key))throw failure('COORDINATOR_INVALID_RECEIPT','Recibo com identidades divergentes. Revisão necessária.');applied.add(key);}
   current=snapshot(await call({protocol:1,action:'read'}));
   if(current.revision<receipt.revision)throw failure('COORDINATOR_INVALID_RECEIPT','Leitura anterior ao recibo. Revisão necessária.');
   for(const r of op.records){const receiptRow=locateWriteReceipt(r.tab,current.rows[r.tab],{id:r.values.at(-1),values:r.values},r.tab==='Peso'?{columns:[0,1,2,5,6]}:undefined);if(receiptRow.status!=='confirmed')throw failure('COORDINATOR_INVALID_RECEIPT','Registro do recibo desapareceu. Revisão necessária.');}
   await saveKnown(current.rows);
   await saveState({...state,pending:null});
   for(const r of receipt.applied)written[r.tab]++;
  }else current=snapshot(await call({protocol:1,action:'read'}));
  verifyRows(local,current.rows);await saveKnown(current.rows);
  const plan=planOutbound(local,current.rows),records=Object.entries(plan).flatMap(([tab,items])=>items.map(item=>{const values=structuredClone(item.values);if(tab==='Peso'){values[3]='';values[4]='';}return {tab,values};}));
  if(!records.length)return {written,remote:Object.fromEntries(['Treinos','Series','Peso'].map(t=>[t,current.rows[t].slice(1).filter(r=>String(r?.[0]??'').trim()).length]))};
  const next={...state,pending:{protocol:1,action:'append',operationId:makeOperationId(),expectedRevision:current.revision,records:records.slice(0,20)}};
  // Validate generated operations with the same rules used after recovery.
  pendingState({settings:{sheet_sync:{coordinator_v1:next}}});
  await saveState(next);
 }
 throw failure('COORDINATOR_BATCH_LIMIT','Há operações preservadas na fila. O limite desta tentativa foi atingido; confira os recibos antes de prosseguir.');
}
