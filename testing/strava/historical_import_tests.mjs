import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const core=readFileSync(new URL('./Code.gs',import.meta.url),'utf8');
const history=readFileSync(new URL('./Historico.gs',import.meta.url),'utf8');
const props=new Map([
 ['STRAVA_ENABLED','false'],
 ['STRAVA_HISTORY_SOURCE_ID','SOURCE_SHEET_FOR_TESTS_1234567890'],
 ['STRAVA_HISTORY_ENABLED','false'],
 ['STRAVA_HISTORY_DUPLICATES_REVIEWED','false']
]);
const dates=['2026-08-24','2026-08-25','2026-08-29','2026-08-31','2026-09-01','2026-09-03','2026-09-04','2026-09-29','2026-09-30','2026-10-05','2026-10-06','2026-10-15','2026-10-18','2026-10-19','2026-10-21','2026-10-22','2026-10-26'];
const sessions=dates.map((date,i)=>[date,'Dia',i===8?'Condicionamento':'Superior '+i,'Concluído',i===8?47:'',null,null,null,i===8?'Esteira 2 km e escada 15 min':'Registro histórico de teste']);
const sets=sessions.filter((s,i)=>i!==8).flatMap((s,i)=>[
 [s[0],s[2],'Supino reto','Barra','Efetiva',1,40,'kg',12,2],
 [s[0],s[2],'Voador','Peck deck','Efetiva',2,7,'plaquetas',12,2],
 [s[0],s[2],'Prancha frontal','Peso corporal','Core',1,'','segundos',60,'']
]);
let networkCalls=0;
const ctx={
 PropertiesService:{getScriptProperties:()=>({
  getProperty:k=>props.get(k)||null,
  setProperty:(k,v)=>props.set(k,v),
  deleteProperty:k=>props.delete(k)
 })},
 SpreadsheetApp:{openById:id=>{
  assert.equal(id,'SOURCE_SHEET_FOR_TESTS_1234567890');
  return {getName:()=> 'Painel de Treino e Evolução',
    getSheetByName:name=>name==='Treinos'?{getDataRange:()=>({getValues:()=>[['Data','Dia','Sessão','Status','Duração'],...sessions]})}
     :name==='Series'?{getDataRange:()=>({getValues:()=>[['Data','Sessão','Exercício'],...sets]})}:null};
 }},
 Utilities:{
  formatDate:(date,tz,pattern)=>date.toISOString().slice(0,10),
  newBlob:()=>{throw new Error('A rede nao pode ser chamada sem habilitacao.')},
  computeDigest:()=>{throw new Error('Nao chamado')}
 },
 UrlFetchApp:{fetch:()=>{networkCalls++;throw new Error('A rede nao deve ser chamada.')}},
 LockService:{getScriptLock:()=>{throw new Error('Lock bloqueado sem aprovacao.')}},
 Logger:{log:()=>{}}
};
runInNewContext(core+'\n'+history,ctx);
const preview=ctx.stravaHistoryPreview();
assert.equal(preview.count,17);
assert.equal(preview.items.filter(x=>x.uploadType==='json').length,16);
assert.equal(preview.items.filter(x=>x.uploadType==='manual').length,1);
assert.equal(preview.items.find(x=>x.date==='2026-09-30').durationMinutes,47);
assert.equal(preview.items.find(x=>x.date==='2026-09-30').durationEstimated,false);
assert.equal(preview.items.find(x=>x.date==='2026-10-26').durationMinutes,45,'3 series = 45 min by estimate');
assert.equal(preview.items.find(x=>x.date==='2026-10-26').durationEstimated,true);
assert.equal(preview.items[0].id,'historic-20260824');
const entry=ctx.historicRows_()[0];
assert.equal(entry.startISO,'2026-08-24T18:00:00-03:00');
const data=ctx.historicPayload_(entry);
assert.equal(data.kind,'json');
assert.equal(data.payload.utc_offset,-10800);
assert.equal(data.payload.sets[0].exercise_type,'BARBELL_BENCH_PRESS');
assert.equal(data.payload.sets[0].weight,40);
assert.equal(Object.hasOwn(data.payload.sets[1],'weight'),false,'Plaquetas nao convertidas');
assert.equal(data.payload.sets[2].duration,60,'Prancha temporizada');
assert.match(data.description,/HORARIO ESTIMADO/);
assert.match(data.description,/DURACAO ESTIMADA/);
assert.match(ctx.stravaHistoryPublishNext(),/desativada/);
props.set('STRAVA_HISTORY_ENABLED','true');
assert.match(ctx.stravaHistoryPublishNext(),/BLOQUEADO/);
assert.equal(networkCalls,0);
console.log('PASS: 17 sessoes sinteticas, 16 uploads + 1 manual, seguranca e conversoes preservadas; nenhuma rede chamada.');
