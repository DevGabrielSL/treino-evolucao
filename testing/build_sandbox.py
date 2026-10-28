"""Build the synthetic, isolated test app without changing production assets."""
import os
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'dist'
DEST = PUBLIC / 'testes'
TEST_SHEET = '1ZWow3SHWxgy-j7s3GWTJd1AxYXQb-E-ca_GTgK2_5CA'
FORBIDDEN = ('15Nntilky9pyv1OrQMyOd6k97DsE_tU7I4aJtISQdL2M', '1I8J-hCIaZz-MxO1kW6Gh-ASXX5p3hF83lXBOHNp2ZXc')

def hashes():
    return {str(p.relative_to(PUBLIC)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in PUBLIC.rglob('*') if p.is_file() and DEST not in p.parents}

before = hashes()
assert len(before) == 28, 'Unexpected production distribution'
if DEST.exists():
    shutil.rmtree(DEST)
DEST.mkdir()
for relative in before:
    target = DEST / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(PUBLIC / relative, target)

def edit(name, old, new, count=1):
    p = DEST / name
    text = p.read_text()
    assert text.count(old) == count, (name, old)
    p.write_text(text.replace(old, new))

config = DEST / 'sheets_config.js'
config.write_text(config.read_text().replace(FORBIDDEN[0], TEST_SHEET))
edit('store.js', "const DB_NAME='treino-evolucao-local-android-v1';", "const DB_NAME='treino-evolucao-sandbox-local-v1';")
old_cache = 'treino-evolucao-android-shell-v112-coach-plan-sync'
cache = 'treino-evolucao-sandbox-shell-v112-test8-balanced'
edit('sw.js', old_cache, cache)
edit('integrity.js', old_cache, cache)
edit('sw.js', "k.startsWith('treino-evolucao-android-shell-')", "k.startsWith('treino-evolucao-sandbox-shell-')")
for name in ('sw.js', 'integrity.js'):
    edit(name, "'./app.js'", "'./fixtures.json','./test_seed.js','./app.js'")

transport = DEST / 'sheet_sync_browser.js'
transport.write_text("import {SHEET_ID as SANDBOX_SHEET_ID} from './sheets_config.js';\n" + transport.read_text())
edit('sheet_sync_browser.js', 'return id;\n}', "if(id!==SANDBOX_SHEET_ID)throw new Error('Ambiente de testes: destino não permitido.');return id;\n}")

seed = """import {emptyDocument} from './store.js';
import {stageInbound} from './sheet_sync_core.js';
import {parseCoachPlanRows} from './coach_plan_read.js';
export function createSandboxDocument(rows){
 const doc=stageInbound(emptyDocument(),rows).next;
 doc.settings.coach_plan_rules=parseCoachPlanRows(rows.Plano);
 doc.settings.sheet_sync={auto:false};
 return doc;
}
"""
(DEST / 'test_seed.js').write_text(seed)
shutil.copyfile(ROOT / 'testing/fixtures.json', DEST / 'fixtures.json')
edit('app.js', "import {parseGoal", "import {createSandboxDocument} from './test_seed.js';\nimport {parseGoal")
edit('app.js', 'doc=snap.document||emptyDocument();', "doc=snap.document||createSandboxDocument(await (await fetch('./fixtures.json',{cache:'no-store'})).json());")
for old, new in [
    ('A planilha original é a fonte principal.', 'Esta é a planilha de testes com dados fictícios.'),
    ('O Google Sheets é o histórico oficial.', 'Este ambiente usa somente a planilha de testes.'),
    ('Seu histórico local pode ser conectado à planilha original do Google Sheets.', 'Exemplos fictícios para testar registro e sincronização.'),
]:
    edit('app.js', old, new)

edit('index.html', '<title>Treino & Evolução · Android · v1.1.2 beta Assistente Plano</title>', '<title>TESTES · Treino & Evolução · v1.1.2-test.8</title>')
edit('index.html', '<b>Treino & Evolução</b>', '<b>TESTES · Treino & Evolução</b>')
edit('index.html', 'PERSONAL · OFFLINE-FIRST', 'DADOS FICTÍCIOS · AMBIENTE SEPARADO')
edit('index.html', '<main id="app"', '<aside class="sandbox-notice" role="note"><strong>AMBIENTE DE TESTES — DADOS FICTÍCIOS</strong><p>Use esta versão para experimentar. O destino é uma planilha separada e o banco local é exclusivo dos testes.</p></aside>\n<main id="app"')
with (DEST / 'styles.css').open('a') as f:
    f.write('\n.sandbox-notice{background:#fff1c2;color:#49360b;padding:14px 20px;border-bottom:2px solid #c9901e}.sandbox-notice p{margin:6px 0 0;font-size:14px;line-height:1.45}\n')
manifest = json.loads((DEST / 'manifest.webmanifest').read_text())
manifest.update(name='TESTES — Treino & Evolução', short_name='Treinos TESTES', description='Ambiente de homologação com dados fictícios e armazenamento separado.')
(DEST / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
for p in DEST.rglob('*'):
    if p.is_file() and p.suffix in ('.js', '.html', '.json', '.css', '.webmanifest'):
        assert not any(value in p.read_text() for value in FORBIDDEN), p
import runpy
runpy.run_path(str(ROOT / 'testing/patch_input_validation.py'))
runpy.run_path(str(ROOT / 'testing/patch_sync_queue.py'))
runpy.run_path(str(ROOT / 'testing/patch_grid_read.py'))
runpy.run_path(str(ROOT / 'testing/patch_missing_ids.py'))
if os.environ.get('SANDBOX_ENGINE_TEST_MODE') != '1':
    runpy.run_path(str(ROOT / 'testing/patch_concurrency_gate.py'))
    runpy.run_path(str(ROOT / 'testing/patch_balanced_coach.py'))
assert hashes() == before, 'Production files changed'
(ROOT / 'sandbox-build-summary.json').write_text(json.dumps({'production_unchanged': True, 'production_files': len(before), 'test_path': 'testes/', 'test_sheet_id': TEST_SHEET}, indent=2))
print('SANDBOX_BUILD=PASS; PRODUCTION_FILES_UNCHANGED=28')
