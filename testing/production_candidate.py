"""Build an isolated production candidate; never publish or mutate the source app."""
from pathlib import Path
import runpy
import shutil
import sys

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve()
assert not out.exists(), 'Output directory must not exist'
assert out != root and root not in out.parents, 'Choose an isolated output directory'
out.mkdir(parents=True)
dist = out / 'dist'
dist.mkdir()
for p in (root / 'dist').iterdir():
    if p.name not in ('testes', 'tests'):
        if p.is_dir(): shutil.copytree(p, dist / p.name)
        elif p.is_file(): shutil.copy2(p, dist / p.name)
shutil.copytree(root / 'testing', out / 'testing')

def replace_once(text, old, new):
    assert text.count(old) == 1, old
    return text.replace(old, new)

# Reuse the independently tested patches in an isolated build directory.
for name in ('patch_input_validation.py','patch_sync_queue.py','patch_grid_read.py',
             'patch_missing_ids.py','patch_concurrency_gate.py'):
    p = out / 'testing' / name
    source = p.read_text()
    source = source.replace('dist/testes', 'dist')
    if name == 'patch_concurrency_gate.py':
        source = source.replace('Envios de testes pausados:', 'Envios pausados:')
        source = source.replace('Sincronização coordenada em validação no ambiente de testes.', 'Sincronização coordenada em validação.')
    p.write_text(source)
    runpy.run_path(str(p))

client = dist / 'coordinator_client.js'
client.write_text(replace_once(client.read_text(), "result.environment!=='test'", "result.environment!=='production'"))
transport = dist / 'sheet_sync_browser.js'
source = "import {SHEET_ID as PRODUCTION_SHEET_ID} from './sheets_config.js';\n" + transport.read_text()
source = replace_once(source, "return id;\n}", "if(id!==PRODUCTION_SHEET_ID)throw new Error('Destino diferente da planilha principal.');return id;\n}")
transport.write_text(source)
session_patch = (root / 'testing/production_session_patch.py').read_text()
exec(compile(session_patch, str(root / 'testing/production_session_patch.py'), 'exec'), {'dist': dist})
# Apply the existing coach integration to the principal distribution only.
coach_patch = (root / 'testing/patch_balanced_coach.py').read_text().replace("dest=root/'dist/testes'", "dest=root/'dist'")
exec(compile(coach_patch, str(out / 'testing/patch_balanced_coach.py'), 'exec'),
     {'__file__': str(out / 'testing/patch_balanced_coach.py')})
coach_module = dist / 'balanced_coach.js'
coach_module.write_text(replace_once(coach_module.read_text(),
    'Sugestão inicial para testes; ajuste o equipamento antes de registrar.',
    'Sugestão inicial; confira o equipamento antes de registrar.'))
shutil.copy2(root / 'testing/principal_variety.js', dist / 'principal_variety.js')
shutil.copy2(root / 'testing/principal_dose.js', dist / 'principal_dose.js')
app = dist / 'app.js'
app.write_text(replace_once(app.read_text(),
    "import {balancedPlan,replacementFor,catalogEntities,historySummary} from './balanced_coach.js';",
    "import {balancedPlan,replacementFor} from './principal_variety.js';\nimport {catalogEntities,historySummary} from './balanced_coach.js';"))
app.write_text(replace_once(app.read_text(), '${draft.group} · ${draft.equipment}',
    '${draft.group} · ${draft.movementLabel||\'Padrão não identificado\'} · ${draft.equipment}'))
app.write_text(replace_once(app.read_text(), '${draft.equipment} · ${draft.last?',
    '${draft.equipment} · ${draft.dose?.label||\'\'} · ${draft.dose?.source||\'\'} ${draft.dose?.effort||\'\'} · ${draft.last?'))
app.write_text(replace_once(app.read_text(), '${q} série(s) registrada(s)`;const controls=',
    '${q} série(s) registrada(s) · ${active?.planned_guidance?.[id]?.label||\'\'}`;const controls='))
app.write_text(replace_once(app.read_text(), 'Revise o roteiro: nenhuma série foi criada.',
    'Revise o roteiro: nenhuma série foi criada. Séries sugeridas não incluem aquecimento. Faixas e limites são pontos de partida do app; não garantem duração nem recuperação. Você registra apenas o que realizar.'))
app.write_text(replace_once(app.read_text(), "notes:'Sessão iniciada pelo assistente local.',planned_variant_ids:ids,",
    "notes:'Sessão iniciada pelo assistente local. Sugestões (não realizadas): '+coachPlan.items.filter(x=>x.dose).map(x=>x.name+': '+x.dose.label).join('; '),planned_guidance:Object.fromEntries(coachPlan.items.filter(x=>x.dose).map(x=>[x.variant_id,{...x.dose}])),planned_variant_ids:ids,"))
for name in ('sw.js', 'integrity.js'):
    file = dist / name
    file.write_text(replace_once(file.read_text(), "'./balanced_coach.js'", "'./principal_dose.js','./principal_variety.js','./balanced_coach.js'"))
index = dist / 'index.html'
runpy.run_path(str(out / 'testing/principal_live_patch.py'))
runpy.run_path(str(out / 'testing/principal_tools_patch.py'))
runpy.run_path(str(out / 'testing/principal_visual_patch.py'))
runpy.run_path(str(out / 'testing/principal_intent_patch.py'))
runpy.run_path(str(out / 'testing/principal_cards_patch.py'))
runpy.run_path(str(out / 'testing/principal_premium_patch.py'))
runpy.run_path(str(out / 'testing/principal_rpg_patch.py'))
runpy.run_path(str(out / 'testing/principal_world_patch.py'))
index.write_text(replace_once(index.read_text(), "connect-src 'self' https://sheets.googleapis.com https://accounts.google.com;",
                              "connect-src 'self' https://sheets.googleapis.com https://script.googleapis.com https://accounts.google.com;"))
for name in ('sw.js','integrity.js'):
    p = dist / name
    p.write_text(replace_once(p.read_text(), 'treino-evolucao-android-shell-v112-coach-plan-sync',
                              'treino-evolucao-android-shell-v140-rpg-world'))
index.write_text(replace_once(index.read_text(), 'v1.1.2 beta Assistente Plano', 'v1.4.0 Mundo RPG'))

runpy.run_path(str(out / 'testing/principal_entry_patch.py'))
runpy.run_path(str(out / 'testing/principal_visibility_patch.py'))
runpy.run_path(str(out / 'testing/principal_planner_patch.py'))
runpy.run_path(str(out / 'testing/principal_launch_patch.py'))
runpy.run_path(str(out / 'testing/principal_install_patch.py'))
runpy.run_path(str(out / 'testing/principal_cancel_patch.py'))
runpy.run_path(str(out / 'testing/principal_unit_patch.py'))
runpy.run_path(str(out / 'testing/principal_presets_patch.py'))

code = (root / 'testing/coordinator/Code.gs').read_text()
code = replace_once(code, "'1ZWow3SHWxgy-j7s3GWTJd1AxYXQb-E-ca_GTgK2_5CA'", "'15Nntilky9pyv1OrQMyOd6k97DsE_tU7I4aJtISQdL2M'")
code = replace_once(code, "result.environment='test'", "result.environment='production'")
code = code.replace('SYNTHETIC test spreadsheet only', 'production spreadsheet candidate')
code = code.replace('confirming the test-only Sheet', 'confirming the production Sheet')
(out / 'Code.gs').write_text(code)
shutil.copy2(root / 'testing/coordinator/appsscript.json', out / 'appsscript.json')
# Run the existing server simulation against the production-bound candidate.
(out / 'testing/coordinator/Code.gs').write_text(code)
mock = out / 'testing/coordinator/mock_service.mjs'
mock.write_text(replace_once(mock.read_text(), '1ZWow3SHWxgy-j7s3GWTJd1AxYXQb-E-ca_GTgK2_5CA',
                             '15Nntilky9pyv1OrQMyOd6k97DsE_tU7I4aJtISQdL2M'))
print('PRODUCTION_CANDIDATE_BUILT; COORDINATOR_DISABLED; NOT_DEPLOYED')
