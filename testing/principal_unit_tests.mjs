import assert from 'node:assert/strict';
import {confirmSessionVariant,correctLocalSetUnit} from '../dist/principal_unit.js';
const make=()=>({base:{entities:{exercise_variants:[{id:'old',exercise_id:'ex',unit:'kg (não confirmado)'}]}},overlay:{exercise_variants:[],sessions:[{id:'s',status:'in_progress',planned_variant_ids:['old'],planned_guidance:{old:{sets:3,label:'3 séries'}}}],sets:[{id:'set',variant_id:'old',load_value:10}]}});
const args={sessionId:'s',sourceId:'old',newId:'new',equipment:'Barra livre',unit:'kg/lado'};
const d=make(),base=JSON.stringify(d.base),sets=JSON.stringify(d.overlay.sets);const v=confirmSessionVariant(d,args);
assert.equal(v.unit,'kg/lado');assert.equal(v.unit_confirmed,true);assert.equal(v.comparison_group_id,'new');assert.equal(JSON.stringify(d.base),base);assert.equal(JSON.stringify(d.overlay.sets),sets);assert.deepEqual(d.overlay.sessions[0].planned_variant_ids,['new']);assert.equal(d.overlay.sessions[0].planned_guidance.new.sets,3);
for(const changes of [{unit:''},{unit:'kg desconhecido'},{equipment:''},{sourceId:'missing'},{sessionId:'missing'},{newId:'old'}]){const doc=make(),before=JSON.stringify(doc);assert.throws(()=>confirmSessionVariant(doc,{...args,...changes}));assert.equal(JSON.stringify(doc),before);}
const stopped=make();stopped.overlay.sessions[0].status='cancelled';assert.throws(()=>confirmSessionVariant(stopped,args));
console.log('UNIT_CONFIRM_PRESERVE_HISTORY_EXPLICIT_CHOICE_STALE=PASS');
const reused=make();
reused.overlay.exercise_variants.push({...v,id:'saved',equipment_or_variation:' barra  livre '});
assert.equal(confirmSessionVariant(reused,args).id,'saved');
assert.deepEqual(reused.overlay.sessions[0].planned_variant_ids,['saved']);
assert.equal(reused.overlay.exercise_variants.length,1);
{
 const doc=make();
 const variant={...v,id:'kg',unit:'kg'};
 doc.overlay.exercise_variants.push(variant);
 const parent={id:'parent',session_id:'s',variant_id:'kg',set_type:'effective',load_value:30};
 const first={...parent,id:'first',set_type:'drop_set',set_number:2,notes:'Drop de parent',load_value:20};
 const second={...first,id:'second',set_number:3,load_value:10};
 doc.overlay.sets=[parent,first,second];
 const mutate=(d,id,changes)=>Object.assign(d.overlay.sets.find(row=>row.id===id),changes);
 const update=(row,load,unit='kg',type=row.set_type)=>correctLocalSetUnit(doc,row.id,unit,'new',{load_value:load,set_type:type},mutate);
 const before=JSON.stringify(doc);
 assert.throws(()=>update(first,31),/menor/);
 assert.throws(()=>update(parent,19),/menor/);
 assert.throws(()=>update(first,15,'plaquetas'),/unidade/);
 assert.throws(()=>update(first,15,'kg','effective'),/tipo/);
 assert.equal(JSON.stringify(doc),before);
 update(first,15);
 assert.deepEqual(doc.overlay.sets.map(s=>s.load_value),[30,15,10]);
 console.log('DROP_EDIT_PRESERVES_SEQUENCE=PASS');
}
