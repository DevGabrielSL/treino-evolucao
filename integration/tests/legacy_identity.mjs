import assert from 'node:assert/strict';
import {emptyDocument,validateDocument} from '../../dist/store.js';
import {previewRemote,stageInbound,planOutbound} from '../sheet_sync_core.js';
let checks=0;
const ok=(label,fn)=>{fn();checks++;console.log('PASS '+label);};
const rows=()=>({
 Treinos:[['Data','Dia','Sessão','Status','Duração (min)','Peso (kg)','Dor lombar antes (0-10)','Dor lombar depois (0-10)','Observações'],['2026-10-20','Terça','Sessão sintética','Concluído','','','','','']],
 Series:[['Data','Sessão','Exercício','Equipamento / variação','Tipo','Série','Carga','Unidade','Reps','RIR','RPE','Índice de volume','Dor / desconforto','Observações'],['2026-10-20','Sessão sintética','Supino sintético','Barra','Efetiva',1,50,'kg',10,2,8,500,'','']],
 Peso:[['Data','Peso (kg)','Meta (kg)','Variação desde início (kg)','Restante até meta (kg)','Observações'],['2026-10-20',85,80,'',5,'']]
});
const local=()=>{
 const d=emptyDocument();
 d.overlay.sessions.push({id:'legacy_session',date:'2026-10-20',name:'Sessão sintética',status:'completed'});
 d.overlay.exercises.push({id:'legacy_exercise',name:'Supino sintético'});
 d.overlay.exercise_variants.push({id:'legacy_variant',exercise_id:'legacy_exercise',equipment_or_variation:'Barra',unit:'kg',unit_confirmed:true});
 d.overlay.sets.push({id:'legacy_set',date:'2026-10-20',session_id:'legacy_session',exercise_id:'legacy_exercise',variant_id:'legacy_variant',set_type:'effective',set_number:1,load_value:50,repetitions:10,rir:2,rpe:8});
 d.overlay.weigh_ins.push({id:'legacy_weight',date:'2026-10-20',weight_kg:85});
 return d;
};
const d=local(),remote=rows(),original=JSON.stringify(d);
ok('Documento sintético inicial válido',()=>assert.equal(validateDocument(d),true));
const before=previewRemote(d,remote);
ok('Prévia histórica detecta zero duplicações a importar',()=>assert.deepEqual(before.counts,{Treinos:0,Series:0,Peso:0}));
ok('Link único para série antiga',()=>assert.equal(before.legacyLinks.length,1));
ok('Link único para sessão antiga',()=>assert.equal(before.legacySessionLinks.length,1));
ok('Link único para pesagem antiga',()=>assert.equal(before.legacyWeightLinks.length,1));
ok('Prévia não altera dados',()=>assert.equal(JSON.stringify(d),original));
const reconciled=stageInbound(d,remote);
ok('Nenhum registro criado na reconciliação',()=>assert.deepEqual([reconciled.add.sessions,reconciled.add.sets,reconciled.add.weigh_ins],[0,0,0]));
ok('IDs originais preservados',()=>assert.deepEqual([reconciled.next.overlay.sessions[0].id,reconciled.next.overlay.sets[0].id,reconciled.next.overlay.weigh_ins[0].id],['legacy_session','legacy_set','legacy_weight']));
ok('Série ganha referência de linha',()=>assert.deepEqual([reconciled.next.overlay.sets[0].provenance.sheet,reconciled.next.overlay.sets[0].provenance.row],['Series',2]));
ok('Sessão ganha referência de linha',()=>assert.equal(reconciled.next.overlay.sessions[0].provenance.sheet,'Treinos'));
ok('Pesagem ganha referência de linha',()=>assert.equal(reconciled.next.overlay.weigh_ins[0].provenance.sheet,'Peso'));
ok('Modelo reconciliado válido',()=>assert.equal(validateDocument(reconciled.next),true));
ok('Planilha não recebe reenvio do legado',()=>assert.deepEqual(planOutbound(reconciled.next,remote),{Treinos:[],Series:[],Peso:[]}));
ok('Mesmo antes da gravação, prévia de envio exclui legado',()=>assert.deepEqual(planOutbound(d,remote),{Treinos:[],Series:[],Peso:[]}));
ok('Segunda importação adiciona zero',()=>assert.deepEqual(stageInbound(reconciled.next,remote).add,{sessions:0,sets:0,exercises:0,exercise_variants:0,weigh_ins:0}));
ok('Segunda importação conserva o total de uma série',()=>assert.equal(stageInbound(reconciled.next,remote).next.overlay.sets.length,1));
const fresh=stageInbound(emptyDocument(),remote);
ok('Base limpa importa uma série',()=>assert.equal(fresh.add.sets,1));
ok('Base limpa importa sessão e pesagem',()=>assert.deepEqual([fresh.add.sessions,fresh.add.weigh_ins],[1,1]));
ok('Base limpa é válida após a importação',()=>assert.equal(validateDocument(fresh.next),true));
ok('Importação de base limpa é idempotente',()=>assert.equal(stageInbound(fresh.next,remote).add.sets,0));
const twoRemote=rows();twoRemote.Series.push([...twoRemote.Series[1]]);
ok('Duas séries remotas realmente iguais são preservadas',()=>assert.equal(stageInbound(emptyDocument(),twoRemote).add.sets,2));
ok('Uma série local e duas remotas iguais exigem revisão',()=>assert.throws(()=>previewRemote(local(),twoRemote),/ambíguas/));
const twoLocal=local();twoLocal.overlay.sets.push({...twoLocal.overlay.sets[0],id:'legacy_set_2'});
ok('Duas séries locais iguais e uma remota exigem revisão',()=>assert.throws(()=>stageInbound(twoLocal,rows()),/ambíguas/));
const modified=rows();modified.Series[1][6]=55;
ok('Carga alterada em posição antiga interrompe importação',()=>assert.throws(()=>stageInbound(local(),modified),/Conflito de série/));
const diffVariation=rows();diffVariation.Series[1][3]='Máquina';
ok('Equipamentos diferentes não são tratados como equivalentes',()=>assert.equal(stageInbound(local(),diffVariation).add.sets,1));
const android=local();android.overlay.sets[0].provenance={source:'android_local'};
ok('Série explicitamente local não é adotada como histórica',()=>assert.throws(()=>stageInbound(android,rows()),/Android/));
const foreign=rows();foreign.Series[1][14]='app_id_outro_celular';
ok('ID divergente de série bloqueia mesclagem',()=>assert.throws(()=>stageInbound(local(),foreign),/ID de série/));
const foreignSession=rows();foreignSession.Treinos[1][9]='app_session_outro';
ok('ID divergente de sessão bloqueia mesclagem',()=>assert.throws(()=>stageInbound(local(),foreignSession),/ID de sessão/));
const foreignWeight=rows();foreignWeight.Peso[1][6]='app_weight_outro';
ok('ID divergente de pesagem bloqueia mesclagem',()=>assert.throws(()=>stageInbound(local(),foreignWeight),/ID de pesagem/));
const incompleteSession=rows();incompleteSession.Treinos[1][8]='Texto alterado';
ok('Sessão divergente não é presumida igual',()=>assert.throws(()=>stageInbound(local(),incompleteSession),/Sessão histórica/));
const incompleteWeight=rows();incompleteWeight.Peso[1][5]='Texto alterado';
ok('Pesagem divergente não é presumida igual',()=>assert.throws(()=>stageInbound(local(),incompleteWeight),/Pesagem histórica/));
const oldCount=238,oldSessions=16;
const synthetic={Treinos:[rows().Treinos[0]],Series:[rows().Series[0]],Peso:[rows().Peso[0]]};
const old=emptyDocument();
old.overlay.exercises.push({id:'exercise',name:'Supino sintético'});
old.overlay.exercise_variants.push({id:'variant',exercise_id:'exercise',equipment_or_variation:'Barra',unit:'kg',unit_confirmed:true});
for(let i=0;i<oldSessions;i++){
 const date=new Date(Date.UTC(2026,7,1+i*3)).toISOString().slice(0,10),name='Sessão '+i;
 synthetic.Treinos.push([date,'',name,'Concluído','','','','','']);
 old.overlay.sessions.push({id:'ss'+i,date,name,status:'completed'});
}
for(let i=0;i<oldCount;i++){
 const j=i%oldSessions,s=old.overlay.sessions[j],reps=5+Math.floor(i/oldSessions),setNumber=1+Math.floor(i/oldSessions);
 synthetic.Series.push([s.date,s.name,'Supino sintético','Barra','Efetiva',setNumber,50,'kg',reps,2,8,50*reps,'','']);
 old.overlay.sets.push({id:'set'+i,date:s.date,session_id:s.id,exercise_id:'exercise',variant_id:'variant',set_type:'effective',set_number:setNumber,load_value:50,repetitions:reps,rir:2,rpe:8});
}
ok('Amostra sintética 16 sessões e 238 séries é válida',()=>assert.equal(validateDocument(old),true));
const batch=stageInbound(old,synthetic);
ok('Importação 16/238 não acrescenta treino nem série histórica',()=>assert.deepEqual([batch.add.sessions,batch.add.sets],[0,0]));
ok('Importação 16/238 mantém totais e vincula referências',()=>assert.deepEqual([batch.next.overlay.sessions.length,batch.next.overlay.sets.length,batch.linked_legacy_sets],[16,238,238]));
ok('Reimportar 16/238 é idempotente',()=>assert.equal(stageInbound(batch.next,synthetic).add.sets,0));
ok('16/238 reconciliados não entram na fila de envio',()=>assert.deepEqual(planOutbound(batch.next,synthetic),{Treinos:[],Series:[],Peso:[]}));
console.log('ETAPA1_DEDUP_TESTS='+checks);
