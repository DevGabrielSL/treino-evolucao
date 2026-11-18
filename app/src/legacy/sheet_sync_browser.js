import {recoverCoordinatorExchange} from './principal_transport.js';
import {SHEET_ID as PRODUCTION_SHEET_ID} from './sheets_config.js';
export const COORDINATOR_GATE_MESSAGE='Envios pausados: a proteção entre aparelhos aguarda configuração. Os registros continuam salvos neste dispositivo; você pode conferir e importar a planilha.';
import {coordinatorReady,runCoordinatorUpload,validateCoordinatorResponse} from './coordinator_client.js';
import {COORDINATOR_DEPLOYMENT_ID} from './sheets_config.js';
import {assertKnownRemoteIds,mergeKnownRemoteIds} from './sheet_sync_core.js';
import {locateWriteReceipt} from './write_receipt.js';
import {parseCoachPlanRows} from './coach_plan_read.js';
/* Google access token lives in this browser tab session only. */
import {previewRemote,stageInbound,planOutbound,detectOutboundDrift,sessionValues,setValues,weightValues} from './sheet_sync_core.js';
export const SHEETS_SCOPE='https://www.googleapis.com/auth/spreadsheets'+(coordinatorReady()?' https://www.googleapis.com/auth/userinfo.email':'');
const SHEETS_ORIGIN='https://sheets.googleapis.com';
let accessToken=null,expiresAt=0;
const SESSION_KEY='treino-evolucao-google-token-v1';
function clearSessionToken(){try{globalThis.sessionStorage?.removeItem(SESSION_KEY);}catch{}}
function saveSessionToken(){try{globalThis.sessionStorage?.setItem(SESSION_KEY,JSON.stringify({token:accessToken,expiresAt,scope:SHEETS_SCOPE}));}catch{}}
function restoreSessionToken(){
 try{
  const raw=globalThis.sessionStorage?.getItem(SESSION_KEY);if(!raw)return;
  const v=JSON.parse(raw);
  if(typeof v.token!=='string'||!v.token||v.token.length>8192||!Number.isFinite(v.expiresAt)||v.expiresAt<=Date.now()||v.scope!==SHEETS_SCOPE){clearSessionToken();return;}
  accessToken=v.token;expiresAt=v.expiresAt;
 }catch{clearSessionToken();}
}
restoreSessionToken();
export function parseSheetId(input){
 const s=String(input||'').trim();const m=s.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);const id=m?.[1]||s;
 if(!/^[A-Za-z0-9_-]{20,}$/.test(id))throw new Error('Informe o link ou ID válido da planilha do Google Sheets.');if(id!==PRODUCTION_SHEET_ID)throw new Error('Destino diferente da planilha principal.');return id;
}
export function validateClientId(value){const s=String(value||'').trim();if(!/^\d{8,}-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(s))throw new Error('Client ID OAuth de aplicativo Web inválido.');return s;}
export async function loadGoogleIdentity(){
 if(globalThis.google?.accounts?.oauth2)return;
 if(!globalThis.document)throw new Error('A autorização Google exige navegador.');
 await new Promise((resolve,reject)=>{
  const e=document.createElement('script');e.src='https://accounts.google.com/gsi/client';e.async=true;e.onload=resolve;e.onerror=()=>reject(new Error('Não foi possível carregar o login do Google. Verifique a conexão.'));document.head.appendChild(e);
 });
 if(!globalThis.google?.accounts?.oauth2)throw new Error('Google Identity Services indisponível.');
}
/** Must be invoked by explicit user tap to avoid popup blocking. */
export async function authorize(clientId){
 validateClientId(clientId);if(!globalThis.navigator?.onLine)throw new Error('Conecte-se à internet para autorizar o Google Sheets.');
 await loadGoogleIdentity();
 return new Promise((resolve,reject)=>{
  const client=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:SHEETS_SCOPE,
   callback:response=>{if(response.error||!response.access_token){reject(new Error(response.error_description||response.error||'Autorização do Google não concedida.'));return;}const seconds=Number(response.expires_in);if(!Number.isFinite(seconds)||seconds<=0){reject(new Error('Prazo da autorização Google inválido.'));return;}accessToken=response.access_token;expiresAt=Date.now()+Math.max(0,seconds-Math.min(90,seconds/10))*1000;saveSessionToken();resolve(true);},
   error_callback:()=>reject(new Error('Autorização cancelada ou bloqueada pelo navegador.'))});
  client.requestAccessToken({prompt:''});
 });
}
export function authorized(){if(accessToken&&Date.now()>=expiresAt)disconnect();return !!accessToken;}
export function disconnect(){accessToken=null;expiresAt=0;clearSessionToken();}
function auth(){if(!authorized())throw new Error('Autorização expirada. Conecte sua conta Google novamente; dados locais não foram perdidos.');return accessToken;}
async function request(url,{method='GET',body,fetchImpl=fetch}={}){
 const token=auth();const r=await fetchImpl(url,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',redirect:'error'});
 let json={};try{json=await r.json();}catch{}
 if(r.status===401)disconnect();
 if(!r.ok){
  const service=new URL(url).hostname==='script.googleapis.com'?'Apps Script':'Google Sheets';
  const reason=typeof json?.error?.details?.[0]?.reason==='string'?json.error.details[0].reason:'';
  let detail=typeof json?.error?.message==='string'?json.error.message:'';
  detail=detail.split(token).join('[removido]').replace(/Bearer\s+\S+/gi,'Bearer [removido]').slice(0,350);
  if(r.status===401)throw new Error('A sessão Google expirou. Conecte novamente.');
  throw new Error(service+' recusou a solicitação ('+r.status+').'+(reason?' Motivo: '+reason.slice(0,80)+'.':'')+(detail?' '+detail:''));
 }
 return json;
}
/** One response supplies displayed dates/text and effective numeric values from
 * each cell. Never join separate snapshots by row position. This is a read,
 * not a transaction lock against later edits by other clients.
 */
export async function fetchTables(sheetId,{fetchImpl=fetch}={}){
 if(coordinatorReady()){parseSheetId(sheetId);const result=await callCoordinator({protocol:1,action:'read'},{fetchImpl});return result.rows;}
 const id=parseSheetId(sheetId),widths={Treinos:10,Series:15,Peso:7};
 const numeric={Treinos:new Set([4,5,6,7]),Series:new Set([5,6,8,9,10,11]),Peso:new Set([1,2,3,4])};
 const url=new URL(SHEETS_ORIGIN+'/v4/spreadsheets/'+encodeURIComponent(id));
 for(const range of ["'Treinos'!A:J","'Series'!A:O","'Peso'!A:G"])url.searchParams.append('ranges',range);
 url.searchParams.set('fields','sheets(properties(title),data(startRow,startColumn,rowData(values(formattedValue,effectiveValue))))');
 const response=await request(url.toString(),{fetchImpl});
 const invalid=detail=>new Error('Leitura inconsistente ou incompleta da planilha: '+detail+'. Nenhum dado desta resposta será importado.');
 if(!Array.isArray(response.sheets))throw invalid('abas ausentes');
 const result={};
 for(const [name,width] of Object.entries(widths)){
  const matches=response.sheets.filter(s=>s?.properties?.title===name);
  if(matches.length!==1)throw invalid('aba ausente ou duplicada: '+name);
  const blocks=matches[0].data;
  if(!Array.isArray(blocks)||blocks.length!==1)throw invalid('intervalo ausente ou ambíguo: '+name);
  const block=blocks[0];
  if(!block||typeof block!=='object'||(block.startRow??0)!==0||(block.startColumn??0)!==0)throw invalid('origem do intervalo: '+name);
  const rows=block.rowData??[];
  if(!Array.isArray(rows))throw invalid('linhas inválidas: '+name);
  result[name]=rows.map((row,r)=>{
   if(!row||typeof row!=='object')throw invalid('linha inválida: '+name);
   const cells=row.values??[];
   if(!Array.isArray(cells)||cells.length>width)throw invalid('colunas inválidas: '+name);
   return cells.map((cell,c)=>{
    if(!cell||typeof cell!=='object'||Array.isArray(cell))throw invalid('célula inválida: '+name);
    const effective=cell.effectiveValue;
    const formatted=cell.formattedValue;
    if(formatted!==undefined&&typeof formatted!=='string')throw invalid('texto inválido: '+name);
    if(effective!==undefined&&(!effective||typeof effective!=='object'||Array.isArray(effective)))throw invalid('valor inválido: '+name);
    if(effective?.errorValue)throw invalid('erro de fórmula ou célula: '+name+' linha '+(r+1));
    const kinds=['numberValue','stringValue','boolValue'].filter(k=>effective?.[k]!==undefined);
    if(kinds.length>1)throw invalid('valor ambíguo: '+name);
    if(effective?.numberValue!==undefined&&(typeof effective.numberValue!=='number'||!Number.isFinite(effective.numberValue)))throw invalid('número inválido: '+name);
    if(effective?.stringValue!==undefined&&typeof effective.stringValue!=='string')throw invalid('valor textual inválido: '+name);
    if(r>0&&numeric[name].has(c)){
     if(effective?.numberValue!==undefined)return effective.numberValue;
     if(effective?.stringValue!==undefined)return effective.stringValue;
     if(effective?.boolValue!==undefined||formatted)throw invalid('número ausente: '+name+' linha '+(r+1));
     return '';
    }
    if(formatted!==undefined)return formatted;
    if(effective?.stringValue!==undefined)return effective.stringValue;
    if(kinds.length)throw invalid('valor exibido ausente: '+name+' linha '+(r+1));
    return '';
   });
  });
  // Match Values API trimming without removing interior blank rows/columns.
  for(const row of result[name])while(row.length&&row.at(-1)==='')row.pop();
  while(result[name].length&&result[name].at(-1).length===0)result[name].pop();
 }
 return result;
}

/** Read-only Google API request. User-specific Plan data stays in browser state.
 * The returned rows are parsed, not written to the public code.
 */
export async function fetchCoachPlanRows(sheetId,{fetchImpl=fetch}={}){
 const id=parseSheetId(sheetId);
 const range="'Plano'!A1:I40";
 const url=SHEETS_ORIGIN+'/v4/spreadsheets/'+encodeURIComponent(id)+'/values/'+encodeURIComponent(range)+'?valueRenderOption=FORMATTED_VALUE';
 const response=await request(url,{fetchImpl});
 return parseCoachPlanRows(response.values||[]);
}
export async function inspectSpreadsheet(sheetId,doc,options={}){
 const rows=await fetchTables(sheetId,options);
 verifyPreviouslySent(doc,rows);
 const preview=previewRemote(doc,rows);
 // First stage reconciled remote edits without mutating the live document.
 // Planning outbound against the stale document would reject legitimate
 // changes in the Sheet before the app has a chance to import them.
 const staged=stageInbound(doc,rows);
 const outbound=planOutbound(staged.next,rows);
 return {rows,preview,reconciled:staged.reconciled,pending:Object.fromEntries(Object.entries(outbound).map(([t,v])=>[t,v.length]))};
}
/** Safe transaction plan: append-only. Never overwrite historical A:I/A:N/A:F entries. */
/** Read-only preview. No header, row, or token is written to Google.
 * Always re-fetch immediately before any subsequent upload.
 */
export async function previewUpload(sheetId,doc,{fetchImpl=fetch}={}){
 const rows=await fetchTables(sheetId,{fetchImpl});
 verifyPreviouslySent(doc,rows);
 const drift=detectOutboundDrift(doc,rows);
 if(drift.length)throw new Error('Há divergência em '+drift.length+' registro(s) já enviados. Revise antes de continuar.');
 const pending=planOutbound(doc,rows);
 return {pending,counts:Object.fromEntries(Object.entries(pending).map(([name,items])=>[name,items.length])),remote:previewRemote(doc,rows).remoteCounts};
}
/** Confirm previously submitted app records before planning anything new.
 * Full-value receipts apply on immediate append; for a previously written
 * weigh-in, derived delta columns (D/E) may depend on later history edits.
 */
function verifyPreviouslySent(doc,rows){
 assertKnownRemoteIds(doc,rows);
 const lookup={
  Treinos:{list:doc.overlay.sessions,make:x=>sessionValues(x)},
  Series:{list:doc.overlay.sets,make:x=>setValues(x,{
   sessions:[...(doc.base?.entities?.sessions||[]),...doc.overlay.sessions],
   exercises:[...(doc.base?.entities?.exercises||[]),...doc.overlay.exercises],
   exercise_variants:[...(doc.base?.entities?.exercise_variants||[]),...doc.overlay.exercise_variants]})},
  Peso:{list:doc.overlay.weigh_ins,make:x=>weightValues(x,{
   initial:rows.Peso[1]?.[1]==null||String(rows.Peso[1][1]).trim()===''?null:Number(String(rows.Peso[1][1]).replace(',','.')),
   goal:rows.Peso[1]?.[2]==null||String(rows.Peso[1][2]).trim()===''?null:Number(String(rows.Peso[1][2]).replace(',','.'))})}
 };
 for(const [tab,{list,make}] of Object.entries(lookup)){
  const idColumn={Treinos:9,Series:14,Peso:6}[tab];
  const ids=new Set(rows[tab].slice(1).map(r=>String(r?.[idColumn]??'').trim()).filter(Boolean));
  for(const local of list){
   if(local.provenance?.sheet||!ids.has(local.id))continue;
   const columns=tab==='Peso'?[0,1,2,5,6]:undefined;
   const receipt=locateWriteReceipt(tab,rows[tab],{id:local.id,values:make(local)},columns?{columns}:undefined);
   if(tab==='Peso')checkWeightFormulaHealth(rows.Peso,receipt);
  }
 }
}
const activeUploads=new Set();
/** Append one weigh-in without writing D/E, which are ARRAYFORMULA cells.
 * appendCells may jump to row 501 because the array formula fills the grid;
 * values.append A:G writes over the formula spill and yields #REF!.
 * We target only A:C and F:G in a single batch request after re-reading.
 */
async function writeWeightPreservingFormulas(sheetId,rows,item,{fetchImpl=fetch}={}){
 const tab=rows.Peso;
 let lastDataRow=1;
 for(let i=1;i<tab.length;i++)if(String(tab[i]?.[0]??'').trim())lastDataRow=i+1;
 const rowNumber=lastDataRow+1;
 const at=tab[rowNumber-1]||[];
 if([0,1,2,5,6].some(k=>String(at[k]??'').trim()))
  throw new Error('A linha de pesagem foi preenchida por outra operação. Recarregue os dados antes de reenviar.');
 // A native ARRAYFORMULA begins at D3/E3 in the original workbook.
 // Never touch the computed columns, including with an empty string.
 const data=[
  {range:"'Peso'!A"+rowNumber+":C"+rowNumber,majorDimension:'ROWS',values:[[item.values[0],item.values[1],item.values[2]]]},
  {range:"'Peso'!F"+rowNumber+":G"+rowNumber,majorDimension:'ROWS',values:[[item.values[5],item.values[6]]]}
 ];
 const url=SHEETS_ORIGIN+'/v4/spreadsheets/'+encodeURIComponent(sheetId)+'/values:batchUpdate';
 return request(url,{method:'POST',body:{valueInputOption:'RAW',data},fetchImpl});
}
function checkWeightFormulaHealth(tab,receipt){
 if(receipt.status!=='confirmed')return;
 // Formula origin at D3/E3 can fail while the newly written row has numbers.
 // Check both the formula anchor and the confirmed data row.
 const positions=[2,receipt.row-1];
 for(const index of new Set(positions)){
  const row=tab[index]||[];
  for(const c of [3,4]){
   const val=String(row[c]??'');
   if(/^#(REF!|ERROR!|VALUE!|SPILL!)/i.test(val))
    throw new Error('A fórmula de pesagem foi danificada no Google Sheets (linha '+(index+1)+', coluna '+(c+1)+'). Envio interrompido para revisão.');
  }
 }
}
async function uploadNewRowsUnlocked(sheetId,doc,{fetchImpl=fetch,onCheckpoint}={}){
 const id=parseSheetId(sheetId);
 let checkpointDoc=doc;
 async function persistLedger(ledger){
  if(JSON.stringify(ledger)===JSON.stringify(checkpointDoc.settings.sheet_sync?.known_remote_ids_v1))return;
  if(typeof onCheckpoint!=='function')return;
  try{await onCheckpoint(structuredClone(ledger));}
  catch(error){throw new Error('Recibo de IDs não pôde ser salvo no dispositivo. Envio interrompido para revisão: '+String(error?.message||error).slice(0,120));}
  checkpointDoc=structuredClone(checkpointDoc);
  checkpointDoc.settings.sheet_sync={...checkpointDoc.settings.sheet_sync,known_remote_ids_v1:ledger};
 }
 async function checkpoint(rows){await persistLedger(mergeKnownRemoteIds(checkpointDoc,rows));}
 async function checkpointReceipt(tab,id){
  const ledger=structuredClone(checkpointDoc.settings.sheet_sync.known_remote_ids_v1);
  ledger.ids[tab]=[...new Set([...ledger.ids[tab],id])].sort();
  await persistLedger(ledger);
 }


 const endpoints={Treinos:"'Treinos'!A:J",Series:"'Series'!A:O",Peso:"'Peso'!A:G"};
 const headerNames={Treinos:'ID do aplicativo',Series:'ID do aplicativo',Peso:'ID do aplicativo'};
 const headerCell={Treinos:"'Treinos'!J1",Series:"'Series'!O1",Peso:"'Peso'!G1"};
 let written={Treinos:0,Series:0,Peso:0};
 for(const tab of ['Treinos','Series','Peso']){
  // Re-read the sheet before every append: a lost HTTP response must never create a duplicate on retry.
  let rows=await fetchTables(id,{fetchImpl});
  verifyPreviouslySent(checkpointDoc,rows);
  const drift=detectOutboundDrift(checkpointDoc,rows);if(drift.length)throw new Error('Alterações em registros já enviados precisam de revisão antes de sincronizar: '+drift.map(x=>x.tab+' '+x.id).join(', ').slice(0,180));
  let outbound=planOutbound(checkpointDoc,rows)[tab];
  await checkpoint(rows);
  if(!outbound.length)continue;
  if(typeof onCheckpoint!=='function')throw new Error('A gravação exige salvar a referência dos IDs no dispositivo antes do envio. Revisão necessária.');
  const existingHeader=rows[tab][0]?.[{Treinos:9,Series:14,Peso:6}[tab]];
  if(existingHeader&&existingHeader!==headerNames[tab])throw new Error('Coluna reservada para identificação já está em uso na aba '+tab+'. Não alteramos a planilha.');
  if(!existingHeader){const headUrl=`${SHEETS_ORIGIN}/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(headerCell[tab])}?valueInputOption=RAW`;
   await request(headUrl,{method:'PUT',body:{range:headerCell[tab],majorDimension:'ROWS',values:[[headerNames[tab]]]},fetchImpl});
  }
  for(const item of outbound){
   rows=await fetchTables(id,{fetchImpl});
   verifyPreviouslySent(checkpointDoc,rows);
   const changed=detectOutboundDrift(checkpointDoc,rows);if(changed.length)throw new Error('Encontradas alterações em linhas já sincronizadas. Envio interrompido.');
   outbound=planOutbound(checkpointDoc,rows)[tab];
   if(!outbound.some(v=>v.id===item.id))continue;
   const url=`${SHEETS_ORIGIN}/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(endpoints[tab])}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
   let appendError=null;
   try{
    if(tab==='Peso') await writeWeightPreservingFormulas(id,rows,item,{fetchImpl});
    else await request(url,{method:'POST',body:{majorDimension:'ROWS',values:[item.values]},fetchImpl});
   }catch(error){appendError=error;}
   // Regardless of the HTTP response, only a fresh read counts as a receipt.
   // A dropped response can follow a successful append. Never blindly POST
   // the same item twice within this attempt.
   let check;
   try{check=await fetchTables(id,{fetchImpl});}
   catch(error){
    throw new Error('O resultado do envio de '+tab+' não pôde ser confirmado pela leitura da planilha. Não repetimos o envio automaticamente. Confira a planilha antes de tentar de novo.');
   }
   const receipt=locateWriteReceipt(tab,check[tab],item,tab==='Peso'?{columns:[0,1,2,5,6]}:undefined);

   if(receipt.status==='absent'){
    if(appendError)throw new Error('Envio de '+tab+' não confirmado no Google Sheets ('+String(appendError.message).slice(0,130)+'). Registro local preservado para uma próxima tentativa.');
    throw new Error('O Google respondeu ao envio, mas não encontramos o ID na planilha ('+tab+'). Não foi marcada confirmação.');
   }
   await checkpointReceipt(tab,item.id);
   if(tab==='Peso')checkWeightFormulaHealth(check.Peso,receipt);
   verifyPreviouslySent(checkpointDoc,check);
   await checkpoint(check);
   written[tab]++;
  }
 }
 const after=await fetchTables(id,{fetchImpl});
 verifyPreviouslySent(checkpointDoc,after);
 const drift=detectOutboundDrift(checkpointDoc,after);
 await checkpoint(after);
 if(drift.length)throw new Error('Dados divergentes após gravação no Google Sheets. Verifique a planilha antes de tentar novamente: '+drift.map(x=>x.tab+' '+x.id).join(', ').slice(0,180));
 const remaining=planOutbound(checkpointDoc,after);
 if(Object.values(remaining).some(a=>a.length))throw new Error('Existem registros ainda pendentes na planilha. Tente sincronizar novamente após conferir os dados.');
 return {written,remote:previewRemote(checkpointDoc,after).remoteCounts};
}
/** Prevent concurrent submissions in one window. When supported, the Web
 * Locks API also protects separate tabs of this origin on this device.
 * Cross-device writes remain non-atomic and require server-side ID checks.
 */
export async function uploadNewRows(sheetId,doc,options={}){
 parseSheetId(sheetId);
 if(!coordinatorReady()){const blocked=new Error(COORDINATOR_GATE_MESSAGE);blocked.code='COORDINATOR_REQUIRED';throw blocked;}
 const coordinatorKey=parseSheetId(sheetId);
 if(activeUploads.has(coordinatorKey))throw new Error('Outro envio ao Google Sheets já está em andamento neste aplicativo.');
 activeUploads.add(coordinatorKey);
 try{return await runCoordinatorUpload(doc,{call:op=>callCoordinator(op,{fetchImpl:options.fetchImpl||fetch}),onState:options.onState,onCheckpoint:options.onCheckpoint,verifyRows:verifyPreviouslySent});}finally{activeUploads.delete(coordinatorKey);}
 const id=parseSheetId(sheetId);
 if(activeUploads.has(id))throw new Error('Outro envio ao Google Sheets já está em andamento neste aplicativo.');
 activeUploads.add(id);
 try{
  if(globalThis.navigator?.locks?.request){
   return await navigator.locks.request('treino-evolucao-sheets-upload-'+id,
    {mode:'exclusive',ifAvailable:true},async lock=>{
     if(!lock)throw new Error('O Google Sheets já está sendo sincronizado em outra aba deste dispositivo.');
     return uploadNewRowsUnlocked(id,doc,options);
    });
  }
  return await uploadNewRowsUnlocked(id,doc,options);
 }finally{activeUploads.delete(id);}
}

async function callCoordinator(operation,{fetchImpl=fetch}={}){
 if(!coordinatorReady())throw new Error(COORDINATOR_GATE_MESSAGE);
 const execution=await recoverCoordinatorExchange(operation,captured=>request('https://script.googleapis.com/v1/scripts/'+encodeURIComponent(COORDINATOR_DEPLOYMENT_ID)+':run',{method:'POST',body:{function:'coordinateSync',parameters:[captured],devMode:false},fetchImpl}));
 const result=validateCoordinatorResponse(execution);
 if(operation.action==='read'){
  if(!Number.isInteger(result.revision)||result.revision<0||!result.rows||['Treinos','Series','Peso'].some(t=>!Array.isArray(result.rows[t])))throw new Error('Leitura inconsistente do coordenador. Revisão necessária.');
 }
 return result;
}
