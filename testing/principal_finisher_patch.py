from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
shutil.copy2(root/'testing/principal_finisher.js',dist/'principal_finisher.js')
p=dist/'app.js';s=p.read_text()
s="import {FINISHER_GOALS,finisherProgress,plankElapsed,recordFinisherSet,setPlankRunning,workoutElapsed,setWorkoutPaused,lastRecordedSet} from './principal_finisher.js?v=179';\n"+s
def once(old,new):
 global s
 assert s.count(old)==1,old
 s=s.replace(old,new)
# Timestamp is set when a record is created, and survives later corrections.
once('const row={id:makeId(\'set\'),date:s.date',"const row={recorded_at:new Date().toISOString(),id:makeId('set'),date:s.date")
once("d.overlay.sets.push({id:makeId('set'),date:session.date","d.overlay.sets.push({recorded_at:new Date().toISOString(),id:makeId('set'),date:session.date")
once("${active?current+renderTrainingTools(active,selected,m)+composer:composer+preview}","${active?current+renderLastSetClock(active,activeSets)+renderTrainingTools(active,selected,m)+renderFinisher(active,m)+composer:composer+preview}")
once('<h2>Últimas séries</h2>','<h2>Últimas séries</h2>')
# Timed sets have an honest duration label, without pretending seconds are reps.
once("`${({effective:'Trabalho'", "`${s.finisher_key==='plank'?'Prancha · '+(s.duration_ms/1000).toFixed(1)+' segundos':`${({effective:'Trabalho'")
once("${dropSequence(s,activeSets,m.variantMap.get(s.variant_id)?.unit||'')}`", "${dropSequence(s,activeSets,m.variantMap.get(s.variant_id)?.unit||'')}`} · ${s.recorded_at?new Date(s.recorded_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'Horário não registrado'}`")
once("function renderCoach(",(root/'testing/principal_finisher_ui.js').read_text()+'\nfunction renderCoach(')
once("async function onSubmit(event){",'''async function onSubmit(event){
 if(event.target?.id==='finisher-set-form'){
  event.preventDefault();if(busy||quickSaving)return;
  const values=new FormData(event.target),session=coachActive();
  try{
   if(!session||values.get('session_id')!==session.id)throw new Error('Treino indisponível.');
   const readFinalNumber=name=>{const raw=String(values.get(name)??'').trim();if(!raw)throw new Error('Preencha carga, repetições e RIR.');const n=Number(raw.replace(',','.'));if(!Number.isFinite(n))throw new Error('Valor inválido.');return n;};
   const key=values.get('key'),entry={id:makeId('set'),now:Date.now(),load:readFinalNumber('load'),reps:readFinalNumber('reps'),rir:readFinalNumber('rir'),kind:values.get('kind'),unit:values.get('unit')};
   quickSaving=true;
   if(await perform(d=>recordFinisherSet(d,session.id,key,entry),'Série do bloco final salva.')){finisherDrafts.delete(session.id+':'+key);render();}
  }catch(err){error(err);}finally{quickSaving=false;}return;
 }
''')
needle="async function onClick(event){const btn=event.target.closest('button');if(!btn)return;"
once(needle,needle+"if(btn.dataset.finisherAction){try{await handleFinisherAction(btn);}catch(err){error(err);}return;}")
# Preserve partial final-block entries across timer and navigation actions.
at=s.index('function onInput(');brace=s.index('{',at)
s=s[:brace+1]+'''\n const finalForm=event.target?.closest?.('#finisher-set-form');
 if(finalForm){const values=new FormData(finalForm);finisherDrafts.set(values.get('session_id')+':'+values.get('key'),Object.fromEntries(values));return;}
'''+s[brace+1:]
# Paused workout time is excluded from elapsed time, including after reopening.
once("const start=session.started_at||session.clock_started_at,seconds=sessionClockSeconds(start);","const start=session.started_at||session.clock_started_at,elapsed=workoutElapsed(session),seconds=elapsed===null?null:Math.floor(elapsed/1000);")
once("data-session-clock=\"'+e(start)+'\"","data-session-clock=\"'+e(start)+'\" data-clock-session=\"'+e(session.id)+'\"")
once("+sessionClockLabel(seconds)+'</strong></div>';","+sessionClockLabel(seconds)+'</strong><span>'+(session.clock_paused_at?'Pausado':'Em andamento')+'</span><button type=\"button\" class=\"btn small\" data-finisher-action=\"'+(session.clock_paused_at?'resume-workout':'pause-workout')+'\" data-session=\"'+e(session.id)+'\">'+(session.clock_paused_at?'Retomar treino':'Pausar treino')+'</button><button type=\"button\" class=\"btn small\" data-finisher-action=\"open\" data-session=\"'+e(session.id)+'\">Ir para bloco final</button></div>';")
once("document.querySelectorAll('[data-session-clock]').forEach(el=>{el.textContent=sessionClockLabel(sessionClockSeconds(el.dataset.sessionClock));});", """document.querySelectorAll('[data-session-clock]').forEach(el=>{const session=doc?.overlay.sessions.find(s=>s.id===el.dataset.clockSession);const ms=session?workoutElapsed(session):null;el.textContent=sessionClockLabel(ms===null?null:Math.floor(ms/1000));});
 document.querySelectorAll('[data-last-set-clock]').forEach(el=>{el.textContent=sessionClockLabel(sessionClockSeconds(el.dataset.lastSetClock));});
 document.querySelectorAll('[data-plank-clock]').forEach(el=>{const session=doc?.overlay.sessions.find(s=>s.id===el.dataset.plankClock);if(!session)return;const seconds=Math.floor(plankElapsed(session,merged(doc).sets)/1000);el.textContent=sessionClockLabel(seconds);const label=document.querySelector('[data-plank-remaining]');if(label)label.textContent=seconds>=180?'Meta atingida':'Faltam '+(180-seconds)+' segundos';});""")
once("const pending=summary.pending.length?", "const finalPending=finisherProgress(active,g().sets).filter(g=>g.remaining).map(g=>g.name+': faltam '+g.remaining+(g.timed?' s':' reps'));\n  const pending=summary.pending.length?")
once("+review+pending+'\\n\\nCancelar volta ao treino.","+review+pending+(finalPending.length?'\\n\\nBloco final pendente:\\n'+finalPending.join('\\n'):'\\n\\nBloco final: metas atingidas.')+'\\n\\nCancelar volta ao treino.")
once("s.finished_at=new Date().toISOString();", "setPlankRunning(d,id,false,{id:makeId('set')});setWorkoutPaused(d,id,false);s.finished_at=new Date().toISOString();")
once("if(Number.isFinite(start))s.duration_minutes=Math.max(0,Math.round((Date.parse(s.finished_at)-start)/60000));", "if(Number.isFinite(start))s.duration_minutes=Math.round(workoutElapsed(s,Date.parse(s.finished_at))/60000);")
once("sessionClockLabel(Math.max(0,Math.floor((end-start)/1000)))","sessionClockLabel(Math.floor(workoutElapsed(session,end)/1000))")
once("'<p class=\"text-small\">Treino salvo no aparelho.","renderFinisherSummary(session,entities.sets)+'<p class=\"text-small\">Treino salvo no aparelho.")
# The history detail keeps finisher totals visible after the recap is closed.
once('<hr class="divider">${sets.length?sets.filter', '<hr class="divider">${sets.some(s=>s.finisher_key)?renderFinisherSummary(session,sets):\'\'}${sets.length?sets.filter')
# A duration record is removable in the final block, not editable as repetitions.
once("function renderSeriesEditActions(row,sets,editable){", "function renderSeriesEditActions(row,sets,editable){\n if(row.finisher_key==='plank')return editable.has(row.id)?'<button type=\"button\" class=\"btn small\" data-edit-set=\"'+e(row.id)+'\">Corrigir duração</button>':'';")
once("const s=doc.overlay.sets.find(x=>x.id===id);if(!s)return '';",'''const s=doc.overlay.sets.find(x=>x.id===id);if(!s)return '';
 if(s.finisher_key==='plank')return panel('<h2>Corrigir duração da prancha</h2><form id="edit-plank-form"><input type="hidden" name="set_id" value="'+e(s.id)+'"><label class="field"><span>Segundos realizados neste trecho</span><input class="input" name="seconds" type="number" required min="0.01" max="86400" step="0.01" value="'+(s.duration_ms/1000).toFixed(2)+'"></label><div class="inline-actions"><button class="btn primary" type="submit">Salvar correção</button><button class="btn" type="button" data-action="cancel-edit-set">Cancelar</button></div></form>','tinted');''')
once("async function onSubmit(event){",'''async function onSubmit(event){
 if(event.target?.id==='edit-plank-form'){
  event.preventDefault();if(busy||quickSaving)return;
  try{const values=new FormData(event.target),seconds=Number(values.get('seconds'));if(!Number.isFinite(seconds)||seconds<=0||seconds>86400)throw new Error('Informe de 0,01 a 86400 segundos.');
   const ok=await perform(d=>{const row=d.overlay.sets.find(s=>s.id===values.get('set_id')&&s.finisher_key==='plank');if(!row)throw new Error('Registro local indisponível.');row.duration_ms=Math.round(seconds*1000);row.notes='Bloco final · Prancha · '+seconds.toFixed(2)+' segundos';},'Duração corrigida.');
   if(ok){editSetId='';render();}
  }catch(err){error(err);}return;
 }
''')
# Duration remains visible in history; a timed record is never displayed as reps.
once("`${v?.equipment_or_variation||''} · ${fmt(s.load_value)}", "`${s.finisher_key==='plank'?'Prancha · '+(s.duration_ms/1000).toFixed(1)+' segundos':`${v?.equipment_or_variation||''} · ${fmt(s.load_value)}")
once("${dropSequence(s,sets,v?.unit||'')}`", "${dropSequence(s,sets,v?.unit||'')}`}`")
p.write_text(s)
# A repeated workout starts fresh; the automatic closing block is not duplicated
# as ordinary planned exercises when a session becomes a template.
p=dist/'template_ops.js';t=p.read_text();old='allSets(doc).filter(s=>s.session_id===session.id)';assert t.count(old)==1
p.write_text(t.replace(old,'allSets(doc).filter(s=>s.session_id===session.id&&!s.finisher_key)'))
p=dist/'edit_ops.js';t=p.read_text();old='.filter(s=>s.session_id===source.id)';assert t.count(old)==1
t=t.replace(old,'.filter(s=>s.session_id===source.id&&!s.finisher_key)')
t=t.replace("status:'in_progress',duration_minutes:null","status:'in_progress',started_at:new Date().toISOString(),duration_minutes:null")
p.write_text(t)
p=dist/'principal_focus.css';p.write_text(p.read_text()+'''
.last-set-clock{display:grid;grid-template-columns:1fr auto;align-items:center;gap:5px 12px;padding:12px 16px;margin:10px 0 16px;background:#122e30;border:1px solid #698c83;border-radius:14px}.last-set-clock>strong{font:700 26px/1.2 system-ui;font-variant-numeric:tabular-nums;color:#f3dfaa}.last-set-clock>small{grid-column:1/-1;color:#b5c9c8;font-size:12px}
.finisher-heading{display:flex;justify-content:space-between;align-items:center;gap:8px}.finisher-heading h2{margin:6px 0}.finisher-heading>span{font-size:12px;color:#ced8ce;white-space:nowrap}.finisher-goals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:16px 0}.finisher-goal{display:grid;text-align:left;gap:7px;align-content:start;min-width:0;padding:12px 9px;border-radius:12px;border:1px solid #8e805e;background:#112433;color:#e4e9e4;font:inherit}.finisher-goal.selected{border:2px solid #8de5cc;background:#153b36}.finisher-goal>span{font-size:12px;line-height:1.4;min-height:34px}.finisher-goal strong{font:700 clamp(14px,4.2vw,18px)/1.2 system-ui;white-space:nowrap;font-variant-numeric:tabular-nums;color:#f2dfac}.finisher-goal small{font-size:11px;line-height:1.4}.finisher-panel{scroll-margin-top:16px}.finisher-panel:focus{outline:2px solid #a3deca}.finisher-panel form{min-width:0;border-top:1px solid #4e625d;padding-top:10px}.finisher-panel .quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.finisher-panel .quick-grid .field{min-width:0;margin:6px 0;grid-column:auto;display:flex;flex-direction:column}.finisher-panel .quick-grid .field:has(select[name=unit]){grid-column:1/-1}.finisher-panel .input{min-width:0;width:100%;font-size:16px;min-height:48px;box-sizing:border-box}.finisher-panel .field>span{font-size:13px;line-height:1.4;min-height:36px;display:block}.finisher-panel .btn{min-height:44px;white-space:normal}.finisher-plank{margin:20px 0 14px;padding:16px;border:1px solid #758c7d;border-radius:14px;background:#102927}.finisher-plank h3{font-size:17px;margin:0 0 10px}.finisher-plank>strong{display:block;font:700 36px/1.3 system-ui;font-variant-numeric:tabular-nums;color:#f2dfac}.finisher-plank>small{display:block;margin-top:4px;color:#c2dfd4}.finisher-record{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between;padding:10px 0;border-bottom:1px solid #4f625c;font-size:13px}.finisher-summary{display:grid;gap:6px;border-top:1px solid #63746b;padding:14px 0;margin-top:12px;font-size:14px}.session-clock .btn{min-height:40px;font-size:12px}.session-clock>span{font-size:12px;color:#bddccf}
@media(max-width:360px){.finisher-goals{gap:5px}.finisher-goal{padding:10px 6px}.finisher-goal strong{font-size:16px}.last-set-clock{grid-template-columns:1fr}.last-set-clock>small{grid-column:auto}}
''')
for name in ('sw.js','integrity.js'):
 p=dist/name;t=p.read_text();assert 'shell-v178-mobile-edit' in t
 t=t.replace('shell-v178-mobile-edit','shell-v180-finisher-layout').replace('principal_focus.css?v=178','principal_focus.css?v=180')
 assert "'./app.js?v=170'" in t
 t=t.replace("'./app.js?v=170'","'./app.js?v=179','./principal_finisher.js?v=179'")
 p.write_text(t)
p=dist/'index.html';p.write_text(p.read_text().replace('principal_focus.css?v=178','principal_focus.css?v=180').replace('app.js?v=170','app.js?v=179'))
