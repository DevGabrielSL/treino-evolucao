/* Browser-only Google Sheets transport. No token is persisted, logged, or embedded. */
import {previewRemote,stageInbound,planOutbound} from './sheet_sync_core.js';
export const SHEETS_SCOPE='https://www.googleapis.com/auth/spreadsheets';
const SHEETS_ORIGIN='https://sheets.googleapis.com';
let accessToken=null,expiresAt=0;
export function parseSheetId(input){
 const s=String(input||'').trim();const m=s.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);const id=m?.[1]||s;
 if(!/^[A-Za-z0-9_-]{20,}$/.test(id))throw new Error('Informe o link ou ID válido da planilha do Google Sheets.');return id;
}
export function validateClientId(value){const s=String(value||'').trim();if(!/^\d{8,}-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(s))throw new Error('Client ID OAuth de aplicativo Web inválido.');return s;}
async function loadGoogleIdentity(){
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
   callback:response=>{if(response.error||!response.access_token){reject(new Error(response.error_description||response.error||'Autorização do Google não concedida.'));return;}accessToken=response.access_token;expiresAt=Date.now()+Math.max(60,Number(response.expires_in||3600)-90)*1000;resolve(true);},
   error_callback:()=>reject(new Error('Autorização cancelada ou bloqueada pelo navegador.'))});
  client.requestAccessToken({prompt:'consent'});
 });
}
export function authorized(){return !!accessToken&&Date.now()<expiresAt;}
export function disconnect(){accessToken=null;expiresAt=0;}
function auth(){if(!authorized())throw new Error('Autorização expirada. Conecte sua conta Google novamente; dados locais não foram perdidos.');return accessToken;}
async function request(url,{method='GET',body,fetchImpl=fetch}={}){
 const token=auth();const r=await fetchImpl(url,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',redirect:'error'});
 let json={};try{json=await r.json();}catch{}
 if(!r.ok)throw new Error(r.status===401?'A sessão Google expirou. Conecte novamente.':r.status===403?'Sem permissão para esta planilha ou Google Sheets API não ativada.':`Google Sheets recusou a operação (${r.status}). ${String(json?.error?.message||'').slice(0,150)}`);
 return json;
}
export async function fetchTables(sheetId,{fetchImpl=fetch}={}){
 const id=parseSheetId(sheetId);const ranges=["'Treinos'!A:J","'Series'!A:O","'Peso'!A:G"];
 const u=new URL(`${SHEETS_ORIGIN}/v4/spreadsheets/${encodeURIComponent(id)}/values:batchGet`);
 u.searchParams.set('valueRenderOption','FORMATTED_VALUE');for(const v of ranges)u.searchParams.append('ranges',v);
 const raw=await request(u.toString(),{fetchImpl});if(!Array.isArray(raw.valueRanges)||raw.valueRanges.length!==3)throw new Error('A planilha não possui as abas Treinos, Series e Peso com o esquema esperado.');
 return Object.fromEntries(['Treinos','Series','Peso'].map((n,i)=>[n,raw.valueRanges[i].values||[]]));
}
export async function inspectSpreadsheet(sheetId,doc,options={}){
 const rows=await fetchTables(sheetId,options);const preview=previewRemote(doc,rows);const outbound=planOutbound(doc,rows);
 return {rows,preview,pending:Object.fromEntries(Object.entries(outbound).map(([t,v])=>[t,v.length]))};
}
/** Safe transaction plan: append-only. Never overwrite historical A:I/A:N/A:F entries. */
export async function uploadNewRows(sheetId,doc,{fetchImpl=fetch}={}){
 const id=parseSheetId(sheetId);
 const endpoints={Treinos:"'Treinos'!A:J",Series:"'Series'!A:O",Peso:"'Peso'!A:G"};
 const headerNames={Treinos:'ID do aplicativo',Series:'ID do aplicativo',Peso:'ID do aplicativo'};
 const headerCell={Treinos:"'Treinos'!J1",Series:"'Series'!O1",Peso:"'Peso'!G1"};
 let written={Treinos:0,Series:0,Peso:0};
 for(const tab of ['Treinos','Series','Peso']){
  // Re-read the sheet before every append: a lost HTTP response must never create a duplicate on retry.
  let rows=await fetchTables(id,{fetchImpl}),outbound=planOutbound(doc,rows)[tab];
  if(!outbound.length)continue;
  const existingHeader=rows[tab][0]?.[{Treinos:9,Series:14,Peso:6}[tab]];
  if(existingHeader&&existingHeader!==headerNames[tab])throw new Error('Coluna reservada para identificação já está em uso na aba '+tab+'. Não alteramos a planilha.');
  if(!existingHeader){const headUrl=`${SHEETS_ORIGIN}/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(headerCell[tab])}?valueInputOption=RAW`;
   await request(headUrl,{method:'PUT',body:{range:headerCell[tab],majorDimension:'ROWS',values:[[headerNames[tab]]]},fetchImpl});
  }
  for(const item of outbound){
   rows=await fetchTables(id,{fetchImpl});
   outbound=planOutbound(doc,rows)[tab];
   if(!outbound.some(v=>v.id===item.id))continue;
   const url=`${SHEETS_ORIGIN}/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(endpoints[tab])}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
   await request(url,{method:'POST',body:{majorDimension:'ROWS',values:[item.values]},fetchImpl});
   const check=await fetchTables(id,{fetchImpl});
   if(!check[tab].slice(1).some(r=>String(r?.[{Treinos:9,Series:14,Peso:6}[tab]]||'')===item.id))throw new Error('Confirmação de escrita ausente na aba '+tab+'. Verifique a planilha antes de repetir.');
   written[tab]++;
  }
 }
 const after=await fetchTables(id,{fetchImpl});const remaining=planOutbound(doc,after);
 if(Object.values(remaining).some(a=>a.length))throw new Error('Existem registros ainda pendentes na planilha. Tente sincronizar novamente após conferir os dados.');
 return {written,remote:previewRemote(doc,after).remoteCounts};
}