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
runpy.run_path(str(out / 'testing/principal_focus_patch.py'))

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

# Compact preview cards and refresh their offline cache (v1.6.5).
p=dist/'index.html'
p.write_text(p.read_text().replace('principal_deckrow.css?v=154','principal_deckrow.css?v=165').replace('v1.6.4 Painel de treino','v1.6.5 Cartas compactas'))
for name in ('sw.js','integrity.js'):
 p=dist/name
 p.write_text(p.read_text().replace('principal_deckrow.css?v=154','principal_deckrow.css?v=165').replace('shell-v164-focus','shell-v165-compact-cards'))

# Hide the requested secondary panels without changing their data or handlers.
p=dist/'app.js'
s=p.read_text()
headings=('Armazenamento','Importar / restaurar','Backup privado','Recuperação de segurança','Preferências','Instalação Android')
lines=s.splitlines(keepends=True)
for heading in headings:
 matches=[i for i,line in enumerate(lines) if '${panel(`<h2>'+heading+'</h2>' in line or '${recoveryAvailable?panel(`<h2>'+heading+'</h2>' in line]
 assert len(matches)==1,heading
 i=matches[0]
 if heading=='Recuperação de segurança':
  lines[i]=lines[i].replace("`,'warn')", "`,'warn more-hidden-detail')")
 else:
  lines[i]=lines[i].replace('`)}',"`,'more-hidden-detail')}")
p.write_text(''.join(lines))
p=dist/'principal_focus.css'
p.write_text(p.read_text()+'\n.more-hidden-detail{display:none!important}\n')
p=dist/'index.html'
p.write_text(p.read_text().replace('app.js?v=164','app.js?v=166').replace('principal_focus.css?v=164','principal_focus.css?v=166').replace('v1.6.5 Cartas compactas','v1.6.6 Mais simplificado'))
for name in ('sw.js','integrity.js'):
 p=dist/name
 p.write_text(p.read_text().replace('app.js?v=164','app.js?v=166').replace('principal_focus.css?v=164','principal_focus.css?v=166').replace('shell-v165-compact-cards','shell-v166-more-simple'))

# Required, visible set fields and explicit set type (v1.6.7).
p=dist/'app.js';s=p.read_text()
s=s.replace('<details class="focus-options"><summary>Mais opções · RIR e aquecimento</summary><div class="quick-grid">','<div class="quick-grid required-set-fields">')
s=s.replace('<p id="entry-rir-help"','<p id="entry-rir-help"',1)
s=s.replace('</p></details><button class="btn primary block" type="submit">Salvar série','</p><button class="btn primary block" type="submit">Salvar série')
s=s.replace('RIR <small>opcional · 0 a 10</small>','RIR <small>obrigatório · 0 a 10</small>')
s=s.replace('name="rir" inputmode="decimal"','name="rir" required inputmode="decimal"')
s=s.replace('<select name="kind" class="input"><option value="effective">Trabalho</option>','<select name="kind" class="input" required><option value="" ${!draft.kind?\'selected\':\'\'} disabled>Selecione o tipo</option><option value="effective" ${draft.kind===\'effective\'?\'selected\':\'\'}>Trabalho</option>')
s=s.replace("rir=numeric(values.get('rir'),true)","rir=numeric(values.get('rir'))")
old="`${s.load_value??'—'} ${m.variantMap.get(s.variant_id)?.unit||''} · ${s.repetitions??'—'} reps · RIR ${s.rir??'não informado'}`"
new="`${({effective:'Trabalho',warmup:'Aquecimento',core:'Core',drop_set:'Drop set',other:'Outra'})[s.set_type]||'Tipo não informado'} · ${s.load_value??'—'} ${m.variantMap.get(s.variant_id)?.unit||''} · ${s.repetitions??'—'} reps · RIR ${s.rir??'não informado'}`"
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace('Treino & Evolução · v1.6.4','Treino & Evolução · v1.6.7')
p.write_text(s)
p=dist/'index.html';p.write_text(p.read_text().replace('app.js?v=166','app.js?v=167').replace('v1.6.6 Mais simplificado','v1.6.7 Registro completo'))
for name in ('sw.js','integrity.js'):
 p=dist/name;p.write_text(p.read_text().replace('app.js?v=166','app.js?v=167').replace('shell-v166-more-simple','shell-v167-required-set'))

# Persist session start and display a wall-clock based HH:MM:SS timer.
p=dist/'app.js';s=p.read_text()
s=s.replace("status:'in_progress',duration_minutes:null", "status:'in_progress',started_at:new Date().toISOString(),duration_minutes:null")
needle='<small>${liveGuidance(active,selected,m.entities).reached} / ${planIds.length} metas atingidas</small>'
assert s.count(needle)==1;s=s.replace(needle,needle+'${renderSessionClock(active)}')
needle=" const a=btn.dataset.action;if(!a)return;";assert s.count(needle)==1
s=s.replace(needle,needle+"\n if(a==='start-session-clock'){const active=coachActive();if(!active||active.id!==btn.dataset.session)return;await perform(d=>{const session=d.overlay.sessions.find(x=>x.id===active.id&&x.status==='in_progress');if(session&&!session.started_at&&!session.clock_started_at)session.clock_started_at=new Date().toISOString();},'Contagem iniciada agora. O início original não foi informado.');return;}\n")
s+='''
function sessionClockSeconds(start,now=Date.now()){
 const ms=typeof start==='string'?Date.parse(start):NaN;
 return Number.isFinite(ms)?Math.max(0,Math.floor((now-ms)/1000)):null;
}
function sessionClockLabel(seconds){
 if(seconds===null)return '—';
 return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(x=>String(x).padStart(2,'0')).join(':');
}
function renderSessionClock(session){
 const start=session.started_at||session.clock_started_at,seconds=sessionClockSeconds(start);
 if(seconds===null)return '<div class="session-clock"><small>Início não registrado</small><button class="btn small" data-action="start-session-clock" data-session="'+e(session.id)+'">Contar a partir de agora</button></div>';
 const time=new Date(start).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
 return '<div class="session-clock"><small>'+(session.started_at?'Início do treino: ':'Contagem iniciada: ')+e(time)+'</small><strong role="timer" aria-label="Tempo decorrido" data-session-clock="'+e(start)+'">'+sessionClockLabel(seconds)+'</strong></div>';
}
function updateSessionClock(){
 document.querySelectorAll('[data-session-clock]').forEach(el=>{el.textContent=sessionClockLabel(sessionClockSeconds(el.dataset.sessionClock));});
}
setInterval(updateSessionClock,1000);
document.addEventListener('visibilitychange',updateSessionClock);
'''
s=s.replace('Treino & Evolução · v1.6.7','Treino & Evolução · v1.6.8');p.write_text(s)
p=dist/'template_ops.js';p.write_text(p.read_text().replace("status:'in_progress',duration_minutes:null", "status:'in_progress',started_at:new Date().toISOString(),duration_minutes:null"))
p=dist/'principal_focus.css';p.write_text(p.read_text()+'\n.session-clock{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:10px}.session-clock small{display:block;font-size:12px}.session-clock strong{font:700 25px/1.2 system-ui,sans-serif;font-variant-numeric:tabular-nums;color:#f2dfac;white-space:nowrap;letter-spacing:.04em}\n')
p=dist/'index.html';p.write_text(p.read_text().replace('app.js?v=167','app.js?v=168').replace('principal_focus.css?v=166','principal_focus.css?v=168').replace('v1.6.7 Registro completo','v1.6.8 Tempo do treino'))
for name in ('sw.js','integrity.js'):
 p=dist/name;p.write_text(p.read_text().replace('app.js?v=167','app.js?v=168').replace('principal_focus.css?v=166','principal_focus.css?v=168').replace('shell-v167-required-set','shell-v168-session-clock'))
