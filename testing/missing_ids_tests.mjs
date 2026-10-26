import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authorize,disconnect,uploadNewRows,inspectSpreadsheet,previewUpload} from '../dist/testes/sheet_sync_browser.js';
import {emptyDocument,commit,validateDocument} from '../dist/testes/store.js';
import {planOutbound,stageInbound} from '../dist/testes/sheet_sync_core.js';
import {decodeBackup} from '../dist/testes/backup.js';
import {SHEET_ID} from '../dist/testes/sheets_config.js';
import {gridResponse} from './grid_mock.mjs';
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.google={accounts:{oauth2:{initTokenClient:({callback})=>({requestAccessToken:()=>callback({access_token:'SYNTHETIC_IDS_TOKEN',expires_in:3600})})}}};
await authorize('1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures.json',import.meta.url)));
const columns={Treinos:9,Series:14,Peso:6};
const model=()=>{
 const d=emptyDocument();d.overlay.exercises.push({id:'ex',name:'Supino'});d.overlay.exercise_variants.push({id:'v',exercise_id:'ex',equipment_or_variation:'Barra',unit:'kg',unit_confirmed:true});
 d.overlay.sessions.push({id:'s',date:'2026-10-26',name:'Treino sintético',status:'completed'});
 d.overlay.sets.push({id:'r',date:'2026-10-26',session_id:'s',exercise_id:'ex',variant_id:'v',set_type:'effective',set_number:1,load_value:50,repetitions:10,rir:2,rpe:8});
 d.overlay.weigh_ins.push({id:'w',date:'2026-10-26',weight_kg:80});validateDocument(d);return d;
};
function api(){
 const tabs=Object.fromEntries(Object.keys(columns).map(t=>[t,[fixture[t][0].slice()]])),stats={writes:0,reads:0};
 const fetchImpl=async(url,options)=>{
  const u=new URL(url);assert.equal(u.origin,'https://sheets.googleapis.com');
  if(u.pathname==='/v4/spreadsheets/'+SHEET_ID){stats.reads++;return {ok:true,status:200,json:async()=>gridResponse(tabs)}}
  stats.writes++;
  if(u.pathname.endsWith('/values:batchUpdate')){const parts=JSON.parse(options.body).data,row=Number(parts[0].range.match(/!A(\d+)/)[1]);tabs.Peso[row-1]=[...parts[0].values[0],'','',...parts[1].values[0]];return {ok:true,status:200,json:async()=>({})}}
  const range=decodeURIComponent(u.pathname),tab=Object.keys(columns).find(t=>range.includes("'"+t+"'!"));assert.ok(tab,range);
  if(options.method==='PUT')tabs[tab][0][columns[tab]]='ID do aplicativo';
  else if(options.method==='POST')tabs[tab].push(JSON.parse(options.body).values[0]);else throw Error('unexpected method');
  return {ok:true,status:200,json:async()=>({})};
 };
 return {tabs,stats,fetchImpl};
}
function client(doc=model()){
 let saved=structuredClone(doc),checkpoints=[];
 return {get doc(){return saved},get checkpoints(){return checkpoints},onCheckpoint:async ledger=>{saved=commit(saved,d=>{d.settings.sheet_sync={...d.settings.sheet_sync,known_remote_ids_v1:structuredClone(ledger)}});checkpoints.push(structuredClone(ledger))}};
}
const send=(c,a,extra={})=>uploadNewRows(SHEET_ID,c.doc,{fetchImpl:a.fetchImpl,onCheckpoint:c.onCheckpoint,...extra});
let n=0;const test=async(name,fn)=>{await fn();n++;console.log('PASS '+name)};
for(const tab of Object.keys(columns))for(const change of ['delete','clear-id','replace-id'])await test(tab+' / '+change+' bloqueia reenvio após restauração do estado',async()=>{
 const c=client(),a=api();await send(c,a);const restored=client(await decodeBackup(JSON.parse(JSON.stringify(c.doc)),''));
 const row=a.tabs[tab].findIndex(r=>r[columns[tab]]===({Treinos:'s',Series:'r',Peso:'w'}[tab]));
 if(change==='delete')a.tabs[tab].splice(row,1);else a.tabs[tab][row][columns[tab]]=change==='clear-id'?'':'outro-id';
 const writes=a.stats.writes,before=structuredClone(restored.doc);
 await assert.rejects(send(restored,a),/desapareceu ou perdeu o ID/);assert.equal(a.stats.writes,writes);assert.deepEqual(restored.doc,before);
});
await test('Primeiro envio conserva IDs antes de terminar a sincronização',async()=>{const c=client(),a=api();await send(c,a);const ids=c.doc.settings.sheet_sync.known_remote_ids_v1;assert.equal(ids.spreadsheet_id,SHEET_ID);assert.deepEqual(ids.ids,{Treinos:['s'],Series:['r'],Peso:['w']});assert.ok(c.checkpoints.some(x=>x.ids.Treinos.includes('s')&&x.ids.Series.length===0));assert.ok(c.checkpoints.some(x=>x.ids.Series.includes('r')&&x.ids.Peso.length===0))});
await test('IDs repetidos não são acrescentados em novas consultas',async()=>{const c=client(),a=api();await send(c,a);const before=structuredClone(c.doc.settings.sheet_sync.known_remote_ids_v1);await send(c,a);assert.deepEqual(c.doc.settings.sheet_sync.known_remote_ids_v1,before)});
await test('Reordenação preserva identidade sem gravações adicionais',async()=>{const c=client(),a=api();await send(c,a);a.tabs.Series.splice(1,0,[]);const writes=a.stats.writes;await send(c,a);assert.equal(a.stats.writes,writes)});
await test('ID duplicado interrompe envio',async()=>{const c=client(),a=api();await send(c,a);a.tabs.Series.push(a.tabs.Series[1].slice());const writes=a.stats.writes;await assert.rejects(send(c,a),/duplicado/);assert.equal(a.stats.writes,writes)});
await test('Sessão, séries e pesagem locais são mantidas após remoção remota',async()=>{const c=client(),a=api();await send(c,a);a.tabs.Treinos.splice(1);const before=structuredClone(c.doc.overlay);await assert.rejects(send(c,a));assert.deepEqual(c.doc.overlay,before)});
await test('Planejamento puro bloqueia registro conhecido ausente',async()=>{const c=client(),a=api();await send(c,a);a.tabs.Series.splice(1);assert.throws(()=>planOutbound(c.doc,a.tabs),/desapareceu/)});
await test('Importação não aceita desaparecimento de ID conhecido',async()=>{const c=client(),a=api();await send(c,a);a.tabs.Peso.splice(1);assert.throws(()=>stageInbound(c.doc,a.tabs),/desapareceu/)});
for(const [name,fn] of [['Prévia',previewUpload],['Inspeção',inspectSpreadsheet]])await test(name+' bloqueia desaparecimento antes de qualquer envio',async()=>{const c=client(),a=api();await send(c,a);a.tabs.Series.splice(1);const writes=a.stats.writes;await assert.rejects(fn(SHEET_ID,c.doc,{fetchImpl:a.fetchImpl}),/desapareceu/);assert.equal(a.stats.writes,writes)});
await test('Falha ao salvar referência inicial impede primeira escrita',async()=>{const c=client(),a=api();await assert.rejects(send(c,a,{onCheckpoint:async()=>{throw Error('armazenamento indisponível')}}),/Recibo de IDs não pôde ser salvo/);assert.equal(a.stats.writes,0)});
await test('Sem rotina de persistência não inicia gravação',async()=>{const c=client(),a=api();await assert.rejects(uploadNewRows(SHEET_ID,c.doc,{fetchImpl:a.fetchImpl}),/exige salvar a referência/);assert.equal(a.stats.writes,0)});
await test('Falha no recibo local interrompe gravações seguintes',async()=>{const c=client(),a=api();await assert.rejects(send(c,a,{onCheckpoint:async ledger=>{if(ledger.ids.Treinos.includes('s'))throw Error('disk full');await c.onCheckpoint(ledger)}}),/Recibo de IDs não pôde ser salvo/);assert.equal(a.tabs.Treinos.length,2);assert.equal(a.tabs.Series.length,1);assert.equal(a.tabs.Peso.length,1)});
await test('Sucesso parcial preserva referência antes de falha posterior',async()=>{const c=client(),a=api();await assert.rejects(send(c,a,{fetchImpl:async(url,o)=>{if(c.doc.settings.sheet_sync?.known_remote_ids_v1?.ids.Treinos.includes('s'))throw Error('falha posterior');return a.fetchImpl(url,o)}}));assert.deepEqual(c.doc.settings.sheet_sync.known_remote_ids_v1.ids.Treinos,['s']);a.tabs.Treinos.splice(1);const writes=a.stats.writes;await assert.rejects(send(client(structuredClone(c.doc)),a),/desapareceu/);assert.equal(a.stats.writes,writes)});
await test('Backup preserva referências sem converter ausência em exclusão',async()=>{const c=client(),a=api();await send(c,a);const d=await decodeBackup(JSON.parse(JSON.stringify(c.doc)),'');assert.deepEqual(d,c.doc);assert.equal(d.overlay.sets.length,1)});
for(const [label,mutate] of [
 ['outro destino',l=>l.spreadsheet_id='outro-destino'],['versão incompatível',l=>l.version=99],['IDs duplicados',l=>l.ids.Series.push('r')],['IDs malformados',l=>l.ids.Series=[null]],['aba sem lista',l=>delete l.ids.Peso]
])await test('Referência inválida: '+label+' impede escrita',async()=>{const c=client(),a=api();await send(c,a);const restored=structuredClone(c.doc);mutate(restored.settings.sheet_sync.known_remote_ids_v1);const writes=a.stats.writes;await assert.rejects(send(client(restored),a),/Referência de IDs/);assert.equal(a.stats.writes,writes)});
await test('Confirmação antiga sem IDs e com registro ausente exige revisão',async()=>{const d=model();d.settings.sheet_sync={last_write_confirmed_at:'2026-10-25T12:00:00Z',spreadsheet_id:SHEET_ID};const c=client(d),a=api();await assert.rejects(send(c,a),/Histórico de envio antigo sem referência/);assert.equal(a.stats.writes,0)});
await test('Primeiro envio genuinamente novo continua permitido',async()=>{const c=client(),a=api();const r=await send(c,a);assert.deepEqual(r.written,{Treinos:1,Series:1,Peso:1})});
await test('Nova pesagem não é confundida com registro removido',async()=>{const c=client(),a=api();await send(c,a);const d=structuredClone(c.doc);d.overlay.weigh_ins.push({id:'w2',date:'2026-10-27',weight_kg:79});const next=client(d);const result=await send(next,a);assert.deepEqual(result.written,{Treinos:0,Series:0,Peso:1});assert.deepEqual(next.doc.settings.sheet_sync.known_remote_ids_v1.ids.Peso,['w','w2'])});
await test('App persiste checkpoints e pausa automação em desaparecimento',async()=>{const code=fs.readFileSync(new URL('../dist/testes/app.js',import.meta.url),'utf8');assert.ok(code.includes('onCheckpoint:saveKnownRemoteIds'));assert.ok(code.includes('await saveKnownRemoteIds(mergeKnownRemoteIds(doc,check.rows))'));assert.ok(code.includes('desapareceu/i.test(sheetsError)'))});
disconnect();console.log('MISSING_IDS_TESTS='+n);
