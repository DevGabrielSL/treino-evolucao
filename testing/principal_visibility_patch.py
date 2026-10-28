"""Temporarily hide Home/Progress in the principal app without deleting their data."""
from pathlib import Path
root=Path(__file__).resolve().parents[1];dist=root/'dist'
p=dist/'app.js';s=p.read_text()
needle='function render(){const m=g();'
assert s.count(needle)==1
s=s.replace(needle,"function render(){if(['home','progress'].includes(page))page='workout';const m=g();")
s=s.replace("page='home'","page='workout'").replace('Treino & Evolução · v1.4.1','Treino & Evolução · v1.4.3')
banner="${title('Na academia','Meu treino','Interface para uma mão: selecione o exercício, informe carga e repetições e salve a série.')}"
assert s.count(banner)==1
s=s.replace(banner,'<h1 hidden>Meu treino</h1>')
p.write_text(s)
p=dist/'index.html';s=p.read_text()
start=s.index('<nav class="bottom-nav"');end=s.index('</nav>',start)
nav=s[start:end]
for page in ('home','progress'):
 needle='<button data-page="'+page+'">';assert nav.count(needle)==1
 nav=nav.replace(needle,'<button hidden data-page="'+page+'">')
s=s[:start]+nav+s[end:]
s=s.replace('app.js?v=141','app.js?v=143').replace('v1.4.1 Registro RPG','v1.4.3 Treino direto')
s=s.replace('<header class="topbar">','<header class="topbar" hidden>')
assert '<header class="topbar" hidden>' in s
s=s.replace('</head>','<link rel="stylesheet" href="./principal_visibility.css?v=143">\n</head>');p.write_text(s)
(dist/'principal_visibility.css').write_text('.bottom-nav{grid-template-columns:repeat(3,minmax(0,1fr))}.topbar[hidden]{display:none!important}html{scroll-padding-top:12px}.app-container{padding-top:16px}\n')
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=141','app.js?v=143').replace('shell-v141-entry','shell-v143-direct').replace("'./principal_entry.css?v=141'","'./principal_visibility.css?v=143','./principal_entry.css?v=141'");p.write_text(s)
