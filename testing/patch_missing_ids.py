from pathlib import Path
root=Path(__file__).resolve().parents[1];dest=root/'dist/testes'
p=dest/'sheet_sync_core.js';s=p.read_text();s="import {SHEET_ID as SANDBOX_SHEET_ID} from './sheets_config.js';\n"+s
for name in ['previewRemote','planOutbound','stageInbound','detectOutboundDrift']:
 needle='export function '+name+'(doc,raw){';assert s.count(needle)==1;s=s.replace(needle,needle+'\n assertKnownRemoteIds(doc,raw);')
s+='\n'+(root/'testing/known_remote_ids.js').read_text();p.write_text(s)
p=dest/'sheet_sync_browser.js';s=p.read_text();s="import {assertKnownRemoteIds,mergeKnownRemoteIds} from './sheet_sync_core.js';\n"+s
needle='function verifyPreviouslySent(doc,rows){';assert s.count(needle)==1;s=s.replace(needle,needle+'\n assertKnownRemoteIds(doc,rows);')
start=s.index('async function uploadNewRowsUnlocked(');end=s.index('/** Prevent concurrent submissions',start);chunk=s[start:end]
chunk=chunk.replace("{fetchImpl=fetch}={}){","{fetchImpl=fetch,onCheckpoint}={}){",1)
needle=' const id=parseSheetId(sheetId);';assert chunk.count(needle)==1
chunk=chunk.replace(needle,needle+'''
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

''')
# All planning/verification in this attempt uses the latest persisted checkpoint.
for fn in ['verifyPreviouslySent','detectOutboundDrift','planOutbound','previewRemote']:
 chunk=chunk.replace(fn+'(doc,',fn+'(checkpointDoc,')
needle='  let outbound=planOutbound(checkpointDoc,rows)[tab];';assert chunk.count(needle)==1
chunk=chunk.replace(needle,needle+"\n  await checkpoint(rows);")
needle='  if(!outbound.length)continue;';assert chunk.count(needle)==1
chunk=chunk.replace(needle,needle+"\n  if(typeof onCheckpoint!=='function')throw new Error('A gravação exige salvar a referência dos IDs no dispositivo antes do envio. Revisão necessária.');")
needle='   verifyPreviouslySent(checkpointDoc,check);';assert chunk.count(needle)==1;chunk=chunk.replace(needle,needle+'\n   await checkpoint(check);')
needle=' const drift=detectOutboundDrift(checkpointDoc,after);';assert chunk.count(needle)==1;chunk=chunk.replace(needle,needle+'\n await checkpoint(after);')
# Persist each confirmed ID before checks that can fail on unrelated records.
needle="   if(tab==='Peso')checkWeightFormulaHealth(check.Peso,receipt);";assert chunk.count(needle)==1;chunk=chunk.replace(needle,'')
needle='   verifyPreviouslySent(checkpointDoc,check);';assert chunk.count(needle)==1
chunk=chunk.replace(needle,"   await checkpointReceipt(tab,item.id);\n   if(tab==='Peso')checkWeightFormulaHealth(check.Peso,receipt);\n"+needle)
s=s[:start]+chunk+s[end:];p.write_text(s)
p=dest/'app.js';s=p.read_text();s="import {mergeKnownRemoteIds} from './sheet_sync_core.js';\n"+s
needle='async function sheetsInspect(){';assert s.count(needle)==1
helper='''async function saveKnownRemoteIds(ledger){
 if(JSON.stringify(doc.settings.sheet_sync?.known_remote_ids_v1)===JSON.stringify(ledger))return;
 const next=commit(doc,d=>{d.settings.sheet_sync={...d.settings.sheet_sync,known_remote_ids_v1:structuredClone(ledger)};});
 const generation=await saveSnapshot(next,storageGeneration);
 doc=next;storageGeneration=generation;
}
'''
s=s.replace(needle,helper+needle)
needle=' check.checkedRevision=doc.revision;';assert s.count(needle)==1;s=s.replace(needle,' await saveKnownRemoteIds(mergeKnownRemoteIds(doc,check.rows));\n'+needle)
needle='const sent=await uploadNewRows(SHEET_ID,doc);';assert s.count(needle)==1;s=s.replace(needle,'const sent=await uploadNewRows(SHEET_ID,doc,{onCheckpoint:saveKnownRemoteIds});')
# Preview must not keep showing a stale successful inspection after a conflict.
needle="const check=await inspectSpreadsheet(SHEET_ID,doc);";assert s.count(needle)==1;s=s.replace(needle,"sheetsPreflight=null;sheetsReport=null;\n "+needle)
p.write_text(s)
