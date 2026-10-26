import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {gridResponse} from './grid_mock.mjs';
const code=fs.readFileSync(new URL('./coordinator/Code.gs',import.meta.url),'utf8');
const sheet='1ZWow3SHWxgy-j7s3GWTJd1AxYXQb-E-ca_GTgK2_5CA';
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name)};
function harness(){
 const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures.json',import.meta.url))),width={Treinos:9,Series:14,Peso:6};
 const tabs=Object.fromEntries(Object.keys(width).map(t=>{const header=fixture[t][0].slice();header[width[t]]='ID do aplicativo';return [t,[header]]}));
 const ids={Treinos:11,Series:12,Peso:13,_SyncEstado:14};
 const props={SYNC_OWNER_EMAIL:'owner@example.test',SYNC_ENABLED:'false',SYNC_SPREADSHEET_ID:sheet};
 let control='',locked=null,writes=0,hook=null,failBefore=false,loseAfter=false,badRead=false,requestsLog=[];
 function context(name,email='owner@example.test'){
  const c=vm.createContext({Session:{getActiveUser:()=>({getEmail:()=>email})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>{props[k]=v},deleteProperty:k=>{delete props[k]}})},LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=name;return true},releaseLock:()=>{assert.equal(locked,name);locked=null}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(algorithm,s)=>[...crypto.createHash('sha256').update(s).digest()]},Sheets:{Spreadsheets:{
   get:()=>{if(badRead)throw Error('read failed');const g=gridResponse(tabs);g.sheets.forEach(s=>s.properties.sheetId=ids[s.properties.title]);g.sheets.push({properties:{title:'_SyncEstado',sheetId:14},data:[{rowData:control?[{values:[{effectiveValue:{stringValue:control},formattedValue:control}]}]:[]}]});return g},
   batchUpdate:body=>{
    writes++;requestsLog.push(structuredClone(body.requests));if(hook){const fn=hook;hook=null;fn()}if(failBefore)throw Error('lost before application');
    const next=structuredClone(tabs);let nextControl=control;
    for(const r of body.requests){const update=r.updateCells;if(!update)throw Error('unexpected request');const range=update.range,name=Object.keys(ids).find(t=>ids[t]===range.sheetId);const vals=update.rows[0].values.map(c=>{const v=c.userEnteredValue||{};return v.numberValue??v.stringValue??v.boolValue??''});
     if(name==='_SyncEstado'){nextControl=vals[0];continue}
     const row=range.startRowIndex;next[name][row]??=[];vals.forEach((v,i)=>next[name][row][range.startColumnIndex+i]=v);
    }
    Object.keys(tabs).forEach(t=>tabs[t]=next[t]);control=nextControl;if(loseAfter)throw Error('response lost after application');return {};
   }
  }}});
  vm.runInContext(code,c);return c;
 }
 const a=context('a'),b=context('b');a.initializeCoordinator();props.SYNC_ENABLED='true';writes=0;
 const call=(c,op)=>JSON.parse(JSON.stringify(c.coordinateSync(op)));
 return {a,b,tabs,props,call,get control(){return JSON.parse(control)},get requests(){return requestsLog},get writes(){return writes},set hook(fn){hook=fn},set failBefore(v){failBefore=v},set loseAfter(v){loseAfter=v},set badRead(v){badRead=v},context};
}
const op=(id='operation_00000001',rev=0,records=[{tab:'Treinos',values:['2026-10-26','Segunda','Treino A','Concluído','','','','','','session_1']}])=>({protocol:1,action:'append',operationId:id,expectedRevision:rev,records});
const weight=(id,kg)=>({tab:'Peso',values:['2026-10-26',kg,'','','','',id]});
test('Duas execuções compartilham bloqueio remoto',()=>{const h=harness();let other;h.hook=()=>other=h.call(h.b,op());const first=h.call(h.a,op());assert.equal(other.code,'BUSY');assert.equal(first.ok,true);assert.equal(h.tabs.Treinos.length,2)});
test('Repetir operação em outro contexto devolve recibo sem nova linha',()=>{const h=harness();const a=h.call(h.a,op());const writes=h.writes;assert.deepEqual(h.call(h.b,op()),a);assert.equal(h.writes,writes);assert.equal(h.tabs.Treinos.length,2)});
test('Operação com ID reaproveitado e conteúdo alterado é bloqueada',()=>{const h=harness();h.call(h.a,op());const x=op();x.records[0].values[2]='Outro';assert.equal(h.call(h.b,x).code,'OPERATION_REUSED')});
test('Versão antiga de outro cliente não sobrescreve pesagem',()=>{const h=harness();let other;h.hook=()=>other=h.call(h.b,op('operation_00000002',0,[weight('weight_2',81)]));h.call(h.a,op('operation_00000001',0,[weight('weight_1',80)]));assert.equal(other.code,'BUSY');assert.equal(h.call(h.b,op('operation_00000002',0,[weight('weight_2',81)])).code,'VERSION_CONFLICT');assert.equal(h.tabs.Peso.length,2);assert.equal(h.tabs.Peso[1][6],'weight_1')});
test('Cliente atualizado insere segunda pesagem em outra linha',()=>{const h=harness();h.call(h.a,op('operation_00000001',0,[weight('weight_1',80)]));const read=h.call(h.b,{protocol:1,action:'read'});assert.equal(read.revision,1);h.call(h.b,op('operation_00000002',read.revision,[weight('weight_2',81)]));assert.deepEqual(h.tabs.Peso.slice(1).map(r=>r[6]),['weight_1','weight_2'])});
test('Peso não escreve as colunas de fórmulas D/E',()=>{const h=harness();assert.equal(h.call(h.a,op('operation_00000001',0,[weight('weight_1',80)])).ok,true);const writes=h.requests.flat().filter(r=>r.updateCells?.range.sheetId===13);assert.equal(writes.length,2);assert.deepEqual(writes.map(r=>[r.updateCells.range.startColumnIndex,r.updateCells.range.endColumnIndex]),[[0,3],[5,7]])});
test('Resposta perdida após lote recupera recibo sem reaplicar',()=>{const h=harness();h.loseAfter=true;assert.equal(h.call(h.a,op()).code,'UNCERTAIN');assert.ok(h.props.SYNC_INTENT);h.loseAfter=false;const writes=h.writes;assert.equal(h.call(h.b,op()).ok,true);assert.equal(h.writes,writes);assert.equal(h.props.SYNC_INTENT,undefined)});
test('Ausência de recibo após resultado incerto mantém bloqueio',()=>{const h=harness();h.failBefore=true;assert.equal(h.call(h.a,op()).code,'UNCERTAIN');h.failBefore=false;const writes=h.writes;assert.equal(h.call(h.b,op()).code,'UNCERTAIN');assert.equal(h.call(h.b,{protocol:1,action:'read'}).code,'UNCERTAIN');assert.equal(h.writes,writes);assert.equal(h.tabs.Treinos.length,1)});
test('Mudança externa interrompe novas escritas',()=>{const h=harness();h.call(h.a,op());h.tabs.Treinos[1][2]='Mudança manual';assert.equal(h.call(h.b,op('operation_00000002',1,[weight('weight_1',80)])).code,'EXTERNAL_CHANGE')});
test('Leitura e consulta de recibo não alteram dados',()=>{const h=harness();const before=h.writes;assert.equal(h.call(h.a,{protocol:1,action:'read'}).revision,0);assert.equal(h.call(h.a,{protocol:1,action:'receipt',operationId:'operation_00000001'}).code,'NOT_FOUND');assert.equal(h.writes,before)});
test('Outro usuário é rejeitado antes de entrar na seção crítica',()=>{const h=harness();assert.throws(()=>h.call(h.context('foreign','other@example.test'),op()),/OWNER_REQUIRED/);assert.equal(h.writes,0)});
test('Coordenador desabilitado não grava',()=>{const h=harness();h.props.SYNC_ENABLED='false';assert.throws(()=>h.call(h.a,op()),/COORDINATOR_DISABLED/);assert.equal(h.writes,0)});
test('Destino diferente da planilha de testes é bloqueado',()=>{const h=harness();h.props.SYNC_SPREADSHEET_ID='other';assert.throws(()=>h.call(h.a,op()),/WRONG_SPREADSHEET/);assert.equal(h.writes,0)});
test('Falha de leitura libera o lock sem escrever',()=>{const h=harness();h.badRead=true;assert.throws(()=>h.call(h.a,op()),/read failed/);h.badRead=false;assert.equal(h.call(h.b,op()).ok,true)});
test('Inicialização nunca apaga controle existente',()=>{const h=harness();h.props.SYNC_ENABLED='false';const before=JSON.stringify(h.control);assert.throws(()=>h.a.initializeCoordinator(),/ALREADY_INITIALIZED/);assert.equal(JSON.stringify(h.control),before)});
for(const [name,mutate,pattern] of [
 ['data inválida',o=>o.records[0].values[0]='2026-02-30',/INVALID_DATE/],
 ['sessão não concluída',o=>o.records[0].values[3]='Em andamento',/INVALID_SESSION/],
 ['duração negativa',o=>o.records[0].values[4]=-1,/INVALID_NUMBER/],
 ['protocolo desconhecido',o=>o.protocol=9,/INVALID_REQUEST/],
 ['ID de operação ausente',o=>delete o.operationId,/INVALID_OPERATION_ID/],
 ['lote vazio',o=>o.records=[],/INVALID_BATCH/],
 ['tipo de registro desconhecido',o=>o.records[0].tab='Outra',/INVALID_RECORD/],
 ['célula não escalar',o=>o.records[0].values[8]={x:1},/INVALID_CELL/],
 ['versão negativa',o=>o.expectedRevision=-1,/INVALID_BATCH/]
])test(name+' é rejeitado antes de gravar',()=>{const h=harness(),x=op();mutate(x);assert.throws(()=>h.call(h.a,x),pattern);assert.equal(h.writes,0)});
console.log('COORDINATOR_CANDIDATE_TESTS='+count);
