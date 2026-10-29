from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
for name in ('principal_presets.js','principal_presets.css'):shutil.copy2(root/'testing'/name,dist/name)
p=dist/'app.js';s=p.read_text();s="import {presetPlan,renderPresetLibrary,presetHistorySummary} from './principal_presets.js?v=160';\n"+s
needle='<h2>Começar com um modelo salvo</h2>${templates.length?'
# There are two old/source occurrences; target only the active helper.
start=s.index('function renderSavedCoachTemplates()');prefix=s[:start];tail=s[start:]
assert tail.count(needle)==1
tail=tail.replace(needle,'<h2>Começar com um modelo salvo</h2>${renderPresetLibrary()}<h3>Seus modelos pessoais</h3>${templates.length?')
s=prefix+tail
needle='historySummary(coachPlan.history)';assert s.count(needle)==1
s=s.replace(needle,'coachPlan.presetId?presetHistorySummary(coachPlan):historySummary(coachPlan.history)')
needle=" const action=btn.dataset.coachAction;";assert s.count(needle)==1
s=s.replace(needle,needle+'''
 if(action==='preset'){
  if(busy||quickSaving)return;if(coachActive())throw new Error('Conclua ou cancele o treino atual antes de escolher outro deck.');
  const form=document.getElementById('coach-form');if(form){const values=new FormData(form);coachReadiness=Object.fromEntries(['fatigue','recovery','area','pain'].map(key=>[key,values.get('readiness_'+key)||(key==='area'?'all':'unknown')]));}
  const proposal=presetPlan(btn.dataset.presetId,g().entities,dateLocal(),coachReadiness);
  coachPlan=proposal;coachSelected=proposal.items[0]?.variant_id||'';coachMode=true;page='workout';
  coachSay('assistant','Deck pronto: '+proposal.presetName+'. '+proposal.items.length+' exercícios, 3 séries cada. Confira o equipamento e as cartas antes de começar.'+(proposal.adjustment.reduced?' O relato de hoje reduziu a quantidade de exercícios.':''));render();document.querySelector('.proposal-list')?.scrollIntoView({block:'start',behavior:'smooth'});return;
 }
''')
needle="name:group+' · Assistente',status:'in_progress'";assert s.count(needle)==1
s=s.replace(needle,"name:coachPlan.presetName||group+' · Assistente',status:'in_progress'")
s=s.replace('Treino & Evolução · v1.5.5','Treino & Evolução · v1.6.0');p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=155','app.js?v=160').replace('v1.5.5 Registro de séries','v1.6.0 Quinze decks prontos').replace('</head>','<link rel="stylesheet" href="./principal_presets.css?v=160">\n</head>');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=155','app.js?v=160').replace('shell-v155-unit','shell-v160-presets').replace("'./principal_unit.js?v=155'","'./principal_presets.js?v=160','./principal_presets.css?v=160','./principal_unit.js?v=155'");p.write_text(s)

# Temporarily hide the rest controls in the principal app; retain timer settings.
p=dist/'index.html';s=p.read_text().replace('app.js?v=160','app.js?v=163').replace('v1.6.0 Quinze decks prontos','v1.6.3 Ocultação corrigida');p.write_text(s)
p=dist/'app.js';p.write_text(p.read_text().replace('Treino & Evolução · v1.6.0','Treino & Evolução · v1.6.3'))
for name in ('sw.js','integrity.js'):
 p=dist/name;p.write_text(p.read_text().replace('app.js?v=160','app.js?v=163').replace('shell-v160-presets','shell-v163-panels-css'))

p=dist/'app.js';s=p.read_text()
needle="panel(`<details><summary>Resumo do roteiro</summary>${overview}</details>`)"
assert s.count(needle)==1
s=s.replace(needle,"panel(`<details><summary>Resumo do roteiro</summary>${overview}</details>`,'session-outline')")
needle="'conversation-panel planner-panel');"
assert s.count(needle)==1
s=s.replace(needle,"'conversation-panel planner-panel'+(active?' session-help':''));")
p.write_text(s)

# Use the external stylesheet allowed by CSP; inline styles are blocked.
p=dist/'principal_presets.css';p.write_text(p.read_text()+'\n.rest-card,.session-outline,.conversation-panel.session-help{display:none!important}\n')
for name in ('index.html','sw.js','integrity.js'):
 p=dist/name;p.write_text(p.read_text().replace('principal_presets.css?v=160','principal_presets.css?v=163'))
