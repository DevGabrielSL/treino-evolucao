import assert from 'node:assert/strict';
import {parseCoachPlanRows} from '../coach_plan_read.js';
import {authorize,disconnect,fetchCoachPlanRows} from '../sheet_sync_browser.js';
let checks=0;
function pass(label,fn){fn();checks++;console.log('PASS '+label);}
const header=['Parâmetro','Definição','','Dia','Sessão','Intenção','','Regra','Aplicação'];
const fixture=[
 header,
 ['Frequência','4 vezes por semana','','Segunda','Peito prioritário','Flexível','','RIR alvo','2–3 sem falha improvisada'],
 ['Objetivo','Hipertrofia','','Terça','Costas prioritário','Flexível','','Progressão','Subir reps antes de aumentar carga'],
 ['','', '', '', '', '', '', 'Core','Prancha e abdominal infra permitidos. Bird dog e dead bug fora do programa.']
];
const saved=JSON.stringify(fixture);
const clean=parseCoachPlanRows(fixture);
pass('Um planejamento gera dois parâmetros',()=>assert.equal(clean.plan_parameters.length,2));
pass('Duas linhas de frequência produzem sessões semanais',()=>assert.equal(clean.weekly_schedule.length,2));
pass('Três regras são importadas',()=>assert.equal(clean.training_rules.length,3));
pass('RIR com intervalo preservado como texto',()=>assert.equal(clean.training_rules[0].application,'2–3 sem falha improvisada'));
pass('A origem não é alterada pelo parser',()=>assert.equal(JSON.stringify(fixture),saved));
pass('Apenas campos previstos no objeto retornado',()=>assert.deepEqual(Object.keys(clean).sort(),['plan_parameters','training_rules','weekly_schedule'].sort()));
pass('Plano vazio é rejeitado',()=>assert.throws(()=>parseCoachPlanRows([]),/Plano/));
pass('Cabeçalho inesperado é rejeitado',()=>assert.throws(()=>parseCoachPlanRows([['Outro','Incorreto']]),/Cabeçalhos/));
pass('Sem regras úteis é rejeitado',()=>assert.throws(()=>parseCoachPlanRows([header]),/Nenhuma regra/));
const missing=structuredClone(fixture);missing[2][7]='';missing[2][8]='';
pass('Regra incompleta não inventa aplicação',()=>assert.equal(parseCoachPlanRows(missing).training_rules.length,2));
const short=structuredClone(fixture);short[2][4]='';
pass('Dia incompleto não cria sessão',()=>assert.equal(parseCoachPlanRows(short).weekly_schedule.length,1));
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.google={accounts:{oauth2:{initTokenClient:({callback})=>({requestAccessToken:()=>callback({access_token:'PLAN_TEST_ONLY',expires_in:3600})})}}};
const fakeClient='1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com';
await authorize(fakeClient);
const urls=[],requests=[];
async function fetchImpl(url,opt){
 const u=new URL(url);urls.push(u.href);requests.push(opt);
 assert.equal(opt.method,'GET');assert.equal(opt.headers.Authorization,'Bearer PLAN_TEST_ONLY');
 assert.equal(u.origin,'https://sheets.googleapis.com');
 assert.ok(decodeURIComponent(u.pathname).includes("'Plano'!A1:I40"));
 return {ok:true,status:200,json:async()=>({values:fixture})};
}
const spreadsheet='ABCDEFGHIJKLMNOPQRSTUVWXYZabc-12345';
const actual=await fetchCoachPlanRows(spreadsheet,{fetchImpl});
pass('O cliente autorizado lê Plano sem pedir novo escopo',()=>assert.equal(actual.training_rules.length,3));
pass('Só faz uma chamada GET',()=>assert.equal(requests.length,1));
pass('Nenhuma escrita feita na planilha',()=>assert.equal(requests[0].body,undefined));
pass('Usa valores formatados para texto e notas',()=>assert.ok(urls[0].includes('valueRenderOption=FORMATTED_VALUE')));
disconnect();
let invoked=false;
await assert.rejects(fetchCoachPlanRows(spreadsheet,{fetchImpl:async()=>{invoked=true;return {}}}),/Autorização expirada/);
pass('Não lê o plano sem autorização válida',()=>assert.equal(invoked,false));
console.log('ETAPA5_PLAN_READ_TESTS='+checks);
