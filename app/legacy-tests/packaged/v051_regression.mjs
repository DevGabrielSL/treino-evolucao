import assert from 'node:assert/strict';
import {emptyDocument,commit,validateDocument} from '../store.js';
import {compute,lastSetsForVariant} from '../metrics.js';
import {repeatSessionAsDraft} from '../edit_ops.js';
let tests=0;
const check=(description,action)=>{action();tests++;console.log('PASS:',description)};
let doc=emptyDocument();
doc=commit(doc,d=>{
 d.overlay.exercises.push({id:'exercise1',name:'Supino'},{id:'exercise2',name:'Remada'});
 d.overlay.exercise_variants.push({id:'variant1',exercise_id:'exercise1',equipment_or_variation:'barra',unit:'kg',unit_confirmed:true},{id:'variant2',exercise_id:'exercise2',equipment_or_variation:'halter',unit:'kg',unit_confirmed:true});
 d.overlay.sessions.push({id:'finished',date:'2026-10-21',name:'Superior A',status:'completed'},{id:'draft',date:'2026-10-22',name:'Rascunho',status:'in_progress'});
 d.overlay.sets.push(
 {id:'zero',date:'2026-10-21',session_id:'finished',exercise_id:'exercise1',variant_id:'variant1',set_type:'effective',load_value:0,repetitions:12,rir:2},
 {id:'valid',date:'2026-10-21',session_id:'finished',exercise_id:'exercise1',variant_id:'variant1',set_type:'effective',load_value:20,repetitions:8,rir:2},
 {id:'only-zero',date:'2026-10-21',session_id:'finished',exercise_id:'exercise2',variant_id:'variant2',set_type:'effective',load_value:0,repetitions:10,rir:2},
 {id:'not-finished',date:'2026-10-22',session_id:'draft',exercise_id:'exercise1',variant_id:'variant1',set_type:'effective',load_value:80,repetitions:8,rir:2},
 {id:'warmup',date:'2026-10-21',session_id:'finished',exercise_id:'exercise2',variant_id:'variant2',set_type:'warmup',load_value:40,repetitions:10,rir:2}
 );
});
check('Validar esquema original',()=>assert.equal(validateDocument(doc),true));
check('Excluir cargas zero de recordes',()=>assert.equal(compute(doc).prs.length,1));
check('Recorde de sessão concluída com carga positiva',()=>assert.equal(compute(doc).prs[0].load,20));
check('Séries em andamento não entram na métrica',()=>assert.equal(compute(doc).eff.length,3));
check('Última série sugerida ignora rascunhos',()=>assert.equal(lastSetsForVariant(compute(doc).entities,'variant1').load_value,20));
check('Última série sugerida ignora aquecimento',()=>assert.equal(lastSetsForVariant(compute(doc).entities,'variant2').load_value,0));
doc=commit(doc,d=>{d.overlay.sessions[1].status='cancelled';});
doc=commit(doc,d=>repeatSessionAsDraft(d,'finished','repeated','2026-10-23'));
check('Repetir restaura exercícios na ordem',()=>assert.deepEqual(doc.overlay.sessions.at(-1).planned_variant_ids,['variant1','variant2']));
check('Repetir não copia cargas nem séries',()=>assert.equal(doc.overlay.sets.length,5));
check('Repetir mantém sessão in_progress',()=>assert.equal(doc.overlay.sessions.at(-1).status,'in_progress'));
check('Repetir não conta frequência antes de finalizar',()=>assert.equal(compute(doc).done.length,1));
check('Rejeitar IDs duplicados',()=>assert.throws(()=>commit(doc,d=>{d.overlay.sessions.at(-1).status='cancelled';repeatSessionAsDraft(d,'finished','finished','2026-10-23')}),/Identificador/));
check('Rejeitar datas impossíveis',()=>assert.throws(()=>commit(doc,d=>{d.overlay.sessions.at(-1).status='cancelled';repeatSessionAsDraft(d,'finished','new','2026-02-30')}),/Data/));
check('Estado permanece validável após correções',()=>assert.equal(validateDocument(JSON.parse(JSON.stringify(doc))),true));
console.log('TESTES APROVADOS:',tests);
