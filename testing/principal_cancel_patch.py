from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
shutil.copy2(root/'testing/principal_cancel.js',dist/'principal_cancel.js')
p=dist/'app.js';s=p.read_text();s="import {cancelLocalSession} from './principal_cancel.js?v=152';\n"+s
needle='<button class="btn" data-coach-action="finish">Concluir treino</button>'
assert s.count(needle)==1
s=s.replace(needle,needle+'<button class="btn danger" data-coach-action="cancel" data-coach-session="${e(active.id)}">Cancelar treino</button>')
needle=" const action=btn.dataset.coachAction;";assert s.count(needle)==1
s=s.replace(needle,needle+'''
 if(action==='cancel'){
  if(busy||quickSaving)return;
  const active=coachActive();if(!active||btn.dataset.coachSession!==active.id)throw new Error('Treino indisponível. Atualize a tela.');
  const id=active.id;
  if(!confirm('Cancelar este treino? Ele não será marcado como concluído. As séries já registradas serão preservadas no histórico.'))return;
  const ok=await perform(d=>cancelLocalSession(d,id),'Treino cancelado neste aparelho. Séries preservadas no histórico.');
  if(ok){restTimer.stop(id);activeSessionId='';coachSelected='';coachPlan=null;deckRecap='';for(const key of quickDrafts.keys())if(key.startsWith(id+':'))quickDrafts.delete(key);coachSay('assistant','Treino cancelado. Você pode montar outro treino ou escolher um modelo salvo.');render();window.scrollTo(0,0);}return;
 }
''')
s=s.replace('Treino & Evolução · v1.5.1','Treino & Evolução · v1.5.2');p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=151','app.js?v=152').replace('v1.5.1 Instalar em Mais','v1.5.2 Cancelar treino');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=151','app.js?v=152').replace('shell-v151-install','shell-v152-cancel').replace("'./principal_install.js?v=151'","'./principal_cancel.js?v=152','./principal_install.js?v=151'");p.write_text(s)
