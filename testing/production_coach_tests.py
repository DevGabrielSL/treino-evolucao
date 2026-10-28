"""Run the coach regressions against the principal build, without modifying either published app."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
candidate = Path(sys.argv[1]).resolve()
source = (root / 'testing/balanced_coach_tests.mjs').read_text()
assert '../dist/testes/' in source
script = candidate / 'testing/principal_coach_tests.mjs'
script.write_text(source.replace('../dist/testes/', '../dist/'))
subprocess.run(['node', str(script)], check=True)
subprocess.run(['node', str(candidate / 'testing/principal_variety_tests.mjs')], check=True)
subprocess.run(['node', str(candidate / 'testing/principal_dose_tests.mjs')], check=True)
subprocess.run(['node', str(candidate / 'testing/principal_live_tests.mjs')], check=True)
subprocess.run(['node', str(candidate / 'testing/principal_tools_tests.mjs')], check=True)
dist = candidate / 'dist'
app = (dist / 'app.js').read_text()
for text in ('balancedPlan(m.entities', 'historySummary(coachPlan.history)', 'readinessFields()',
             "automaticSheets.request('save')", 'Seu relato mudou'):
    assert text in app, text
for name in ('sw.js', 'integrity.js'):
    content = (dist / name).read_text()
    assert "'./balanced_coach.js'" in content
    assert 'shell-v117-training-tools' in content
    assert "'./principal_variety.js'" in content
    assert "'./principal_dose.js'" in content
    assert "'./principal_live.js'" in content
    assert "'./principal_rest.js'" in content
assert 'v1.1.7 Descanso e registro rápido' in (dist / 'index.html').read_text()
for file in dist.glob('*.js'):
    subprocess.run(['node', '--check', str(file)], check=True)
print('PRINCIPAL_COACH_INTEGRATION=PASS')
