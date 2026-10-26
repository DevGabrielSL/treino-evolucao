from pathlib import Path
root=Path(__file__).resolve().parents[1];dest=root/'dist/testes'
message='Envios de testes pausados: a proteção entre aparelhos aguarda configuração. Os registros continuam salvos neste dispositivo; você pode conferir e importar a planilha.'
(dest/'coordinator_client.js').write_text((root/'testing/coordinator_client.js').read_text())
p=dest/'sheets_config.js';p.write_text(p.read_text()+"\n// Deployment is intentionally absent until account setup and real validation.\nexport const COORDINATOR_DEPLOYMENT_ID='';\nexport const COORDINATOR_ENABLED=false;\n")
for name in ['sw.js','integrity.js']:
 p=dest/name;s=p.read_text();assert s.count("'./app.js'")==1;p.write_text(s.replace("'./app.js'","'./coordinator_client.js','./app.js'"))
p=dest/'sheet_sync_browser.js';s=p.read_text();s="import {coordinatorReady,runCoordinatorUpload,validateCoordinatorResponse} from './coordinator_client.js';\nimport {COORDINATOR_DEPLOYMENT_ID} from './sheets_config.js';\n"+s
needle="export const SHEETS_SCOPE='https://www.googleapis.com/auth/spreadsheets';";assert s.count(needle)==1;s=s.replace(needle,"export const SHEETS_SCOPE='https://www.googleapis.com/auth/spreadsheets'+(coordinatorReady()?' https://www.googleapis.com/auth/userinfo.email':'');")
needle='export async function fetchTables(sheetId,{fetchImpl=fetch}={}){';assert s.count(needle)==1;s=s.replace(needle,needle+"\n if(coordinatorReady()){parseSheetId(sheetId);const result=await callCoordinator({protocol:1,action:'read'},{fetchImpl});return result.rows;}")
needle='export async function uploadNewRows(sheetId,doc,options={}){';assert s.count(needle)==1;s=s.replace(needle,needle+"\n parseSheetId(sheetId);\n if(!coordinatorReady()){const blocked=new Error(COORDINATOR_GATE_MESSAGE);blocked.code='COORDINATOR_REQUIRED';throw blocked;}\n const coordinatorKey=parseSheetId(sheetId);\n if(activeUploads.has(coordinatorKey))throw new Error('Outro envio ao Google Sheets já está em andamento neste aplicativo.');\n activeUploads.add(coordinatorKey);\n try{return await runCoordinatorUpload(doc,{call:op=>callCoordinator(op,{fetchImpl:options.fetchImpl||fetch}),onState:options.onState,onCheckpoint:options.onCheckpoint,verifyRows:verifyPreviouslySent});}finally{activeUploads.delete(coordinatorKey);}")
s="export const COORDINATOR_GATE_MESSAGE="+repr(message)+";\n"+s
s+='''
async function callCoordinator(operation,{fetchImpl=fetch}={}){
 if(!coordinatorReady())throw new Error(COORDINATOR_GATE_MESSAGE);
 const execution=await request('https://script.googleapis.com/v1/scripts/'+encodeURIComponent(COORDINATOR_DEPLOYMENT_ID)+':run',{method:'POST',body:{function:'coordinateSync',parameters:[operation],devMode:false},fetchImpl});
 const result=validateCoordinatorResponse(execution);
 if(operation.action==='read'){
  if(!Number.isInteger(result.revision)||result.revision<0||!result.rows||['Treinos','Series','Peso'].some(t=>!Array.isArray(result.rows[t])))throw new Error('Leitura inconsistente do coordenador. Revisão necessária.');
 }
 return result;
}
''';p.write_text(s)
p=dest/'automatic_sync.js';s=p.read_text();s="import {coordinatorReady} from './coordinator_client.js';\n"+s;needle="if(!doc||!state?.auto)return {allowed:false,reason:'disabled'};";assert s.count(needle)==1;s=s.replace(needle,needle+"\n if(!coordinatorReady())return {allowed:false,reason:'coordinator_unavailable'};");p.write_text(s)
p=dest/'app.js';s=p.read_text();s="import {coordinatorReady} from './coordinator_client.js';\nimport {COORDINATOR_GATE_MESSAGE} from './sheet_sync_browser.js';\n"+s
needle='return panel(`<h2>Sincronização com Google Sheets</h2>';assert s.count(needle)==1;s=s.replace(needle,needle+'<p class="surface warn" role="status">${e(coordinatorReady()?\'Sincronização coordenada em validação no ambiente de testes.\':COORDINATOR_GATE_MESSAGE)}</p>')
needle='<button class="btn dark block mt" data-action="sheets-sync"';assert s.count(needle)==1;s=s.replace(needle,'<button class="btn dark block mt" data-action="sheets-import-readonly" ${!authorized()||sheetsBusy?\'disabled\':\'\'}>Importar novidades da planilha</button>\n <button ${!coordinatorReady()?\'disabled\':\'\'} class="btn dark block mt" data-action="sheets-sync"')
s=s.replace('<button class="btn block mt" data-action="sheets-auto"','<button ${!coordinatorReady()?\'disabled\':\'\'} class="btn block mt" data-action="sheets-auto"')
needle=" if(a==='sheets-sync'){await sheetsSyncNow();return;}";assert s.count(needle)==1;s=s.replace(needle," if(a==='sheets-import-readonly'){await sheetsImportReadOnly();return;}\n if((a==='sheets-sync'||a==='sheets-auto')&&!coordinatorReady())return error(new Error(COORDINATOR_GATE_MESSAGE));\n"+needle)
needle='async function sheetsSyncNow({automatic=false}={}){';assert s.count(needle)==1
helper='''async function saveCoordinatorState(state){
 const next=commit(doc,d=>{d.settings.sheet_sync={...d.settings.sheet_sync,coordinator_v1:structuredClone(state)};});
 const generation=await saveSnapshot(next,storageGeneration);doc=next;storageGeneration=generation;
}
async function sheetsImportReadOnly(){
 if(busy||sheetsBusy)return notify('Já existe uma operação em andamento.');
 sheetsBusy=true;sheetsError='';render();
 try{
  const check=await sheetsInspect(),incoming=stageInbound(doc,check.rows);
  validateDocument(incoming.next);
  const next=commit(doc,d=>{d.base=incoming.next.base;d.overlay=incoming.next.overlay;});
  const generation=await saveSnapshot(next,storageGeneration,{preservePrevious:true});
  doc=next;storageGeneration=generation;recoveryAvailable=await hasRecovery();
  notify('Importação salva no dispositivo. Nenhum registro foi enviado para a planilha.');
 }catch(err){sheetsError=err.message||String(err);error(err);}
 finally{sheetsBusy=false;render();}
}
'''
s=s.replace(needle,helper+needle+"\n if(!coordinatorReady()){sheetsError=COORDINATOR_GATE_MESSAGE;notify(sheetsError);render();return false;}")
needle='{onCheckpoint:saveKnownRemoteIds}';assert s.count(needle)==1;s=s.replace(needle,'{onCheckpoint:saveKnownRemoteIds,onState:saveCoordinatorState}')
p.write_text(s)
