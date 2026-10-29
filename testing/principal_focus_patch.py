from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
p=dist/'app.js';s=p.read_text()
s=s.replace('renderSportCard,renderDeckChooser,renderDeckRecap,muscleSymbol','renderSportCard,renderDeckChooser,renderDeckRecap,muscleSymbol,deckModels')
a=s.index('function renderLiveGuidance(');b=s.index('let quickSaving=',a)
s=s[:a]+'''function renderLiveGuidance(active,selected,m){
 const state=liveGuidance(active,selected,m.entities),unit=m.variantMap.get(selected)?.unit||'';
 const pips=state.target?Array.from({length:Math.min(state.target,20)},(_,i)=>`<span class="focus-pip ${i<state.count?'filled':''}" aria-hidden="true"></span>`).join(''):'';
 return `<div class="focus-dose"><strong>${state.target?state.count>=state.target?'Meta de séries atingida':'Série '+(state.count+1)+' de '+state.target:'Séries registradas: '+state.count}</strong><span>${state.dose?e(state.dose.min)+'–'+e(state.dose.max)+' '+(state.dose.unit==='segundos'?'segundos':'repetições'):'Sem meta salva'}</span></div><div class="focus-pips" aria-label="${state.count} de ${state.target??'quantidade não definida'} séries de trabalho registradas">${pips}</div>${state.latest?`<p class="focus-saved" role="status">Última série de trabalho salva: <strong>${e(state.latest.load_value)} ${e(unit)} × ${e(state.latest.repetitions)}</strong></p>`:''}<details class="focus-reference"><summary>Referência e orientação</summary><p>${state.reference?'Anterior: '+e(state.reference.load_value)+' '+e(unit)+' × '+e(state.reference.repetitions)+' · '+e(state.reference.date):'Sem referência anterior confirmada desta variação.'}</p><p>${e(state.dose?.effort||'Ajuste o esforço à sua condição de hoje.')} Dor durante o movimento: interrompa e procure orientação.</p><p>${state.warmups} aquecimento(s) registrado(s). As metas não representam séries realizadas.</p></details>`;
}
function renderFocusDeck(active,selected,entities){
 const models=deckModels(active,selected,entities);
 return `<section class="surface focus-deck"><div class="focus-deck-heading"><h2>Seu deck</h2><span>${models.filter(x=>x.reached).length}/${models.length} metas atingidas</span></div><div class="focus-deck-row" role="group" aria-label="Exercícios do treino">${models.map(x=>`<button class="focus-mini ${x.selected?'selected':''} ${x.reached?'reached':''}" data-coach-action="select" data-coach-variant="${e(x.variant_id)}" aria-pressed="${x.selected}"><span class="focus-mini-art" aria-hidden="true">${muscleSymbol(x.group)}</span><span class="focus-mini-name">${e(x.name)}</span><span>${x.count}${x.target!==null?' / '+x.target:''} séries</span></button>`).join('')}</div><button class="btn block" data-coach-action="next">Próximo exercício →</button></section>`;
}
'''+s[b:]
# Keep the established form fields, validation, drafts and saving flow.
a=s.index('<label class="field"><span>RIR <small>');b=s.index('<p id="entry-rir-help"',a)
extra=s[a:b];assert extra.endswith('</div>');extra=extra[:-6]
s=s[:a]+'</div><details class="focus-options"><summary>Mais opções · RIR e aquecimento</summary><div class="quick-grid">'+extra+'</div></details>'+s[b:]
a=s.index(' const overview=',s.index('function renderTrainingTools('));b=s.index(' const entry=',a);s=s[:a]+s[b:]
# Consolidate the exercise heading and live guidance into the registration card.
a=s.index(' return panel(`<div class="entry-heading">');b=s.index('\n\n}',a)
s=s[:a]+''' return panel(`<div class="focus-exercise-kicker">EXERCÍCIO ATUAL</div><h1 class="focus-exercise-name">${e(m.exerciseMap.get(v?.exercise_id)?.name||'Selecione um exercício')}</h1><p class="focus-equipment">${e(v?.equipment_or_variation||'')}${safeUnit?' · '+e(v.unit):''}</p>${renderLiveGuidance(active,selected,m)}${entry}`,'training-entry focus-entry')+renderFocusDeck(active,selected,m.entities);
'''+s[b:]
a=s.index(' const current=active?');b=s.index('\n const composer=',a)
s=s[:a]+''' const current=active?panel(`<div class="focus-session-top"><div><span class="focus-session-label">TREINO EM ANDAMENTO</span><p>${e(active.name)}</p><small>${liveGuidance(active,selected,m.entities).reached} / ${planIds.length} metas atingidas</small></div><details class="focus-session-menu"><summary aria-label="Opções do treino">⋯</summary><div><button class="btn" data-coach-action="finish">Concluir treino</button><button class="btn danger" data-coach-action="cancel" data-coach-session="${e(active.id)}">Cancelar treino</button></div></details></div>`,'focus-session'):'';
'''+s[b:]
# Prefill known equipment, while keeping unit choice explicit.
s=s.replace('placeholder="Ex.: barra livre, máquina ou halteres"','value="${e(g().variantMap.get(selected)?.equipment_or_variation||\'\')}" placeholder="Ex.: barra livre, máquina ou halteres"')
s=s.replace('<p class="text-small">Confirme o equipamento e a unidade para liberar o registro. Uma variação confirmada será criada; cargas e séries anteriores continuam na variação original.</p>','<p class="focus-setup-title">Como você registra a carga?</p><details class="focus-setup-help"><summary>Entenda esta configuração</summary><p>Confirme equipamento e unidade. Uma variação confirmada será criada; o histórico original será preservado.</p></details>')
s=s.replace('Equipamento ou variação usada</span>','Equipamento · ajuste se necessário</span>').replace('Como você informa a carga?</span>','Unidade da carga</span>').replace('Confirmar e liberar registro</button>','Confirmar configuração</button>')
# Move the optional explanation into the disclosure, directly after its fields.
start=s.index('<p id="entry-rir-help"');end=s.index('</p>',start)+4
help=s[start:end];s=s[:start]+s[end:];s=s.replace('</div></details><button class="btn primary block" type="submit">Salvar série', '</div>'+help+'</details><button class="btn primary block" type="submit">Salvar série')
s=s.replace('Treino & Evolução · v1.6.3','Treino & Evolução · v1.6.4')
p.write_text(s)
shutil.copy2(root/'testing/principal_focus.css',dist/'principal_focus.css')
p=dist/'index.html';s=p.read_text().replace('app.js?v=163','app.js?v=164').replace('v1.6.3 Ocultação corrigida','v1.6.4 Painel de treino').replace('</head>','<link rel="stylesheet" href="./principal_focus.css?v=164">\n</head>');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=163','app.js?v=164').replace('shell-v163-panels-css','shell-v164-focus').replace("'./principal_presets.css?v=163'","'./principal_presets.css?v=163','./principal_focus.css?v=164'");p.write_text(s)
