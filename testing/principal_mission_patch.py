"""Wire the two mission layouts to the main app's existing workout handlers."""

app = dist / 'app.js'
source = app.read_text()

def swap(old, new):
    global source
    assert source.count(old) == 1, old
    source = source.replace(old, new, 1)

swap('import {presetPlan,renderPresetLibrary,presetHistorySummary}',
     'import {PRESET_DECKS,presetPlan,presetHistorySummary}')
swap(" if(action==='preset'){", """ if(action==='start-mission'){
  if(busy||quickSaving)return;
  if(coachActive())throw new Error('Conclua ou cancele o treino atual antes de escolher outro deck.');
  const form=document.getElementById('coach-form');
  const values=form?new FormData(form):new FormData();
  coachReadiness=Object.fromEntries(['fatigue','recovery','area','pain'].map(key=>[key,values.get('readiness_'+key)||(key==='area'?'all':'unknown')]));
  coachPlan=presetPlan(btn.dataset.missionId,g().entities,dateLocal(),coachReadiness);
  await handleCoachAction({dataset:{coachAction:'start'}});
  window.scrollTo(0,0);
  return;
 }
 if(action==='preset'){""")
swap("if(action==='clear'){coachPlan=null;coachSelected='';render();return;}", "if(action==='clear'){coachPlan=null;coachSelected='';render();window.scrollTo(0,0);return;}")
swap("const composer=panel(`${active?'<details><summary>Conversa e ajuda</summary>':''}<div class=\"planner-art\" aria-hidden=\"true\"></div><div class=\"planner-content\"><div class=\"planner-kicker\">SUA PRÓXIMA MISSÃO</div><h2>Monte seu treino</h2><p class=\"planner-intro\">Diga o que quer treinar e quanto tempo tem. Revise as cartas antes de começar.</p>",
     """const composer=panel(`<details><summary>${active?'Conversa e ajuda':'Assistente de treino'}</summary><div class="planner-content">""")
swap("${active?'</details>':''}`,'conversation-panel planner-panel'+(active?' session-help':''))",
     "</details>`,'conversation-panel planner-panel session-help')")
swap("<h2>Começar com um modelo salvo</h2>${renderPresetLibrary()}<h3>Seus modelos pessoais</h3>",
     "<details><summary>Seus modelos pessoais</summary>")
swap("Gerenciar modelos e exercícios</button>`,'saved-coach-models'",
     "Gerenciar modelos e exercícios</button></details>`,'saved-coach-models'")
swap('return `${describeSave()}${!active?deckRecap:\'\'}${active?current+renderTrainingTools(active,selected,m)',
     'return `${!active?deckRecap+(coachPlan?preview:renderMissionHome()):\'\'}${active?current+renderTrainingTools(active,selected,m)')
swap("+composer:composer+preview}${!active?renderSavedCoachTemplates():''}${actions}`;",
     "+composer:composer+renderSavedCoachTemplates()}${actions}${describeSave()}`;")

swap(' return panel(`<div class="focus-exercise-kicker">EXERCÍCIO ATUAL</div><h1 class="focus-exercise-name">${e(m.exerciseMap.get(v?.exercise_id)?.name||\'Selecione um exercício\')}</h1>',
     ''' const exerciseName=m.exerciseMap.get(v?.exercise_id)?.name||'Selecione um exercício';
 return panel(`<h1 class="focus-exercise-name">${e(exerciseName)}</h1>''')
swap("${renderLiveGuidance(active,selected,m)}${renderLoadReference(active,selected,m)}${entry}${renderPlanControls(active,selected,m)}",
     """${renderMissionExerciseArt(exerciseName,v?.equipment_or_variation)}${entry}
 ${renderMissionRecent(active,selected,m)}${renderMissionNext(active,selected,m)}
 <details class="mission-controls"><summary>Opções do exercício</summary>
 ${renderLiveGuidance(active,selected,m)}${renderLoadReference(active,selected,m)}${renderPlanControls(active,selected,m)}
 </details>""")
source += '\n' + (root / 'testing/principal_mission_ui.js').read_text()
app.write_text(source)

assets = ('mission-cover.webp', 'mission-deck.webp', 'mission-avenue.webp', 'mission-incline.webp')
for asset in assets:
    shutil.copy2(root / 'testing/assets' / asset, dist)

shutil.copy2(root / 'testing/principal_mission.css', dist)
for name in ('index.html','sw.js','integrity.js','app.js'):
    path = dist / name
    text = (path.read_text()
            .replace('shell-v203-coastal-update', 'shell-v204-mission')
            .replace('app.js?v=203', 'app.js?v=204')
            .replace('index.html?release=203', 'index.html?release=204')
            .replace('v1.6.11 Edição tropical','v1.6.12 Edição tropical')
            .replace('Treino & Evolução · v1.6.11','Treino & Evolução · v1.6.12'))
    if name == 'index.html':
        text = text.replace('</head>', '<link rel="stylesheet" href="./principal_mission.css?v=204">\n</head>')
    if name in ('sw.js','integrity.js'):
        entries = ('principal_mission.css?v=204', *assets)
        text = text.replace("'./app.js?v=204'", "'./app.js?v=204'," + ','.join(repr('./'+asset) for asset in entries))
    path.write_text(text)
