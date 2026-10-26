// IDs observed in validated Sheet reads. This is presence evidence, not a
// replacement for full-value write receipts or server-side concurrency control.
export function knownRemoteIds(doc){
 const ledger=doc?.settings?.sheet_sync?.known_remote_ids_v1;
 if(ledger===undefined)return null;
 if(!ledger||ledger.version!==1||ledger.spreadsheet_id!==SANDBOX_SHEET_ID||!ledger.ids)throw new Error('Referência de IDs da planilha inválida ou de outro destino. Revisão necessária.');
 for(const tab of ['Treinos','Series','Peso']){
  const ids=ledger.ids[tab];
  if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!id.trim()||id!==id.trim()||id.length>180)||new Set(ids).size!==ids.length)throw new Error('Referência de IDs inválida: '+tab+'. Revisão necessária.');
 }
 return ledger;
}
export function assertKnownRemoteIds(doc,raw){
 const rows=readRowSets(raw),ledger=knownRemoteIds(doc);
 for(const [tab,key] of [['Treinos','sessions'],['Series','sets'],['Peso','weigh_ins']]){
  const current=new Set(rows[tab].slice(1).filter(r=>str(r?.[0])).map(r=>str(r?.[COLUMN_IDS[tab]])).filter(Boolean));
  for(const id of ledger?.ids[tab]||[])if(!current.has(id))throw new Error('Registro observado anteriormente desapareceu ou perdeu o ID na planilha: '+tab+' / '+id+'. Envio interrompido para revisão; a cópia local foi preservada.');
  // An old timestamp cannot identify which local records were sent. Do not
  // silently turn that ambiguity into permission to recreate missing records.
  if(!ledger&&doc?.settings?.sheet_sync?.last_write_confirmed_at){
   const local=[...(doc.base?.entities?.[key]||[]),...(doc.overlay?.[key]||[])];
   if(local.some(x=>!x.provenance?.sheet&&!current.has(x.id)))throw new Error('Histórico de envio antigo sem referência de IDs em '+tab+'. Revisão necessária antes de enviar registros ausentes. A cópia local foi preservada.');
  }
 }
 return rows;
}
export function mergeKnownRemoteIds(doc,raw){
 const rows=assertKnownRemoteIds(doc,raw),old=knownRemoteIds(doc);
 return {version:1,spreadsheet_id:SANDBOX_SHEET_ID,ids:Object.fromEntries(['Treinos','Series','Peso'].map(tab=>[tab,[...new Set([...(old?.ids[tab]||[]),...rows[tab].slice(1).filter(r=>str(r?.[0])).map(r=>str(r?.[COLUMN_IDS[tab]])).filter(Boolean)])].sort()]))};
}
