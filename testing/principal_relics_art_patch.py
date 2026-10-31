"""v1.6.10: imagens reais do RPG em cartas e miniaturas; sem mudar lógica de treino."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
for name in ('relic-group-scenes.webp','relic-supino-card.webp'):
    assert (root/'testing/assets'/name).is_file(),name
    shutil.copy2(root/'testing/assets'/name,dist/name)
shutil.copy2(root/'testing/principal_relics_art.css',dist/'principal_relics_art.css')
p=dist/'app.js'
s=p.read_text()
old='class="focus-mini relic-mini card--${e(x.group)} ${x.selected?'
new='class="focus-mini relic-mini card--${e(x.group)} ${/supino reto/i.test(x.name)&&/barra/i.test(x.equipment)?\'relic-ex-supino\':\'\'} ${x.selected?'
assert s.count(old)==1,'miniatura em andamento'
s=s.replace(old,new)
s=s.replace('Treino & Evolução · v1.6.9','Treino & Evolução · v1.6.10')
s=s.replace("principal_cards.js?v=132","principal_cards.js?v=170")
p.write_text(s)
p=dist/'principal_cards.js'
s=p.read_text()
old='class="sport-card card--${group} ${item.selected?'
new='class="sport-card card--${group} ${/supino reto/i.test(item.name)&&/barra/i.test(item.equipment)?\'relic-ex-supino\':\'\'} ${item.selected?'
assert s.count(old)==1,'cartas do planejador'
p.write_text(s.replace(old,new))
p=dist/'index.html'
s=p.read_text()
assert s.count('</head>')==1
s=s.replace('</head>','<link rel="stylesheet" href="./principal_relics_art.css?v=170">\n</head>')
assert s.count('app.js?v=168')==1
s=s.replace('app.js?v=168','app.js?v=170')
s=s.replace('v1.6.9 Relíquias da Forja','v1.6.10 Relíquias ilustradas')
p.write_text(s)
for name in ('sw.js','integrity.js'):
    p=dist/name
    s=p.read_text()
    assert s.count('shell-v169-relics')>0,(name,'versão esperada')
    assert s.count("'./relic-emblem.svg'")==1,(name,'emblema esperado')
    s=s.replace('shell-v169-relics','shell-v170-relic-art')
    s=s.replace("'./relic-emblem.svg'","'./relic-emblem.svg','./relic-group-scenes.webp','./relic-supino-card.webp','./principal_relics_art.css?v=170'")
    s=s.replace('app.js?v=168','app.js?v=170')
    s=s.replace('principal_cards.js?v=132','principal_cards.js?v=170')
    p.write_text(s)
