"""Install tropical cover art and the reviewed Deck 1 exercise illustrations."""

covers = tuple(f'deck-cover-{number:02}.webp' for number in range(1, 5))
deck_one = (
    'crucifixo-maquina-inclinada', 'supino-inclinado-halteres', 'supino-reto-barra',
    'supino-declinado-maquina', 'rosca-scott-maquina', 'rosca-direta-polia',
    'rosca-martelo', 'elevacao-lateral-polia',
)
for cover in covers:
    shutil.copy2(root / 'testing/assets' / cover, dist)

for slug in deck_one:
    filename = f'exercise-{slug}.webp'
    shutil.copy2(root / 'testing/assets/deck-one' / filename, dist / filename)

art = dist / 'principal_exercise_art.js'
source = art.read_text()
rules = {
    'rosca-scott-maquina': " if(n==='rosca scott'&&/maquina/.test(both))return art('rosca-scott-maquina');",
    'rosca-direta-polia': " if(n==='rosca direta'&&/polia/.test(both))return art('rosca-direta-polia');",
}
for rule in rules.values():
    source = source.replace(' return null;', rule + '\n return null;')
art.write_text(source)

app = dist / 'app.js'
source = app.read_text()
source = source.replace('./mission-deck.webp" width="146"', './deck-cover-01.webp" width="146"')
source = source.replace("${i===0?'./mission-deck.webp':'./mission-avenue.webp'}", './deck-cover-0${i+2}.webp')
source = source.replace(" const source=image.src==='./exercise-supino-inclinado-halteres.webp'?'./mission-incline.webp':image.src;", ' const source=image.src;')
source = source.replace('principal_exercise_art.js?v=194', 'principal_exercise_art.js?v=206')
source = source.replace('${renderPlanSummary(coachPlan)}',
                        '${renderPresetCover(coachPlan.presetId)}${renderPlanSummary(coachPlan)}', 1)
source += '''
function renderPresetCover(id) {
 const index=PRESET_DECKS.findIndex(deck=>deck.id===id);
 return index<0?'':`<img class="deck-preview-cover" src="./deck-cover-0${index+1}.webp" width="640" height="426" alt="">`;
}
'''
app.write_text(source)
cards = dist / 'principal_cards.js'
cards.write_text(cards.read_text().replace('principal_exercise_art.js?v=194', 'principal_exercise_art.js?v=206'))

css = dist / 'principal_mission.css'
css.write_text(css.read_text() + '''
.deck-preview-cover {
  display: block;
  width: 100%;
  height: clamp(110px, 34vw, 200px);
  object-fit: cover;
  border-radius: 10px;
  margin: 0 0 10px;
}
.mission-exercise-art {
  object-fit: contain;
  background: radial-gradient(ellipse at center, #482942, #21182f 80%);
}
''')
for name in ('index.html', 'app.js', 'integrity.js', 'sw.js'):
    path = dist / name
    source = (path.read_text()
              .replace('shell-v205-brand', 'shell-v206-deck-art')
              .replace('app.js?v=205', 'app.js?v=206')
              .replace('index.html?release=205', 'index.html?release=206')
              .replace('principal_exercise_art.js?v=194', 'principal_exercise_art.js?v=206')
              .replace('principal_mission.css?v=204', 'principal_mission.css?v=206')
              .replace('v1.6.13', 'v1.6.14'))
    if name in ('sw.js', 'integrity.js'):
        assets = [*covers, *(f'exercise-{slug}.webp' for slug in rules)]
        source = source.replace("'./app.js?v=206'", "'./app.js?v=206'," + ','.join(repr('./'+asset) for asset in assets))
    path.write_text(source)
