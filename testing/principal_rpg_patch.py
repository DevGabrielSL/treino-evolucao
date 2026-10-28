from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
for name in ('principal_rpg.js','principal_rpg.css'):
 shutil.copy2(root/'testing'/name,dist/name)
shutil.copy2(root/'testing/assets/rpg-training.webp',dist/'rpg-training.webp')
p=dist/'principal_cards.js';s=p.read_text()
assert s.count('return [{variant_id:id')==1
s=s.replace('return [{variant_id:id','return [{session_id:session.id,variant_id:id')
needle='return `<article class="sport-card'
assert s.count(needle)==1
s=s.replace(needle,'''return `<article ${active?'data-card-session="'+e(item.session_id||'')+'" data-card-id="'+e(item.variant_id||'')+'" data-card-count="'+count+'" data-card-target="'+(target??'')+'"':''} class="sport-card''')
p.write_text(s)
p=dist/'app.js';s=p.read_text();s="import './principal_rpg.js';\n"+s
s=s.replace('principal_cards.js?v=131','principal_cards.js?v=132').replace("from './principal_motion.js';","from './principal_motion.js?v=132';").replace('Treino & Evolução · v1.3.1','Treino & Evolução · v1.3.2');p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=131','app.js?v=132').replace('<link rel="stylesheet" href="./principal_cards_premium.css?v=131r2">','<link rel="stylesheet" href="./principal_cards_premium.css?v=131r2">\n<link rel="stylesheet" href="./principal_rpg.css">');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=131','app.js?v=132').replace('principal_cards.js?v=131','principal_cards.js?v=132').replace("'./principal_motion.js'","'./principal_motion.js?v=132'")
 assert s.count("'./principal_rpg.js'")==0;s=s.replace("'./principal_cards.css'","'./principal_rpg.js','./principal_rpg.css','./rpg-training.webp','./principal_cards.css'");p.write_text(s)
