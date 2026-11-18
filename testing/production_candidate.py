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

# Review actual work and pending plan before finishing, then show a useful recap.
p=dist/'app.js';s=p.read_text()
old="  if(!confirm('Concluir treino com '+sets.length+' séries registradas? Revise se deseja encerrar. A sincronização automática tentará enviar quando habilitada.'))return;"
new="""  const summary=workoutCompletionSummary(active,g().entities);
  const pending=summary.pending.length?'\\n\\nPendências:\\n'+summary.pending.map(item=>item.name+' — '+item.remaining+' série(s)').join('\\n'):'';
  const review=summary.work+' série(s) de trabalho · '+summary.warmup+' aquecimento(s) · '+summary.drops+' redução(ões) de drop · '+summary.skipped+' pulada(s)';
  if(!confirm('Concluir este treino?\\n\\n'+review+pending+'\\n\\nCancelar volta ao treino. Confirmar encerra com os registros atuais.'))return;"""
assert s.count(old)==1
s=s.replace(old,new)
old="s.status='completed';},'Treino concluído no celular."
new="""s.finished_at=new Date().toISOString();
   const start=Date.parse(s.started_at||s.clock_started_at||'');
   if(Number.isFinite(start))s.duration_minutes=Math.max(0,Math.round((Date.parse(s.finished_at)-start)/60000));
   s.status='completed';},'Treino concluído no celular."""
assert s.count(old)==1
s=s.replace(old,new)
s=s.replace('deckRecap=renderDeckRecap(active,g().entities);','deckRecap=renderFinishSummary(doc.overlay.sessions.find(s=>s.id===id),g().entities);')
helper='''
function workoutCompletionSummary(session,entities){
 const sets=entities.sets.filter(row=>row.session_id===session.id);
 const variants=new Map(entities.exercise_variants.map(row=>[row.id,row]));
 const exercises=new Map((entities.exercises||[]).map(row=>[row.id,row]));
 const ids=[...new Set(session.planned_variant_ids||[])];
 const pending=ids.flatMap(id=>{
  const state=liveGuidance(session,id,entities);
  const remaining=state.target===null?0:Math.max(0,state.target-state.resolved);
  return remaining?[{name:exercises.get(variants.get(id)?.exercise_id)?.name||'Exercício',remaining}]:[];
 });
 return {
  work:sets.filter(row=>['effective','core','back_off'].includes(row.set_type)).length,
  warmup:sets.filter(row=>row.set_type==='warmup').length,
  drops:sets.filter(row=>row.set_type==='drop_set').length,
  skipped:ids.reduce((n,id)=>n+(session.skipped_series?.[id]||0),0),
  pending
 };
}
function renderFinishSummary(session,entities){
 const summary=workoutCompletionSummary(session,entities);
 const start=Date.parse(session.started_at||session.clock_started_at||'');
 const end=Date.parse(session.finished_at||'');
 const duration=Number.isFinite(start)&&Number.isFinite(end)?sessionClockLabel(Math.max(0,Math.floor((end-start)/1000))):'Tempo não registrado';
 return panel('<h2>Treino concluído</h2><p>'+e(session.name)+'</p><p><strong>'+e(duration)+'</strong></p>'+
 '<p>'+summary.work+' série(s) de trabalho · '+summary.warmup+' aquecimento(s)</p>'+
 '<p>'+summary.drops+' redução(ões) de drop · '+summary.skipped+' série(s) pulada(s)</p>'+
 (summary.pending.length?'<p>'+summary.pending.reduce((n,item)=>n+item.remaining,0)+' série(s) planejada(s) ficaram pendentes.</p>':'')+
 '<p class="text-small">Treino salvo no aparelho. Confira a confirmação de envio ao Google Sheets.</p>'+
 '<button class="btn block" data-page="data">Ver sincronização</button>','deck-recap');
}
'''
s=s.replace('function renderCoach(',helper+'\nfunction renderCoach(',1)
p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;p.write_text(p.read_text().replace('shell-v176-load-reference','shell-v177-finish-review'))

# Give corrections their own view and keep mobile controls usable.
p=dist/'app.js';s=p.read_text()
old="pages[page](m)+(editSetId&&doc.overlay.sets.some(s=>s.id===editSetId)?renderSetEditor(m,editSetId):'')"
new="(editSetId&&doc.overlay.sets.some(s=>s.id===editSetId)?renderSetEditor(m,editSetId):pages[page](m))"
assert s.count(old)==1
s=s.replace(old,new)
old="$('#edit-set-form')?.scrollIntoView({behavior:'smooth',block:'center'});"
assert s.count(old)>=1
s=s.replace(old,"focusSetEditor();")
s+='''
function focusSetEditor(){
 const form=document.querySelector('#edit-set-form');
 if(!form)return;
 form.scrollIntoView({block:'start',behavior:'auto'});
 form.elements.namedItem('load')?.focus({preventScroll:true});
}
'''
p.write_text(s)
p=dist/'principal_focus.css'
p.write_text(p.read_text()+"""
/* Mobile registration and correction layout. */
#quick-set-form,#edit-set-form{min-width:0;scroll-margin-top:20px}
#quick-set-form .quick-grid,#edit-set-form .form-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
#quick-set-form .field,#edit-set-form .field{min-width:0;margin:8px 0}
#quick-set-form .input,#edit-set-form .input{width:100%;min-width:0;min-height:50px;font-size:16px;box-sizing:border-box}
#quick-set-form input[name=load],#quick-set-form input[name=reps],#edit-set-form input[name=load],#edit-set-form input[name=reps]{font-size:24px;font-variant-numeric:tabular-nums}
#quick-set-form .field>span,#edit-set-form .field>span{min-height:0;line-height:1.4;margin-bottom:6px}
#quick-set-form .btn,#edit-set-form .btn,.training-entry+.inline-actions .btn{min-height:44px;white-space:normal}
#quick-set-form fieldset{min-width:0;margin:12px 0;padding:12px;border:1px solid #78958a;border-radius:10px}
#quick-set-form fieldset legend{padding:0 5px;font-size:13px}
#quick-set-form fieldset .btn{align-self:end}
#edit-set-form .inline-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
#edit-set-form .inline-actions>.btn{flex:1 1 130px;min-height:48px}
.surface:has(>#edit-set-form){padding:18px!important;max-width:680px;margin-inline:auto}
#app:has(#edit-set-form){padding-bottom:calc(110px + env(safe-area-inset-bottom,0px))}
@media(max-width:360px){#edit-set-form .form-grid,#quick-set-form fieldset.quick-grid{grid-template-columns:minmax(0,1fr)}}
@media(prefers-reduced-motion:reduce){#edit-set-form{scroll-behavior:auto}}
""")
for name in ('sw.js','integrity.js'):
 p=dist/name;p.write_text(p.read_text().replace('shell-v177-finish-review','shell-v178-mobile-edit').replace('principal_focus.css?v=176','principal_focus.css?v=178'))
p=dist/'index.html';p.write_text(p.read_text().replace('principal_focus.css?v=176','principal_focus.css?v=178'))


# Finisher goals, durable timers and last-set rest clock.
runpy.run_path(str(out / 'testing/principal_finisher_patch.py'))


# The first preset follows the user's exact exercise order; keep the closing block separate.
p=dist/'app.js';s=p.read_text();assert "./principal_presets.js?v=160" in s
p.write_text(s.replace('./principal_presets.js?v=160','./principal_presets.js?v=181'))
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text();assert 'shell-v180-finisher-layout' in s
 p.write_text(s.replace('shell-v180-finisher-layout','shell-v181-first-deck').replace('principal_presets.js?v=160','principal_presets.js?v=181').replace('app.js?v=179','app.js?v=181'))
p=dist/'index.html';p.write_text(p.read_text().replace('app.js?v=179','app.js?v=181'))


# Publish the user's second deck and refresh cached preset code.
for name in ('app.js','sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('principal_presets.js?v=181','principal_presets.js?v=182').replace('app.js?v=181','app.js?v=182').replace('shell-v181-first-deck','shell-v182-second-deck'))


# Publish the user's third deck while retaining the first two customized presets.
for name in ('app.js','sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('principal_presets.js?v=182','principal_presets.js?v=183').replace('app.js?v=182','app.js?v=183').replace('shell-v182-second-deck','shell-v183-third-deck'))


# Publish the requested fourth deck before simplifying the preset library.
for name in ('app.js','sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('principal_presets.js?v=183','principal_presets.js?v=184').replace('app.js?v=183','app.js?v=184').replace('shell-v183-third-deck','shell-v184-fourth-deck'))

# Keep only the four customized decks in the published preset library.
for name in ('app.js','sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('principal_presets.js?v=184','principal_presets.js?v=185').replace('app.js?v=184','app.js?v=185').replace('shell-v184-fourth-deck','shell-v185-four-custom-decks'))


# Hide the requested planner details and local conversation text.
p=dist/'principal_focus.css'
p.write_text(p.read_text()+"\n.planner-readiness,.planner-examples,.planner-messages,.planner-storage-note{display:none!important}\n")
for name in ('sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('shell-v185-four-custom-decks','shell-v186-clean-planner').replace('app.js?v=185','app.js?v=186').replace('principal_focus.css?v=180','principal_focus.css?v=186'))


# Polish the active exercise screen without changing set registration.
p=dist/'app.js';s=p.read_text()
old="if(!reference)return '<div class=\"load-reference\">"
assert s.count(old)==1
s=s.replace(old,"if(!reference)return '<div class=\"load-reference is-empty\">")
s=s.replace('Sem carga anterior confirmada para este equipamento e unidade.</p></div>', 'Sem carga anterior confirmada para esta variação.</p></div>')
p.write_text(s)
p=dist/'principal_focus.css';p.write_text(p.read_text()+'\n'+(root/'testing/principal_training_polish.css').read_text())
for name in ('sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('shell-v186-clean-planner','shell-v187-training-polish').replace('app.js?v=186','app.js?v=187').replace('principal_focus.css?v=186','principal_focus.css?v=187'))

# Keep transient save confirmations clear of the fixed save action.
for name in ('sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('shell-v187-training-polish','shell-v188-training-feedback').replace('app.js?v=187','app.js?v=188').replace('principal_focus.css?v=187','principal_focus.css?v=188'))


# Associate the eight uploaded complete cards with their actual exercise variants.
runpy.run_path(str(out / 'testing/principal_exercise_art_patch.py'))

# Remove the legacy fixed flex basis from full portrait cards.
for name in ('sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('shell-v189-exercise-art','shell-v190-full-portrait-cards').replace('app.js?v=189','app.js?v=190').replace('principal_relics_art.css?v=189','principal_relics_art.css?v=190'))


# Add the second set of eight uploaded exercise cards and refresh art modules.
for name in ('app.js','principal_cards.js','sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('principal_exercise_art.js?v=189','principal_exercise_art.js?v=191').replace('principal_cards.js?v=189','principal_cards.js?v=191').replace('app.js?v=190','app.js?v=191').replace('principal_relics_art.css?v=190','principal_relics_art.css?v=191').replace('shell-v190-full-portrait-cards','shell-v191-back-triceps-art'))


# Complete the third deck with the three newly supplied portrait cards.
for name in ('app.js','principal_cards.js','sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('principal_exercise_art.js?v=191','principal_exercise_art.js?v=192').replace('principal_cards.js?v=191','principal_cards.js?v=192').replace('app.js?v=191','app.js?v=192').replace('principal_relics_art.css?v=191','principal_relics_art.css?v=192').replace('shell-v191-back-triceps-art','shell-v192-third-deck-art'))


# Compact, accessible finishing targets and an unobstructed entry form.
p=dist/'app.js';s=p.read_text()
needle="if(label)label.textContent=seconds>=180?'Meta atingida':'Faltam '+(180-seconds)+' segundos';"
assert s.count(needle)==1
s=s.replace(needle,needle+"const progress=document.querySelector('[data-plank-progress]');if(progress)progress.value=Math.min(180,seconds);")
p.write_text(s)
p=dist/'principal_focus.css';p.write_text(p.read_text()+'\n'+(root/'testing/principal_finisher_polish.css').read_text())
for name in ('sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('shell-v192-third-deck-art','shell-v193-finisher-polish').replace('app.js?v=192','app.js?v=193').replace('principal_focus.css?v=188','principal_focus.css?v=193'))


# Complete the fourth deck with the seven supplied leg exercise cards.
for name in ('app.js','principal_cards.js','sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 p.write_text(s.replace('principal_exercise_art.js?v=192','principal_exercise_art.js?v=194').replace('principal_cards.js?v=192','principal_cards.js?v=194').replace('app.js?v=193','app.js?v=194').replace('principal_relics_art.css?v=192','principal_relics_art.css?v=194').replace('shell-v193-finisher-polish','shell-v194-leg-deck-art'))


# Show rewards only after a successful durable save; XP is derived from records.
shutil.copy2(root/'testing/principal_xp.js',dist/'principal_xp.js')
p=dist/'app.js';s=p.read_text()
s="import {xpReward,showXpReward} from './principal_xp.js?v=195';\n"+s
old="const nextGeneration=await saveSnapshot(next,storageGeneration);doc=next;storageGeneration=nextGeneration;saved=true;notify(message);render();return true;"
assert s.count(old)==1
s=s.replace(old,"const nextGeneration=await saveSnapshot(next,storageGeneration);const reward=xpReward(merged(doc),merged(next));doc=next;storageGeneration=nextGeneration;saved=true;notify(message);render();showXpReward(reward);return true;")
p.write_text(s)
p=dist/'principal_focus.css';p.write_text(p.read_text()+'\n'+(root/'testing/principal_xp.css').read_text())
for name in ('sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 s=s.replace('app.js?v=194','app.js?v=195').replace('shell-v194-leg-deck-art','shell-v195-xp-rewards').replace('principal_focus.css?v=193','principal_focus.css?v=195')
 if name!='index.html':s=s.replace("'./principal_rpg.js'","'./principal_rpg.js','./principal_xp.js?v=195'")
 p.write_text(s)


# Explain execution failures and preserve timed sets without fictitious repetitions.
shutil.copy2(root/'testing/principal_sync_fix.js',dist/'principal_sync_fix.js')
p=dist/'coordinator_client.js';s=p.read_text()
s="import {coordinatorExecutionFailure} from './principal_sync_fix.js?v=196';\n"+s
old="if(execution?.error||execution?.done!==true)throw failure('COORDINATOR_EXECUTION_ERROR','Não foi possível executar o coordenador no Google. Confira implantação, autorização e configuração.');"
assert s.count(old)==1
s=s.replace(old,"const issue=coordinatorExecutionFailure(execution);if(issue)throw failure(issue.code,issue.message);")
p.write_text(s)
p=dist/'sheet_sync_core.js';s=p.read_text()
s="import {timedSeconds} from './principal_sync_fix.js?v=196';\n"+s
needle="  if(set.repetitions!==null&&!Number.isInteger(set.repetitions))"
assert s.count(needle)==1
s=s.replace(needle,"  const seconds=timedSeconds(str(r[7]),set.notes);if(seconds!==null){set.duration_ms=Math.round(seconds*1000);set.finisher_key='plank';}\n"+needle)
p.write_text(s)
p=dist/'app.js';s=p.read_text()
s="import {outboundSeriesLabel} from './principal_sync_fix.js?v=196';\n"+s
old="plan.Series.map(x=>'Série: '+x.values[0]+' · '+x.values[2]+' · '+x.values[6]+' '+x.values[7]+' × '+x.values[8])"
assert s.count(old)==1
s=s.replace(old,"plan.Series.map(x=>outboundSeriesLabel(x.values))")
s=s.replace("from './coordinator_client.js'","from './coordinator_client.js?v=196'").replace("from './sheet_sync_core.js'","from './sheet_sync_core.js?v=196'")
p.write_text(s)
p=dist/'sheet_sync_browser.js';s=p.read_text().replace("from './coordinator_client.js'","from './coordinator_client.js?v=196'").replace("from './sheet_sync_core.js'","from './sheet_sync_core.js?v=196'");p.write_text(s)
p=dist/'coordinator_client.js';p.write_text(p.read_text().replace("from './sheet_sync_core.js'","from './sheet_sync_core.js?v=196'"))
for name in ('sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 s=s.replace('app.js?v=195','app.js?v=196').replace('shell-v195-xp-rewards','shell-v196-sync-diagnostics')
 if name!='index.html':
  s=s.replace("'./coordinator_client.js'","'./coordinator_client.js?v=196','./principal_sync_fix.js?v=196'").replace("'./sheet_sync_core.js'","'./sheet_sync_core.js?v=196'")
 p.write_text(s)
# Refresh the transport URL because its imports changed.
for name in ('app.js','sw.js','integrity.js'):
 p=dist/name;p.write_text(p.read_text().replace("sheet_sync_browser.js'","sheet_sync_browser.js?v=196'"))


# Reward a higher comparable load and allow removing a slot from the active plan.
p=dist/'app.js';s=p.read_text()
s=replace_once(s,"import {xpReward,showXpReward}","import {markLoadBonus,xpReward,showXpReward}")
s=replace_once(s,"const next=commit(doc,mutate);const nextGeneration=await saveSnapshot(next,storageGeneration);const reward=", """const previous=merged(doc);
 const previousSetIds=new Set(previous.sets.map(row=>row.id));
 const next=commit(doc,draft=>{
  mutate(draft);
  for(const row of draft.overlay.sets){
   if(previousSetIds.has(row.id)||row.set_type!=='effective')continue;
   const session=draft.overlay.sessions.find(item=>item.id===row.session_id&&item.status==='in_progress');
   if(!session)continue;
   const variant=draft.overlay.exercise_variants.find(item=>item.id===row.variant_id)
    ||previous.exercise_variants.find(item=>item.id===row.variant_id);
   markLoadBonus(row,session,variant,previous);
  }
 });const nextGeneration=await saveSnapshot(next,storageGeneration);const reward=""")
s=replace_once(s,"function renderTrainingTools(active,selected,m){","""function renderTrainingTools(active,selected,m){
 if(!selected)return panel('<h2>Roteiro sem exercícios</h2><p>Você pode seguir para o bloco final ou concluir o treino.</p>','focus-entry');""")
s=replace_once(s,"active?.planned_variant_ids?.length?active.planned_variant_ids:(coachPlan?.items||[]).map(x=>x.variant_id)","active?(active.planned_variant_ids||[]):(coachPlan?.items||[]).map(x=>x.variant_id)")
s=replace_once(s," ${state.skipped?'<button",''' <button class="btn danger" type="button" data-coach-action="remove-exercise" data-coach-variant="${e(selected)}">Remover exercício do treino</button>
 ${state.skipped?'<button''')
s=replace_once(s," if(['skip','undo-skip','swap'].includes(action)){",""" if(action==='remove-exercise'){
  const active=coachActive(),current=btn.dataset.coachVariant;
  if(busy||quickSaving||!active?.planned_variant_ids?.includes(current))return;
  const model=g();
  const variant=model.variantMap.get(current);
  const name=model.exerciseMap.get(variant?.exercise_id)?.name||'este exercício';
  if(!confirm('Remover '+name+' do roteiro deste treino? As séries salvas serão mantidas.'))return;
  const next=nextPending(active,current,model.entities)||active.planned_variant_ids.find(id=>id!==current)||'';
  const ok=await perform(d=>changeWorkoutPlan(d,{sessionId:active.id,current,action:'remove'}),'Exercício removido do roteiro.');
  if(ok){quickDrafts.delete(active.id+':'+current);coachSelected=next;render();}
  return;
 }
 if(['skip','undo-skip','swap'].includes(action)){""")
p.write_text(s)
p=dist/'principal_focus.css'
p.write_text(p.read_text()+'\n#finisher-panel .finisher-goals{grid-template-columns:minmax(0,1fr)}\n.xp-content .xp-load-bonus{color:#ffe4a1}\n')
for name in ('app.js','sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text()
 for old,new in [('app.js?v=196','app.js?v=197'),('shell-v196-sync-diagnostics','shell-v197-workout-controls'),('principal_xp.js?v=195','principal_xp.js?v=197'),('principal_finisher.js?v=179','principal_finisher.js?v=197'),('principal_live.js?v=131','principal_live.js?v=197'),('principal_focus.css?v=195','principal_focus.css?v=197')]:
  s=s.replace(old,new)
 p.write_text(s)

# Active workout controls and a dedicated finisher view.
p = dist / 'app.js'
s = p.read_text()
start = s.index('function renderFocusDeck(')
end = s.index('\nlet quickSaving', start)
deck = s[start:end]
prefix, card = deck.split('${models.map(x=>`', 1)
prefix = prefix[:prefix.index(' return `<section')]
card = card.split("`).join('')}", 1)[0]
s = s[:start] + prefix + ''' const resolved = x => x.target !== null && x.resolved >= x.target;
 const finished = models.filter(resolved), pending = models.filter(x=>!resolved(x));
 const card = x => `''' + card + '''`;
 const row = items => '<div class="focus-deck-row">'+items.map(card).join('')+'</div>';
 return `<section class="surface focus-deck"><div class="focus-deck-heading"><h2>Exercícios pendentes</h2><span>${pending.length} de ${models.length}</span></div>
 ${pending.length?row(pending):'<p class="text-small">Roteiro concluído. Você pode seguir para o bloco final.</p>'}
 ${pending.some(x=>!x.selected)?'<button class="btn block" data-coach-action="next">Próximo exercício →</button>':''}
 ${finished.length?`<details class="mt"><summary>Exercícios finalizados (${finished.length})</summary>${row(finished)}</details>`:''}</section>`;
}
''' + s[end:]

start = s.index('<label class="field"><span>RIR <small>obrigatório')
end = s.index('<label class="field"><span>Tipo de série', start)
s = s[:start] + s[end:]
start = s.index('<p id="entry-rir-help"')
end = s.index('</p>', start) + len('</p>')
s = s[:start] + "${v.unit==='peso corporal'?'<p class=\"entry-help\">Use 0 se não houver carga externa.</p>':''}" + s[end:]
s = replace_once(s, "rir=numeric(values.get('rir')),kind=", "kind=")
s = replace_once(s, '||rir!==null&&(rir<0||rir>10)', '')
s = replace_once(s, "(rir===null?'':' RIR '+rir)+", '')
s = replace_once(s, 'Confira carga, repetições, RIR e tipo da série.','Confira carga, repetições e tipo da série.')
s = replace_once(s, ",rir=numeric(values.getAll('drop_rir')[i])", '')
s = replace_once(s, '||rir>10)', ')')
s = replace_once(s, 'reductionLoads.map((raw,i)=>', 'reductionLoads.map(raw=>')
s = replace_once(s, ' e RIR de 0 a 10. Selecione Trabalho.', '. Selecione Trabalho.')
s = replace_once(s, 'return {load,reps,rir};', 'return {load,reps,rir:null};')
s = replace_once(s, '<label class="field"><span>RIR</span><input class="input" inputmode="decimal" name="drop_rir" required></label>', '')
s = replace_once(s, ",rir:readFinalNumber('rir')", '')
s = s.replace('Preencha carga, repetições e RIR.', 'Preencha carga e repetições.')
s = s.replace('Informe o RIR e o tipo da série realizada.', 'Informe o tipo da série realizada.')
s = s.replace('carga, repetições e RIR de cada série', 'carga e repetições de cada série')
s = s.replace(" · RIR ${s.rir??'não informado'}${dropSequence", "${dropSequence").replace("+' · RIR '+e(row.rir??'não informado')", '').replace("+' (RIR '+fmt(s.rir)+')'", '')
s = s.replace(' · RIR ${fmt(s.rir)}', '')
s = s.replace('<div class="stat"><span>RIR médio</span><b>${fmt(m.rir_avg,2)}</b><small>Dados informados</small></div>', '')
s = s.replace('50 kg 10 reps RIR 2','50 kg 10 reps').replace('50 x 10 RIR 2','50 x 10')
s = s.replace(' e <strong>1-2</strong> como RIR','').replace('55 kg 8 reps RIR 2','55 kg 8 reps')
s = s.replace(", RIR '+(parsed.rir??'não informado')+'", '').replace(", RIR ${parsed.rir??'não informado'}", '')
start = s.index('function renderSetEditor(')
end = s.index('name="rir"', start)
field_start = s.rindex('<label', start, end)
field_end = s.index('</label>',end) + len('</label>')
s = s[:field_start] + s[field_end:]
s = replace_once(s, 'rir=parseNumber(x.rir,{allowEmpty:false,max:10})', "rir=doc.overlay.sets.find(row=>row.id===x.set_id).rir??null")

s = replace_once(s, ' const entry=!safeUnit', ''' const switchUnit = !timed && /^(kg(?:\\/lado|\\/halter)?|plaquetas)$/.test(v?.unit||'');
 const previousKg=(active.prior_planned_variants?.[selected]||[]).map(id=>m.variantMap.get(id))
  .find(prior=>prior&&prior.exercise_id===v?.exercise_id&&prior.equipment_or_variation===v.equipment_or_variation&&/^kg(?:\\/lado|\\/halter)?$/.test(prior.unit))?.unit;
 const unitButton=switchUnit?`<button class="btn small" type="button" data-coach-action="switch-load-unit" data-coach-variant="${e(selected)}" data-unit="${v.unit==='plaquetas'?previousKg||'kg':'plaquetas'}">Usar ${v.unit==='plaquetas'?e(previousKg||'kg'):'plaquetas'}</button>`:'';
 const entry=!safeUnit''')
s = replace_once(s, '${renderLoadReference(active,selected,m)}${entry}', '${renderLoadReference(active,selected,m)}${unitButton}${entry}')
s = replace_once(s, " if(action==='add-drop'){", ''' if(action==='switch-load-unit'){
  const active=coachActive(),source=g().variantMap.get(coachSelected),unit=btn.dataset.unit;
  if(!active||!source||coachSelected!==btn.dataset.coachVariant||busy||quickSaving)return;
  let variant;
  const ok=await perform(d=>{variant=confirmSessionVariant(d,{sessionId:active.id,sourceId:source.id,
   newId:makeId('variant'),equipment:source.equipment_or_variation,unit});},'Unidade atualizada. Informe a carga em '+unit+'.');
  if(ok){
   const from=active.id+':'+source.id,to=active.id+':'+variant.id;
   const {reps,kind}=quickDrafts.get(from)||{};
   quickDrafts.delete(from);
   quickDrafts.set(to,{reps,kind});
   coachSelected=variantSelected=variant.id;
   render();
   document.querySelector('#quick-set-form [name="load"]')?.focus();
  }
  return;
 }
 if(action==='add-drop'){''')

s = replace_once(s, ' const actions=active?.status', ''' const inFinisher=active&&sessionStorage.getItem('workout-finisher-session')===active.id;
 const visibleSets=inFinisher?activeSets.filter(row=>row.finisher_key):activeSets;
 const actions=active?.status''')
s = replace_once(s, 'activeSets.filter(s=>!isGroupedDrop(s,activeSets))', 'visibleSets.filter(s=>!isGroupedDrop(s,visibleSets))')
s = replace_once(s, "${activeSets.length?'<div class=\"inline-actions mt\">", "${!inFinisher&&activeSets.length?'<div class=\"inline-actions mt\">")
s = replace_once(s, 'return `${describeSave()}${!active?deckRecap', '''if(inFinisher)return `${describeSave()}${current}<button class="btn block mt" data-finisher-action="back" data-session="${e(active.id)}">Voltar aos exercícios</button>${renderFinisher(active,m)}${actions}`;
 return `${describeSave()}${!active?deckRecap''')
s = replace_once(s, '+renderFinisher(active,m)+composer', '+composer')
s = replace_once(s, "  if(ok&&action==='swap'){", '''  if(ok&&action==='skip'){
   const saved=coachActive(),entities=g().entities,state=liveGuidance(saved,current,entities);
   if(state.target!==null&&state.resolved>=state.target){coachSelected=nextPending(saved,current,entities)||'';render();}
  }
  if(ok&&action==='swap'){''')
s = replace_once(s, '  const next=nextPending(active,current,model.entities)||active.planned_variant_ids.find(id=>id!==current)||\'\';','  const next=nextPending(active,current,model.entities)||\'\';')
s = replace_once(s, '   if(doc.overlay.sets.length===count+1+reductions.length){quickDrafts.delete(active.id+\':\'+id);if(restTimer.state(active.id).auto)restTimer.start(active.id);render();}', '''   if(doc.overlay.sets.length===count+1+reductions.length){
    quickDrafts.delete(active.id+':'+id);
    const saved=coachActive(),entities=g().entities,state=liveGuidance(saved,id,entities);
    if(state.target!==null&&state.resolved>=state.target)coachSelected=nextPending(saved,id,entities)||'';
    if(restTimer.state(active.id).auto)restTimer.start(active.id);
    render();
   }''')
s = replace_once(s, "active?resumeSelectedVariant(doc,active.id,planIds):planIds[0]||''", "active?nextPending(active,'',m.entities)||'':planIds[0]||''")
s = replace_once(s, "if(!selected)return panel('<h2>Roteiro sem exercícios</h2><p>Você pode seguir para o bloco final ou concluir o treino.</p>','focus-entry');", """if(!selected)return active.planned_variant_ids?.length?renderFocusDeck(active,selected,m.entities):panel('<h2>Roteiro sem exercícios</h2><p>Você pode seguir para o bloco final ou concluir o treino.</p>','focus-entry');""")
s = replace_once(s, '<button type="button" class="btn small" data-finisher-action="open" data-session="\'+e(session.id)+\'">Ir para bloco final</button>', '')
s = replace_once(s, '+composer:composer+preview', '''+`<button type="button" class="btn primary block mt" data-finisher-action="open" data-session="${e(active.id)}">Ir para o bloco final</button>`+composer:composer+preview''')
p.write_text(s)
p = dist / 'principal_cards.js'
s = p.read_text().replace('principal_live.js?v=131','principal_live.js?v=198')
s = replace_once(s, "${e(item.equipment||'Confira o equipamento')}</p>", "${e(item.equipment||'Confira o equipamento')}${item.unit==='plaquetas'?' · plaquetas':''}</p>")
p.write_text(s)
for name in ('app.js','sw.js','integrity.js','index.html','principal_live.js'):
 p = dist / name
 s = p.read_text()
 for old,new in (
  ('app.js?v=197','app.js?v=198'), ('shell-v197-workout-controls','shell-v198-workout-view'),
  ('principal_unit.js?v=155','principal_unit.js?v=198'), ('principal_presets.js?v=185','principal_presets.js?v=198'),
  ('principal_cards.js?v=194','principal_cards.js?v=198'),
  ('principal_live.js?v=197','principal_live.js?v=198'), ('principal_finisher.js?v=197','principal_finisher.js?v=198')
 ):
  s = s.replace(old,new)
 p.write_text(s)

# Keep the exercise and its entry form above the secondary workout controls.
p = dist / 'app.js'
s = p.read_text()
start = s.index(' const current=active?panel(')
end = s.index('\n',start)
s = s[:start] + ''' const current=active?panel(`<div class="focus-session-top">
  <div class="focus-session-title"><span class="focus-session-label">${active.clock_paused_at?'TREINO PAUSADO':'TREINO EM ANDAMENTO'}</span><p>${e(active.name)}</p></div>
  <div class="focus-session-actions">
   ${active.started_at||active.clock_started_at?`<button type="button" class="btn session-pause" data-finisher-action="${active.clock_paused_at?'resume-workout':'pause-workout'}" data-session="${e(active.id)}" aria-label="${active.clock_paused_at?'Retomar treino':'Pausar treino'}" title="${active.clock_paused_at?'Retomar treino':'Pausar treino'}"><span aria-hidden="true">${active.clock_paused_at?'▶':'Ⅱ'}</span></button>`:''}
   <details class="focus-session-menu"><summary aria-label="Opções do treino">⋯</summary><div><button class="btn" data-coach-action="finish">Concluir treino</button><button class="btn danger" data-coach-action="cancel" data-coach-session="${e(active.id)}">Cancelar treino</button></div></details>
  </div>
 </div><div class="session-metrics">${renderSessionClock(active)}${renderLastSetClock(active,activeSets)}</div>
 ${planIds.length?`<div class="session-targets"><progress max="${planIds.length}" value="${liveGuidance(active,selected,m.entities).reached}" aria-label="Metas de exercícios atingidas"></progress><small>${liveGuidance(active,selected,m.entities).reached} / ${planIds.length} metas</small></div>`:''}`,'focus-session'):'';''' + s[end:]
s = replace_once(s, 'current+renderLastSetClock(active,activeSets)+renderTrainingTools', 'current+renderTrainingTools')
start = s.index(" return '<div class=\"session-clock\"><small>'+")
end = s.index('\n', start)
s = s[:start] + ''' return '<div class="session-clock"><span>Tempo de treino</span><strong role="timer" aria-label="Tempo decorrido" data-session-clock="'+e(start)+'" data-clock-session="'+e(session.id)+'">'+sessionClockLabel(seconds)+'</strong><small>'+(session.started_at?'Início do treino: ':'Contagem iniciada: ')+e(time)+'</small></div>';''' + s[end:]
s = replace_once(s, '<span>Desde a última série salva</span>', '<span>Desde a última série</span>')
s = replace_once(s, " · contado desde o registro</small>", "</small>")
s = replace_once(s, '<p class="focus-equipment">', '<div class="focus-equipment-row"><p class="focus-equipment">')
s = replace_once(s, "</p>${renderLiveGuidance(active,selected,m)}${renderLoadReference(active,selected,m)}${unitButton}${entry}", "</p>${unitButton}</div>${renderLiveGuidance(active,selected,m)}${renderLoadReference(active,selected,m)}${entry}")
s = replace_once(s, '<div class="load-reference"><span>Último treino compatível · ', '<div class="load-reference"><div class="load-reference-value"><span>Último treino · ')
s = replace_once(s, "label(reference)+'</strong></p>'", "label(reference)+'</strong></p></div>'")
s = replace_once(s, '>Usar carga e repetições</button>', ' aria-label="Usar carga e repetições">Usar valores</button>')
p.write_text(s)
p = dist / 'principal_focus.css'
p.write_text(p.read_text() + '''
/* Active workout: one status panel, then the entry form. */
.focus-session{margin-bottom:10px!important;border-color:#536d65!important}
.focus-session-top{align-items:flex-start;gap:8px}
.focus-session-title p{font-size:15px;font-weight:700;line-height:1.3;margin:3px 0 0!important}
.focus-session-actions{display:flex;flex:none;align-items:center;gap:4px}
.focus-session .session-pause,.focus-session .focus-session-menu>summary{
 width:44px;height:44px;min-height:44px;box-sizing:border-box;padding:0;
 display:grid;place-items:center;border:1px solid #536d65;border-radius:10px;background:#20343b;color:#f5e3b7
}
.focus-session .session-pause{font:700 18px/1 system-ui,sans-serif}
.focus-session .focus-session-menu>summary{font-size:22px}
.session-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}
.focus-session .session-clock,.focus-session .last-set-clock{
 display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:3px;
 min-width:0;margin:0;padding:8px 10px;border:0;border-radius:10px;background:#0d222a
}
.focus-session .last-set-clock{background:#14302f}
.session-metrics span,.session-metrics small{font:500 11px/1.3 system-ui,sans-serif;color:#b8cece}
.session-metrics strong{font:700 clamp(18px,5vw,25px)/1.15 system-ui,sans-serif;color:#f4dcab;letter-spacing:0;font-variant-numeric:tabular-nums}
.session-targets{display:flex;align-items:center;gap:10px;margin-top:8px}
.session-targets small{color:#b8cece;white-space:nowrap;font-size:11px}
.session-targets progress{flex:1;min-width:0;height:5px;accent-color:#7ae2bf}
.focus-entry .focus-exercise-name{margin:5px 0 2px!important}
.focus-entry .focus-equipment-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.focus-entry .focus-equipment-row .focus-equipment{margin:0!important}
.focus-entry [data-coach-action=switch-load-unit]{min-height:44px;padding:5px 10px;flex:none;background:#20343b;border-color:#637d70}
.focus-entry .focus-reference{padding:0;margin-bottom:6px!important;border-bottom:0}
.focus-entry .load-reference:not(.is-empty){display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 8px;padding:6px 9px;margin:6px 0 10px}
.focus-entry .load-reference-value>span{font-size:11px;color:#b9ddd0}
.focus-entry .load-reference-value>p{margin:0}
.focus-entry .load-reference [data-coach-action=use-reference]{min-height:44px;padding:5px 9px;white-space:nowrap}
.focus-entry .load-reference details,.focus-entry [data-reference-feedback]{grid-column:1/-1}
.focus-entry [data-reference-feedback]:empty{display:none}
.focus-entry #quick-set-form>.required-set-fields{grid-template-columns:minmax(0,1fr);margin-top:8px}
.focus-entry #quick-set-form .field>span{min-height:0!important;margin-bottom:4px}
.focus-entry #quick-set-form .field>span small{display:inline;margin-left:3px}
.focus-entry #quick-set-form .input{height:46px;min-height:46px!important}
.focus-entry #quick-set-form>button[type=submit]{scroll-margin-bottom:100px}
''')
for name in ('sw.js','integrity.js','index.html'):
 p = dist / name
 p.write_text(p.read_text().replace('shell-v198-workout-view','shell-v199-workout-layout')
  .replace('app.js?v=198','app.js?v=199').replace('principal_focus.css?v=197','principal_focus.css?v=199'))

# Refresh the principal cache after improving rejected-batch diagnostics.
for name in ('app.js','sheet_sync_browser.js','automatic_sync.js','sw.js','integrity.js','index.html'):
 p=dist/name
 p.write_text(p.read_text().replace('shell-v199-workout-layout','shell-v200-sync-rejection').replace('app.js?v=199','app.js?v=200').replace('coordinator_client.js?v=196','coordinator_client.js?v=200'))

# Recover interrupted coordinator exchanges with the original persisted operation.
shutil.copy2(root/'testing/principal_transport.js',dist/'principal_transport.js')
p=dist/'sheet_sync_browser.js'
s=p.read_text()
s="import {recoverCoordinatorExchange} from './principal_transport.js?v=201';\n"+s
old="const execution=await request('https://script.googleapis.com/v1/scripts/'+encodeURIComponent(COORDINATOR_DEPLOYMENT_ID)+':run',{method:'POST',body:{function:'coordinateSync',parameters:[operation],devMode:false},fetchImpl});"
new="const execution=await recoverCoordinatorExchange(operation,captured=>request('https://script.googleapis.com/v1/scripts/'+encodeURIComponent(COORDINATOR_DEPLOYMENT_ID)+':run',{method:'POST',body:{function:'coordinateSync',parameters:[captured],devMode:false},fetchImpl}));"
assert s.count(old)==1
p.write_text(s.replace(old,new))
for name in ('app.js','sw.js','integrity.js','index.html'):
 p=dist/name;s=p.read_text().replace('shell-v200-sync-rejection','shell-v201-sync-network').replace('app.js?v=200','app.js?v=201').replace('sheet_sync_browser.js?v=196','sheet_sync_browser.js?v=201')
 if name in ('sw.js','integrity.js'):
  needle="'./sheet_sync_browser.js?v=201'"
  assert s.count(needle)==1
  s=s.replace(needle,"'./principal_transport.js?v=201',"+needle)
 p.write_text(s)

# Apply the coastal theme to the principal distribution.
shutil.copy2(root / 'testing/principal_coastal.css', dist)
coastal_assets = ['coastal-training.webp', 'coastal-city.webp']
for name in coastal_assets:
    shutil.copy2(root / 'testing/assets' / name, dist)
for size in (192, 512):
    shutil.copy2(root / f'testing/assets/icon-coastal-{size}.png', dist / 'icons')
for name in ('index.html', 'manifest.webmanifest', 'sw.js', 'integrity.js', 'app.js'):
    p = dist / name
    source = p.read_text()
    source = (source.replace('shell-v201-sync-network', 'shell-v202-coastal')
              .replace('app.js?v=201', 'app.js?v=202')
              .replace('manifest.webmanifest?v=150', 'manifest.webmanifest?v=202')
              .replace('icon-rpg-', 'icon-coastal-'))
    if name in ('index.html', 'manifest.webmanifest'):
        source = source.replace('#10171e', '#100d1c')
    if name == 'index.html':
        source = source.replace('</head>', '<link rel="stylesheet" href="./principal_coastal.css">\n</head>')
        source = source.replace('Emblema de cristal esmeralda e escudo dourado', 'Ícone do Treino &amp; Evolução')
        source = source.replace('SUA PRÓXIMA JORNADA', 'SUA PRÓXIMA MISSÃO')
    if name == 'app.js':
        source = source.replace('SALA DE ESTRATÉGIA', 'SUA PRÓXIMA MISSÃO')
    if name in ('sw.js', 'integrity.js'):
        entries = ['principal_coastal.css', *coastal_assets]
        source = source.replace("'./app.js?v=202'", "'./app.js?v=202'," + ','.join(repr('./' + asset) for asset in entries))
    p.write_text(source)
