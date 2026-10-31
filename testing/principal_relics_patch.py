"""Direção 3 — Relíquias da Forja: somente apresentação, sem tocar na persistência."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
shutil.copy2(root/'testing/principal_relics.css',dist/'principal_relics.css')
shutil.copy2(root/'testing/assets/relic-emblem.svg',dist/'relic-emblem.svg')
p=dist/'app.js'
s=p.read_text()
needle='class="focus-mini ${x.selected?'
assert s.count(needle)==1, 'mini-card marker'
s=s.replace(needle,'class="focus-mini relic-mini card--${e(x.group)} ${x.selected?')
s=s.replace('Treino & Evolução · v1.6.8','Treino & Evolução · v1.6.9')
p.write_text(s)
p=dist/'index.html'
s=p.read_text()
assert s.count('</head>')==1
s=s.replace('</head>','<link rel="stylesheet" href="./principal_relics.css?v=169">\n</head>')
s=s.replace('v1.6.8 Tempo do treino','v1.6.9 Relíquias da Forja')
p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name
 s=p.read_text()
 needle="'./principal_focus.css?v=168'"
 assert s.count(needle)==1, (name,'focus cache marker')
 s=s.replace(needle,needle+",'./principal_relics.css?v=169','./relic-emblem.svg'")
 assert s.count('shell-v168-session-clock')>=1
 s=s.replace('shell-v168-session-clock','shell-v169-relics')
 p.write_text(s)
