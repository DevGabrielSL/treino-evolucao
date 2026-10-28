"""Principal-only RPG world presentation. No persistence or training mutations."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]; dist=root/'dist'
for name in ('principal_world.css',):
 shutil.copy2(root/'testing'/name,dist/name)
assets=('rpg-citadel.webp','rpg-arena.webp','rpg-archive.webp')
for name in assets: shutil.copy2(root/'testing/assets'/name,dist/name)
p=dist/'app.js'; s=p.read_text()
needle="$('#app').dataset.page=page;"
assert s.count(needle)==1
s=s.replace(needle,needle+"document.body.dataset.realm=page;")
s=s.replace('=>`<div class="eyebrow">${e(eyebrow)}</div><h1>${e(text)}</h1><p class="sub">${e(sub)}</p>`;', '=>`<header class="realm-banner"><div class="eyebrow">${e(eyebrow)}</div><h1>${e(text)}</h1><p class="sub">${e(sub)}</p></header>`;')
assert 'header class="realm-banner"' in s
s=s.replace('Treino & Evolução · v1.3.2','Treino & Evolução · v1.4.0')
p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=132','app.js?v=140')
s=s.replace('<link rel="stylesheet" href="./principal_rpg.css">','<link rel="stylesheet" href="./principal_rpg.css">\n<link rel="stylesheet" href="./principal_world.css?v=140">')
p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=132','app.js?v=140')
 s=s.replace("'./rpg-training.webp'","'./rpg-training.webp','./principal_world.css?v=140',"+','.join(repr('./'+x) for x in assets))
 p.write_text(s)
