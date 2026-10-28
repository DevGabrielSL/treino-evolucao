"""Temporarily hide Home/Progress in the principal app without deleting their data."""
from pathlib import Path
root=Path(__file__).resolve().parents[1];dist=root/'dist'
p=dist/'app.js';s=p.read_text()
needle='function render(){const m=g();'
assert s.count(needle)==1
s=s.replace(needle,"function render(){if(['home','progress'].includes(page))page='workout';const m=g();")
s=s.replace("page='home'","page='workout'").replace('Treino & Evolução · v1.4.1','Treino & Evolução · v1.4.4')
banner="${title('Na academia','Meu treino','Interface para uma mão: selecione o exercício, informe carga e repetições e salve a série.')}"
assert s.count(banner)==1
s=s.replace(banner,'<h1 hidden>Meu treino</h1>')
start=s.index('${panel(`<h2>Cadastrar novo exercício</h2>')
end=s.index('\n',start)
block=s[start:end]
assert block.endswith('}') and 'id="exercise-form"' in block
s=s[:start]+s[end:]
s+='\nfunction renderExerciseRegistration(){return '+block[2:-1]+';}\n'
needle='</div>${panel(\'<h2>Seu aplicativo</h2>'
assert s.count(needle)==1
s=s.replace(needle,'</div>${renderExerciseRegistration()}${panel(\'<h2>Seu aplicativo</h2>')
s=s.replace('Cadastre primeiro um exercício no formulário abaixo.','Cadastre primeiro um exercício em Mais.')
s=s.replace('data-page="workout">Cadastrar exercício novo','data-page="more">Cadastrar exercício novo')
p.write_text(s)
p=dist/'index.html';s=p.read_text()
start=s.index('<nav class="bottom-nav"');end=s.index('</nav>',start)
nav=s[start:end]
for page in ('home','progress'):
 needle='<button data-page="'+page+'">';assert nav.count(needle)==1
 nav=nav.replace(needle,'<button hidden data-page="'+page+'">')
s=s[:start]+nav+s[end:]
s=s.replace('app.js?v=141','app.js?v=144').replace('v1.4.1 Registro RPG','v1.4.4 Cadastro em Mais')
s=s.replace('<header class="topbar">','<header class="topbar" hidden>')
assert '<header class="topbar" hidden>' in s
s=s.replace('</head>','<link rel="stylesheet" href="./principal_visibility.css?v=144">\n</head>');p.write_text(s)
(dist/'principal_visibility.css').write_text('.bottom-nav{grid-template-columns:repeat(3,minmax(0,1fr))}.topbar[hidden]{display:none!important}html{scroll-padding-top:12px}.app-container{padding-top:16px}\n')
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=141','app.js?v=144').replace('shell-v141-entry','shell-v144-more').replace("'./principal_entry.css?v=141'","'./principal_visibility.css?v=144','./principal_entry.css?v=141'");p.write_text(s)
