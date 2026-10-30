import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {liveGuidance} from '../dist/principal_live.js?v=131';
import {deckModels,muscleSymbol} from '../dist/principal_cards.js?v=132';
const app=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const v={id:'v',exercise_id:'ex',equipment_or_variation:'Barra livre',unit:'kg/lado'},ex={id:'ex',name:'Supino reto',muscle_group:'peito'};
const active={id:'s',date:'2026-10-29',status:'in_progress',planned_variant_ids:['v'],planned_guidance:{v:{sets:3,min:8,max:12,unit:'repetições',label:'3 séries de 8–12'}}};
const entities={exercise_variants:[v],exercises:[ex],sessions:[active],sets:[]};
const m={entities,variantMap:new Map([['v',v]]),exerciseMap:new Map([['ex',ex]])};
const escape=x=>String(x??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const ctx=vm.createContext({e:escape,liveGuidance,deckModels,muscleSymbol,restTimer:{state:()=>({})},Map,panel:(s,c)=>`<section class="${c}">${s}</section>`,g:()=>m});
vm.runInContext(app.slice(app.indexOf('function renderLiveGuidance('),app.indexOf('function renderCoach(')),ctx);
// Extract only the function, as later source may contain unrelated boot code.
const start=app.indexOf('function renderUnitConfirmation('),end=app.indexOf('\n',start);
vm.runInContext(app.slice(start,end<0?undefined:end),ctx);
const html=ctx.renderTrainingTools(active,'v',m);
assert.equal((html.match(/Supino reto/g)||[]).length,2); // heading and compact deck
assert.ok(html.includes('Série 1 de 3'));
assert.ok(html.includes('id="quick-set-form"'));
assert.ok(!html.includes('rest-card'));assert.ok(!html.includes('Resumo do roteiro'));
assert.ok(!html.includes('<details class="focus-options">'));
assert.ok(html.includes('name="rir" required'));
assert.ok(html.includes('name="kind" class="input" required'));
assert.ok(html.includes('Selecione o tipo'));
assert.ok(!html.includes('opcional · 0 a 10'));
assert.ok(app.includes("rir=numeric(values.get('rir'))"));
assert.ok(app.includes("effective:'Trabalho',warmup:'Aquecimento'"));
assert.ok(html.includes('aria-pressed="true"'));
v.unit='a confirmar';const setup=ctx.renderTrainingTools(active,'v',m);
assert.ok(setup.includes('value="Barra livre"'));
assert.ok(setup.includes('<option value="">Selecione a unidade</option>'));
assert.ok(!setup.includes('id="quick-set-form"'));
assert.equal(entities.sets.length,0);
console.log('FOCUS_RENDER_COMPACT_DECK_EXPLICIT_UNIT_NO_WRITES=PASS');
// Exercise the actual submit validation before any storage operation.
const validation=app.slice(app.indexOf('   const numeric='),app.indexOf('   const count=doc.overlay.sets.length;'));
function validate(fields){return vm.runInNewContext('(()=>{'+validation+';return {load,reps,rir,kind};})()', {values:{get:key=>fields[key]}});}
const valid={load:'30',reps:'10',rir:'2',kind:'effective'};
for(const key of ['load','reps','rir','kind'])assert.throws(()=>validate({...valid,[key]:''}),key+' must be required');
assert.equal(validate({...valid,load:'0',rir:'0',kind:'warmup'}).kind,'warmup');
assert.equal(validate({...valid,rir:'0'}).rir,0);
assert.throws(()=>validate({...valid,rir:'11'}));
assert.throws(()=>validate({...valid,reps:'1.5'}));
assert.throws(()=>validate({...valid,kind:'other'}));
console.log('REQUIRED_SET_FIELDS_BLANK_ZERO_WARMUP_RANGES=PASS');
