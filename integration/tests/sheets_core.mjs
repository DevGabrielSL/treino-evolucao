import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readRowSets,previewRemote,planOutbound,stageInbound} from '../sheet_sync_core.js';
import {validateDocument} from '../../public/store.js';
let passes=0;const check=(msg,fn)=>{fn();passes++;console.log('PASS '+msg)};
function makeBase(){
 const date=i=>new Date(Date.UTC(2026,7,24+i*3)).toISOString().slice(0,10);
 const sessions=Array.from({length:15},(_,i)=>({id:'session_'+i,date:date(i),name:'Treino '+i,status:'completed',provenance:{sheet:'Treinos',row:i+2}}));
 const sets=Array.from({length:225},(_,i)=>({id:'set_'+i,date:sessions[Math.floor(i/15)].date,session_id:sessions[Math.floor(i/15)].id,exercise_id:'ex0',variant_id:'v0',set_type:'effective',set_number:i%3+1,load_value:50,repetitions:10,rir:2,provenance:{sheet:'Series',row:i+2}}));
 return {app:'treino-evolucao',schema_version:'2.0',entities:{sessions,sets,exercises:[{id:'ex0',name:'Supino'}],exercise_variants:[{id:'v0',exercise_id:'ex0',equipment_or_variation:'Barra',unit:'kg',unit_confirmed:true}],weigh_ins:[{id:'w0',date:date(0),weight_kg:88,provenance:{sheet:'Peso',row:2}}],goals:[],plan_parameters:[],training_rules:[],weekly_schedule:[]}};
}
const base=process.env.HISTORY_FIXTURE?JSON.parse(fs.readFileSync(process.env.HISTORY_FIXTURE,'utf8')):makeBase();
const doc={format:'treino-evolucao-android-v1',version:1,base,overlay:{exercises:[],exercise_variants:[],sessions:[],sets:[],weigh_ins:[]},settings:{weekly_goal:4,templates:[]},revision:0,last_backup_revision:0};
const t0=['Data','Dia','Sessão','Status','Duração (min)','Peso (kg)','Dor lombar antes (0-10)','Dor lombar depois (0-10)','Observações'];
const s0=['Data','Sessão','Exercício','Equipamento / variação','Tipo','Série','Carga','Unidade','Reps','RIR','RPE','Índice de volume','Dor / desconforto','Observações'];
const w0=['Data','Peso (kg)','Meta (kg)','Variação desde início (kg)','Restante até meta (kg)','Observações'];
const legacyRows=(n,dates)=>Array.from({length:n},(_,i)=>[dates[i]||'2026-10-20']);
// A realistic fixture preserves row positions for the imported 15 sessions and 225 sets.
const treinos=[t0,...base.entities.sessions.map(s=>[s.date,s.weekday_reported,s.name,'Concluído','','','','',s.notes])];
const sets=[s0,...base.entities.sets.map(s=>{
 const session=base.entities.sessions.find(x=>x.id===s.session_id),ex=base.entities.exercises.find(x=>x.id===s.exercise_id),v=base.entities.exercise_variants.find(x=>x.id===s.variant_id);
 return [s.date,session.name,ex.name,v.equipment_or_variation,s.set_type==='effective'?'Efetiva':'Aquecimento',s.set_number,s.load_value,v.unit,s.repetitions,s.rir,s.rpe,s.legacy_volume_index,s.discomfort,s.notes];
})];
const weights=[w0,...base.entities.weigh_ins.map(w=>[w.date,w.weight_kg,w.goal_weight_kg_reported,'','',w.notes])];
const raw={Treinos:treinos,Series:sets,Peso:weights};
check('A base histórica já importada não gera novidades',()=>assert.deepEqual(previewRemote(doc,raw).counts,{Treinos:0,Series:0,Peso:0}));
check('Sem dados locais não há upload',()=>assert.deepEqual(planOutbound(doc,raw),{Treinos:[],Series:[],Peso:[]}));
const newDate='2026-10-22',newName='Costas + tríceps';
treinos.push([newDate,'Quinta',newName,'Concluído','','','','','Nova sessão da planilha']);
for(let i=0;i<13;i++)sets.push([newDate,newName,'Puxada frontal','Máquina', 'Efetiva',i%3+1,50,'kg',12,2,8,600,'','']);
check('Detectar atualização de 16 treinos e 238 séries',()=>assert.deepEqual(previewRemote(doc,raw).remoteCounts,{Treinos:16,Series:238,Peso:1}));
check('Detectar precisamente registros novos',()=>assert.deepEqual(previewRemote(doc,raw).counts,{Treinos:1,Series:13,Peso:0}));
let staged;
check('Ler sem sobrescrever histórico base',()=>{staged=stageInbound(doc,raw);assert.equal(staged.next.base.entities.sessions.length,15);assert.equal(staged.next.overlay.sessions.length,1);assert.equal(staged.next.overlay.sets.length,13);assert.equal(staged.next.overlay.sessions[0].date,newDate)});
check('Documento atualizado continua válido',()=>assert.equal(validateDocument(staged.next),true));
check('Reteste não importa duas vezes',()=>assert.deepEqual(previewRemote(staged.next,raw).counts,{Treinos:0,Series:0,Peso:0}));
check('Linha importada não volta para planilha',()=>assert.deepEqual(planOutbound(staged.next,raw),{Treinos:[],Series:[],Peso:[]}));
const draft=structuredClone(staged.next);draft.overlay.sessions.push({id:'app-session-001',date:'2026-10-23',name:'Superiores C',status:'completed'});
draft.overlay.sets.push({id:'app-set-001',date:'2026-10-23',session_id:'app-session-001',exercise_id:base.entities.exercises[0].id,variant_id:base.entities.exercise_variants.find(v=>v.exercise_id===base.entities.exercises[0].id).id,set_type:'effective',set_number:1,load_value:70,repetitions:10,rir:2});
draft.overlay.weigh_ins.push({id:'app-weight-001',date:'2026-10-23',weight_kg:87,notes:'pesagem'});
check('Preparar novas sessões e séries para anexação',()=>{const p=planOutbound(draft,raw);assert.equal(p.Treinos.length,1);assert.equal(p.Series.length,1);assert.equal(p.Peso.length,1);assert.equal(p.Treinos[0].values[9],'app-session-001');assert.equal(p.Series[0].values[14],'app-set-001');});
check('IDs já presentes nunca são reanexados',()=>{const copy={Treinos:[...treinos,[...planOutbound(draft,raw).Treinos[0].values]],Series:[...sets,[...planOutbound(draft,raw).Series[0].values]],Peso:[...weights,[...planOutbound(draft,raw).Peso[0].values]]};assert.equal(planOutbound(draft,copy).Series.length,0);assert.equal(planOutbound(draft,copy).Peso.length,0);assert.equal(planOutbound(draft,copy).Treinos.length,0)});
check('Bloquear conflito de sessão com mesma data/nome',()=>{const d=structuredClone(draft);d.overlay.sessions.push({id:'app-duplicate',date:newDate,name:newName,status:'completed'});assert.throws(()=>planOutbound(d,raw),/Conflito/)});
check('Impedir linhas sem cabeçalho esperado',()=>assert.throws(()=>readRowSets({...raw,Series:[['Inválido'],...sets.slice(1)]}),/Cabeçalho/));
check('Não aceitar data inválida',()=>{const bad=structuredClone(raw);bad.Treinos.push(['2026-02-30','Quinta','Bug','Concluído']);assert.throws(()=>previewRemote(doc,bad),/Data inválida/)});
console.log('SHEETS_SYNC_TESTS='+passes);