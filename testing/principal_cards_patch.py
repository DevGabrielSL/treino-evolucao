from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
for name in ('principal_cards.js','principal_cards.css'):
 shutil.copy2(root/'testing'/name,dist/name)
p=dist/'app.js';s=p.read_text()
def replace(old,new):
 global s
 assert s.count(old)==1,(old,s.count(old))
 s=s.replace(old,new)
s="import {renderSportCard,renderDeckChooser,renderDeckRecap,muscleSymbol} from './principal_cards.js';\n"+s
start=s.index('function renderProposalItem(');end=s.index('function renderHome(',start)
s=s[:start]+"function renderProposalItem(draft,index,controls){return renderSportCard(draft,{index,controls});}\n"+s[end:]
replace('let quickSaving=false;',"let quickSaving=false;let deckRecap='';")
# Keep numeric entry and rest ahead of the next-card choices.
replace("'rest-card')+panel(`<details><summary>Resumo do roteiro", "'rest-card')+renderDeckChooser(active,selected,m.entities)+panel(`<details><summary>Resumo do roteiro")
replace('Seu treino de ${e(groupLabel(coachPlan.groups))}', 'Seu deck de ${e(groupLabel(coachPlan.groups))}')
replace('Confirmar e começar treino</button>', 'Confirmar deck e começar treino</button>')
replace('<div class="eyebrow mt">Exercício atual</div>', '<div class="eyebrow mt">Carta em jogo · exercício atual</div>')
replace('Próximo exercício</button>', 'Próxima carta</button>')
replace("${describeSave()}${active?current+renderTrainingTools(active,selected,m)+composer:composer+preview}", "${describeSave()}${!active?deckRecap:''}${active?current+renderTrainingTools(active,selected,m)+composer:composer+preview}")
replace("if(ok){restTimer.stop(id);activeSessionId='';", "if(ok){deckRecap=renderDeckRecap(active,g().entities);restTimer.stop(id);activeSessionId='';")
replace("if(ok){activeSessionId=id;coachSelected=ids[0];", "if(ok){deckRecap='';activeSessionId=id;coachSelected=ids[0];")
s=s.replace('Treino & Evolução · v1.2.1','Treino & Evolução · v1.3.0').replace('app.js?v=121','app.js?v=130');p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=121','app.js?v=130').replace('<link rel="stylesheet" href="./principal_visual.css">','<link rel="stylesheet" href="./principal_visual.css">\n<link rel="stylesheet" href="./principal_cards.css">');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=121','app.js?v=130');assert s.count("'./principal_intent.js'")==1;p.write_text(s.replace("'./principal_intent.js'","'./principal_cards.js','./principal_cards.css','./principal_intent.js'"))
