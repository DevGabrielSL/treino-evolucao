import assert from 'node:assert/strict';
import {PRESET_DECKS,presetItems,presetPlan,renderPresetLibrary} from '../dist/principal_presets.js';
import {catalogEntities} from '../dist/balanced_coach.js?v=121';
import {emptyDocument,validateDocument} from '../dist/store.js';
const entities={sessions:[],sets:[],exercises:[],exercise_variants:[]},today='2026-10-29';
assert.equal(PRESET_DECKS.length,15);assert.equal(new Set(PRESET_DECKS.map(x=>x.id)).size,15);
const before=JSON.stringify(PRESET_DECKS);
for(const deck of PRESET_DECKS){
 const p=presetPlan(deck.id,entities,today);assert.equal(p.items.length,deck.items.length);assert.equal(new Set(p.items.map(x=>x.variant_id)).size,p.items.length);assert.equal(p.items.some(x=>x.group==='core'),deck.id!=='rpg_deck_01');
 for(const x of p.items){assert.equal(x.dose.sets,3);assert.ok(x.dose.min>0&&x.dose.max>=x.dose.min);assert.equal(x.last,null);assert.ok(!/smith|smitch/i.test(x.equipment));if(x.name==='Supino reto')assert.equal(x.equipment,'Barra livre');if(x.name==='Crucifixo de peito')assert.equal(x.equipment,'Máquina inclinada com anilhas');if(/Agachamento/.test(x.name))assert.ok(/hack|goblet/.test(x.name));}
 const reduced=presetPlan(deck.id,entities,today,{fatigue:'high'});assert.ok(reduced.items.length<=4);assert.equal(reduced.items.some(x=>x.group==='core'),deck.id!=='rpg_deck_01');assert.ok(reduced.items.every(x=>x.dose.sets===3));
 assert.throws(()=>presetPlan(deck.id,entities,today,{pain:'yes'}));
 const doc=emptyDocument(),c=catalogEntities(p.items);doc.overlay.exercises.push(...c.exercises);doc.overlay.exercise_variants.push(...c.variants);assert.equal(validateDocument(doc),true);assert.equal(doc.overlay.sets.length,0);assert.equal(doc.overlay.sessions.length,0);
}
assert.equal(JSON.stringify(PRESET_DECKS),before);assert.deepEqual(entities,{sessions:[],sets:[],exercises:[],exercise_variants:[]});assert.throws(()=>presetPlan('missing',entities,today));
const e={...entities,exercises:[{id:'personalEx',name:'Supino reto'}],exercise_variants:[{id:'personalV',exercise_id:'personalEx',equipment_or_variation:'Barra livre',unit:'kg/lado',unit_confirmed:true}]};
const reused=presetPlan('rpg_deck_01',e,today).items[1];assert.equal(reused.variant_id,'personalV');assert.equal(reused.unit,'kg/lado');assert.equal(reused.is_catalog,false);
e.exercise_variants[0].unit_confirmed=false;assert.notEqual(presetPlan('rpg_deck_01',e,today).items[1].variant_id,'personalV');
const html=renderPresetLibrary();assert.equal((html.match(/data-preset-id=/g)||[]).length,15);assert.ok(html.includes('Ver deck'));
console.log('PRESETS_15_PREFERENCES_DOSE_RECOVERY_IDENTITY_NO_WRITES=PASS');


const first=presetPlan('rpg_deck_01',entities,today).items;
assert.deepEqual(first.map(x=>[x.name,x.equipment]),[
 ['Supino inclinado','Halteres'],['Supino reto','Barra livre'],['Supino declinado','Máquina'],['Crucifixo de peito','Máquina inclinada com anilhas'],
 ['Rosca Scott unilateral','Banco Scott · unilateral'],['Rosca inclinada 45°','Halteres · banco a 45°'],['Rosca martelo','Halteres'],['Elevação lateral','Polia']
]);
assert.equal(first[4].unit,'a confirmar');
assert.match(first[4].dose.effort,/por lado/);
assert.equal(first[5].unit,'kg/halter');
assert.deepEqual(first.map(x=>x.group),['peito','peito','peito','peito','biceps','biceps','biceps','ombros']);
console.log('FIRST_DECK_EXACT_ORDER_EQUIPMENT_EIGHT_EXERCISES=PASS');
