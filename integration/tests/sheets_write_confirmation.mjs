import assert from 'node:assert/strict';
import {emptyDocument,validateDocument} from '../../dist/store.js';
import {authorize,authorized,disconnect,previewUpload,uploadNewRows} from '../sheet_sync_browser.js';
let n=0;const ok=(name,fn)=>{fn();n++;console.log('PASS '+name)};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.google={accounts:{oauth2:{initTokenClient:({callback})=>({requestAccessToken:()=>callback({access_token:'MOCK_TEST_TOKEN',expires_in:3600})})}}};
await authorize('1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com');
const headers={
Treinos:['Data','Dia','Sessão','Status','Duração (min)','Peso (kg)','Dor lombar antes (0-10)','Dor lombar depois (0-10)','Observações'],
Series:['Data','Sessão','Exercício','Equipamento / variação','Tipo','Série','Carga','Unidade','Reps','RIR','RPE','Índice de volume','Dor / desconforto','Observações'],
Peso:['Data','Peso (kg)','Meta (kg)','Variação desde início (kg)','Restante até meta (kg)','Observações']};
const empty=()=>Object.fromEntries(Object.entries(headers).map(([k,v])=>[k,[v.slice()]]));
const model=()=>{
 const d=emptyDocument();
 d.overlay.exercises.push({id:'exercise-public',name:'Supino'});
 d.overlay.exercise_variants.push({id:'variant-public',exercise_id:'exercise-public',equipment_or_variation:'Barra',unit:'kg',unit_confirmed:true});
 d.overlay.sessions.push({id:'session-public',date:'2026-10-24',name:'Superior A',status:'completed',notes:''});
 d.overlay.sets.push({id:'set-public',date:'2026-10-24',session_id:'session-public',exercise_id:'exercise-public',variant_id:'variant-public',set_type:'effective',set_number:1,load_value:50,repetitions:10,rir:2,rpe:8,notes:''});
 d.overlay.weigh_ins.push({id:'weight-public',date:'2026-10-24',weight_kg:85,notes:''});
 assert.equal(validateDocument(d),true);
 return d;
};
const id='ABCDEFGHIJKLMNOPQRSTUVWXYZabc-12345';
function mockApi(tabs,{mutateUpload=false}={}){
 let writes=[],reads=0;
 async function fetchImpl(url,config){
  assert.equal(config.headers.Authorization,'Bearer MOCK_TEST_TOKEN');
  const u=new URL(url);assert.equal(u.origin,'https://sheets.googleapis.com');
  if(u.pathname.endsWith('values:batchGet')){
   reads++;
   assert.ok(['FORMATTED_VALUE','UNFORMATTED_VALUE'].includes(u.searchParams.get('valueRenderOption')));
   return {ok:true,status:200,json:async()=>({valueRanges:['Treinos','Series','Peso'].map(name=>({values:tabs[name]}))})};
  }
  const match=u.pathname.match(/\/values\/(.*?)(:append)?$/);
  const name=decodeURIComponent(match?.[1]||'').match(/'(Treinos|Series|Peso)'/)?.[1];
  assert.ok(name,'unexpected table '+u.pathname);
  if(config.method==='PUT'){
   tabs[name][0][{Treinos:9,Series:14,Peso:6}[name]]='ID do aplicativo';writes.push('HEADER '+name);
   return {ok:true,status:200,json:async()=>({})};
  }
  if(config.method==='POST'){
   const row=JSON.parse(config.body).values[0].slice();
   if(mutateUpload&&name==='Series')row[6]=99;
   tabs[name].push(row);writes.push('ROW '+name);
   return {ok:true,status:200,json:async()=>({})};
  }
  throw Error('Unexpected method '+config.method);
 }
 return {fetchImpl,writes,get reads(){return reads}};
}
const doc=model(),tabs=empty(),mock=mockApi(tabs);
const preview=await previewUpload(id,doc,{fetchImpl:mock.fetchImpl});
ok('Read-only preview includes completed workout',()=>assert.equal(preview.counts.Treinos,1));
ok('Read-only preview includes effective set',()=>assert.equal(preview.counts.Series,1));
ok('Read-only preview includes weigh-in',()=>assert.equal(preview.counts.Peso,1));
ok('Preview contains session name',()=>assert.equal(preview.pending.Treinos[0].values[2],'Superior A'));
ok('Preview does not modify Google Sheets',()=>assert.deepEqual(mock.writes,[]));
const sent=await uploadNewRows(id,doc,{fetchImpl:mock.fetchImpl});
ok('First outbound run writes each new row once',()=>assert.deepEqual(sent.written,{Treinos:1,Series:1,Peso:1}));
ok('Server received all three IDs',()=>assert.ok(tabs.Treinos.at(-1)[9]==='session-public'&&tabs.Series.at(-1)[14]==='set-public'&&tabs.Peso.at(-1)[6]==='weight-public'));
const retry=await uploadNewRows(id,doc,{fetchImpl:mock.fetchImpl});
ok('Retry is idempotent',()=>assert.deepEqual(retry.written,{Treinos:0,Series:0,Peso:0}));
ok('Retry writes no extra rows',()=>assert.equal(mock.writes.filter(v=>v.startsWith('ROW ')).length,3));
const after=await previewUpload(id,doc,{fetchImpl:mock.fetchImpl});
ok('Post-upload preview empty',()=>assert.deepEqual(after.counts,{Treinos:0,Series:0,Peso:0}));
const altered=structuredClone(doc);altered.overlay.sets[0].load_value=55;
await assert.rejects(previewUpload(id,altered,{fetchImpl:mock.fetchImpl}),/divergência|divergente/);
ok('Read-only preview detects edited uploaded sets',()=>{});
const badTabs=empty(),bad=mockApi(badTabs,{mutateUpload:true});
await assert.rejects(uploadNewRows(id,doc,{fetchImpl:bad.fetchImpl}),/valores não correspondem|Recibo divergente/);
ok('Bad server echo is never marked confirmed',()=>assert.equal(badTabs.Series.filter(v=>v[14]==='set-public').length,1));
ok('Bad echo blocks weigh-in write',()=>assert.equal(bad.writes.some(v=>v==='ROW Peso'),false));
ok('Failed confirmation leaves only one remote ID to avoid duplicate replay',()=>assert.equal(badTabs.Series.filter(v=>v[14]==='set-public').length,1));
disconnect();ok('Token discarded',()=>assert.equal(authorized(),false));
console.log('SHEETS_WRITE_CONFIRMATION_TESTS='+n);
