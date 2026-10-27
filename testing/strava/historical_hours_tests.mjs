import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=['Code.gs','Historico.gs','HorasStrava.gs']
  .map(f=>readFileSync(new URL('./'+f,import.meta.url),'utf8')).join('\n');
const dates=['2026-08-24','2026-08-25','2026-08-29','2026-08-31','2026-09-01','2026-09-03','2026-09-04','2026-09-29','2026-09-30','2026-10-05','2026-10-06','2026-10-15','2026-10-18','2026-10-19','2026-10-21','2026-10-22','2026-10-26'];
const sessions=dates.map((dt,i)=>[dt,'Segunda',i===8?'Condicionamento':'Musculação teste '+i,'Concluído',i===8?47:'',null,null,null,'']);
const sets=sessions.flatMap((s,i)=>i===8?[]:[ [s[0],s[2],'Exercício teste','','Efetiva',1,20,'kg',12,2] ]);
const props=new Map([
 ['STRAVA_HISTORY_SOURCE_ID','SOURCE_SHEET_FOR_TESTS_1234567890'],
 ['STRAVA_ENABLED','false'],['STRAVA_HISTORY_ENABLED','false'],
 ['STRAVA_HISTORY_MANUAL_FALLBACK_ENABLED','false'],
 ['STRAVA_HISTORY_DUPLICATES_REVIEWED','true'],
 ['STRAVA_HOURS_ENABLED','false']
]);
let remotePosts=0,remoteReads=0;
let simulatedAmbiguous=false, simulateSkip=false;
const ctx={
 PropertiesService:{getScriptProperties:()=>({
    getProperty:k=>props.get(k)??null,
    setProperty:(k,v)=>props.set(k,String(v)),
    deleteProperty:k=>props.delete(k)
 })},
 SpreadsheetApp:{openById:id=>{
   assert.equal(id,'SOURCE_SHEET_FOR_TESTS_1234567890');
   return {getName:()=> 'Painel de Treino e Evolução',
    getSheetByName:name=>name==='Treinos'
      ? {getDataRange:()=>({getValues:()=>[['Data','Dia','Sessão','Status','Duração'],...sessions]})}
      : name==='Series'
      ? {getDataRange:()=>({getValues:()=>[['Data','Sessão','Exercício'],...sets]})}
      : null};
 }},
 Logger:{log:()=>{}},
 Utilities:{formatDate:(date,tz,fmt)=>date.toISOString().slice(0,10),
            sleep:()=>{}},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
 UrlFetchApp:{fetch:()=>{throw Error('A rede real nunca deve ser chamada.')}}
};
runInNewContext(source,ctx);

const p1=ctx.stravaHoursPreview();
assert.equal(p1.count,17);
assert.equal(p1.recordedDurations,1);
assert.equal(p1.approximateDurations,16);
assert.equal(p1.activities[0].end,'18:45');
assert.equal(p1.activities[8].end,'18:47');
assert.equal(p1.activities[8].activity,'Condicionamento físico');
assert.equal(p1.activities[0].activity,'Musculação');
assert.equal(remotePosts,0);
assert.match(ctx.stravaHoursPublishNext(),/DESATIVADO/);

props.set('STRAVA_HOURS_ENABLED','true');
props.set('STRAVA_HISTORY_ENABLED','true');
assert.match(ctx.stravaHoursPublishNext(),/BLOQUEADO/);
props.set('STRAVA_HISTORY_ENABLED','false');
props.set('STRAVA_HISTORY_LEDGER_V1',JSON.stringify({
 'historic-20260824':{state:'ERROR',note:'Error Processing Data',uploadId:'555001'}
}));

ctx.stravaAccessToken_=()=> 'OFFLINE_TEST_TOKEN';
ctx.stravaResponse_=(url,token,options={})=>{
 assert.equal(token,'OFFLINE_TEST_TOKEN');
 if(url.endsWith('/uploads/555001')){
    remoteReads++;
    return {status:200,body:{error:'Error Processing Data',activity_id:null}};
 }
 if(url.endsWith('/activities')) {
   remotePosts++;
   assert.equal(options.method,'post');
   assert.equal(options.payload.start_date_local,dates[remotePosts-1]+'T18:00:00-03:00');
   assert.ok(['WeightTraining','Workout'].includes(options.payload.sport_type));
   assert.equal(typeof options.payload.elapsed_time,'string');
   assert.deepEqual(Object.keys(options.payload).sort(),
       ['description','elapsed_time','name','sport_type','start_date_local'].sort());
   assert.match(options.payload.description,/aproximad|registrada/);
   const string=JSON.stringify(options.payload);
   assert.doesNotMatch(string,/series|plaquetas|exercicios|repeticoes|weight|sets|RIR/i);
   if(remotePosts===9) assert.equal(options.payload.sport_type,'Workout');
   else assert.equal(options.payload.sport_type,'WeightTraining');
   if(simulatedAmbiguous) throw new Error('Fake timeout after Strava received request');
   return {status:201,body:{id:BigInt(2000000+remotePosts).toString()}};
 }
 throw new Error('Endpoint inesperado '+url);
};
const first=ctx.stravaHoursPublishNext();
assert.match(first,/PUBLICADO historic-20260824/);
assert.equal(remotePosts,1);
assert.equal(remoteReads,1);
const states=JSON.parse(props.get('STRAVA_HOURS_LEDGER_V1'));
assert.equal(states['historic-20260824'].state,'PUBLISHED');
assert.equal(states['historic-20260824'].method,'manual_hours');
assert.match(ctx.stravaHoursImportRemaining(),/BLOQUEADO/,'do not batch before user reviews first activity');
props.set('STRAVA_HOURS_BATCH_APPROVED','true');
const all=ctx.stravaHoursImportRemaining();
assert.equal(all.publications,16);
assert.equal(remotePosts,17);
assert.equal(ctx.stravaHoursPreview().activities.filter(x=>x.status==='PUBLISHED').length,17);
assert.match(ctx.stravaHoursPublishNext(),/CONCLUIDO/);
assert.equal(remotePosts,17,'Never re-post on repeated invocation');
assert.equal(remoteReads,1);

const actual=ctx.stravaHoursLedger_();
delete actual['historic-20261026'];
props.set('STRAVA_HOURS_LEDGER_V1',JSON.stringify(actual));
simulatedAmbiguous=true;
assert.match(ctx.stravaHoursPublishNext(),/INCERTO/);
const count=remotePosts;
assert.match(ctx.stravaHoursPublishNext(),/PAUSADO/);
assert.equal(remotePosts,count,'ambiguous API response cannot trigger retry');
console.log('PASS: 17 historical sessions; 16 weight-training + 1 workout; minimal fields, explicit enable, no blind retry, idempotent batch; no real network.');
