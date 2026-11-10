// Actual finisher records use the same set collection as the rest of the workout.
export const FINISHER_GOALS=Object.freeze([
 {key:'abs',name:'Abdominal máquina',exercise:'Abdominal máquina',target:100},
 {key:'plank',name:'Prancha',exercise:'Prancha',target:180,timed:true}
]);
function activeSession(doc,id){const s=doc.overlay.sessions.find(s=>s.id===id&&s.status==='in_progress');if(!s)throw new Error('Este treino não está mais em andamento.');return s;}
function validNow(now){if(!Number.isFinite(now)||now<0)throw new Error('Horário inválido.');return now;}
function all(doc,key){return [...(doc.base?.entities?.[key]||[]),...doc.overlay[key]];}
function goalFor(key){const goal=FINISHER_GOALS.find(g=>g.key===key);if(!goal)throw new Error('Exercício final inválido.');return goal;}
export function plankElapsed(session,sets,now=Date.now()){
 const saved=sets.filter(s=>s.session_id===session.id&&s.finisher_key==='plank').reduce((n,s)=>n+(Number.isFinite(s.duration_ms)?Math.max(0,s.duration_ms):0),0);
 const start=Date.parse(session.finisher_plank_started_at||'');
 return saved+(Number.isFinite(start)&&session.status==='in_progress'?Math.max(0,now-start):0);
}
export function finisherProgress(session,sets,now=Date.now()){
 return FINISHER_GOALS.map(goal=>{const done=goal.timed?Math.floor(plankElapsed(session,sets,now)/1000):sets.filter(s=>s.session_id===session.id&&s.finisher_key===goal.key&&['effective','core','back_off'].includes(s.set_type)).reduce((n,s)=>n+(s.repetitions||0),0);return {...goal,done,remaining:Math.max(0,goal.target-done)};});
}
function variantFor(doc,goal,unit){
 const exerciseId='exercise_finisher_'+goal.key,variantId='variant_finisher_'+goal.key+'_'+unit.replace(/[^a-z]/g,'');
 if(!all(doc,'exercises').some(x=>x.id===exerciseId))doc.overlay.exercises.push({id:exerciseId,name:goal.exercise,muscle_group:'abdômen',classification_verified:false,notes:'Bloco final do treino.'});
 if(!all(doc,'exercise_variants').some(x=>x.id===variantId))doc.overlay.exercise_variants.push({id:variantId,exercise_id:exerciseId,equipment_or_variation:goal.key==='abs'?'Máquina do bloco final':'Peso corporal',unit,unit_confirmed:true,comparison_group_id:variantId,comparison_policy:'match_same_variant_only'});
 const v=all(doc,'exercise_variants').find(x=>x.id===variantId);if(v.exercise_id!==exerciseId||v.unit!==unit)throw new Error('Conflito no cadastro do bloco final.');return v;
}
function pushRow(doc,session,goal,{id,load,reps,rir,kind,unit,now,durationMs=null}){
 if(typeof id!=='string'||!id||all(doc,'sets').some(s=>s.id===id))throw new Error('Registro já salvo ou identificador inválido.');
 const variant=variantFor(doc,goal,unit);
 const number=all(doc,'sets').filter(s=>s.session_id===session.id&&s.variant_id===variant.id).reduce((n,s)=>Math.max(n,s.set_number||0),0)+1;
 const row={id,date:session.date,session_id:session.id,session_name_original:session.name,exercise_id:variant.exercise_id,variant_id:variant.id,set_type:kind,set_type_original:null,set_number:number,load_value:load,load_unit_original:unit,repetitions:reps,rir,rpe:null,legacy_volume_index:null,discomfort:null,recorded_at:new Date(validNow(now)).toISOString(),finisher_key:goal.key,notes:durationMs===null?'Bloco final · '+goal.exercise:'Bloco final · Prancha · '+(durationMs/1000).toFixed(2)+' segundos',provenance:{source:'android_local'}};
 if(durationMs!==null)row.duration_ms=durationMs;
 doc.overlay.sets.push(row);return row;
}
export function recordFinisherSet(doc,sessionId,key,values){
 const session=activeSession(doc,sessionId),goal=goalFor(key),{load,reps,rir,kind,unit}=values;
 if(goal.timed)throw new Error('Use o cronômetro para registrar a prancha.');
 if(!Number.isFinite(load)||load<0||load>10000||!Number.isInteger(reps)||reps<1||reps>500||!Number.isFinite(rir)||rir<0||rir>10||!['effective','warmup'].includes(kind))throw new Error('Informe carga, repetições, RIR e trabalho ou aquecimento.');
 if(!['kg','plaquetas'].includes(unit))throw new Error('Confirme a unidade da carga.');
 return pushRow(doc,session,goal,values);
}
export function setPlankRunning(doc,sessionId,running,{now=Date.now(),id}={}){
 validNow(now);const session=activeSession(doc,sessionId),start=Date.parse(session.finisher_plank_started_at||'');
 if(typeof running!=='boolean')throw new Error('Estado de cronômetro inválido.');
 if(running){if(session.clock_paused_at)throw new Error('Retome o treino antes de iniciar a prancha.');if(!Number.isFinite(start))session.finisher_plank_started_at=new Date(now).toISOString();return;}
 if(!Number.isFinite(start))return;
 const durationMs=Math.max(0,now-start);
 if(durationMs>0)pushRow(doc,session,goalFor('plank'),{id,load:0,reps:null,rir:null,kind:'core',unit:'segundos',now,durationMs});
 session.finisher_plank_started_at=null;
}
export function workoutElapsed(session,now=Date.now()){
 const start=Date.parse(session.started_at||session.clock_started_at||'');if(!Number.isFinite(start))return null;
 const end=Date.parse(session.finished_at||session.clock_paused_at||'');
 return Math.max(0,(Number.isFinite(end)?end:now)-start-(session.clock_paused_ms||0));
}
export function setWorkoutPaused(doc,sessionId,paused,{now=Date.now(),id}={}){
 validNow(now);const session=activeSession(doc,sessionId);
 if(typeof paused!=='boolean')throw new Error('Estado de pausa inválido.');
 if(paused){if(!session.clock_paused_at){setPlankRunning(doc,sessionId,false,{now,id});session.clock_paused_at=new Date(now).toISOString();}}
 else if(session.clock_paused_at){session.clock_paused_ms=(session.clock_paused_ms||0)+Math.max(0,now-Date.parse(session.clock_paused_at));session.clock_paused_at=null;}
}
export function lastRecordedSet(session,sets){return sets.filter(s=>s.session_id===session.id&&Number.isFinite(Date.parse(s.recorded_at||''))).sort((a,b)=>Date.parse(b.recorded_at)-Date.parse(a.recorded_at))[0]||null;}

