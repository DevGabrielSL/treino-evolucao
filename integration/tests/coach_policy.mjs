import assert from 'node:assert/strict';
import {buildCoachPolicy} from '../../dist/coach_policy.js';
import {parseGoal,suggestExercises,parseSeriesMessage} from '../../dist/coach_logic.js';
let n=0;const test=(name,fn)=>{fn();n++;console.log('PASS '+name)};
const base=()=>({
 plan_parameters:[{parameter:'Frequência base',value:'4 sessões de força por semana'},{parameter:'Prioridades',value:'Estética de ombros e core'}],
 training_rules:[
  {rule:'RIR alvo geral',application:'2–3 inicialmente, sem falha improvisada'},
  {rule:'Progressão',application:'Subir reps dentro da faixa antes de aumentar carga'},
  {rule:'Máquinas',application:'Não comparar plaquetas entre equipamentos diferentes'},
  {rule:'Core',application:'Prancha frontal e abdominal infra conforme tolerância. Bird dog, dead bug, Pallof e abdominal reverso fora do programa.'},
  {rule:'Ordem',application:'Se bíceps e ombro coincidirem, fazer bíceps antes.'},
  {rule:'Lombar',application:'Não treinar por cima de dor aguda, irradiada ou sintomas neurológicos'}
 ],
 weekly_schedule:[{day:'Segunda',session:'Peito prioritário'},{day:'Terça',session:'Costas prioritário'}],
 exercises:[
 {id:'ex-peck',name:'Voador'}, {id:'ex-incline',name:'Supino inclinado'},
 {id:'ex-shoulder',name:'Elevação lateral'}, {id:'ex-biceps',name:'Rosca direta'},
 {id:'ex-bird',name:'Bird dog'},{id:'ex-pallof',name:'Pallof press'},
 {id:'ex-dead',name:'Dead bug'}, {id:'ex-reverse',name:'Abdominal reverso'},
 {id:'ex-plank',name:'Prancha frontal'}, {id:'ex-abs',name:'Abdominal infra'},
 {id:'ex-pull',name:'Pullover'},{id:'ex-row',name:'Remada baixa'}
 ],
 exercise_variants:[],
 sessions:[{id:'s1',date:'2026-10-10',name:'Histórico sintético',status:'completed',notes:'Pullover removido por preferência.'}],
 sets:[]
});
function attach(e,name,unit='kg',equipment='Equipamento de teste'){
 const id=e.exercises.find(x=>x.name===name).id,vid='variant-'+id;
 e.exercise_variants.push({id:vid,exercise_id:id,equipment_or_variation:equipment,unit,unit_confirmed:true});
 return vid;
}
const src=base();src.exercises.forEach(x=>attach(src,x.name,x.name.includes('Prancha')?'reps':'kg'));
const policy=buildCoachPolicy(src),none=buildCoachPolicy({});
test('Reconhece metadados do planejamento',()=>assert.equal(policy.hasPlan,true));
test('RIR 2–3 extraído de regra e aplicação',()=>assert.deepEqual(policy.rirTarget,[2,3]));
test('Orientação de repetições presente',()=>assert.ok(policy.notes.some(s=>s.includes('repetições'))));
test('RIR exibido em nota',()=>assert.ok(policy.notes.some(s=>s.includes('RIR'))));
test('Máquinas têm unidades isoladas',()=>assert.ok(policy.notes.some(s=>s.includes('plaquetas'))));
test('Lombar exige cautela sem diagnóstico automático',()=>assert.ok(policy.notes.some(s=>s.includes('dor aguda'))));
test('Bird dog explicitamente excluído',()=>assert.ok(policy.excluded.includes('bird dog')));
test('Dead bug explicitamente excluído',()=>assert.ok(policy.excluded.includes('dead bug')));
test('Pallof explicitamente excluído',()=>assert.ok(policy.excluded.includes('pallof')));
test('Abdominal reverso explicitamente excluído',()=>assert.ok(policy.excluded.includes('abdominal reverso')));
test('Pullover removido em nota recente fica excluído',()=>assert.ok(policy.excluded.includes('pullover')));
test('Prancha frontal continua permitida',()=>assert.equal(policy.evaluate(src.exercises.find(x=>x.name==='Prancha frontal')).blocked,false));
test('Abdominal infra continua permitido',()=>assert.equal(policy.evaluate(src.exercises.find(x=>x.name==='Abdominal infra')).blocked,false));
test('Nome acentuado é comparado sem depender de acento',()=>assert.equal(policy.evaluate({name:'ABDOMINAL REVERSO'}).blocked,true));
test('Exclusão ocorre antes de calcular exercício escolhido',()=>assert.equal(policy.evaluate({name:'Bird dog'}).blocked,true));
test('Plano não vazio não altera registros originais',()=>assert.equal(src.exercises.length,12));
test('Bíceps vem antes de ombros quando ambos pedidos',()=>assert.deepEqual(policy.orderGroups(['ombros','biceps']),['biceps','ombros']));
test('Demais combinações preservam ordem',()=>assert.deepEqual(policy.orderGroups(['peito','costas']),['peito','costas']));
test('Pedido explícito de peito é reconhecido',()=>assert.deepEqual(parseGoal('Hoje quero treinar PEITO'),['peito']));
const choice=suggestExercises(src,['peito'],{limit:5,ranker:policy.evaluate});
test('Peito mantém sugestões válidas',()=>assert.ok(choice.length>=2));
test('Peito não inclui exercício de core',()=>assert.ok(choice.every(x=>/voador|supino/i.test(x.name))));
test('Roteiro de core ignora os excluídos',()=>assert.deepEqual(suggestExercises(src,['core'],{limit:5,ranker:policy.evaluate}).map(x=>x.name).sort(),['Abdominal infra','Prancha frontal']));
test('Pullover removido não aparece nas costas',()=>assert.ok(!suggestExercises(src,['costas'],{limit:5,ranker:policy.evaluate}).some(x=>x.name==='Pullover')));
test('Sem plano o seletor preserva comportamento anterior',()=>assert.ok(suggestExercises(src,['costas'],{limit:5,ranker:none.evaluate}).some(x=>x.name==='Pullover')));
const favor=buildCoachPolicy(src,{preferred_exercises:['Supino inclinado']});
test('Preferência explícita adiciona bônus',()=>assert.ok(favor.evaluate({name:'Supino inclinado'}).bonus>policy.evaluate({name:'Supino inclinado'}).bonus));
test('Preferência explícita prioriza exercício do grupo',()=>assert.equal(suggestExercises(src,['peito'],{limit:2,ranker:favor.evaluate})[0].name,'Supino inclinado'));
const preferExcluded=buildCoachPolicy(src,{preferred_exercises:['Bird dog']});
test('Exclusão do Plano prevalece sobre preferência',()=>assert.equal(preferExcluded.evaluate({name:'Bird dog'}).blocked,true));
const custom=buildCoachPolicy(src,{excluded_exercises:['Supino inclinado']});
test('Exclusão definida pelo usuário é aplicada',()=>assert.equal(custom.evaluate({name:'Supino inclinado'}).blocked,true));
test('Exclusão personalizada não remove voador',()=>assert.equal(custom.evaluate({name:'Voador'}).blocked,false));
const withHistory=base();withHistory.exercise_variants=[];withHistory.exercises=[{id:'ex-row',name:'Remada baixa'}];
withHistory.exercise_variants.push(
{id:'machine_a',exercise_id:'ex-row',equipment_or_variation:'Máquina A',unit:'plaquetas',unit_confirmed:true},
{id:'machine_b',exercise_id:'ex-row',equipment_or_variation:'Máquina B',unit:'plaquetas',unit_confirmed:true}
);
withHistory.sets=[
 {id:'set_a',session_id:'s1',variant_id:'machine_a',date:'2026-10-05',set_number:1,load_value:12,repetitions:10,rir:2},
 {id:'set_b',session_id:'s1',variant_id:'machine_b',date:'2026-10-10',set_number:1,load_value:5,repetitions:12,rir:1}
];
const rows=suggestExercises(withHistory,['costas'],{ranker:policy.evaluate});
test('Variação mais recente vence dentro do mesmo exercício',()=>assert.equal(rows[0].variant_id,'machine_b'));
test('Última carga é da máquina escolhida, não da outra',()=>assert.equal(rows[0].last.load_value,5));
test('Unidade permanece vinculada à variação selecionada',()=>assert.equal(rows[0].unit,'plaquetas'));
test('RIR informado pelo usuário é preservado',()=>assert.equal(parseSeriesMessage('5 plaquetas 12 reps RIR 2','plaquetas').rir,2));
test('Unidade incorreta continua rejeitada',()=>assert.throws(()=>parseSeriesMessage('60 kg 12 reps RIR 2','plaquetas'),/Unidade incompatível/));
const allBanned=buildCoachPolicy(src,{excluded_exercises:['Voador','Supino inclinado']});
test('Quando todos os exercícios foram excluídos, roteiro fica vazio',()=>assert.equal(suggestExercises(src,['peito'],{ranker:allBanned.evaluate}).length,0));
test('Plano vazio não inventa alvo de RIR',()=>assert.equal(none.rirTarget,null));
test('Plano vazio não inventa exclusões',()=>assert.deepEqual(none.excluded,[]));
test('Avaliação sem nome não quebra o app',()=>assert.equal(none.evaluate({}).blocked,false));
const malicious=buildCoachPolicy({training_rules:[{application:'Semaglutida 25 - 80 treino por cima' }]});
test('Intervalos estranhos sem indicação de RIR não criam alvo',()=>assert.equal(malicious.rirTarget,null));
console.log('ETAPA5_COACH_POLICY_TESTS='+n);
