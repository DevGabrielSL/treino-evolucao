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
s=s.replace('</p></details><div data-drop-parts>','</p><div data-drop-parts>')
s=s.replace('RIR <small>opcional · 0 a 10</small>','RIR <small>obrigatório · 0 a 10</small>')
s=s.replace('name="rir" inputmode="decimal"','name="rir" required inputmode="decimal"')
s=s.replace('<select name="kind" class="input"><option value="effective">Trabalho</option>','<select name="kind" class="input" required><option value="" ${!draft.kind?\'selected\':\'\'} disabled>Selecione o tipo</option><option value="effective" ${draft.kind===\'effective\'?\'selected\':\'\'}>Trabalho</option>')
s=s.replace("rir=numeric(values.get('rir'),true)","rir=numeric(values.get('rir'))")
old="`${s.load_value??'—'} ${m.variantMap.get(s.variant_id)?.unit||''} · ${s.repetitions??'—'} reps · RIR ${s.rir??'não informado'}${dropSequence(s,activeSets,m.variantMap.get(s.variant_id)?.unit||'')}`"
new="`${({effective:'Trabalho',warmup:'Aquecimento',core:'Core',drop_set:'Drop set',other:'Outra'})[s.set_type]||'Tipo não informado'} · ${s.load_value??'—'} ${m.variantMap.get(s.variant_id)?.unit||''} · ${s.repetitions??'—'} reps · RIR ${s.rir??'não informado'}${dropSequence(s,activeSets,m.variantMap.get(s.variant_id)?.unit||'')}`"
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

# Direção artística aprovada: apenas camada visual.
runpy.run_path(str(out / 'testing/principal_relics_patch.py'))

# v1.6.10 — integrar as imagens aprovadas na distribuição principal.
runpy.run_path(str(out / 'testing/principal_relics_art_patch.py'))

# Refresh cached training assets for the revised series flow.
for name in ('sw.js','integrity.js'):
 p=dist/name
 p.write_text(p.read_text().replace('shell-v170-relic-art','shell-v174-deck-progress'))

# Show the work already done and the remaining plan on each compact card.
p=dist/'principal_cards.js';s=p.read_text()
old='count:state.count,target:state.target'
assert s.count(old)==1
p.write_text(s.replace(old,'count:state.count,skipped:state.skipped,resolved:state.resolved,target:state.target'))
p=dist/'app.js';s=p.read_text()
old="<span>${x.count}${x.target!==null?' / '+x.target:''} séries</span>"
new="""<span>${x.count} feita(s)${x.skipped?' · '+x.skipped+' pulada(s)':''}${x.target===null?'':' · '+Math.max(0,x.target-x.resolved)+' restante(s)'}</span>"""
assert s.count(old)==1
s=s.replace(old,new)
old="${models.filter(x=>x.reached).length}/${models.length} metas atingidas"
new="${models.filter(x=>x.target!==null&&x.resolved>=x.target).length}/${models.length} exercícios sem pendências"
assert s.count(old)==1
p.write_text(s.replace(old,new))

# Direct editing for every recent series and each drop segment.
p=dist/'app.js';s=p.read_text()
needle="${dropSequence(s,activeSets,m.variantMap.get(s.variant_id)?.unit||'')}`)).join"
replacement="${dropSequence(s,activeSets,m.variantMap.get(s.variant_id)?.unit||'')}`,renderSeriesEditActions(s,activeSets,new Set(doc.overlay.sets.map(row=>row.id))))).join"
assert s.count(needle)==1
s=s.replace(needle,replacement)
start=s.index('function renderSetEditor(');end=s.index('function sessionDetail(',start)
editor=s[start:end]
editor=editor.replace('RIR (opcional)','RIR')
editor=editor.replace('name="load" type=', 'name="load" required type=')
editor=editor.replace('name="reps" type=', 'name="reps" required type=')
editor=editor.replace('name="rir" type=', 'name="rir" required type=')
editor=editor.replace('min="0" max="500"','min="1" max="500"')
editor=editor.replace('max="30"','max="10"')
editor=editor.replace('<div class="inline-actions"><button class="btn primary" type="submit">Salvar correção',
 '<div class="inline-actions"><button class="btn primary" type="submit">Salvar correção')
editor=editor.replace("</form>`,'tinted');", "</form>${renderSeriesEditActions(s,m.sets,new Set(doc.overlay.sets.map(row=>row.id)))}`,'tinted');")
s=s[:start]+editor+s[end:]
start=s.index(" if(f.id==='edit-set-form'){");end=s.index(" if(f.id==='edit-session-form'){",start)
handler=s[start:end].replace("parseNumber(x.load,{max:10000})","parseNumber(x.load,{allowEmpty:false,max:10000})").replace("parseNumber(x.reps,{max:500})","parseNumber(x.reps,{allowEmpty:false,min:1,max:500})").replace("parseNumber(x.rir,{max:30})","parseNumber(x.rir,{allowEmpty:false,max:10})")
s=s[:start]+handler+s[end:]
s+='''
function renderSeriesEditActions(row,sets,editable){
 const parent=row.set_type==='drop_set'?sets.find(s=>s.session_id===row.session_id&&row.notes==='Drop de '+s.id)||row:row;
 const drops=sets.filter(s=>s.session_id===parent.session_id&&s.set_type==='drop_set'&&s.notes==='Drop de '+parent.id).sort((a,b)=>a.set_number-b.set_number);
 const rows=[parent,...drops];
 return '<div class="inline-actions mt">'+rows.filter(s=>editable.has(s.id)).map((s,i)=>
  '<button type="button" class="btn small" data-edit-set="'+e(s.id)+'">'+(drops.length?(i===0?'Corrigir série inicial':'Corrigir redução '+i):'Corrigir série')+'</button>'
 ).join('')+'</div>';
}
'''
p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;p.write_text(p.read_text().replace('shell-v174-deck-progress','shell-v175-series-edit'))

# Keep the previous comparable load beside the entry fields.
p=dist/'app.js';s=p.read_text()
needle='${renderLiveGuidance(active,selected,m)}${entry}'
assert s.count(needle)==1
s=s.replace(needle,'${renderLiveGuidance(active,selected,m)}${renderLoadReference(active,selected,m)}${entry}')
helper='''
function renderLoadReference(active,selected,m){
 const reference=liveGuidance(active,selected,m.entities).reference;
 if(!reference)return '<div class="load-reference"><span>Último treino compatível</span><p>Sem carga anterior confirmada para este equipamento e unidade.</p></div>';
 const unit=m.variantMap.get(selected)?.unit||'';
 const rows=m.entities.sets.filter(s=>s.session_id===reference.session_id&&s.variant_id===reference.variant_id&&['effective','core','back_off'].includes(s.set_type))
  .sort((a,b)=>(a.set_number||0)-(b.set_number||0));
 const label=row=>e(row.load_value??'—')+' '+e(unit)+' × '+e(row.repetitions??'—')+' · RIR '+e(row.rir??'não informado');
 return '<div class="load-reference"><span>Último treino compatível · '+e(reference.date)+'</span><p><strong>'+label(reference)+'</strong></p>'+
 '<button type="button" class="btn small" data-coach-action="use-reference" data-reference-session="'+e(active.id)+'" data-reference-variant="'+e(selected)+'">Usar carga e repetições</button>'+
 (rows.length>1?'<details><summary>Ver séries daquele treino</summary>'+rows.map(row=>'<p>'+label(row)+'</p>').join('')+'</details>':'')+
 '<p class="text-small" data-reference-feedback role="status"></p></div>';
}
'''
s=s.replace('function renderCoach(',helper+'\nfunction renderCoach(',1)
needle=" if(action==='next'){"
assert s.count(needle)==1
s=s.replace(needle,''' if(action==='use-reference'){
  const active=coachActive();
  if(!active||active.id!==btn.dataset.referenceSession||coachSelected!==btn.dataset.referenceVariant)
   throw new Error('A seleção mudou. Confira o exercício atual.');
  const reference=liveGuidance(active,coachSelected,g().entities).reference;
  const form=document.querySelector('#quick-set-form');
  if(!reference||!form||String(form.elements.namedItem('variant_id').value)!==coachSelected)
   throw new Error('Confirme o equipamento e a unidade antes de usar a referência.');
  const load=form.elements.namedItem('load'),reps=form.elements.namedItem('reps');
  load.value=String(reference.load_value??'');
  reps.value=String(reference.repetitions??'');
  onInput({target:load});
  const feedback=btn.closest('.load-reference').querySelector('[data-reference-feedback]');
  feedback.textContent='Carga e repetições preenchidas. Informe o RIR e o tipo da série realizada.';
  load.focus();
  return;
 }
'''+needle)
p.write_text(s)
p=dist/'principal_focus.css'
p.write_text(p.read_text()+'\n.load-reference{padding:12px;margin:12px 0 16px;border:1px solid #6b9586;border-radius:12px;background:#102f2c}.load-reference>span{font:600 12px/1.4 system-ui;color:#b9ddd0}.load-reference p{margin:6px 0;line-height:1.5}.load-reference strong{font:650 16px/1.5 system-ui;color:#f5e5bd}.load-reference details{margin-top:10px}.load-reference summary{font-size:13px}\n')
for name in ('sw.js','integrity.js'):
 p=dist/name;p.write_text(p.read_text().replace('shell-v175-series-edit','shell-v176-load-reference').replace('principal_focus.css?v=168','principal_focus.css?v=176'))
p=dist/'index.html';p.write_text(p.read_text().replace('principal_focus.css?v=168','principal_focus.css?v=176'))
