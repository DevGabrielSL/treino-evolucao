from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
for name in ('principal_motion.js','principal_cards_premium.css'):
 shutil.copy2(root/'testing'/name,dist/name)
p=dist/'app.js';s=p.read_text();s="import {playCard} from './principal_motion.js';\n"+s
needle="if(ids.includes(vid)){coachSelected=vid;render();}"
assert s.count(needle)==1;s=s.replace(needle,"if(ids.includes(vid)){await playCard(btn);coachSelected=vid;render();}")
s=s.replace('Treino & Evolução · v1.3.0','Treino & Evolução · v1.3.1').replace("'./principal_cards.js'","'./principal_cards.js?v=131'").replace('principal_variety.js?v=121','principal_variety.js?v=131')
s=s.replace("from './principal_live.js';","from './principal_live.js?v=131';")
p.write_text(s)
for name in ('principal_variety.js','principal_cards.js'):
 p=dist/name;s=p.read_text().replace("from './principal_dose.js';","from './principal_dose.js?v=131';").replace("from './principal_live.js';","from './principal_live.js?v=131';");p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=130','app.js?v=131').replace('<link rel="stylesheet" href="./principal_cards.css">','<link rel="stylesheet" href="./principal_cards.css">\n<link rel="stylesheet" href="./principal_cards_premium.css">');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=130','app.js?v=131').replace('principal_variety.js?v=121','principal_variety.js?v=131').replace("'./principal_cards.js'","'./principal_cards.js?v=131'").replace("'./principal_live.js'","'./principal_live.js?v=131'").replace("'./principal_dose.js'","'./principal_dose.js?v=131'");s=s.replace("'./principal_cards.css'","'./principal_cards.css','./principal_cards_premium.css','./principal_motion.js'");p.write_text(s)
