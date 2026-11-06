from pathlib import Path
import shutil,json,hashlib
root=Path(__file__).resolve().parents[1];dist=root/'dist'
manifest=json.loads((root/'testing/exercise_art/manifest.json').read_text())
assert len(manifest)==16
for entry in manifest:
 p=root/'testing/exercise_art'/entry['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256']
 shutil.copy2(p,dist/entry['file'])
shutil.copy2(root/'testing/principal_exercise_art.js',dist/'principal_exercise_art.js')
for name in ('app.js','principal_cards.js'):
 p=dist/name;s=p.read_text()
 s="import {exerciseArt,renderExerciseArt} from './principal_exercise_art.js?v=189';\n"+s
 if name=='principal_cards.js':
  old='class="sport-card card--${group} ';assert s.count(old)==1
  s=s.replace(old,'class="sport-card card--${group} ${exerciseArt(item.name,item.equipment)?\'has-exercise-art\':\'\'} ')
  old='${muscleSymbol(group)}<span class="card-art-label">${e(info[1])}</span>';assert s.count(old)==1
  s=s.replace(old,'${renderExerciseArt(item.name,item.equipment)||`${muscleSymbol(group)}<span class="card-art-label">${e(info[1])}</span>`}')
 else:
  old='class="focus-mini relic-mini card--${e(x.group)} ';assert s.count(old)==1
  s=s.replace(old,'class="focus-mini relic-mini card--${e(x.group)} ${exerciseArt(x.name,x.equipment)?\'has-exercise-art\':\'\'} ')
  old='<span class="focus-mini-art" aria-hidden="true">${muscleSymbol(x.group)}</span>';assert s.count(old)==1
  s=s.replace(old,'<span class="focus-mini-art" aria-hidden="true">${renderExerciseArt(x.name,x.equipment,true)||muscleSymbol(x.group)}</span>')
  s=s.replace('principal_cards.js?v=170','principal_cards.js?v=189')
 p.write_text(s)
p=dist/'principal_relics_art.css';p.write_text(p.read_text()+'\n'+(root/'testing/principal_exercise_art.css').read_text())
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text()
 s=s.replace("'./app.js?v=188'","'./app.js?v=189','./principal_exercise_art.js?v=189',"+','.join(repr('./'+entry['file']) for entry in manifest))
 s=s.replace('shell-v188-training-feedback','shell-v189-exercise-art').replace('principal_cards.js?v=170','principal_cards.js?v=189').replace('principal_relics_art.css?v=170','principal_relics_art.css?v=189')
 p.write_text(s)
p=dist/'index.html';p.write_text(p.read_text().replace('app.js?v=188','app.js?v=189').replace('principal_relics_art.css?v=170','principal_relics_art.css?v=189'))

