import assert from 'node:assert/strict';
import {emptyDocument,validateDocument,commit} from '../dist/store.js';
import {parseCoachPlanRows} from '../integration/coach_plan_read.js';
import {buildCoachPolicy} from '../dist/coach_policy.js';
import {parseGoal,suggestExercises,parseSeriesMessage} from '../dist/coach_logic.js';
import {replaceCoachVariant} from '../integration/coach_substitution.js';
import {lastDraftSet,correctLastDraftSet,undoLastDraftSet,resumeSelectedVariant} from '../dist/coach_commands.js';
import {planOutbound,stageInbound} from '../integration/sheet_sync_core.js';
import {locateWriteReceipt} from '../integration/write_receipt.js';
import {automaticSyncEligibility} from '../integration/automatic_sync.js';

let n=0;function check(label,fn){fn();n++;console.log('PASS '+label);}
const headers={
 Treinos:['Data','Dia','Sessão','Status','Duração (min)','Peso (kg)','Dor lombar antes (0-10)','Dor lombar depois (0-10)','Observações','ID do aplicativo'],
 Series:['Data','Sessão','Exercício','Equipamento / variação','Tipo','Série','Carga','Unidade','Reps','RIR','RPE','Índice de volume','Dor / desconforto','Observações','ID do aplicativo'],
 Peso:['Data','Peso (kg)','Meta (kg)','Variação desde início (kg)','Restante até meta (kg)','Observações','ID do aplicativo']
};
const emptyTables=()=>Object.fromEntries(Object.entries(headers).map(([k,v])=>[k,[... [v]]]));
const plan=[
 ['Parâmetro','Definição','','Dia','Sessão','Intenção','','Regra','Aplicação'],
 ['Objetivo','Treino de força sintético','','Segunda','Peito prioritário','Flexível','','RIR alvo','2–3 nas séries iniciais'],
 ['Frequência','4 sessões por semana','','Terça','Costas','Flexível','','Progressão','Subir reps antes de aumentar carga'],
 ['','','','','','','','Máquinas','Não comparar plaquetas de máquinas diferentes'],
 ['','','','','','','','Core','Bird dog e dead bug fora do programa']
];
const rules=parseCoachPlanRows(plan),policy=buildCoachPolicy({...rules,exercises:[],sessions:[]});
check('Plano sintético interpretado',()=>assert.equal(rules.training_rules.length,4));
check('Alvo de RIR da política extraído',()=>assert.deepEqual(policy.rirTarget,[2,3]));
check('Exercício excluído pelo plano rejeitado',()=>assert.equal(policy.evaluate({name:'Bird dog'}).blocked,true));
check('Exercício comum de peito não é excluído',()=>assert.equal(policy.evaluate({name:'Supino reto'}).blocked,false));

let d=emptyDocument();
const initialRevision=d.revision;
d=commit(d,x=>{
 x.settings.coach_plan_rules=rules;
 x.overlay.exercises.push({id:'bench',name:'Supino reto'},{id:'fly',name:'Voador'},{id:'core',name:'Bird dog'});
 x.overlay.exercise_variants.push(
  {id:'bench-bar',exercise_id:'bench',equipment_or_variation:'Barra de teste',unit:'kg',unit_confirmed:true},
  {id:'fly-machine',exercise_id:'fly',equipment_or_variation:'Máquina de teste',unit:'plaquetas',unit_confirmed:true},
  {id:'core-body',exercise_id:'core',equipment_or_variation:'Peso corporal',unit:'reps',unit_confirmed:true}
 );
});
check('Planejamento cabe no documento local validado',()=>assert.equal(validateDocument(d),true));
check('Gravação local aumenta revisão',()=>assert.ok(d.revision>initialRevision));
check('Plano fica disponível offline no documento',()=>assert.equal(d.settings.coach_plan_rules.training_rules.length,4));

const all={...rules,sessions:d.overlay.sessions,sets:d.overlay.sets,exercises:d.overlay.exercises,exercise_variants:d.overlay.exercise_variants};
const groups=parseGoal('Quero treinar peito hoje');
check('Interpreta intenção em português',()=>assert.deepEqual(groups,['peito']));
const proposed=suggestExercises(all,groups,{limit:5,ranker:policy.evaluate});
check('Roteiro contém dois exercícios conhecidos',()=>assert.equal(proposed.length,2));
check('Cada sugestão conserva variante própria',()=>assert.equal(new Set(proposed.map(x=>x.variant_id)).size,2));
check('Não recomenda exercício fora do grupo',()=>assert.ok(proposed.every(x=>x.name==='Supino reto'||x.name==='Voador')));

d=commit(d,x=>x.overlay.sessions.push({
 id:'synthetic-session',date:'2026-10-26',name:'Peito · Assistente sintético',status:'in_progress',
 planned_variant_ids:proposed.map(x=>x.variant_id),provenance:{source:'android_local'}
}));
check('Sessão inicial é válida',()=>assert.equal(validateDocument(d),true));
const beforeStart=planOutbound(d,emptyTables());
check('Treino em andamento ainda não é enviado',()=>assert.deepEqual(beforeStart,{Treinos:[],Series:[],Peso:[]}));
const first=parseSeriesMessage('50 kg 10 reps RIR 2','kg');
check('Comando registra carga numérica',()=>assert.equal(first.load_value,50));
check('Comando registra repetições',()=>assert.equal(first.repetitions,10));
check('Comando registra RIR',()=>assert.equal(first.rir,2));
d=commit(d,x=>x.overlay.sets.push({
 id:'synthetic-set-1',date:'2026-10-26',session_id:'synthetic-session',exercise_id:'bench',
 variant_id:'bench-bar',set_type:first.set_type,set_number:1,load_value:first.load_value,
 repetitions:first.repetitions,rir:first.rir,provenance:{source:'android_local'}
}));
check('Série persistida no documento',()=>assert.equal(validateDocument(d),true));
check('Última série local identificada',()=>assert.equal(lastDraftSet(d,'synthetic-session').id,'synthetic-set-1'));
check('Série de sessão aberta continua fora da fila',()=>assert.equal(planOutbound(d,emptyTables()).Series.length,0));
d=commit(d,x=>correctLastDraftSet(x,'synthetic-session',{load_value:55,repetitions:8,rir:1}));
check('Correção atualiza peso e repetições',()=>assert.deepEqual([d.overlay.sets[0].load_value,d.overlay.sets[0].repetitions],[55,8]));
check('Correção mantém o ID original',()=>assert.equal(d.overlay.sets[0].id,'synthetic-set-1'));
check('Após correção nenhuma duplicata surge',()=>assert.equal(d.overlay.sets.length,1));

const replaced=structuredClone(d);
const action=replaceCoachVariant(replaced,'synthetic-session','bench-bar','fly-machine');
check('Substituição preserva série existente',()=>assert.equal(replaced.overlay.sets[0].id,'synthetic-set-1'));
check('Substituição preserva carga anterior',()=>assert.equal(replaced.overlay.sets[0].load_value,55));
check('Substituição permite variante nova no roteiro',()=>assert.equal(action.selected,'fly-machine'));
check('Substituição é recuperável ao reabrir',()=>assert.equal(resumeSelectedVariant(replaced,'synthetic-session',replaced.overlay.sessions[0].planned_variant_ids),'bench-bar'));
check('Documento substituído continua válido',()=>assert.equal(validateDocument(replaced),true));
const fly=parseSeriesMessage('5 plaquetas 12 reps RIR 2','plaquetas');
d=commit(replaced,x=>x.overlay.sets.push({
 id:'synthetic-set-2',date:'2026-10-26',session_id:'synthetic-session',exercise_id:'fly',
 variant_id:'fly-machine',set_type:fly.set_type,set_number:1,load_value:fly.load_value,
 repetitions:fly.repetitions,rir:fly.rir,provenance:{source:'android_local'}
}));
check('Séries de equipamentos diferentes coexistem',()=>assert.equal(d.overlay.sets.length,2));
check('Unidade incompatível bloqueada',()=>assert.throws(()=>parseSeriesMessage('50 kg 10 reps RIR 2','plaquetas'),/Unidade incompatível/));
const temp=structuredClone(d);
undoLastDraftSet(temp,'synthetic-session');
check('Desfazer última série só altera o rascunho',()=>assert.equal(temp.overlay.sets.length,1));
check('Original não é alterado pelo desfazer em cópia',()=>assert.equal(d.overlay.sets.length,2));
d=commit(d,x=>{const s=x.overlay.sessions.find(y=>y.id==='synthetic-session');s.status='completed';});
check('Sessão concluída é válida',()=>assert.equal(validateDocument(d),true));
const pending=planOutbound(d,emptyTables());
check('Uma sessão entra na fila',()=>assert.equal(pending.Treinos.length,1));
check('Duas séries entram na fila',()=>assert.equal(pending.Series.length,2));
check('Nenhuma pesagem foi inventada',()=>assert.equal(pending.Peso.length,0));
check('Série de barra mantém kg na exportação',()=>assert.equal(pending.Series.find(x=>x.id==='synthetic-set-1').values[7],'kg'));
check('Série de máquina mantém plaquetas',()=>assert.equal(pending.Series.find(x=>x.id==='synthetic-set-2').values[7],'plaquetas'));
check('Reexportação não inventa IDs novos',()=>assert.deepEqual(planOutbound(d,emptyTables()),pending));
const remote=emptyTables();
for(const [tab,items] of Object.entries(pending))for(const item of items){
 remote[tab].push(item.values);
 check('Recibo integral confirma '+tab+' '+item.id,()=>assert.equal(locateWriteReceipt(tab,remote[tab],item).status,'confirmed'));
}
check('Recebimento do Sheets reduz fila a zero',()=>assert.deepEqual(planOutbound(d,remote),{Treinos:[],Series:[],Peso:[]}));
check('Nova consulta sem escrita mantém fila vazia',()=>assert.deepEqual(planOutbound(d,structuredClone(remote)),{Treinos:[],Series:[],Peso:[]}));
const imported=stageInbound(emptyDocument(),remote);
check('Releitura recupera uma sessão',()=>assert.equal(imported.add.sessions,1));
check('Releitura recupera duas séries',()=>assert.equal(imported.add.sets,2));
check('Documento importado continua válido',()=>assert.equal(validateDocument(imported.next),true));
check('Importação repetida não duplica séries',()=>assert.equal(stageInbound(imported.next,remote).add.sets,0));
const conflict=structuredClone(remote);
conflict.Series[1][6]=60;
check('Recibo detecta carga remota diferente',()=>assert.throws(()=>locateWriteReceipt('Series',conflict.Series,pending.Series[0]),/Recibo divergente/));
const offline=structuredClone(d);
offline.settings.sheet_sync={auto:true,spreadsheet_id:'SYNTHETIC_SHEET_ID',last_write_confirmed_at:'2026-10-26T12:00:00Z'};
check('Offline bloqueia envio automático',()=>assert.equal(automaticSyncEligibility({doc:offline,sheetId:'SYNTHETIC_SHEET_ID',online:false,authorized:true}).reason,'offline'));
check('Sem autorização Google não envia',()=>assert.equal(automaticSyncEligibility({doc:offline,sheetId:'SYNTHETIC_SHEET_ID',online:true,authorized:false}).reason,'reauthorize'));
const fresh=structuredClone(offline);delete fresh.settings.sheet_sync.last_write_confirmed_at;
check('Sem primeira gravação não habilita envio',()=>assert.equal(automaticSyncEligibility({doc:fresh,sheetId:'SYNTHETIC_SHEET_ID',online:true,authorized:true}).reason,'first_write_not_verified'));
const restored=JSON.parse(JSON.stringify(d));
check('Documento JSON restaurado permanece válido',()=>assert.equal(validateDocument(restored),true));
check('RIR sobrevive à serialização',()=>assert.equal(restored.overlay.sets[0].rir,1));
check('Plano offline sobrevive à serialização',()=>assert.equal(restored.settings.coach_plan_rules.training_rules.length,4));
check('IDs sobrevivem à serialização sem perder séries',()=>assert.deepEqual(restored.overlay.sets.map(x=>x.id),d.overlay.sets.map(x=>x.id)));
console.log('STAGE6_E2E_TESTS='+n);
