from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'dist/testes'
f=p/'automatic_sync.js';s=f.read_text();marker='export function createAutomaticSyncScheduler('
assert s.count(marker)==1
s=s[:s.index(marker)]+(root/'testing/sync_scheduler.js').read_text();f.write_text(s)
f=p/'app.js';s=f.read_text()
old="if(ok&&authorized()&&doc.settings.sheet_sync?.auto&&navigator.onLine)sheetsSyncNow({automatic:true});"
assert s.count(old)==1;s=s.replace(old,"if(ok)automaticSheets.request('save');")
old="if(authorized()&&doc.settings.sheet_sync?.auto&&navigator.onLine)sheetsSyncNow({automatic:true});"
assert s.count(old)==1;s=s.replace(old,"automaticSheets.request('save');")
start=s.index('async function sheetsSyncNow(');end=s.index('function updateConnectivity()',start)
chunk=s[start:end]
chunk=chunk.replace("if(automatic&&!doc.settings.sheet_sync?.last_write_confirmed_at)return;","if(automatic&&!doc.settings.sheet_sync?.last_write_confirmed_at)return false;")
chunk=chunk.replace("if(busy||sheetsBusy)return notify('Já existe uma gravação em andamento.');","if(busy||sheetsBusy){notify('Já existe uma gravação em andamento.');return false;}")
needle='   }catch(err){';assert chunk.count(needle)==1;chunk=chunk.replace(needle,'   return true;\n'+needle)
needle='   error(err);render();';assert chunk.count(needle)==1;chunk=chunk.replace(needle,needle+'return false;')
s=s[:start]+chunk+s[end:];f.write_text(s)
