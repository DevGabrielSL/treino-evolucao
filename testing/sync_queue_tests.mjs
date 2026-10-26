import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAutomaticSyncScheduler} from '../dist/testes/automatic_sync.js';
let count=0;
const check=async(name,fn)=>{await fn();count++;console.log('PASS '+name)};
function harness(run){
 let jobs=[],errors=[];
 const state={sheetId:'synthetic',online:true,authorized:true,busy:false,sheetsBusy:false,doc:{revision:1,overlay:{sessions:[],sets:[],weigh_ins:[{id:'w1'}]},settings:{sheet_sync:{auto:true,spreadsheet_id:'synthetic',last_write_confirmed_at:'verified'}}}};
 const scheduler=createAutomaticSyncScheduler({getSnapshot:()=>state,run:()=>run(state),setTimer:fn=>{jobs.push(fn);return fn},clearTimer:fn=>{jobs=jobs.filter(j=>j!==fn)},onFailure:e=>errors.push(e)});
 return {state,scheduler,errors,jobs:()=>jobs.length,tick:async()=>{const list=jobs; jobs=[];await Promise.all(list.map(fn=>fn()))}};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
await check('Falha transitória permite nova tentativa na mesma revisão',async()=>{let calls=0;const h=harness(async()=>{if(++calls===1)throw Error('503')});h.scheduler.request();await h.tick();assert.equal(h.errors.length,1);assert.equal(h.jobs(),0);assert.equal(h.scheduler.request().allowed,true);await h.tick();assert.equal(calls,2)});
await check('Resultado false não confirma revisão',async()=>{const h=harness(async()=>false);h.scheduler.request();await h.tick();assert.equal(h.scheduler.request().allowed,true)});
await check('Novo registro durante envio fica agendado, sem sobreposição',async()=>{const gate=deferred();let calls=0;const h=harness(async s=>{calls++;s.sheetsBusy=true;await gate.promise;s.sheetsBusy=false;s.doc.revision++});h.scheduler.request();const running=h.tick();await Promise.resolve();h.state.doc.revision++;h.scheduler.request();h.state.doc.revision++;h.scheduler.request();assert.equal(calls,1);gate.resolve();await running;assert.equal(h.jobs(),1);await h.tick();assert.equal(calls,2);assert.equal(h.jobs(),0)});
await check('Metadados do envio não criam ciclo infinito',async()=>{let calls=0;const h=harness(async s=>{calls++;s.doc.revision++});h.scheduler.request();await h.tick();assert.equal(h.scheduler.request().reason,'already_checked');assert.equal(calls,1)});
for(const field of ['online','authorized'])await check(field+' é revalidado antes do envio',async()=>{let calls=0;const h=harness(async()=>calls++);h.scheduler.request();h.state[field]=false;await h.tick();assert.equal(calls,0)});
await check('Consentimento retirado bloqueia envio agendado',async()=>{let calls=0;const h=harness(async()=>calls++);h.scheduler.request();h.state.doc.settings.sheet_sync.auto=false;await h.tick();assert.equal(calls,0)});
await check('Troca de planilha bloqueia envio agendado',async()=>{let calls=0;const h=harness(async()=>calls++);h.scheduler.request();h.state.sheetId='other';await h.tick();assert.equal(calls,0)});
await check('Cancelar durante envio cancela continuação pendente',async()=>{const gate=deferred();const h=harness(async()=>gate.promise);h.scheduler.request();const running=h.tick();await Promise.resolve();h.state.doc.revision++;h.scheduler.request();h.scheduler.cancel();gate.resolve();await running;assert.equal(h.jobs(),0);assert.equal(h.scheduler.request().allowed,true)});
await check('Falha com novo registro não provoca repetição automática',async()=>{const gate=deferred();const h=harness(async()=>{await gate.promise;throw Error('Resposta incerta')});h.scheduler.request();const running=h.tick();await Promise.resolve();h.state.doc.revision++;h.scheduler.request();gate.resolve();await running;assert.equal(h.jobs(),0);assert.equal(h.scheduler.request().allowed,true)});
await check('Bloqueio por conflito continua respeitado após falha',async()=>{const h=harness(async s=>{s.doc.settings.sheet_sync.auto=false;return false});h.scheduler.request();await h.tick();assert.equal(h.scheduler.request().reason,'disabled')});
await check('Nova revisão depois do sucesso é elegível',async()=>{const h=harness(async()=>true);h.scheduler.request();await h.tick();h.state.doc.revision++;assert.equal(h.scheduler.request().allowed,true)});
await check('Pesagem e conclusão usam agendador único',async()=>{const s=fs.readFileSync(new URL('../dist/testes/app.js',import.meta.url),'utf8');assert.ok(!s.includes('sheetsSyncNow({automatic:true})'));assert.ok(s.includes('return true;\n   }catch(err)'));assert.ok(s.includes('error(err);render();return false;'))});
console.log('SYNC_QUEUE_TESTS='+count);
