from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
shutil.copy2(root/'testing/principal_intent.js',dist/'principal_intent.js')
p=dist/'coach_logic.js';s=p.read_text();s="import {expandArmRequest} from './principal_intent.js';\n"+s
assert s.count(' const input=normalize(message);')==1
s=s.replace(' const input=normalize(message);',' const input=normalize(expandArmRequest(message));')
s=s.replace('ombros, bíceps, tríceps ou core.','ombros, braços, bíceps, tríceps ou core.');p.write_text(s)
# One additional generic option prevents three arm slots depending on duplicate variations.
p=dist/'balanced_coach.js';s=p.read_text();needle="].map(([group,name,equipment,unit],i)=>"
assert s.count(needle)==1;s=s.replace(needle,",['biceps','Rosca na polia','Polia','kg']\n"+needle);p.write_text(s)
p=dist/'app.js';s=p.read_text();s=s.replace("from './coach_logic.js';","from './coach_logic.js?v=121';");s=s.replace('app.js?v=120r3','app.js?v=121').replace('principal_variety.js?v=120r3','principal_variety.js?v=121');p.write_text(s)
p=dist/'principal_variety.js';s=p.read_text().replace("from './balanced_coach.js';","from './balanced_coach.js?v=121';");p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=120r3','app.js?v=121');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=120r3','app.js?v=121').replace('principal_variety.js?v=120r3','principal_variety.js?v=121').replace("'./coach_logic.js'","'./coach_logic.js?v=121'").replace("'./balanced_coach.js'","'./balanced_coach.js?v=121'")
 assert s.count("'./principal_visual.js'")==1;s=s.replace("'./principal_visual.js'","'./principal_intent.js','./principal_visual.js'");p.write_text(s)
