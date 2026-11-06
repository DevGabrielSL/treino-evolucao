import assert from 'node:assert/strict';
import {PRESET_DECKS,presetItems,presetPlan,renderPresetLibrary} from '../dist/principal_presets.js';
import {catalogEntities} from '../dist/balanced_coach.js?v=121';
import {emptyDocument,validateDocument} from '../dist/store.js';
const entities={sessions:[],sets:[],exercises:[],exercise_variants:[]},today='2026-10-29';
assert.equal(PRESET_DECKS.length,4);assert.equal(new Set(PRESET_DECKS.map(x=>x.id)).size,4);
const before=JSON.stringify(PRESET_DECKS);
for(const deck of PRESET_DECKS){
 const p=presetPlan(deck.id,entities,today);assert.equal(p.items.length,deck.items.length);assert.equal(new Set(p.items.map(x=>x.variant_id)).size,p.items.length);assert.equal(p.items.some(x=>x.group==='core'),!['rpg_deck_01','rpg_deck_02','rpg_deck_03','rpg_deck_04'].includes(deck.id));
 for(const x of p.items){assert.equal(x.dose.sets,3);assert.ok(x.dose.min>0&&x.dose.max>=x.dose.min);assert.equal(x.last,null);assert.ok(!/smith|smitch/i.test(x.equipment));if(x.name==='Supino reto')assert.equal(x.equipment,'Barra livre');if(x.name==='Crucifixo de peito')assert.equal(x.equipment,'Máquina inclinada com anilhas');if(/Agachamento/.test(x.name))assert.ok(/hack|goblet/.test(x.name));}
 const reduced=presetPlan(deck.id,entities,today,{fatigue:'high'});assert.ok(reduced.items.length<=4);assert.equal(reduced.items.some(x=>x.group==='core'),!['rpg_deck_01','rpg_deck_02','rpg_deck_03','rpg_deck_04'].includes(deck.id));assert.ok(reduced.items.every(x=>x.dose.sets===3));
 assert.throws(()=>presetPlan(deck.id,entities,today,{pain:'yes'}));
 const doc=emptyDocument(),c=catalogEntities(p.items);doc.overlay.exercises.push(...c.exercises);doc.overlay.exercise_variants.push(...c.variants);assert.equal(validateDocument(doc),true);assert.equal(doc.overlay.sets.length,0);assert.equal(doc.overlay.sessions.length,0);
}
assert.equal(JSON.stringify(PRESET_DECKS),before);assert.deepEqual(entities,{sessions:[],sets:[],exercises:[],exercise_variants:[]});assert.throws(()=>presetPlan('missing',entities,today));
const e={...entities,exercises:[{id:'personalEx',name:'Supino reto'}],exercise_variants:[{id:'personalV',exercise_id:'personalEx',equipment_or_variation:'Barra livre',unit:'kg/lado',unit_confirmed:true}]};
const reused=presetPlan('rpg_deck_01',e,today).items[1];assert.equal(reused.variant_id,'personalV');assert.equal(reused.unit,'kg/lado');assert.equal(reused.is_catalog,false);
e.exercise_variants[0].unit_confirmed=false;assert.notEqual(presetPlan('rpg_deck_01',e,today).items[1].variant_id,'personalV');
const html=renderPresetLibrary();assert.equal((html.match(/data-preset-id=/g)||[]).length,4);assert.ok(html.includes('Ver deck'));
console.log('PRESETS_4_PREFERENCES_DOSE_RECOVERY_IDENTITY_NO_WRITES=PASS');


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


const second=presetPlan('rpg_deck_02',entities,today).items;
assert.deepEqual(second.map(x=>[x.name,x.equipment]),[
 ['Puxada alta','Polia alta'],
 ['Remada articulada com apoio','Máquina articulada com apoio'],
 ['Puxada alta unilateral','Polia alta · unilateral'],
 ['Remada alta com apoio no peito','Apoio no peito · equipamento a confirmar'],
 ['Tríceps francês na polia barra V','Polia · barra V'],
 ['Tríceps polia barra V','Polia · barra V'],
 ['Tríceps testa barra V','Polia · barra V'],
 ['Crucifixo inverso','Máquina']
]);
assert.equal(second.length,8);
assert.equal(new Set(second.map(x=>x.variant_id)).size,8);
assert.deepEqual(second.map(x=>x.group),['costas','costas','costas','costas','triceps','triceps','triceps','ombros']);
assert.ok(second.every(x=>x.unit==='a confirmar'));
assert.match(second[2].dose.effort,/por lado/);
console.log('SECOND_DECK_EXACT_ORDER_V_BAR_UNILATERAL_CHEST_SUPPORT=PASS');


const third=presetPlan('rpg_deck_03',entities,today).items;
assert.deepEqual(third.map(x=>[x.name,x.equipment]),[
 ['Rosca Scott unilateral','Banco Scott · unilateral'],
 ['Tríceps francês na polia barra V','Polia · barra V'],
 ['Rosca na polia alongada','Polia · posição alongada'],
 ['Tríceps polia barra V','Polia · barra V'],
 ['Rosca martelo','Halteres'],
 ['Tríceps testa com halteres','Halteres'],
 ['Desenvolvimento de ombros','Máquina'],
 ['Elevação lateral','Polia'],
 ['Crucifixo inverso','Máquina']
]);
assert.equal(third.length,9);
assert.equal(new Set(third.map(x=>x.variant_id)).size,9);
assert.deepEqual(third.map(x=>x.group),['biceps','triceps','biceps','triceps','biceps','triceps','ombros','ombros','ombros']);
assert.ok(third.every(x=>x.dose.sets===3));
assert.equal(third[4].unit,'kg/halter');assert.equal(third[5].unit,'kg/halter');
assert.notEqual(third[5].variant_id,second[6].variant_id);
assert.equal(third[0].variant_id,first[4].variant_id);
assert.equal(third[1].variant_id,second[4].variant_id);
console.log('THIRD_DECK_EXACT_NINE_ALTERNATING_ARMS_SHOULDERS_DUMBBELL_SKULLCRUSHER=PASS');


const fourth=presetPlan('rpg_deck_04',entities,today).items;
assert.deepEqual(fourth.map(x=>[x.name,x.equipment]),[
 ['Leg press 45°','Máquina · 45°'],['Agachamento hack','Máquina hack'],['Cadeira extensora','Máquina'],['Cadeira flexora','Máquina'],['Cadeira abdutora','Máquina'],['Cadeira adutora','Máquina'],['Panturrilha sentada','Máquina']
]);
assert.equal(fourth.length,7);assert.equal(new Set(fourth.map(x=>x.variant_id)).size,7);
assert.ok(fourth.every(x=>x.group==='pernas'&&x.dose.sets===3));
assert.ok(!fourth.some(x=>/stiff|romeno|pélvica|afundo|reverso/i.test(x.name)));
console.log('FOURTH_DECK_EXACT_SEVEN_LEG_EXERCISES=PASS');

assert.deepEqual(PRESET_DECKS.map(x=>x.id),['rpg_deck_01','rpg_deck_02','rpg_deck_03','rpg_deck_04']);
for(let i=5;i<=15;i++){
 const id='rpg_deck_'+String(i).padStart(2,'0');assert.throws(()=>presetPlan(id,entities,today),/não encontrado/);assert.ok(!html.includes('data-preset-id="'+id+'"'));
}
assert.ok(html.includes('4 decks prontos'));assert.ok(!html.includes('15 decks prontos'));
console.log('ONLY_FOUR_PRESETS_REMOVED_IDS_REJECTED_HISTORY_UNTOUCHED=PASS');
