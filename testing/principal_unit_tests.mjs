import assert from 'node:assert/strict';
import {confirmSessionVariant} from '../dist/principal_unit.js';
const make=()=>({base:{entities:{exercise_variants:[{id:'old',exercise_id:'ex',unit:'kg (não confirmado)'}]}},overlay:{exercise_variants:[],sessions:[{id:'s',status:'in_progress',planned_variant_ids:['old'],planned_guidance:{old:{sets:3,label:'3 séries'}}}],sets:[{id:'set',variant_id:'old',load_value:10}]}});
const args={sessionId:'s',sourceId:'old',newId:'new',equipment:'Barra livre',unit:'kg/lado'};
const d=make(),base=JSON.stringify(d.base),sets=JSON.stringify(d.overlay.sets);const v=confirmSessionVariant(d,args);
assert.equal(v.unit,'kg/lado');assert.equal(v.unit_confirmed,true);assert.equal(v.comparison_group_id,'new');assert.equal(JSON.stringify(d.base),base);assert.equal(JSON.stringify(d.overlay.sets),sets);assert.deepEqual(d.overlay.sessions[0].planned_variant_ids,['new']);assert.equal(d.overlay.sessions[0].planned_guidance.new.sets,3);
for(const changes of [{unit:''},{unit:'kg desconhecido'},{equipment:''},{sourceId:'missing'},{sessionId:'missing'},{newId:'old'}]){const doc=make(),before=JSON.stringify(doc);assert.throws(()=>confirmSessionVariant(doc,{...args,...changes}));assert.equal(JSON.stringify(doc),before);}
const stopped=make();stopped.overlay.sessions[0].status='cancelled';assert.throws(()=>confirmSessionVariant(stopped,args));
console.log('UNIT_CONFIRM_PRESERVE_HISTORY_EXPLICIT_CHOICE_STALE=PASS');
