import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const candidate=path.resolve(process.argv[2]),temp=fs.mkdtempSync(path.join(os.tmpdir(),'principal-network-'));
try{
 fs.cpSync(path.join(candidate,'dist'),temp,{recursive:true});
 const config=path.join(temp,'sheets_config.js');
 fs.writeFileSync(config,fs.readFileSync(config,'utf8').replace("COORDINATOR_DEPLOYMENT_ID=''","COORDINATOR_DEPLOYMENT_ID='SYNTHETIC_NETWORK_DEPLOYMENT_201'").replace('COORDINATOR_ENABLED=false','COORDINATOR_ENABLED=true'));
 const {harness}=await import(pathToFileURL(path.join(candidate,'testing/coordinator/mock_service.mjs')));
 const {emptyDocument}=await import(pathToFileURL(path.join(temp,'store.js')));
 const {SHEET_ID}=await import(pathToFileURL(config));
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 globalThis.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'SYNTHETIC_NETWORK_TOKEN',expires_in:3600})})}}};
 const transport=await import(pathToFileURL(path.join(temp,'sheet_sync_browser.js')));
 await transport.authorize('1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com');
 let doc=emptyDocument();doc.overlay.exercises.push({id:'ex',name:'Supino'});doc.overlay.exercise_variants.push({id:'v',exercise_id:'ex',equipment_or_variation:'Barra',unit:'kg',unit_confirmed:true});doc.overlay.sessions.push({id:'s',date:'2026-10-26',name:'Treino A',status:'completed'});doc.overlay.sets.push({id:'r',date:'2026-10-26',session_id:'s',exercise_id:'ex',variant_id:'v',set_type:'effective',set_number:1,load_value:50,repetitions:10,rir:2,rpe:8});
 const h=harness(),sent=[];let lost=false;
 const result=await transport.uploadNewRows(SHEET_ID,doc,{onState:async state=>{doc.settings.sheet_sync={...doc.settings.sheet_sync,coordinator_v1:state}},onCheckpoint:async ledger=>{doc.settings.sheet_sync={...doc.settings.sheet_sync,known_remote_ids_v1:ledger}},fetchImpl:async(url,options)=>{
  assert.equal(new URL(url).origin,'https://script.googleapis.com');
  const operation=JSON.parse(options.body).parameters[0];sent.push(structuredClone(operation));
  if(operation.action==='append')assert.deepEqual(operation,doc.settings.sheet_sync.coordinator_v1.pending);
  const remote=h.call(h.a,operation);
  if(operation.action==='append'&&!lost){lost=true;throw new TypeError('Failed to fetch')}
  return {ok:true,status:200,json:async()=>({done:true,response:{result:remote}})};
 }});
 const appends=sent.filter(x=>x.action==='append');assert.equal(appends.length,2);assert.deepEqual(appends[0],appends[1]);assert.equal(h.writes,1);assert.equal(h.tabs.Treinos.length,2);assert.equal(h.tabs.Series.length,2);assert.equal(doc.settings.sheet_sync.coordinator_v1.pending,null);assert.deepEqual(result.written,{Treinos:1,Series:1,Peso:0});transport.disconnect();
 console.log('PRINCIPAL_TRANSPORT_LOST_RESPONSE_RECEIPT_NO_DUPLICATES=PASS');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
