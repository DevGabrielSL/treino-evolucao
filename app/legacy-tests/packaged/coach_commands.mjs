import assert from 'node:assert/strict';
import {parseCoachCommand,resolvePlannedExercise,lastDraftSet,undoLastDraftSet,correctLastDraftSet,resumeSelectedVariant} from '../coach_commands.js';
import {parseSeriesMessage} from '../coach_logic.js';
import {emptyDocument,commit,validateDocument} from '../store.js';
import {planOutbound} from '../sheet_sync_core.js';
let count=0;function check(name,fn){fn();count++;console.log('PASS',name)}
const cmds={
 'desfazer':'undo','desfazer ultima serie':'undo','apagar última':'undo','remover':'undo',
 'corrigir última: 55 kg 8 reps rir 1':'correct','alterar ultimo registro 55x8 RIR 2':'correct',
 'próximo exercício':'next','seguir':'next','resumo do treino':'summary','ajuda':'help',
 'selecionar supino reto':'select','trocar para voador':'select',
 '50 kg 10 reps rir 2':'set'};
for(const [text,expected] of Object.entries(cmds))check('command '+text,()=>assert.equal(parseCoachCommand(text).kind,expected));
check('Correction payload',()=>assert.equal(parseCoachCommand('corrigir última: 55 kg 8 reps rir 1').payload,'55 kg 8 reps rir 1'));
check('Selection payload',()=>assert.equal(parseCoachCommand('selecionar supino reto').name,'supino reto'));
check('Blank invalid',()=>assert.equal(parseCoachCommand(' ').kind,'invalid'));
const variantMap=new Map([['v1',{exercise_id:'e1',equipment_or_variation:'Barra',unit:'kg'}],['v2',{exercise_id:'e2',equipment_or_variation:'Máquina',unit:'plaquetas'}],['v3',{exercise_id:'e1',equipment_or_variation:'Smith',unit:'kg'}]]);
const exerciseMap=new Map([['e1',{name:'Supino reto'}],['e2',{name:'Voador'}]]);
check('Select exact exercise',()=>assert.equal(resolvePlannedExercise('Voador',['v1','v2'],variantMap,exerciseMap),'v2'));
check('Select partial unique exercise',()=>assert.equal(resolvePlannedExercise('voad',['v1','v2'],variantMap,exerciseMap),'v2'));
check('Ambiguity prevents wrong equipment',()=>assert.throws(()=>resolvePlannedExercise('supino',['v1','v3'],variantMap,exerciseMap),/ambíguo/));
check('Reject non-planned exercise',()=>assert.throws(()=>resolvePlannedExercise('remada',['v1','v2'],variantMap,exerciseMap),/roteiro/));
let d=emptyDocument();d=commit(d,x=>{
 x.overlay.exercises.push({id:'e1',name:'Supino reto'},{id:'e2',name:'Voador'});
 x.overlay.exercise_variants.push({id:'v1',exercise_id:'e1',equipment_or_variation:'Barra',unit:'kg',unit_confirmed:true},{id:'v2',exercise_id:'e2',equipment_or_variation:'Máquina',unit:'plaquetas',unit_confirmed:true});
 x.overlay.sessions.push({id:'s1',date:'2026-10-26',name:'Peito',status:'in_progress',planned_variant_ids:['v1','v2'],provenance:{source:'android_local'}});
 x.overlay.sets.push({id:'set1',date:'2026-10-26',session_id:'s1',exercise_id:'e1',variant_id:'v1',set_type:'effective',set_number:1,load_value:50,repetitions:10,rir:2,notes:null,provenance:{source:'android_local'}});
 x.overlay.sets.push({id:'set2',date:'2026-10-26',session_id:'s1',exercise_id:'e2',variant_id:'v2',set_type:'effective',set_number:1,load_value:5,repetitions:12,rir:2,notes:null,provenance:{source:'android_local'}});
});
check('Initial state valid',()=>assert.equal(validateDocument(d),true));
check('Resume last used exercise',()=>assert.equal(resumeSelectedVariant(d,'s1',['v1','v2']),'v2'));
check('Read last local draft set',()=>assert.equal(lastDraftSet(d,'s1').id,'set2'));
check('Parsed correction unit preserved',()=>assert.equal(parseSeriesMessage('6 plaquetas 10 reps rir 1','plaquetas').load_value,6));
d=commit(d,x=>correctLastDraftSet(x,'s1',{load_value:6,repetitions:10,rir:1,set_type:'effective',notes:'corrigido'}));
check('Correction retains ID',()=>assert.equal(d.overlay.sets.at(-1).id,'set2'));
check('Correction changes only last set',()=>assert.equal(d.overlay.sets.at(-1).load_value,6));
check('First set untouched',()=>assert.equal(d.overlay.sets[0].load_value,50));
check('Correction retains valid document',()=>assert.equal(validateDocument(d),true));
d=commit(d,x=>undoLastDraftSet(x,'s1'));
check('Undo removes last set',()=>assert.deepEqual(d.overlay.sets.map(s=>s.id),['set1']));
check('Resume now first exercise',()=>assert.equal(resumeSelectedVariant(d,'s1',['v1','v2']),'v1'));
check('Draft cannot be uploaded',()=>assert.equal(planOutbound(d,{Treinos:[['Data']],Series:[['Data']],Peso:[['Data']]}).Series.length,0));
check('Failed invalid correction does not mutate original',()=>{
 const before=JSON.stringify(d);assert.throws(()=>commit(d,x=>correctLastDraftSet(x,'s1',{repetitions:-2})),/Repeti/);assert.equal(JSON.stringify(d),before);
});
let done=commit(d,x=>{x.overlay.sessions[0].status='completed';});
check('Completed session blocks corrections',()=>assert.throws(()=>commit(done,x=>correctLastDraftSet(x,'s1',{load_value:99})),/andamento/));
check('Completed session blocks undo',()=>assert.throws(()=>commit(done,x=>undoLastDraftSet(x,'s1')),/andamento/));
check('Completed session creates upload candidate',()=>assert.equal(planOutbound(done,{Treinos:[['Data']],Series:[['Data']],Peso:[['Data']]}).Series.length,1));
check('Cannot undo imported-only set',()=>{
 const c=commit(d,x=>{x.overlay.sets[0].provenance={sheet:'Series',row:2};});
 assert.throws(()=>commit(c,x=>undoLastDraftSet(x,'s1')),/local/);
});
console.log('COACH_COMMAND_TESTS='+count);
