import assert from 'node:assert/strict';
import {emptyDocument,validateDocument} from '../../dist/store.js';
import {locateWriteReceipt} from '../write_receipt.js';
import {authorize,disconnect,authorized,previewUpload,uploadNewRows} from '../sheet_sync_browser.js';
let count=0;const ok=(label,fn)=>{fn();count++;console.log('PASS '+label)};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.google={accounts:{oauth2:{initTokenClient:({callback})=>({requestAccessToken:()=>callback({access_token:'TEST_ONLY_TOKEN',expires_in:3600})})}}};
await authorize('1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com');
const id='ABCDEFGHIJKLMNOPQRSTUVWXYZabc-12345';
const head={
 Treinos:['Data','Dia','Sessão','Status','Duração (min)','Peso (kg)','Dor lombar antes (0-10)','Dor lombar depois (0-10)','Observações'],
 Series:['Data','Sessão','Exercício','Equipamento / variação','Tipo','Série','Carga','Unidade','Reps','RIR','RPE','Índice de volume','Dor / desconforto','Observações'],
 Peso:['Data','Peso (kg)','Meta (kg)','Variação desde início (kg)','Restante até meta (kg)','Observações']
};
const makeRows=()=>Object.fromEntries(Object.entries(head).map(([name,h])=>[name,[h.slice()]]));
const doc=()=>{
 const d=emptyDocument();
 d.overlay.exercises.push({id:'ex-100',name:'Supino sintético'});
 d.overlay.exercise_variants.push({id:'v-100',exercise_id:'ex-100',equipment_or_variation:'Barra',unit:'kg',unit_confirmed:true});
 d.overlay.sessions.push({id:'sess-100',date:'2026-10-26',name:'Treino sintético',status:'completed',duration_minutes:50});
 d.overlay.sets.push({id:'serie-101',date:'2026-10-26',session_id:'sess-100',exercise_id:'ex-100',variant_id:'v-100',set_type:'effective',set_number:1,load_value:50,repetitions:10,rir:2,rpe:8});
 d.overlay.sets.push({id:'serie-102',date:'2026-10-26',session_id:'sess-100',exercise_id:'ex-100',variant_id:'v-100',set_type:'effective',set_number:2,load_value:55,repetitions:8,rir:1,rpe:9});
 d.overlay.weigh_ins.push({id:'peso-100',date:'2026-10-26',weight_kg:82});
 assert.equal(validateDocument(d),true);
 return d;
};
const reply=(values,status=200)=>({ok:status===200,status,json:async()=>values});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
function api({failPostTab=null,failPostMode='',failGetAfterPost=false,mutateTab=null,mutateColumn=11,pausePost=null}={}){
 const tabs=makeRows(),stats={posts:[],headers:[],reads:0},state={postFailureUsed:false,unreadable:false};
 async function fetchImpl(url,config){
  assert.equal(config.headers.Authorization,'Bearer TEST_ONLY_TOKEN');
  const u=new URL(url);assert.equal(u.origin,'https://sheets.googleapis.com');
  if(u.pathname.endsWith('/values:batchGet')){
   stats.reads++;
   if(state.unreadable)throw Error('simulated disconnected GET');
   return reply({valueRanges:['Treinos','Series','Peso'].map(n=>({values:tabs[n]}))});
  }
  if(u.pathname.endsWith('/values:batchUpdate')){
   const body=JSON.parse(config.body),parts=body.data;
   assert.equal(body.valueInputOption,'RAW');
   assert.equal(parts.length,2);
   assert.match(parts[0].range,/^'Peso'!A\d+:C\d+$/);
   assert.match(parts[1].range,/^'Peso'!F\d+:G\d+$/);
   const number=Number(parts[0].range.match(/!A(\d+)/)[1]);
   assert.equal(parts[1].range.match(/!F(\d+)/)[1],String(number));
   if(tabs.Peso[number-1]?.[0])throw Error('Unsafe overwrite in mock');
   const cells=[...parts[0].values[0],'','',...parts[1].values[0]];
   assert.equal(cells.length,7);
   tabs.Peso[number-1]=cells;
   stats.posts.push({tab:'Peso',id:cells.at(-1)});
   return reply({totalUpdatedCells:5});
  }
  const range=decodeURIComponent(u.pathname.match(/\/values\/(.*?)(?:\:append)?$/)?.[1]||'');
  const tab=range.match(/'(Treinos|Series|Peso)'/)?.[1];
  assert.ok(tab,'invalid test route '+u.pathname);
  if(config.method==='PUT'){
   tabs[tab][0][{Treinos:9,Series:14,Peso:6}[tab]]='ID do aplicativo';
   stats.headers.push(tab);return reply({});
  }
  if(config.method==='POST'){
   const record=JSON.parse(config.body).values[0].slice();
   if(pausePost&&pausePost.tab===tab&&!pausePost.used){
    pausePost.used=true;pausePost.entered.resolve();await pausePost.block.promise;
   }
   if(failPostTab===tab&&!state.postFailureUsed&&failPostMode==='reject-before-write'){
    state.postFailureUsed=true;throw Error('network rejected before POST');
   }
   if(mutateTab===tab)record[mutateColumn]=999;
   tabs[tab].push(record);stats.posts.push({tab,id:record.at(-1)});
   if(failPostTab===tab&&!state.postFailureUsed&&failPostMode==='lost-response'){
    state.postFailureUsed=true;
    if(failGetAfterPost)state.unreadable=true;
    throw Error('response lost after server committed');
   }
   return reply({});
  }
  throw Error('unsupported method');
 }
 return {tabs,stats,state,fetchImpl};
}
const x={id:'one',values:['2026-10-26','Segunda','Treino de teste','Concluído','45','','','','','one']};
const candidateRows=[['Data'],x.values];
ok('Recibo completo confirma ID e conteúdo',()=>assert.equal(locateWriteReceipt('Treinos',candidateRows,x).status,'confirmed'));
ok('Ausência de ID é explicitamente ausente',()=>assert.equal(locateWriteReceipt('Treinos',[['Data']],x).status,'absent'));
ok('Recibo identifica a linha existente',()=>assert.equal(locateWriteReceipt('Treinos',candidateRows,x).row,2));
const dup=[...candidateRows,x.values.slice()];
ok('Dois IDs iguais são bloqueados',()=>assert.throws(()=>locateWriteReceipt('Treinos',dup,x),/duplicado/));
const badName=[['Data'],x.values.slice()];badName[1][2]='Treino não esperado';
ok('ID correto e nome divergente não confirma',()=>assert.throws(()=>locateWriteReceipt('Treinos',badName,x),/coluna 3/));
const set={id:'series001',values:['2026-10-26','Treino','Supino','Barra','Efetiva',1,50,'kg',10,2,8,500,'','','series001']};
const same=[['Data'],set.values.slice()];
ok('Recibo de série confirma volume',()=>assert.equal(locateWriteReceipt('Series',same,set).status,'confirmed'));
same[1][11]=900;
ok('Recibo de série rejeita volume incorreto',()=>assert.throws(()=>locateWriteReceipt('Series',same,set),/coluna 12/));
same[1][11]=500;same[1][6]='50,0';
ok('Comparação numérica aceita vírgula sem trocar o valor',()=>assert.equal(locateWriteReceipt('Series',same,set).status,'confirmed'));
same[1][7]='plaquetas';
ok('Unidades divergentes não confirmam',()=>assert.throws(()=>locateWriteReceipt('Series',same,set),/coluna 8/));
const weight={id:'weight001',values:['2026-10-26',82,'','','','','weight001']};
ok('Peso com campos derivados vazios pode ser confirmado',()=>assert.equal(locateWriteReceipt('Peso',[['Data'],weight.values],weight).status,'confirmed'));
const wDiff=[['Data'],weight.values.slice()];wDiff[1][3]=0;
ok('Recibo integral detecta campo extra indevido',()=>assert.throws(()=>locateWriteReceipt('Peso',wDiff,weight),/coluna 4/));
ok('Recibo seletivo preserva validação de campos estáveis',()=>assert.equal(locateWriteReceipt('Peso',wDiff,weight,{columns:[0,1,2,5,6]}).status,'confirmed'));
const normal=api(),model=doc();
const preview=await previewUpload(id,model,{fetchImpl:normal.fetchImpl});
ok('Prévia identifica sessão concluída',()=>assert.equal(preview.counts.Treinos,1));
ok('Prévia identifica duas séries',()=>assert.equal(preview.counts.Series,2));
ok('Prévia identifica pesagem',()=>assert.equal(preview.counts.Peso,1));
ok('Prévia não envia nem cria cabeçalhos',()=>assert.deepEqual(normal.stats.posts,[]));
const initial=await uploadNewRows(id,model,{fetchImpl:normal.fetchImpl});
ok('Grava 1 sessão, 2 séries e 1 pesagem',()=>assert.deepEqual(initial.written,{Treinos:1,Series:2,Peso:1}));
ok('Quatro gravações únicas no servidor',()=>assert.equal(normal.stats.posts.length,4));
ok('Peso gravado sem preencher colunas das fórmulas',()=>assert.deepEqual(normal.tabs.Peso.at(-1).slice(3,5),['','']));
const second=await uploadNewRows(id,model,{fetchImpl:normal.fetchImpl});
ok('Repetição após sucesso não grava nada',()=>assert.deepEqual(second.written,{Treinos:0,Series:0,Peso:0}));
ok('Repetição mantém quatro linhas',()=>assert.equal(normal.stats.posts.length,4));
const changed=structuredClone(model);changed.overlay.sets[0].load_value=75;
await assert.rejects(previewUpload(id,changed,{fetchImpl:normal.fetchImpl}),/divergência|divergente/);
ok('Alteração local após envio não é ignorada',()=>{});
const broken=api();
await uploadNewRows(id,model,{fetchImpl:broken.fetchImpl});
broken.tabs.Peso[2]=['','','','#REF!','#REF!'];
await assert.rejects(previewUpload(id,model,{fetchImpl:broken.fetchImpl}),/fórmula de pesagem/);
ok('Erro de fórmula na âncora D3/E3 é identificado após gravação',()=>{});
normal.tabs.Series[1][11]=777;
await assert.rejects(previewUpload(id,model,{fetchImpl:normal.fetchImpl}),/Recibo divergente/);
ok('Alteração somente do índice de volume é detectada antes de enviar',()=>{});
const wrong=api({mutateTab:'Series',mutateColumn:11});
await assert.rejects(uploadNewRows(id,model,{fetchImpl:wrong.fetchImpl}),/Recibo divergente/);
ok('Valor incorreto não é aceito como sucesso',()=>assert.equal(wrong.stats.posts.filter(x=>x.tab==='Series').length,1));
ok('Falha de confirmação interrompe envio da pesagem',()=>assert.equal(wrong.stats.posts.some(x=>x.tab==='Peso'),false));
const lost=api({failPostTab:'Series',failPostMode:'lost-response'});
const recovered=await uploadNewRows(id,model,{fetchImpl:lost.fetchImpl});
ok('Resposta perdida após gravar é recuperada por releitura',()=>assert.deepEqual(recovered.written,{Treinos:1,Series:2,Peso:1}));
ok('Recuperação não escreve série duas vezes',()=>assert.equal(lost.stats.posts.filter(x=>x.tab==='Series').length,2));
const lostRetry=await uploadNewRows(id,model,{fetchImpl:lost.fetchImpl});
ok('Nova tentativa após resposta perdida é idempotente',()=>assert.equal(lostRetry.written.Series,0));
const denied=api({failPostTab:'Series',failPostMode:'reject-before-write'});
await assert.rejects(uploadNewRows(id,model,{fetchImpl:denied.fetchImpl}),/não confirmado/);
ok('POST rejeitado não é marcado como confirmado',()=>assert.equal(denied.stats.posts.filter(x=>x.tab==='Series').length,0));
const allowed=await uploadNewRows(id,model,{fetchImpl:denied.fetchImpl});
ok('Tentativa posterior só escreve séries ausentes',()=>assert.deepEqual(allowed.written,{Treinos:0,Series:2,Peso:1}));
ok('Sessão já gravada não duplica após POST rejeitado',()=>assert.equal(denied.stats.posts.filter(x=>x.tab==='Treinos').length,1));
const uncertain=api({failPostTab:'Series',failPostMode:'lost-response',failGetAfterPost:true});
await assert.rejects(uploadNewRows(id,model,{fetchImpl:uncertain.fetchImpl}),/não pôde ser confirmado/);
ok('Resposta perdida e leitura indisponível não geram falso sucesso',()=>assert.equal(uncertain.stats.posts.filter(x=>x.tab==='Series').length,1));
uncertain.state.unreadable=false;
const resumed=await uploadNewRows(id,model,{fetchImpl:uncertain.fetchImpl});
ok('Retomada confirma o ID antigo e só grava série faltante',()=>assert.deepEqual(resumed.written,{Treinos:0,Series:1,Peso:1}));
ok('Retomada não duplica o ID cujo resultado era desconhecido',()=>assert.equal(uncertain.stats.posts.filter(x=>x.tab==='Series').length,2));
const barrier={tab:'Treinos',entered:deferred(),block:deferred(),used:false},slow=api({pausePost:barrier});
const firstRun=uploadNewRows(id,model,{fetchImpl:slow.fetchImpl});
await barrier.entered.promise;
await assert.rejects(uploadNewRows(id,model,{fetchImpl:slow.fetchImpl}),/já está em andamento/);
ok('Segundo envio simultâneo é rejeitado durante o primeiro',()=>{});
barrier.block.resolve();
ok('Primeiro envio conclui normalmente após desbloquear',()=>{});
assert.deepEqual((await firstRun).written,{Treinos:1,Series:2,Peso:1});
ok('Bloqueio em memória é liberado após sucesso',()=>true);
const failLock=api({failPostTab:'Treinos',failPostMode:'reject-before-write'});
await assert.rejects(uploadNewRows(id,model,{fetchImpl:failLock.fetchImpl}),/não confirmado/);
ok('Erro também libera bloqueio para nova tentativa',()=>true);
await uploadNewRows(id,model,{fetchImpl:failLock.fetchImpl});
ok('Nova tentativa após falha de bloqueio funciona',()=>assert.equal(failLock.stats.posts.length,4));
disconnect();
ok('Autorização descartada ao desconectar',()=>assert.equal(authorized(),false));
console.log('ETAPA3_WRITE_TESTS='+count);
