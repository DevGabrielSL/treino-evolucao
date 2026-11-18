import assert from 'node:assert/strict';
import {emptyDocument,fromLegacy,commit,validateDocument} from '../store.js';
import {compute} from '../metrics.js';
import {startDate,overview,variantTrend,exerciseRanking,handleProgressChange,renderProgressV06} from '../insights.js';
let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
const today='2026-10-23';
const raw=emptyDocument();
const doc=commit(raw,d=>{
 d.overlay.exercises.push({id:'ex1',name:'Supino <Teste>'},{id:'ex2',name:'Remada'});
 d.overlay.exercise_variants.push(
 {id:'v1',exercise_id:'ex1',equipment_or_variation:'barra',unit:'kg',unit_confirmed:true},
 {id:'v2',exercise_id:'ex1',equipment_or_variation:'máquina',unit:'kg',unit_confirmed:true},
 {id:'v3',exercise_id:'ex2',equipment_or_variation:'placas',unit:'placas',unit_confirmed:false}
 );
 d.overlay.sessions.push(
 {id:'old',date:'2026-07-01',name:'Antigo',status:'completed'},
 {id:'a',date:'2026-10-01',name:'Superior A',status:'completed'},
 {id:'b',date:'2026-10-21',name:'Superior B',status:'completed'},
 {id:'wip',date:'2026-10-22',name:'Aberto',status:'in_progress'},
 {id:'future',date:'2026-10-25',name:'Futuro',status:'completed'},
 );
 function add(id,session_id,date,variant_id,load_value,repetitions,rir=2,set_type='effective'){
 d.overlay.sets.push({id,session_id,date,exercise_id:variant_id==='v3'?'ex2':'ex1',variant_id,set_type,load_value,repetitions,rir});
 }
 add('oldset','old','2026-07-01','v1',60,6);
 add('a1','a','2026-10-01','v1',40,8,3);
 add('a2','a','2026-10-01','v1',0,12,2);
 add('a3','a','2026-10-01','v1',30,10,2);
 add('a4','a','2026-10-01','v2',80,8,1);
 add('b1','b','2026-10-21','v1',50,6,1);
 add('b2','b','2026-10-21','v1',null,8,null);
 add('b3','b','2026-10-21','v1',40,0,1);
 add('b4','b','2026-10-21','v3',9,10,2);
 add('w1','wip','2026-10-22','v1',100,5);
 add('f1','future','2026-10-25','v1',200,3);
 add('warm','b','2026-10-21','v1',90,8,2,'warmup');
});
const m=compute(doc),before=JSON.stringify(doc);
t('data reference valid',()=>assert.equal(validateDocument(doc),true));
t('calendar-day boundary 30',()=>assert.equal(startDate('30',today),'2026-09-24'));
t('calendar-day boundary 90',()=>assert.equal(startDate('90',today),'2026-07-26'));
t('calendar-day boundary 180',()=>assert.equal(startDate('180',today),'2026-04-27'));
t('calendar-day 1 March 2024 30',()=>assert.equal(startDate('30','2024-03-01'),'2024-02-01'));
t('all history boundary',()=>assert.equal(startDate('all',today),'0000-01-01'));
t('invalid period rejected',()=>assert.throws(()=>startDate('4',today),/Período/));
t('bad date rejected',()=>assert.throws(()=>startDate('30','2026-02-30'),/Data/));
t('completed only in 30-day overview',()=>assert.equal(overview(m,'30',today).completed,2));
t('30-day overview ignores in-progress and future effective sets',()=>assert.equal(overview(m,'30',today).effectiveSets,8));
t('90 days excludes old July 1 session',()=>assert.equal(overview(m,'90',today).completed,2));
t('all history includes old session',()=>assert.equal(overview(m,'all',today).completed,3));
t('weekly bars include zero-count weeks',()=>assert.ok(overview(m,'90',today).weekly.some(w=>w.weight===0&&w.sets===0)));
t('overview does not include warmup',()=>assert.equal(overview(m,'30',today).effectiveSets,8));
t('overview RIR excludes null',()=>assert.equal(overview(m,'30',today).rirCount,7));
t('ranking by name includes variants of same exercise',()=>assert.deepEqual(exerciseRanking(m,'30',today)[0],{id:'ex1',name:'Supino <Teste>',sets:7}));
const v=variantTrend(m,'v1','30',today);
t('per-variant sessions excludes incomplete and future',()=>assert.equal(v.rows.length,2));
t('max positive by session excludes zero/null/invalid reps',()=>assert.deepEqual(v.rows.map(x=>x.best),[40,50]));
t('per-session valid sets counted strictly',()=>assert.deepEqual(v.rows.map(x=>x.valid),[2,1]));
t('per-session volume computed for only valid sets',()=>assert.deepEqual(v.rows.map(x=>x.volume),[40*8+30*10,50*6]));
t('total volume within chosen variant',()=>assert.equal(v.volume,920));
t('delta latest previous',()=>assert.equal(v.delta,10));
t('delta percent',()=>assert.equal(v.deltaPct,25));
t('variant separation prevents load mixing',()=>assert.equal(variantTrend(m,'v2','30',today).best,80));
t('unit confirmation required',()=>assert.equal(variantTrend(m,'v3','30',today).rows.length,0));
t('nonexistent variant returns no rows',()=>assert.equal(variantTrend(m,'not_found','30',today).best,null));
t('all history does not merge across variants',()=>assert.equal(variantTrend(m,'v1','all',today).best,60));
t('render escapes exercise names to avoid injection',()=>assert.ok(renderProgressV06(m).includes('Supino &lt;Teste&gt;')));
t('render does not include raw hostile markup',()=>assert.ok(!renderProgressV06(m).includes('Supino <Teste>')));
t('period selector change works',()=>assert.equal(handleProgressChange({id:'progress-period',value:'30'}),true));
t('period selector state reflected in HTML',()=>assert.ok(renderProgressV06(m).includes('Últimos 30 dias')));
t('variant selector controls chart',()=>assert.equal(handleProgressChange({id:'progress-variant',value:'v2'}),true));
t('variant is changed and persists upon rerender',()=>assert.ok(renderProgressV06(m).includes('value="v2" selected')));
t('unknown elements ignored',()=>assert.equal(handleProgressChange({id:'x',value:'30'}),false));
t('dashboard does not mutate personal records',()=>assert.equal(JSON.stringify(doc),before));
console.log(`TOTAL_INSIGHTS_TESTS=${n}`);
