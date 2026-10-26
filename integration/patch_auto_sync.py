#!/usr/bin/env python3
"""Etapa 4: patch ancorado do shell público, sem dados pessoais."""
from pathlib import Path
import re
target=Path('dist/app.js')
s=target.read_text('utf-8')
def replace_unique(old,new,label):
 global s
 count=s.count(old)
 if count!=1: raise ValueError(f'Âncora {label}: {count} ocorrências')
 s=s.replace(old,new,1)

match=re.findall(r"(?m)^import \{[^\n]+\} from '\./sheet_sync_browser\.js';$",s)
if len(match)!=1:raise ValueError('Import Sheets inesperado')
replace_unique(match[0],match[0]+"\nimport {createAutomaticSyncScheduler} from './automatic_sync.js';",'import')
replace_unique("let sheetsBusy=false,sheetsReport=null,sheetsError='',sheetsPreflight=null;",
"""let sheetsBusy=false,sheetsReport=null,sheetsError='',sheetsPreflight=null;
const automaticSheets=createAutomaticSyncScheduler({
 getSnapshot:()=>({doc,sheetId:SHEET_ID,online:navigator.onLine,authorized:authorized(),busy,sheetsBusy}),
 run:({automatic})=>sheetsSyncNow({automatic}),
 delayMs:1200,
 onFailure:err=>error(err)
});""",'scheduler')
replace_unique("""async function perform(mutate,message){
 if(busy){notify('Uma gravação já está em andamento. Tente novamente.');return false;}
 busy=true;
 try{const next=commit(doc,mutate);const nextGeneration=await saveSnapshot(next,storageGeneration);doc=next;storageGeneration=nextGeneration;notify(message);render();return true;}
 catch(err){error(err);return false;}finally{busy=false;}
}""",
"""async function perform(mutate,message){
 if(busy){notify('Uma gravação já está em andamento. Tente novamente.');return false;}
 busy=true;let saved=false;
 try{const next=commit(doc,mutate);const nextGeneration=await saveSnapshot(next,storageGeneration);doc=next;storageGeneration=nextGeneration;saved=true;notify(message);render();return true;}
 catch(err){error(err);return false;}finally{busy=false;if(saved)automaticSheets.request('save');}
}""",'salvar')
replace_unique("window.addEventListener('online',()=>{updateConnectivity();if(authorized()&&doc.settings.sheet_sync?.auto)sheetsSyncNow({automatic:true});});",
"window.addEventListener('online',()=>{updateConnectivity();automaticSheets.request('online');});",'reconectar')
replace_unique("if(totalIncoming){",
"if(totalIncoming||incoming.reconciled?.rowsUpdated||incoming.reconciled?.baselineInitialized||incoming.reconciled?.fieldsUpdated||incoming.linked_legacy_sets||incoming.linked_legacy_sessions||incoming.linked_legacy_weights){",
'persistir conciliação')
replace_unique("d.overlay=incoming.next.overlay;","d.base=incoming.next.base;d.overlay=incoming.next.overlay;",'preservar base reconciliada')
replace_unique("The entire staged document is validated before saving; no historical base records are overwritten.",
"The staged document is validated before saving; base and overlay updates are preserved.",'comentário conciliação')
replace_unique("}catch(err){sheetsError=err.message||String(err);error(err);render();}",
"""  }catch(err){
   sheetsError=err.message||String(err);
   if(automatic && /conflit|diverg|revis[aã]o|não pôde ser confirmado|recibo|duplicad|fórmula|formula|identidade|desapareceu/i.test(sheetsError)){
    try{
     const frozen=commit(doc,d=>{d.settings.sheet_sync={...d.settings.sheet_sync,auto:false,
      auto_pause_reason:'manual_review_required',auto_paused_at:new Date().toISOString()};});
     const generation=await saveSnapshot(frozen,storageGeneration);
     doc=frozen;storageGeneration=generation;
     notify('Sincronização automática pausada para revisão. Nenhum reenvio automático será realizado.');
    }catch(storageErr){error(storageErr);}
   }
   error(err);render();
  }""",'pausar conflito')
replace_unique("if(a==='sheets-auto'){const enabled=!Boolean(doc.settings.sheet_sync?.auto);if(enabled&&!doc.settings.sheet_sync?.last_write_confirmed_at)return error(new Error('Faça primeiro uma gravação manual confirmada no Google Sheets.'));",
"if(a==='sheets-auto'){const enabled=!Boolean(doc.settings.sheet_sync?.auto);if(enabled&&(!doc.settings.sheet_sync?.last_write_confirmed_at||doc.settings.sheet_sync?.spreadsheet_id!==SHEET_ID))return error(new Error('Faça primeiro uma gravação manual confirmada nesta planilha Google Sheets.'));",
'confirmação por planilha')
replace_unique("d.settings.sheet_sync={...d.settings.sheet_sync,auto:enabled};",
"d.settings.sheet_sync={...d.settings.sheet_sync,auto:enabled,auto_pause_reason:enabled?null:d.settings.sheet_sync?.auto_pause_reason};",'reativar')
dollar=chr(36)
notice=dollar+'{!verifiedWrite?\'<p class="text-small mt">A sincronização automática só poderá ser ativada depois da primeira gravação manual confirmada pelo Google Sheets.</p>\':\'\'}'
message=dollar+'{doc.settings.sheet_sync?.auto_pause_reason?\'<p class="text-small mt">Envio automático pausado por conflito: confira a planilha antes de reativar.</p>\':\'\'}'
replace_unique(notice,message+notice,'visibilidade da pausa')
replace_unique("const verifiedWrite=Boolean(doc.settings.sheet_sync?.last_write_confirmed_at);",
"const verifiedWrite=Boolean(doc.settings.sheet_sync?.last_write_confirmed_at&&doc.settings.sheet_sync?.spreadsheet_id===SHEET_ID);",'trava da primeira escrita')
target.write_text(s,'utf-8')
print('ETAPA4_APP_PATCH=APPLIED')
