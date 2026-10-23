import assert from 'node:assert/strict';
import {authorize,authorized,disconnect,parseSheetId,validateClientId,fetchTables,uploadNewRows} from '../sheet_sync_browser.js';
let total=0;const check=(name,fun)=>{fun();total++;console.log('PASS '+name)};
const gId='1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com';
check('ID OAuth Web válido',()=>assert.equal(validateClientId(gId),gId));
check('Recusar OAuth ID inválido',()=>assert.throws(()=>validateClientId('senha-secreta'),/Client ID/));
check('Aceitar URL privada sem divulgar ID no código',()=>assert.equal(parseSheetId('https://docs.google.com/spreadsheets/d/ABCDEFGHIJKLMNOPQRSTUVWXYZabc-12345/edit'),'ABCDEFGHIJKLMNOPQRSTUVWXYZabc-12345'));
check('Recusar planilha inválida',()=>assert.throws(()=>parseSheetId('javascript:alert(1)'),/ID válido/));
// Mock Google Identity Services; no real authentication or network request is made.
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});globalThis.google={accounts:{oauth2:{initTokenClient:({callback})=>({requestAccessToken:()=>callback({access_token:'FAKE_TOKEN_FOR_TEST',expires_in:3600})})}}};
await authorize(gId);
check('Autorização em memória',()=>assert.equal(authorized(),true));
const tabs={Treinos:[['Data','Dia','Sessão','Status','Duração (min)','Peso (kg)','Dor lombar antes (0-10)','Dor lombar depois (0-10)','Observações']],Series:[['Data','Sessão','Exercício','Equipamento / variação','Tipo','Série','Carga','Unidade','Reps','RIR','RPE','Índice de volume','Dor / desconforto','Observações']],Peso:[['Data','Peso (kg)','Meta (kg)','Variação desde início (kg)','Restante até meta (kg)','Observações']]};
let writes=[],reads=0;
const response=(obj,status=200)=>({ok:status===200,status,json:async()=>obj});
async function fakeFetch(url,config){
 assert.equal(config.headers.Authorization,'Bearer FAKE_TOKEN_FOR_TEST');
 const u=new URL(url);assert.equal(u.origin,'https://sheets.googleapis.com');
 if(u.pathname.endsWith('values:batchGet')){reads++;return response({valueRanges:['Treinos','Series','Peso'].map(n=>({values:tabs[n]}))});}
 const m=u.pathname.match(/\/values\/(.*?)(:append)?$/),range=decodeURIComponent(m?.[1]||'');
 const tab=range.match(/'(Treinos|Series|Peso)'/)?.[1];assert.ok(tab);
 if(config.method==='PUT'){assert.equal(tabs[tab][0].length<{Treinos:10,Series:15,Peso:7}[tab],true);tabs[tab][0][{Treinos:9,Series:14,Peso:6}[tab]]='ID do aplicativo';writes.push({method:'PUT',tab});return response({});}
 if(config.method==='POST'){const body=JSON.parse(config.body);assert.equal(body.values.length,1);tabs[tab].push(body.values[0]);writes.push({method:'POST',tab});return response({});}
 throw new Error('Unsupported fake '+config.method);
}
const doc={format:'treino-evolucao-android-v1',version:1,base:null,overlay:{sessions:[{id:'sess-A',date:'2026-10-23',name:'Superior A',status:'completed'}],sets:[],exercises:[],exercise_variants:[],weigh_ins:[{id:'weight-A',date:'2026-10-23',weight_kg:83}]},settings:{weekly_goal:4,templates:[]},revision:0,last_backup_revision:0};
const spreadsheetId='ABCDEFGHIJKLMNOPQRSTUVWXY-abc123';
const before=await fetchTables(spreadsheetId,{fetchImpl:fakeFetch});
check('Ler as três abas sem mutação',()=>{assert.equal(Object.keys(before).length,3);assert.equal(writes.length,0)});
const first=await uploadNewRows(spreadsheetId,doc,{fetchImpl:fakeFetch});
check('Anexar sessão e peso com IDs',()=>{assert.deepEqual(first.written,{Treinos:1,Series:0,Peso:1});assert.equal(writes.filter(x=>x.method==='POST').length,2);assert.equal(tabs.Treinos.at(-1)[9],'sess-A');assert.equal(tabs.Peso.at(-1)[6],'weight-A')});
const second=await uploadNewRows(spreadsheetId,doc,{fetchImpl:fakeFetch});
check('Retentativas não duplicam linhas',()=>{assert.deepEqual(second.written,{Treinos:0,Series:0,Peso:0});assert.equal(writes.filter(x=>x.method==='POST').length,2)});
check('Só Google Sheets recebeu POST',()=>assert.ok(reads>0));
disconnect();check('Desconectar apaga token em memória',()=>assert.equal(authorized(),false));
console.log('BROWSER_TRANSPORT_TESTS='+total);