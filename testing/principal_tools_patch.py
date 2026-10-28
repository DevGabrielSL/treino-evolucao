"""Principal app: rest timer, quick entry and session overview."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
shutil.copy2(root/'testing/principal_rest.js',dist/'principal_rest.js')
p=dist/'app.js';s=p.read_text()
def replace(old,new):
 global s
 assert s.count(old)==1,old
 s=s.replace(old,new)
replace("import {liveGuidance,nextPending} from './principal_live.js';", "import {restTimer,clockLabel} from './principal_rest.js';\nimport {liveGuidance,nextPending} from './principal_live.js';")
replace('function renderCoach(m){', '''let quickSaving=false;
const quickDrafts=new Map();
function renderTrainingTools(active,selected,m){
 const v=m.variantMap.get(selected),timer=restTimer.state(active.id),guidance=active.planned_guidance?.[selected],draft=quickDrafts.get(active.id+':'+selected)||{};
 const safeUnit=['kg','kg/lado','kg/halter','plaquetas','peso corporal'].includes(v?.unit),timed=guidance?.unit==='segundos';
 const overview=(active.planned_variant_ids||[]).map(id=>{const x=liveGuidance(active,id,m.entities),variant=m.variantMap.get(id),ex=m.exerciseMap.get(variant?.exercise_id);return item(ex?.name||'Exercício',x.count+' série(s) de trabalho'+(x.target!==null?' / '+x.target+' sugeridas':' · sem meta salva'),`<button class="btn small" data-coach-action="select" data-coach-variant="${e(id)}">Ir para exercício</button>`);}).join('');
 const options=[30,60,90,120,180,300].map(n=>`<option value="${n}" ${timer.seconds===n?'selected':''}>${n} segundos</option>`).join('');
 const entry=safeUnit&&!timed?`<form id="quick-set-form"><input type="hidden" name="variant_id" value="${e(selected)}"><label class="field"><span>Carga realizada (${e(v.unit)})${v.unit==='peso corporal'?' · 0 = sem carga externa':''}</span><input class="input" name="load" inputmode="decimal" value="${e(draft.load||'')}" required placeholder="Informe a carga"></label><label class="field"><span>Repetições realizadas</span><input class="input" name="reps" type="number" min="1" max="500" step="1" value="${e(draft.reps||'')}" required></label><label class="field"><span>RIR observado (opcional, de 0 a 10)</span><input class="input" name="rir" inputmode="decimal" value="${e(draft.rir||'')}" placeholder="Não informado"></label><label class="field"><span>Tipo de série</span><select name="kind" class="input"><option value="effective">Trabalho</option><option value="warmup" ${draft.kind==='warmup'?'selected':''}>Aquecimento</option></select></label><button class="btn primary block" type="submit">Salvar série realizada</button></form>`:`<p>${timed?'A sugestão deste exercício usa segundos. O registro por tempo ainda não está disponível; não registre segundos como repetições.':'Use a conversa ou o modo manual para registrar na unidade cadastrada.'}</p>`;
 return panel(`<h2>Descanso</h2><p data-rest-session="${e(active.id)}" role="timer">${timer.remaining?clockLabel(timer.remaining):'Descanso encerrado / não iniciado'}</p><form id="rest-settings-form"><input type="hidden" name="session_id" value="${e(active.id)}"><label class="field"><span>Intervalo escolhido</span><select class="input" name="seconds">${options}</select></label><label><input type="checkbox" name="auto" ${timer.auto?'checked':''}> Iniciar após salvar uma série na entrada rápida</label><button class="btn block mt" type="submit">Aplicar intervalo</button></form><div class="inline-actions mt"><button class="btn" data-coach-action="rest-start">Iniciar</button><button class="btn" data-coach-action="rest-pause">Pausar</button><button class="btn" data-coach-action="rest-resume">Retomar</button><button class="btn" data-coach-action="rest-stop">Encerrar descanso</button></div><p class="text-small">O intervalo é ajustável; não é uma avaliação de recuperação. O relógio é recalculado ao voltar à aba, sem garantia de alerta com o celular bloqueado.</p>`)+panel(`<h2>Registrar série do exercício atual</h2><p>${e(m.exerciseMap.get(v?.exercise_id)?.name||'Selecione um exercício')} · ${e(v?.equipment_or_variation||'')}</p>${entry}`)+panel(`<details><summary>Resumo do roteiro</summary>${overview}</details>`);
}
'''+ 'function renderCoach(m){')
replace('${active?current+composer:composer+preview}${actions}', '${active?current+renderTrainingTools(active,selected,m)+composer:composer+preview}${actions}')
replace("${panel(`<h2>Última sessão</h2>", "${doc.overlay.sessions.some(x=>x.status==='in_progress')?panel('<h2>Treino em andamento</h2><p>Retome o roteiro e as séries já salvas neste aparelho.</p><button class=\"btn primary block\" data-coach-action=\"open\">Retomar treino no assistente</button>'):''}${panel(`<h2>Última sessão</h2>")
replace(" const action=btn.dataset.coachAction;", " const action=btn.dataset.coachAction;\n if(action.startsWith('rest-')){const active=coachActive();if(!active)return;const method={'rest-start':'start','rest-pause':'pause','rest-resume':'resume','rest-stop':'stop'}[action];if(method){restTimer[method](active.id);render();}return;}")
needle="async function onSubmit(event){const f=event.target;"
replace(needle,needle+'''if(f?.id==='rest-settings-form'){event.preventDefault();const values=new FormData(f),active=coachActive();if(!active||values.get('session_id')!==active.id)throw new Error('Treino indisponível.');restTimer.configure(active.id,Number(values.get('seconds')),values.get('auto')==='on');render();return;}
 if(f?.id==='quick-set-form'){
  event.preventDefault();if(quickSaving||busy)return;quickSaving=true;const button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;
  try{const active=coachActive(),values=new FormData(f),id=String(values.get('variant_id')||'');if(!active||!active.planned_variant_ids?.includes(id)||id!==coachSelected)throw new Error('O exercício mudou. Confira a seleção antes de registrar.');
   const v=g().variantMap.get(id);if(!v||active.planned_guidance?.[id]?.unit==='segundos')throw new Error('Registro rápido indisponível para esta variação.');
   const numeric=(raw,optional=false)=>{const text=String(raw??'').trim();if(optional&&!text)return null;if(!/^\\d+(?:[.,]\\d+)?$/.test(text))throw new Error('Informe números válidos, sem unidades nos campos.');return Number(text.replace(',','.'));};
   const load=numeric(values.get('load')),reps=numeric(values.get('reps')),rir=numeric(values.get('rir'),true),kind=values.get('kind');
   if(!Number.isInteger(reps)||reps<1||reps>500||load<0||load>10000||rir!==null&&(rir<0||rir>10)||!['effective','warmup'].includes(kind))throw new Error('Confira carga, repetições, RIR e tipo da série.');
   const count=doc.overlay.sets.length;
   await handleCoachMessage(load+' '+v.unit+' '+reps+' reps'+(rir===null?'':' RIR '+rir)+(kind==='warmup'?' aquecimento':''));
   if(doc.overlay.sets.length===count+1){quickDrafts.delete(active.id+':'+id);if(restTimer.state(active.id).auto)restTimer.start(active.id);render();}
  }catch(err){error(err);}finally{quickSaving=false;if(button)button.disabled=false;}return;
 }
''')
replace('function onInput(event){', "function onInput(event){if(event.target.form?.id==='quick-set-form'){const active=coachActive();if(active){const values=new FormData(event.target.form);quickDrafts.set(active.id+':'+values.get('variant_id'),Object.fromEntries(['load','reps','rir','kind'].map(key=>[key,String(values.get(key)||'')])));}return;}")
replace("if(!confirm('Concluir treino com '+sets.length+' séries? Depois, abra Dados para enviar à planilha Google.'))return;", "if(!confirm('Concluir treino com '+sets.length+' séries registradas? Revise se deseja encerrar. A sincronização automática tentará enviar quando habilitada.'))return;")
replace("if(ok){activeSessionId='';coachPlan=null;coachSay('assistant','Treino concluído e salvo no celular.", "if(ok){restTimer.stop(id);activeSessionId='';coachPlan=null;coachSay('assistant','Treino concluído e salvo no celular.")
p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text();assert s.count("'./principal_live.js'")==1;p.write_text(s.replace("'./principal_live.js'","'./principal_rest.js','./principal_live.js'"))
