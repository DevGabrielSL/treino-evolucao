"""Principal workout composer: original art and clearer layout, same command handler."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
for src,target in [('principal_planner.css','principal_planner.css'),('assets/rpg-planner.webp','rpg-planner.webp')]:shutil.copy2(root/'testing'/src,dist/target)
p=dist/'app.js';s=p.read_text()
start=s.index(' const composer=panel(');end=s.index('\n const actions=',start)
old=s[start:end];a=old.index('<details class="technical-note">');b=old.index('</details>',a)+len('</details>');examples=old[a:b]
s=s[:start]+''' const composer=panel(`${active?'<details><summary>Conversa e ajuda</summary>':''}<div class="planner-art" aria-hidden="true"></div><div class="planner-content"><div class="planner-kicker">SALA DE ESTRATÉGIA</div><h2>Monte seu treino</h2><p class="planner-intro">Diga o que quer treinar e quanto tempo tem. Revise as cartas antes de começar.</p><form id="coach-form"><label class="field"><span>Qual é o foco de hoje?</span><input name="message" class="input" maxlength="260" required autocomplete="off" placeholder="Ex.: braços, 45 minutos"></label>${!active?'<details class="planner-readiness"><summary>Como estou hoje? <small>Opcional</small></summary>'+readinessFields()+'</details>':''}<button class="btn primary big block" type="submit">${active?'Enviar mensagem':'Montar meu treino'}</button></form><div class="planner-examples">'''+examples+'''</div>${messageList?'<div class="planner-messages" aria-live="polite">'+messageList+'</div>':'<p class="planner-storage-note">Roteiro e séries ficam salvos no treino. As mensagens desta conversa são temporárias.</p>'}</div>${active?'</details>':''}`,'conversation-panel planner-panel');'''+s[end:]
s=s.replace("${title('Assistente local','Treino por conversa','Sugestões baseadas no seu próprio histórico. Sem IA paga nem envio da conversa a terceiros.')}",'')
needle='panel(`<h2>Novo treino</h2><form id="new-session-form">'
assert s.count(needle)==1
s=s.replace(needle,'panel(`<div class="planner-art" aria-hidden="true"></div><div class="planner-content"><div class="planner-kicker">PREPARAR SESSÃO</div><h2>Novo treino</h2><form id="new-session-form">')
needle='Iniciar treino</button></form>`)'
assert s.count(needle)==1
s=s.replace(needle,'Iniciar treino</button></form></div>`,\'manual-session-panel\')')
s=s.replace('function renderWorkout(m){if(coachMode)return renderCoach(m);','function renderWorkout(m){return renderCoach(m);')
needle="${panel('<button class=\"btn block\" data-coach-action=\"close\">Voltar ao modo manual</button>')}"
assert s.count(needle)==1
s=s.replace(needle,'')
needle='${active?current+renderTrainingTools(active,selected,m)+composer:composer+preview}'
assert s.count(needle)==1
s=s.replace(needle,needle+"${!active?renderSavedCoachTemplates():''}")
s+='''\nfunction renderSavedCoachTemplates(){const templates=getTemplates(doc).filter(t=>t.items.length);return panel(`<h2>Começar com um modelo salvo</h2>${templates.length?templates.map(t=>item(t.name,`${t.items.length} exercícios planejados`,`<button class="btn primary small" data-start-template="${e(t.id)}">Iniciar</button>`)).join(''):'<p class="text-small">Nenhum modelo com exercícios ainda. Organize seus modelos em Mais.</p>'}<button class="btn block mt" data-page="templates">Gerenciar modelos e exercícios</button>`,'saved-coach-models');}\n'''
s=s.replace('Treino & Evolução · v1.4.4','Treino & Evolução · v1.4.9');p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=144','app.js?v=149').replace('v1.4.4 Cadastro em Mais','v1.4.9 Assistente e modelos').replace('</head>','<link rel="stylesheet" href="./principal_planner.css?v=149">\n</head>');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=144','app.js?v=149').replace('shell-v144-more','shell-v149-assistant').replace("'./principal_visibility.css?v=144'","'./principal_planner.css?v=149','./rpg-planner.webp','./principal_visibility.css?v=144'");p.write_text(s)
