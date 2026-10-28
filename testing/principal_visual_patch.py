"""Principal redesign: presentation and navigation only; preserve persistence/sync operations."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
for name in ('principal_visual.js','principal_visual.css'):
 shutil.copy2(root/'testing'/name,dist/name)
p=dist/'index.html';html=p.read_text()
html=html.replace('<link rel="stylesheet" href="./styles.css">','<link rel="stylesheet" href="./styles.css">\n<link rel="stylesheet" href="./principal_visual.css">')
html=html.replace('PERSONAL · OFFLINE-FIRST','Seu treino, sua evolução')
html=html.replace('src="./app.js"','src="./app.js?v=120r3"')
html=html.replace('<span id="conn-status" class="status">Verificando…</span>','<button id="conn-status" class="status sync-shortcut" data-page="data" aria-label="Ver sincronização">Verificando…</button>')
icons={'home':'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>','workout':'<path d="m4 6 3-3m-4 9 9-9m0 18 9-9m-4 9 4-4M7 7l10 10"/>','history':'<path d="M4 4v5h5"/><path d="M4 9a8 8 0 1 1-1 6M12 7v5l3 2"/>','progress':'<path d="M4 20V4m0 16h16M7 15l4-5 4 2 5-7"/>','more':'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'}
nav='<nav class="bottom-nav" aria-label="Menu principal">'+''.join(f'<button data-page="{key}"><span aria-hidden="true"><svg viewBox="0 0 24 24">{icons[key]}</svg></span><small>{label}</small></button>' for key,label in [('home','Início'),('workout','Treinar'),('history','Histórico'),('progress','Evolução'),('more','Mais')])+'</nav>'
start=html.index('<nav class="bottom-nav"');end=html.index('</nav>',start)+len('</nav>');html=html[:start]+nav+html[end:];p.write_text(html)
p=dist/'app.js';s=p.read_text()
def replace(old,new):
 global s
 assert s.count(old)==1,(old,s.count(old))
 s=s.replace(old,new)
replace("import {restTimer,clockLabel} from './principal_rest.js';", "import {visualSyncState,renderPlanSummary} from './principal_visual.js';\nimport {restTimer,clockLabel} from './principal_rest.js';")
replace("from './principal_variety.js';", "from './principal_variety.js?v=120r3';")
replace('templates:renderTemplates}', 'templates:renderTemplates,more:renderMore}')
replace("$('#app').innerHTML=pages[page](m)", "$('#app').dataset.page=page;$('#app').innerHTML=pages[page](m)")
# Keep More selected while viewing its child pages; all original page routes remain available.
s=s.replace("el.dataset.page===page", "el.dataset.page===(['data','body','templates'].includes(page)?'more':page)")
start=s.index('function updateConnectivity(){');end=s.index('\nasync function perform(',start)
s=s[:start]+'''function updateConnectivity(){const el=$('#conn-status');if(!el||!doc)return;const state=visualSyncState({error:sheetsError,busy:sheetsBusy,pending:sheetPendingCount(),last:doc.settings.sheet_sync?.last_success_at,online:navigator.onLine,active:doc.overlay.sessions.some(x=>x.status==='in_progress')});el.textContent=state.text;el.dataset.tone=state.tone;el.title=state.detail;el.setAttribute('aria-label','Sincronização: '+state.text+'. '+state.detail);}
'''+s[end:]
replace("function renderHome(m){", '''function renderMore(){return `${title('Organize seu treino','Mais opções','Modelos, medidas e dados em um só lugar.')}<div class="more-menu"><button class="btn" data-page="templates">Modelos e exercícios<span>Monte e organize seus roteiros</span></button><button class="btn" data-page="body">Corpo e recuperação<span>Peso, medidas e relatos</span></button><button class="btn" data-page="data">Sincronização e backup<span>Google Sheets e proteção dos registros</span></button></div>${panel('<h2>Seu aplicativo</h2><p class="text-small">Treino & Evolução · v1.2.0<br>Seu histórico permanece no aparelho e na planilha que você conectou.</p>')}`;}
function renderProposalItem(draft,index,controls){return `<div class="list-item"><div class="grow"><div class="item-title">${index+1}. ${e(draft.name)}</div><div class="item-sub">${e(draft.equipment)} · ${e(draft.movementLabel||draft.group)}</div><p><strong>${e(draft.dose?.label||'Quantidade a definir')}</strong></p><div class="reference-box text-small">${draft.last?.load_value!=null?'Referência anterior: '+e(draft.last.load_value)+' '+e(draft.unit):'Sem carga de referência para esta variação.'}</div><details><summary>Referência e orientação</summary><p class="text-small">${e(draft.dose?.source||'Sugestão inicial.')} ${e(draft.dose?.effort||'Confira sua condição de hoje.')}</p></details></div><div class="inline-actions">${controls}</div></div>`;}
function renderHome(m){''')
replace("title('Seu painel pessoal','Evolua treino após treino','Seu histórico local pode ser conectado à planilha original do Google Sheets.')", "title('Seu painel pessoal','Seu próximo treino começa aqui','Acompanhe sua constância e retome de onde parou.')")
replace('Cada série registrada é gravada no IndexedDB automaticamente.', 'As séries realizadas são salvas no aparelho. A confirmação de envio aparece em Dados.')
replace('<h2>Começar agora</h2><button', '<div class="eyebrow">Vamos treinar</div><h2>Um treino de cada vez.</h2><button')
replace('>+ Registrar treino</button>', '>Começar treino</button>')
replace('<h2>Um treino de cada vez.</h2><button class="btn primary big block" data-page="workout">', '<h2>Um treino de cada vez.</h2><button class="btn primary big block" data-coach-action="open">')
replace("<p class=\"text-small\">As séries realizadas são salvas no aparelho. A confirmação de envio aparece em Dados.</p>`)}", "<p class=\"text-small\">As séries realizadas são salvas no aparelho. A confirmação de envio aparece em Dados.</p>`,'home-primary')}")
replace('Sua base não está incluída no código público. Importe o arquivo JSON privado da Etapa 2, ou comece a registrar novos treinos.', 'Conecte sua planilha em Dados ou importe um backup para consultar os treinos anteriores.')
replace("function describeSave(){return doc.revision>doc.last_backup_revision?`<div class=\"surface warn\"><strong>Backup pendente</strong><div class=\"text-small\">Existem ${doc.revision-doc.last_backup_revision} alterações locais desde o último backup confirmado. Abra Dados para proteger os registros.</div></div>`:'';}", "function describeSave(){return doc.revision>doc.last_backup_revision?`<details class=\"backup-note\"><summary>Backup externo pendente</summary><p>Existem ${doc.revision-doc.last_backup_revision} alterações locais desde o último backup confirmado.</p><button class=\"btn\" data-page=\"data\">Ver backup e sincronização</button></details>`:'';}")
replace("return item(`${i+1}. ${draft?.name||ex?.name||'Exercício'}`,desc,controls);", "return draft?renderProposalItem(draft,i,controls):item(`${i+1}. ${ex?.name||'Exercício'}`,desc,controls);")
replace('<h2>Sugestão para ${e(groupLabel(coachPlan.groups))}</h2>', '<h2>Seu treino de ${e(groupLabel(coachPlan.groups))}</h2>${renderPlanSummary(coachPlan)}')
replace("${list||'<p>Não encontrei exercícios compatíveis no histórico.</p>'}", "<div class=\"proposal-list\">${list||'<p>Não encontrei exercícios compatíveis no histórico.</p>'}</div>")
replace('Análise do histórico e dos grupos musculares', 'Por que este treino?')
start=s.index('function renderLiveGuidance(');end=s.index('let quickSaving=',start)
s=s[:start]+'''function renderLiveGuidance(active,selected,m){
 const state=liveGuidance(active,selected,m.entities),unit=m.variantMap.get(selected)?.unit||'',value=x=>x==null?'—':String(x);
 return `<div class="live-guidance"><div class="live-progress"><div><strong>${state.count}${state.target!==null?' / '+state.target:''}</strong><br><span>séries de trabalho</span></div><span>${state.reached} / ${state.total} exercícios<br>${state.warmups} aquecimento(s)</span></div>${state.target?`<progress max="${state.target}" value="${Math.min(state.count,state.target)}" aria-label="Séries de trabalho registradas"></progress>`:''}<p><strong>${e(state.dose?.label||'Sem sugestão salva para este exercício.')}</strong></p><p>${e(state.message)}</p>${state.latest?`<div class="reference-box"><span class="text-small">Última série deste treino</span><br><strong>${e(value(state.latest.load_value))} ${e(unit)} · ${e(value(state.latest.repetitions))} reps</strong><span class="text-small"> · RIR ${e(value(state.latest.rir))}</span></div>`:''}<details><summary>Referência anterior e cuidados</summary><p class="text-small">${state.reference?'Mesma variação ('+e(state.reference.date)+'): '+e(value(state.reference.load_value))+' '+e(unit)+' · '+e(value(state.reference.repetitions))+' reps.':'Sem referência de treino anterior concluído desta variação.'}</p><p class="text-small">${e(state.dose?.effort||'Ajuste o esforço à sua condição de hoje.')} As metas são sugestões. Dor durante o movimento: interrompa e procure orientação profissional.</p></details></div>`;
}
'''+s[end:]
# Group the quick-entry numeric fields without changing names or submission logic.
replace('<input type="hidden" name="variant_id" value="${e(selected)}"><label', '<input type="hidden" name="variant_id" value="${e(selected)}"><div class="quick-grid"><label')
replace('<label class="field"><span>Tipo de série</span><select name="kind"', '</div><label class="field"><span>Tipo de série</span><select name="kind"')
start=s.index(' return panel(`<h2>Descanso</h2>');end=s.index('\n}',start)
s=s[:start]+''' return panel(`<h2>Registrar série</h2><p class="text-small">${e(m.exerciseMap.get(v?.exercise_id)?.name||'Selecione um exercício')} · ${e(v?.equipment_or_variation||'')}</p>${entry}`,'training-entry')+panel(`<div class="rest-line"><h2>Descanso</h2><p class="rest-clock" data-rest-session="${e(active.id)}" role="timer">${timer.remaining?clockLabel(timer.remaining):'Pronto'}</p></div><div class="inline-actions"><button class="btn" data-coach-action="rest-start">Iniciar</button><button class="btn" data-coach-action="rest-pause">Pausar</button><button class="btn" data-coach-action="rest-resume">Retomar</button></div><details><summary>Ajustar descanso</summary><form id="rest-settings-form"><input type="hidden" name="session_id" value="${e(active.id)}"><label class="field"><span>Intervalo escolhido</span><select class="input" name="seconds">${options}</select></label><label><input type="checkbox" name="auto" ${timer.auto?'checked':''}> Iniciar após salvar pela entrada rápida</label><button class="btn block mt" type="submit">Aplicar intervalo</button></form><button class="btn block mt" data-coach-action="rest-stop">Encerrar descanso</button><p class="text-small">Intervalo ajustável. O relógio é recalculado ao voltar à aba; alertas com a tela bloqueada não são garantidos.</p></details>`,'rest-card')+panel(`<details><summary>Resumo do roteiro</summary>${overview}</details>`);
'''+s[end:]
start=s.index(' const current=active?panel(');end=s.index(' const composer=panel(',start)
s=s[:start]+''' const current=active?panel(`<p class="session-name">${e(active.name)} · ${e(datePT(active.date))}</p><div class="eyebrow mt">Exercício atual</div><h2 class="exercise-heading">${e(ex?.name||'Selecione um exercício')}</h2><p class="text-small">${e(picked?.equipment_or_variation||'')} · Unidade: ${e(picked?.unit||'')}</p>${renderLiveGuidance(active,selected,m)}<div class="inline-actions mt"><button class="btn" data-coach-action="next">Próximo exercício</button><button class="btn" data-coach-action="finish">Concluir treino</button></div>`,'workout-current'):'';
'''+s[end:]
replace('const composer=panel(`<h2>Converse com o assistente</h2>', 'const composer=panel(`${active?\'<details><summary>Conversa e ajuda</summary>\':\'\'}<h2>Monte seu treino</h2>')
replace('<p class="text-small">Exemplos:', '<details class="technical-note"><summary>Comandos e exemplos</summary><p class="text-small">Exemplos:')
replace('Para máquinas em plaquetas, informe essa unidade.</p>', 'Para máquinas em plaquetas, informe essa unidade.</p></details>')
replace("${!active?readinessFields():''}", "${!active?'<details><summary>Como estou hoje? (opcional)</summary>'+readinessFields()+'</details>':''}")
replace('Enviar mensagem</button></form>`);', 'Enviar mensagem</button></form>${active?\'</details>\':\'\'}`,\'conversation-panel\');')
# Preserve the sync card functionality, but separate explanatory content from actions.
replace('<h2>Sincronização com Google Sheets</h2>', '<h2>Seus dados no Google</h2>')
p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text();assert s.count("'./principal_rest.js'")==1;s=s.replace("'./app.js'","'./app.js?v=120r3'").replace("'./principal_variety.js'","'./principal_variety.js?v=120r3'");p.write_text(s.replace("'./principal_rest.js'", "'./principal_visual.js','./principal_visual.css','./principal_rest.js'"))
print('PRINCIPAL_VISUAL_REDESIGN=APPLIED')
