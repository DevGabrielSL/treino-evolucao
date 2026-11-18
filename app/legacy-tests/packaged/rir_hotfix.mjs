// Extraído do workflow antigo (etapa v1.0.1): importação de RIR em faixa.
import assert from 'node:assert/strict';
import {emptyDocument,validateDocument} from '../store.js';
import {stageInbound,previewRemote,planOutbound,parseReportedRir} from '../sheet_sync_core.js';
let n=0;const ok=(label,f)=>{f();n++;console.log('PASS '+label);};
for(const [raw,want] of [['1-2',1.5],['1 – 2',1.5],['2,5-3',2.75],['2',2]]){
ok('RIR '+raw,()=>assert.equal(parseReportedRir(raw).value,want));
}
ok('RIR ausente',()=>assert.equal(parseReportedRir('').value,null));
ok('RIR invertido bloqueado',()=>assert.throws(()=>parseReportedRir('3-1'),/RIR inválido/));
const data={
Treinos:[['Data','Dia','Sessão','Status']],
Series:[['Data','Sessão','Exercício','Equipamento / variação','Tipo','Série','Carga','Unidade','Reps','RIR']],
Peso:[['Data','Peso (kg)','Meta (kg)'],['2026-08-24','88','79,9']]
};
const sessions=[];
for(let i=0;i<16;i++){const date=new Date(Date.UTC(2026,7,24+i*3)).toISOString().slice(0,10),name='Treino '+i;sessions.push({date,name});data.Treinos.push([date,'Segunda',name,'Concluído']);}
for(let i=0;i<238;i++){const s=sessions[Math.floor(i/15)%16],row=i+2;data.Series.push([s.date,s.name,'Supino','Barra','Efetiva',i%3+1,50,'kg',10,[79,86,87].includes(row)?'1-2':'2']);}
const before=emptyDocument(),result=stageInbound(before,data);
ok('Importar 16 sessões',()=>assert.equal(result.add.sessions,16));
ok('Importar 238 séries',()=>assert.equal(result.add.sets,238));
ok('Preservar pesagem',()=>assert.equal(result.add.weigh_ins,1));
ok('Três faixas RIR estimadas',()=>assert.equal(result.next.overlay.sets.filter(s=>s.provenance.rir_estimated_midpoint).length,3));
ok('Texto exato preservado',()=>assert.ok(result.next.overlay.sets.filter(s=>s.provenance.rir_estimated_midpoint).every(s=>s.provenance.rir_reported_text==='1-2'&&s.rir===1.5)));
ok('Estado validado',()=>assert.equal(validateDocument(result.next),true));
ok('Nada duplicado na reimportação',()=>assert.deepEqual(previewRemote(result.next,data).counts,{Treinos:0,Series:0,Peso:0}));
ok('Nada antigo enviado ao servidor',()=>assert.deepEqual(planOutbound(result.next,data),{Treinos:[],Series:[],Peso:[]}));
ok('Importação repetida estável',()=>assert.equal(stageInbound(result.next,data).add.sets,0));
console.log('SHEETS_RIR_HOTFIX_TESTS='+n);
