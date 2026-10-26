from pathlib import Path
root=Path(__file__).resolve().parents[1];dest=root/'dist/testes'
message='Envios de testes pausados: a proteção entre aparelhos aguarda configuração. Os registros continuam salvos neste dispositivo; você pode conferir e importar a planilha.'
p=dest/'sheet_sync_browser.js';s=p.read_text();needle='export async function uploadNewRows(sheetId,doc,options={}){';assert s.count(needle)==1
s=s.replace(needle,needle+"\n const blocked=new Error(COORDINATOR_GATE_MESSAGE);blocked.code='COORDINATOR_REQUIRED';throw blocked;")
s="export const COORDINATOR_GATE_MESSAGE="+repr(message)+";\n"+s;p.write_text(s)
p=dest/'automatic_sync.js';s=p.read_text();needle="if(!doc||!state?.auto)return {allowed:false,reason:'disabled'};";assert s.count(needle)==1;s=s.replace(needle,needle+"\n return {allowed:false,reason:'coordinator_unavailable'};");p.write_text(s)
p=dest/'app.js';s=p.read_text();s="import {COORDINATOR_GATE_MESSAGE} from './sheet_sync_browser.js';\n"+s
needle='return panel(`<h2>Sincronização com Google Sheets</h2>';assert s.count(needle)==1;s=s.replace(needle,needle+'<p class="surface warn" role="status">${e(COORDINATOR_GATE_MESSAGE)}</p>')
needle='<button class="btn dark block mt" data-action="sheets-sync"';assert s.count(needle)==1;s=s.replace(needle,'<button class="btn dark block mt" data-action="sheets-import-readonly" ${!authorized()||sheetsBusy?\'disabled\':\'\'}>Importar novidades da planilha</button>\n <button disabled class="btn dark block mt" data-action="sheets-sync"')
s=s.replace('<button class="btn block mt" data-action="sheets-auto"','<button disabled class="btn block mt" data-action="sheets-auto"')
needle=" if(a==='sheets-sync'){await sheetsSyncNow();return;}";assert s.count(needle)==1;s=s.replace(needle," if(a==='sheets-import-readonly'){await sheetsImportReadOnly();return;}\n if(a==='sheets-sync'||a==='sheets-auto')return error(new Error(COORDINATOR_GATE_MESSAGE));\n"+needle)
needle='async function sheetsSyncNow({automatic=false}={}){';assert s.count(needle)==1
helper='''async function sheetsImportReadOnly(){
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
s=s.replace(needle,helper+needle+"\n sheetsError=COORDINATOR_GATE_MESSAGE;notify(sheetsError);render();return false;")
s=s.replace("${auto?'Desativar sincronização automática':'Ativar sincronização automática'}",'Envio automático indisponível nesta etapa')
p.write_text(s)
