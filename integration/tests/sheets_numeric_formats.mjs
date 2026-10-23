import assert from 'node:assert/strict';
import {authorize,disconnect,fetchTables} from '../sheet_sync_browser.js';
import {emptyDocument,validateDocument} from '../../dist/store.js';
import {stageInbound,previewRemote,planOutbound} from '../sheet_sync_core.js';
let checks=0;function ok(name,fn){fn();checks++;console.log('PASS '+name);}
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.google={accounts:{oauth2:{initTokenClient:({callback})=>({requestAccessToken:()=>callback({access_token:'SYNTHETIC_FAKE_TOKEN',expires_in:3600})})}}};
await authorize('1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com');
const names=['Treinos','Series','Peso'];
const header={
 Treinos:['Data','Dia','Sessão','Status','Duração (min)','Peso (kg)','Dor lombar antes (0-10)','Dor lombar depois (0-10)','Observações'],
 Series:['Data','Sessão','Exercício','Equipamento / variação','Tipo','Série','Carga','Unidade','Reps','RIR','RPE','Índice de volume','Dor / desconforto','Observações'],
 Peso:['Data','Peso (kg)','Meta (kg)','Variação desde início (kg)','Restante até meta (kg)','Observações']
};
const shown=Object.fromEntries(names.map(n=>[n,[header[n]]]));
const raw=Object.fromEntries(names.map(n=>[n,[header[n]]]));
const sessions=[];
for(let i=0;i<16;i++){
 const d=new Date(Date.UTC(2026,7,1+i*2)).toISOString().slice(0,10),name='Sessão sintética '+i;
 sessions.push({date:d,name});
 shown.Treinos.push([d,'Sábado',name,'Concluído']);
 raw.Treinos.push([46235+i*2,'Sábado',name,'Concluído']);
}
const dateBad=new Map([[13,[1.5,8.5,'31.12','7.1']],[14,[1.5,8.5,'31.12','7.1']],[35,[3.5,6.5,'2.1','5.1']],[45,[2.5,7.5,'1.1','6.1']],[49,[3.5,6.5,'2.1','5.1']],[57,[1.5,8.5,'31.12','7.1']],[65,[1.5,8.5,'31.12','7.1']],[69,[2.5,7.5,'1.1','6.1']]]);
for(let i=0;i<238;i++){
 const sheetRow=i+2,s=sessions[i%16],pair=dateBad.get(sheetRow);
 const rir=[79,86,87].includes(sheetRow)?'1-2':pair?pair[2]:'2';
 const rpe=pair?pair[3]:'8';
 shown.Series.push([s.date,s.name,'Exercício sintético','Barra','Efetiva',String(i%3+1),'50','kg','10',rir,rpe,'500','','']);
 raw.Series.push([46235+(i%16)*2,s.name,'Exercício sintético','Barra','Efetiva',i%3+1,50,'kg',10,pair?pair[0]:rir,pair?pair[1]:8,500,'','']);
}
shown.Peso.push(['2026-08-01','88','79,9','0','8,1','Dado sintético']);
raw.Peso.push([46235,88,79.9,0,8.1,'Dado sintético']);
let count={FORMATTED_VALUE:0,UNFORMATTED_VALUE:0};
const respond=async (url,config)=>{
 assert.equal(config.headers.Authorization,'Bearer SYNTHETIC_FAKE_TOKEN');
 const u=new URL(url),type=u.searchParams.get('valueRenderOption');assert.ok(type in count);
 count[type]++;
 return {ok:true,status:200,json:async()=>({valueRanges:names.map(n=>({values:(type==='FORMATTED_VALUE'?shown:raw)[n]}))})};
};
const id='ABCDEFGHIJKLMNOPQRSTUVWXYZabc-12345';
const data=await fetchTables(id,{fetchImpl:respond});
ok('Two Google Sheets reads mandatory',()=>assert.deepEqual(count,{FORMATTED_VALUE:1,UNFORMATTED_VALUE:1}));
ok('ISO dates preserved from formatted read',()=>assert.equal(data.Series[12][0],shown.Series[12][0]));
ok('All 16 sessions',()=>assert.equal(data.Treinos.length-1,16));
ok('All 238 sets',()=>assert.equal(data.Series.length-1,238));
ok('Weight goal numeric 79.9',()=>assert.equal(data.Peso[1][2],79.9));
ok('Four 31.12 display errors corrected',()=>assert.equal([13,14,57,65].filter(i=>data.Series[i-1][9]===1.5).length,4));
ok('Eight erroneous RIR numbers repaired',()=>assert.ok([...dateBad].every(([row,[rir]])=>data.Series[row-1][9]===rir)));
ok('Eight erroneous RPE numbers repaired',()=>assert.ok([...dateBad].every(([row,[,rpe]])=>data.Series[row-1][10]===rpe)));
ok('RIR text intervals stay intact',()=>assert.ok([79,86,87].every(i=>data.Series[i-1][9]==='1-2')));
const first=stageInbound(emptyDocument(),data);
ok('Import 16 sessions',()=>assert.equal(first.add.sessions,16));
ok('Import 238 sets',()=>assert.equal(first.add.sets,238));
ok('Import weigh-in',()=>assert.equal(first.add.weigh_ins,1));
ok('Source intervals retained in provenance',()=>assert.equal(first.next.overlay.sets.filter(s=>s.provenance?.rir_estimated_midpoint).length,3));
ok('App receives correct RIR',()=>assert.ok([...dateBad].every(([row,[rir]])=>first.next.overlay.sets[row-2].rir===rir)));
ok('App receives correct RPE',()=>assert.ok([...dateBad].every(([row,[,rpe]])=>first.next.overlay.sets[row-2].rpe===rpe)));
ok('Valid app state',()=>assert.equal(validateDocument(first.next),true));
ok('Reimport counts stay zero',()=>assert.deepEqual(previewRemote(first.next,data).counts,{Treinos:0,Series:0,Peso:0}));
ok('No upload of imported history',()=>assert.deepEqual(planOutbound(first.next,data),{Treinos:[],Series:[],Peso:[]}));
let failed=false;
try{await fetchTables(id,{fetchImpl:async url=>{
 if(new URL(url).searchParams.get('valueRenderOption')==='UNFORMATTED_VALUE')throw new Error('Offline test');
 return respond(url,{headers:{Authorization:'Bearer SYNTHETIC_FAKE_TOKEN'}});
}});}catch(e){failed=String(e).includes('Offline test');}
ok('Never fall back to corrupted formatting on second read failure',()=>assert.equal(failed,true));
disconnect();
console.log('SHEETS_TYPED_NUMBERS_TESTS='+checks);
