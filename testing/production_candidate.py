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
for name in ('sw.js','integrity.js'):
    p = dist / name
    p.write_text(replace_once(p.read_text(), 'treino-evolucao-android-shell-v112-coach-plan-sync',
                              'treino-evolucao-android-shell-v112-coordinated-session2'))

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
