import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {gridResponse} from '../grid_mock.mjs';
const code=fs.readFileSync(new URL('./Code.gs',import.meta.url),'utf8');
const sheet='1ZWow3SHWxgy-j7s3GWTJd1AxYXQb-E-ca_GTgK2_5CA';
export function harness(){
 const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures.json',import.meta.url))),width={Treinos:9,Series:14,Peso:6};
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
