import assert from 'node:assert/strict';
import fs from 'node:fs';
import {authorize,disconnect,fetchTables,uploadNewRows} from '../dist/testes/sheet_sync_browser.js';
import {SHEET_ID} from '../dist/testes/sheets_config.js';
import {createSandboxDocument} from '../dist/testes/test_seed.js';
import {gridResponse} from './grid_mock.mjs';
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.google={accounts:{oauth2:{initTokenClient:({callback})=>({requestAccessToken:()=>callback({access_token:'SYNTHETIC_GRID_TOKEN',expires_in:3600})})}}};
await authorize('1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures.json',import.meta.url)));
const reply=value=>({ok:true,status:200,json:async()=>value});
let count=0;const test=async(name,fn)=>{await fn();count++;console.log('PASS '+name)};
const read=value=>fetchTables(SHEET_ID,{fetchImpl:async()=>reply(value)});
const data=()=>gridResponse(fixture);
await test('Uma resposta associa identidade, texto e números, mesmo após reordenação',async()=>{
 const shown=structuredClone(fixture),raw=structuredClone(fixture);
 shown.Series=[shown.Series[0],['2026-10-26','Treino A','Supino','Barra','Efetiva','1','50','kg','10','31.12','8','500','','','A'],['2026-10-25','Treino B','Remada','Máquina','Efetiva','1','80','kg','8','1','9','640','','','B']];
 raw.Series=structuredClone(shown.Series);raw.Series[1][6]=50;raw.Series[1][9]=1.5;raw.Series[2][6]=80;
 const newerShown=structuredClone(shown),newerRaw=structuredClone(raw);
 newerShown.Series=[shown.Series[0],shown.Series[2],shown.Series[1]];newerRaw.Series=[raw.Series[0],raw.Series[2],raw.Series[1]];
 let calls=0;
 const result=await fetchTables(SHEET_ID,{fetchImpl:async url=>{
  calls++;const option=new URL(url).searchParams.get('valueRenderOption');
  if(option)return reply({valueRanges:['Treinos','Series','Peso'].map(n=>({values:(option==='FORMATTED_VALUE'?shown:newerRaw)[n]}))});
  return reply(gridResponse(newerShown,newerRaw));
 }});
 assert.equal(result.Series.find(r=>r[14]==='A')[6],50);assert.equal(result.Series.find(r=>r[14]==='A')[9],1.5);assert.equal(result.Series.find(r=>r[14]==='B')[6],80);assert.equal(calls,1);
});
await test('Consulta única limita abas, colunas e campos sem incluir fórmulas ou notas',async()=>{let calls=0;await fetchTables(SHEET_ID,{fetchImpl:async(url,options)=>{calls++;const u=new URL(url);assert.equal(u.pathname,'/v4/spreadsheets/'+SHEET_ID);assert.deepEqual(u.searchParams.getAll('ranges'),["'Treinos'!A:J","'Series'!A:O","'Peso'!A:G"]);assert.equal(options.method,'GET');assert.match(u.searchParams.get('fields'),/formattedValue,effectiveValue/);assert.ok(!u.searchParams.get('fields').includes('userEnteredValue'));return reply(data())}});assert.equal(calls,1)});
await test('Abas são identificadas pelo título e não pela posição',async()=>{const d=data();d.sheets.reverse();const r=await read(d);assert.equal(r.Series.length,fixture.Series.length);assert.equal(r.Treinos.length,fixture.Treinos.length)});
await test('Zero numérico e RIR decimal prevalecem sobre aparência',async()=>{const d=data(),cells=d.sheets[1].data[0].rowData[1].values;cells[6]={formattedValue:'0,00',effectiveValue:{numberValue:0}};cells[9]={formattedValue:'31.12',effectiveValue:{numberValue:1.5}};const r=await read(d);assert.equal(r.Series[1][6],0);assert.equal(r.Series[1][9],1.5)});
await test('Datas exibidas preservadas com data nativa numérica',async()=>{const d=data();d.sheets[1].data[0].rowData[1].values[0].effectiveValue={numberValue:46321};assert.equal((await read(d)).Series[1][0],fixture.Series[1][0])});
await test('Intervalo RIR textual preservado',async()=>{const d=data();d.sheets[1].data[0].rowData[1].values[9]={formattedValue:'1-2',effectiveValue:{stringValue:'1-2'}};assert.equal((await read(d)).Series[1][9],'1-2')});
await test('Linhas vazias internas preservam posição',async()=>{const d=data();d.sheets[1].data[0].rowData.splice(2,0,{});const r=await read(d);assert.deepEqual(r.Series[2],[]);assert.equal(r.Series[3][14],fixture.Series[2][14])});
await test('Abas vazias continuam representadas',async()=>{const d=data();d.sheets.forEach(s=>s.data=[{}]);assert.deepEqual(await read(d),{Treinos:[],Series:[],Peso:[]})});
for(const [label,mutate] of [
 ['Aba ausente',d=>d.sheets.pop()],['Aba duplicada',d=>d.sheets.push(structuredClone(d.sheets[0]))],
 ['Bloco ausente',d=>delete d.sheets[0].data],['Blocos ambíguos',d=>d.sheets[0].data.push({})],
 ['Deslocamento de linha',d=>d.sheets[0].data[0].startRow=1],['Deslocamento de coluna',d=>d.sheets[0].data[0].startColumn=1],
 ['Linhas malformadas',d=>d.sheets[0].data[0].rowData={}],['Colunas malformadas',d=>d.sheets[0].data[0].rowData[0].values={}],
 ['Valor numérico ausente',d=>d.sheets[1].data[0].rowData[1].values[6]={formattedValue:'50'}],
 ['Booleano na carga',d=>d.sheets[1].data[0].rowData[1].values[6]={formattedValue:'TRUE',effectiveValue:{boolValue:true}}],
 ['Erro de fórmula',d=>d.sheets[2].data[0].rowData[1].values[3]={formattedValue:'#REF!',effectiveValue:{errorValue:{type:'REF',message:'synthetic'}}}],
 ['Número não finito',d=>d.sheets[1].data[0].rowData[1].values[6]={formattedValue:'50',effectiveValue:{numberValue:Infinity}}],
 ['Valor ambíguo',d=>d.sheets[1].data[0].rowData[1].values[6]={formattedValue:'50',effectiveValue:{numberValue:50,stringValue:'50'}}],
 ['Data numérica sem exibição',d=>d.sheets[1].data[0].rowData[1].values[0]={effectiveValue:{numberValue:46321}}],
])await test(label+' rejeita a resposta inteira',async()=>{const d=data();mutate(d);await assert.rejects(read(d),/inconsistente ou incompleta/)});
await test('Erro HTTP preserva documento e impede qualquer gravação',async()=>{const doc=createSandboxDocument(fixture),before=structuredClone(doc);let writes=0;await assert.rejects(uploadNewRows(SHEET_ID,doc,{fetchImpl:async(url,options)=>{if(options.method!=='GET')writes++;return {ok:false,status:429,json:async()=>({error:{message:'quota'}})}}}),/429/);assert.equal(writes,0);assert.deepEqual(doc,before)});
await test('Resposta incompleta não causa gravações nem alteração local',async()=>{const doc=createSandboxDocument(fixture),before=structuredClone(doc);let writes=0;await assert.rejects(uploadNewRows(SHEET_ID,doc,{fetchImpl:async(url,options)=>{if(options.method!=='GET')writes++;return reply({})}}));assert.equal(writes,0);assert.deepEqual(doc,before)});
await test('JSON inválido não é tratado como leitura confirmada',async()=>{await assert.rejects(fetchTables(SHEET_ID,{fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw Error('JSON inválido')}})}),/inconsistente ou incompleta/)});
disconnect();console.log('GRID_READ_TESTS='+count);
