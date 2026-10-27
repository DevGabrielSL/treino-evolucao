import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('./Code.gs',import.meta.url),'utf8');
const properties=new Map([['STRAVA_ENABLED','false']]);
const ctx={
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v)})},
  UrlFetchApp:{fetch:()=>{throw new Error('Rede proibida nos testes')}},
  LockService:{getScriptLock:()=>{throw new Error('Lock nao deve ser usado com envio desativado')}},
  Utilities:{formatDate:(date)=>date.toISOString().slice(0,10)},
  SpreadsheetApp:{openById:()=>{throw new Error('Nenhuma planilha real em teste')}},
  console
};
runInNewContext(src,ctx);
const workout=['2026-10-27','Terça','Peito + bíceps','Concluído',65,null,null,null,'','gym20261027AB','2026-10-27T18:00:00-03:00'];
function record(ex,variant,type,n,kg,unit,reps,rir){
  return ['2026-10-27','Peito + bíceps',ex,variant,type,n,kg,unit,reps,rir,null,null,null,'','serie'+n];
}
const rows=[
  record('Supino na máquina com plaquetas','Máquina de supino com plaquetas','Efetiva',1,15,'plaquetas',12,2),
  record('Máquina peito inferior - empurrar','Máquina','Efetiva',1,42.5,'kg',12,2),
  record('Rosca direta com halteres','Halteres em pé (bilateral)','Efetiva',1,16,'kg/halter',12,2),
  record('Crucifixo inclinado','Máquina com anilhas atrás (plate-loaded)','Efetiva',1,20,'kg (configuração não confirmada)',12,2),
  record('Elevação lateral','Halteres em pé','Efetiva',1,18,'kg/halter',12,2),
  record('Prancha frontal','Peso corporal','Core',1,null,'segundos',60,null),
  record('Prancha lateral','Peso corporal — esquerda','Core',1,null,'segundos',30,null)
];
const result=ctx.stravaBuildUpload_(workout,rows,'America/Sao_Paulo');
assert.equal(result.externalId,'appfitness-gym20261027AB.json');
assert.equal(result.payload.version,'1.0');
assert.equal(result.payload.elapsed_time,3900);
assert.equal(result.payload.utc_offset,-10800);
assert.equal(result.payload.start_time,workout[10]);
assert.equal(result.payload.sets.length,7);
assert.equal(result.payload.sets[0].exercise_type,'MACHINE_CHEST_PRESS');
assert.equal(Object.hasOwn(result.payload.sets[0],'weight'),false,'plaquetas nao viram kg');
assert.equal(result.payload.sets[1].weight,42.5);
assert.equal(result.payload.sets[2].weight,16,'kg por halter nao vira total');
assert.equal(Object.hasOwn(result.payload.sets[3],'weight'),false,'carga ambigua nao se converte');
assert.equal(result.payload.sets[5].duration,60);
assert.equal(result.payload.sets[6].exercise_type,'SIDE_PLANK_HOLD');
assert.match(result.description,/RIR 2/);
const unsupported=record('Exercicio desconhecido','Desconhecido','Efetiva',1,8,'kg',10,2);
const partial=ctx.stravaBuildUpload_(workout,[...rows,unsupported], 'America/Sao_Paulo');
assert.equal(partial.payload.sets.length,7,'nao inventa codigo de exercicio');
assert.match(partial.description,/Exercicio desconhecido/);
assert.throws(()=>ctx.stravaBuildUpload_([...workout.slice(0,4),0,...workout.slice(5)],rows,'UTC'),/Duracao/);
assert.throws(()=>ctx.stravaBuildUpload_([...workout.slice(0,10),''],rows,'UTC'),/inicio ISO/);
assert.throws(()=>ctx.stravaBuildUpload_([...workout.slice(0,3),'Em andamento',...workout.slice(4)],rows,'UTC'),/nao concluido/);
assert.throws(()=>ctx.stravaBuildUpload_([...workout.slice(0,9),'',workout[10]],rows,'UTC'),/ID estavel/);
assert.equal(ctx.stravaPublisherTick(),'Desativado');
console.log('OK: 18 verificacoes locais; sem rede, sem planilha, sem Strava.');
