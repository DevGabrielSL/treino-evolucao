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

p=dist/'app.js';s=p.read_text()
s=s.replace("state.count>=state.target?'Meta de séries atingida':'Série '+(state.count+1)", "state.resolved>=state.target?'Roteiro de séries finalizado':'Série '+(state.resolved+1)")
s=s.replace("${renderLiveGuidance(active,selected,m)}${entry}", "${renderLiveGuidance(active,selected,m)}${entry}${renderPlanControls(active,selected,m)}")
controls='''
function renderPlanControls(active,selected,m){
 const state=liveGuidance(active,selected,m.entities);
 const pending=state.target===null||state.resolved<state.target;
 const occupied=new Set(active.planned_variant_ids.flatMap(id=>[id,...(active.prior_planned_variants?.[id]||[])]));
 const options=[...m.variantMap.values()].filter(v=>!occupied.has(v.id)&&m.exerciseMap.has(v.exercise_id))
  .map(v=>({id:v.id,label:m.exerciseMap.get(v.exercise_id).name+' · '+(v.equipment_or_variation||v.unit||'')}));
 options.sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
 return `<div class="mt"><p class="text-small">${state.count} realizadas · ${state.skipped} puladas</p><div class="inline-actions">
 ${pending&&state.target!==null?'<button class="btn" data-coach-action="skip">Pular série</button>':''}
 ${state.skipped?'<button class="btn" data-coach-action="undo-skip">Desfazer pulo</button>':''}</div>
 ${pending&&options.length?`<details class="mt"><summary>Trocar exercício</summary><p class="text-small">${state.target===null?'Sem meta de séries definida.':(state.target-state.resolved)+' série(s) restante(s) neste exercício.'}</p><label class="field"><span>Buscar exercício ou equipamento</span><input class="input" type="search" data-swap-search placeholder="Ex.: rosca Scott ou máquina"></label><p class="text-small" data-swap-results role="status">${options.length} opções</p><label class="field"><span>Substituto para as séries restantes</span><select class="input"><option value="">Selecione</option>${options.map(o=>`<option value="${e(o.id)}">${e(o.label)}</option>`).join('')}</select></label><button class="btn" data-coach-action="swap">Confirmar troca</button></details>`:''}</div>`;
}
'''
s=s.replace('function renderCoach(', controls+'\nfunction renderCoach(',1)
p.write_text(s)

# Drop sets use normal Sheets rows, with the parent ID preserved in Observações.
p=dist/'app.js';s=p.read_text()
s=s.replace('async function handleCoachMessage(message){','async function handleCoachMessage(message,reductions=[]){')
anchor=s.index(' const parsed=parseSeriesMessage(input,chosen.unit);')
start=s.index('  d.overlay.sets.push({',anchor)
end=s.index('\n',start)
line=s[start:end]
assert line.endswith('});')
s=s[:start]+line.replace('d.overlay.sets.push({','const row={',1)[:-2]+''';
  if(reductions.length && parsed.set_type!=='effective')throw new Error('Use Trabalho para registrar um drop set.');
  d.overlay.sets.push(row,...reductions.map((part,i)=>({
   ...row,id:makeId('set'),set_type:'drop_set',set_number:number+i+1,
   load_value:part.load,repetitions:part.reps,rir:part.rir,notes:'Drop de '+row.id
  })));'''+s[end:]
needle='   const count=doc.overlay.sets.length;'
assert s.count(needle)==1
s=s.replace(needle,'''   const reductionLoads=values.getAll?.('drop_load')||[];
   let previous=load;
   const reductions=reductionLoads.map((raw,i)=>{
    const load=numeric(raw),reps=numeric(values.getAll('drop_reps')[i]),rir=numeric(values.getAll('drop_rir')[i]);
    if(kind!=='effective'||load>=previous||!Number.isInteger(reps)||reps<1||reps>500||rir>10)
     throw new Error('Cada redução exige carga menor que a anterior, 1 a 500 repetições e RIR de 0 a 10. Selecione Trabalho.');
    previous=load;
    return {load,reps,rir};
   });
'''+needle)
s=s.replace("+(kind==='warmup'?' aquecimento':''));","+(kind==='warmup'?' aquecimento':''),reductions);")
s=s.replace('doc.overlay.sets.length===count+1','doc.overlay.sets.length===count+1+reductions.length')
needle='<button class="btn primary block" type="submit">Salvar série</button>'
assert s.count(needle)==1
s=s.replace(needle,'<div data-drop-parts></div><button class="btn small" type="button" data-coach-action="add-drop">Adicionar redução</button>'+needle)
idx=s.index(" if(action==='next'){")
s=s[:idx]+''' if(action==='add-drop'){
  const parts=btn.form?.querySelector('[data-drop-parts]');
  if(!parts)return;
  if(parts.childElementCount>=8)throw new Error('Limite de oito reduções por série.');
  const field=document.createElement('fieldset');
  field.className='quick-grid mt';
  field.innerHTML='<legend>Redução de carga</legend><label class="field"><span>Carga</span><input class="input" inputmode="decimal" name="drop_load" required></label><label class="field"><span>Repetições</span><input class="input" inputmode="numeric" name="drop_reps" required></label><label class="field"><span>RIR</span><input class="input" inputmode="decimal" name="drop_rir" required></label>';
  const remove=document.createElement('button');
  remove.type='button';remove.className='btn small';remove.textContent='Remover redução';
  remove.addEventListener('click',()=>field.remove());
  field.append(remove);parts.append(field);field.querySelector('input').focus();
  return;
 }
'''+s[idx:]
idx=s.index('function sessionDetail(')
s=s[:idx]+'''function dropSequence(row,sets,unit){
 const drops=sets.filter(s=>s.set_type==='drop_set'&&s.notes==='Drop de '+row.id)
  .sort((a,b)=>a.set_number-b.set_number);
 if(!drops.length)return '';
 return ' · Drop: '+drops.map(s=>fmt(s.load_value)+' '+(s.load_unit_original||unit)+' × '+fmt(s.repetitions,0)+' (RIR '+fmt(s.rir)+')').join(' → ');
}
function isGroupedDrop(row,sets){
 return row.set_type==='drop_set'&&sets.some(parent=>row.notes==='Drop de '+parent.id);
}
'''+s[idx:]
s=s.replace("activeSets.slice(-6).reverse()", "activeSets.filter(s=>!isGroupedDrop(s,activeSets)).slice(-6).reverse()")
s=s.replace("RIR ${s.rir??'não informado'}`)).join", "RIR ${s.rir??'não informado'}${dropSequence(s,activeSets,m.variantMap.get(s.variant_id)?.unit||'')}`)).join")
s=s.replace("${sets.length} séries</div>${session.notes", "${sets.filter(s=>!isGroupedDrop(s,sets)).length} séries</div>${session.notes")
s=s.replace("${sets.length?sets.map(s=>{const v=m.variantMap", "${sets.length?sets.filter(s=>!isGroupedDrop(s,sets)).map(s=>{const v=m.variantMap")
s=s.replace("[s.set_type]||e(s.set_type)}`);}).join", "[s.set_type]||e(s.set_type)}${dropSequence(s,sets,v?.unit||'')}`);}).join")
p.write_text(s)

p=dist/'coach_commands.js';s=p.read_text()
s=s.replace(" return [...doc.overlay.sets].reverse().find(s=>s.session_id===sessionId&&s.provenance?.source==='android_local')||null;", """ const rows=doc.overlay.sets;
 const last=[...rows].reverse().find(s=>s.session_id===sessionId&&s.provenance?.source==='android_local');
 if(last?.set_type==='drop_set'){
  return rows.find(s=>s.session_id===sessionId&&last.notes==='Drop de '+s.id)||last;
 }
 return last||null;""")
s=s.replace(' doc.overlay.sets.splice(index,1);',""" doc.overlay.sets=doc.overlay.sets.filter(row=>row.id!==s.id&&
  !(row.session_id===sessionId&&row.set_type==='drop_set'&&row.notes==='Drop de '+s.id));""")
p.write_text(s)

p=dist/'insights.js';s=p.read_text()
needle='   item.valid++;item.volume+=set.load_value*set.repetitions;item.volumeAvailable=true;'
assert s.count(needle)==1
s=s.replace(needle,needle+'''
   for(const part of m.sets||[]){
    if(part.set_type==='drop_set'&&part.notes==='Drop de '+set.id&&
       part.session_id===set.session_id&&part.variant_id===variantId&&
       finite(part.load_value)&&part.load_value>=0&&Number.isInteger(part.repetitions)&&part.repetitions>0){
     item.volume+=part.load_value*part.repetitions;
    }
   }''')
p.write_text(s)

p=dist/'app.js';s=p.read_text()
needle='function onInput(event){'
assert s.count(needle)==1
s=s.replace(needle,needle+"if(event.target.matches?.('[data-swap-search]')){filterSwapOptions(event.target);return;}")
s+='''
const swapOptionCache = new WeakMap();
function filterSwapOptions(input){
 const details=input.closest('details');
 const select=details?.querySelector('select');
 if(!select)return;
 if(!swapOptionCache.has(select))swapOptionCache.set(select,Array.from(select.options));
 const [placeholder,...options]=swapOptionCache.get(select);
 const key=value=>value.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const terms=key(input.value).trim().split(/ +/).filter(Boolean);
 const matches=options.filter(option=>terms.every(term=>key(option.textContent).includes(term)));
 const previous=select.value;
 select.replaceChildren(placeholder,...matches);
 select.value=matches.some(option=>option.value===previous)?previous:'';
 details.querySelector('[data-swap-results]').textContent=matches.length?
  matches.length+' opção(ões) encontrada(s)':'Nenhum exercício encontrado.';
}
'''
p.write_text(s)
