"""Compact principal set-entry layout, preserving field names and save handlers."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
shutil.copy2(root/'testing/principal_entry.css',dist/'principal_entry.css')
p=dist/'app.js';s=p.read_text()
def replace(old,new):
 global s
 assert s.count(old)==1,(old,s.count(old))
 s=s.replace(old,new)
replace('Carga realizada (${e(v.unit)})${v.unit===\'peso corporal\'?\' · 0 = sem carga externa\':\'\'}','Carga <small class="entry-unit">${e(v.unit)}</small>')
replace('required placeholder="Informe a carga"','required placeholder="—" aria-label="Carga realizada em ${e(v.unit)}"')
replace('<span>Repetições realizadas</span>','<span>Repetições <small class="entry-unit">realizadas</small></span>')
replace("value=\"${e(draft.reps||'')}\" required>", "value=\"${e(draft.reps||'')}\" required placeholder=\"—\">")
replace('<span>RIR observado (opcional, de 0 a 10)</span>','<span>RIR <small>opcional · 0 a 10</small></span>')
replace('placeholder="Não informado"','placeholder="0–10" aria-describedby="entry-rir-help"')
replace('</div><label class="field"><span>Tipo de série</span><select name="kind"','<label class="field"><span>Tipo de série <small>realizada</small></span><select name="kind"')
replace('</select></label><button class="btn primary block" type="submit">Salvar série realizada</button></form>', '</select></label></div><p id="entry-rir-help" class="entry-help">RIR: repetições que ainda conseguiria fazer.${v.unit===\'peso corporal\'?\' Peso corporal: use 0 quando não houver carga externa.\':\'\'}</p><button class="btn primary block" type="submit">Salvar série</button></form>')
replace('<h2>Registrar série</h2><p class="text-small">${e(m.exerciseMap.get(v?.exercise_id)?.name||\'Selecione um exercício\')} · ${e(v?.equipment_or_variation||\'\')}</p>', '<div class="entry-heading"><span class="entry-gem" aria-hidden="true">◆</span><h2>Registrar série</h2></div><p class="entry-exercise">${e(m.exerciseMap.get(v?.exercise_id)?.name||\'Selecione um exercício\')}<span>${e(v?.equipment_or_variation||\'\')}</span></p>')
s=s.replace('Treino & Evolução · v1.4.0','Treino & Evolução · v1.4.1');p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=140','app.js?v=141').replace('v1.4.0 Mundo RPG','v1.4.1 Registro RPG').replace('</head>','<link rel="stylesheet" href="./principal_entry.css?v=141">\n</head>');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=140','app.js?v=141').replace('shell-v140-rpg-world','shell-v141-entry').replace("'./principal_world.css?v=140'","'./principal_entry.css?v=141','./principal_world.css?v=140'");p.write_text(s)
