import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=['Code.gs','Historico.gs','TreinosDoChat.gs']
 .map(x=>readFileSync(new URL('./'+x,import.meta.url),'utf8')).join('\n');
const props=new Map([
 ['STRAVA_HISTORY_SOURCE_ID','OFFICIAL_MOCK_SOURCE_123456789123'],
 ['STRAVA_ENABLED','false'],
 ['STRAVA_HOURS_ENABLED','false'],
 ['STRAVA_HISTORY_ENABLED','false'],
 ['STRAVA_HISTORY_MANUAL_FALLBACK_ENABLED','false'],
 ['STRAVA_CHAT_ENABLED','false'],
 ['STRAVA_HOURS_LEDGER_V1',JSON.stringify({'historic-20260824':{state:'PUBLISHED',activityId:'1'}})]
]);
const original=[
 '2026-10-27','Terça','Costas + tríceps + ombros','Concluído',73,'','','',
 'Início 18:26:35 (27/10, registrado na conversa); término por volta de 19:39; duração aproximada 73 min.',
 'chat_20261027_182635'
];
let sent=0,edits=0,callHistory=[];
const ctx={
 PropertiesService:{getScriptProperties:()=>({
  getProperty:k=>props.get(k)??null,setProperty:(k,v)=>props.set(k,String(v)),deleteProperty:k=>props.delete(k)
 })},
 SpreadsheetApp:{openById:id=>{
  assert.equal(id,'OFFICIAL_MOCK_SOURCE_123456789123');
  return {getName:()=> 'Painel de Treino e Evolução',
    getSheetByName:name=>name==='Treinos'?{
      getDataRange:()=>({getValues:()=>[[
        'Data','Dia','Sessão','Status','Duração (min)','Peso (kg)',
        'Dor lombar antes (0-10)','Dor lombar depois (0-10)','Observações',
        'ID do aplicativo'
      ],original]})
    }:null};
 }},
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},
 Utilities:{formatDate:(d,tz,fmt)=>d.toISOString().slice(0,10)},
 Logger:{log:x=>callHistory.push(String(x))},
 UrlFetchApp:{fetch:()=>{throw Error('Real API prohibited in tests')}}
};
runInNewContext(source,ctx);
const preview=ctx.stravaChatPreview();
assert.equal(preview.length,1);
assert.equal(preview[0].status,'PENDENTE');
assert.equal(preview[0].start,'2026-10-27T18:26:35-03:00');
assert.equal(preview[0].durationMinutes,73);
assert.equal(preview[0].description,'');
assert.match(ctx.stravaChatPublishNext(),/DESATIVADO/);
props.set('STRAVA_CHAT_ENABLED','true');
props.set('STRAVA_HOURS_ENABLED','true');
assert.match(ctx.stravaChatPublishNext(),/BLOQUEADO/);
props.set('STRAVA_HOURS_ENABLED','false');
ctx.stravaAccessToken_=()=> 'FAKE_TOKEN';
ctx.stravaResponse_=(url,token,req={})=>{
 assert.equal(url,'https://www.strava.com/api/v3/activities');
 assert.equal(token,'FAKE_TOKEN');
 assert.equal(req.method,'post');
 assert.deepEqual(Object.keys(req.payload).sort(),
    ['name','sport_type','start_date_local','elapsed_time'].sort());
 assert.equal(req.payload.name,'Musculação');
 assert.equal(req.payload.sport_type,'WeightTraining');
 assert.equal(req.payload.start_date_local,'2026-10-27T18:26:35-03:00');
 assert.equal(req.payload.elapsed_time,'4380');
 assert.equal(Object.hasOwn(req.payload,'description'),false);
 sent++;
 return {status:201,body:{id:'28119381234'}};
};
assert.match(ctx.stravaChatPublishNext(),/PUBLICADO 2026-10-27/);
const ledger=JSON.parse(props.get('STRAVA_CHAT_LEDGER_V1'));
assert.equal(ledger['chat_20261027_182635'].state,'PUBLISHED');
assert.equal(ledger['chat_20261027_182635'].activityId,'28119381234');
assert.match(ctx.stravaChatPublishNext(),/CONCLUIDO/);
assert.equal(sent,1,'Never duplicate a published activity');
assert.equal(edits,0,'Never edit official sheet through publisher');
assert.equal(ctx.stravaChatPreview()[0].status,'PUBLISHED');
console.log('PASS: chat workout 27/10, 73min, no description or weights, idempotent manual Strava publication, no real network.');
