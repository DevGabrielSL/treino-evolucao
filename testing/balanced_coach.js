/* Test-only workout composition. Suggestions do not prescribe loads or sets. */
const normalize=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const rules=[
 ['costas',/puxad|remada|barra fixa|pullover/],['peito',/supino|crucifixo(?! inverso)|voador(?! inverso)|peck deck(?! inverso)|chest press/],
 ['ombros',/desenvolvimento|elevacao lateral|elevacao frontal|voador inverso|face pull|crucifixo inverso/],
 ['triceps',/triceps|rosca francesa|extensao de braco/],['biceps',/rosca(?! francesa)|biceps/],
 ['pernas',/agachamento|leg press|extensora|flexora|stiff|panturrilha|adutora|abdutora|afundo|levantamento terra|elevacao pelvica/],
 ['core',/prancha|abdominal|pallof|bird dog|dead bug/]
];
const catalog=[
 ['costas','Puxada alta','Máquina','kg'],['costas','Remada baixa','Máquina','kg'],['costas','Remada com apoio no peito','Máquina','kg/lado'],['costas','Pullover na polia','Polia','kg'],['costas','Remada unilateral','Halter','kg/halter'],
 ['triceps','Tríceps na polia','Polia','kg'],['triceps','Tríceps acima da cabeça','Polia','kg'],['triceps','Tríceps testa','Halteres','kg/halter'],
 ['ombros','Elevação lateral','Halteres','kg/halter'],['ombros','Voador inverso','Máquina','kg'],['ombros','Desenvolvimento de ombros','Halteres','kg/halter'],
 ['peito','Supino reto','Máquina','kg'],['peito','Supino inclinado','Máquina','kg'],['peito','Voador','Máquina','kg'],['peito','Crucifixo na polia','Polia','kg'],
 ['biceps','Rosca direta','Halteres','kg/halter'],['biceps','Rosca martelo','Halteres','kg/halter'],
 ['pernas','Leg press','Máquina','kg'],['pernas','Cadeira extensora','Máquina','kg'],['pernas','Mesa flexora','Máquina','kg'],['pernas','Elevação pélvica','Máquina','kg'],
 ['core','Prancha frontal','Peso corporal','peso corporal'],['core','Bird dog','Peso corporal','peso corporal'],['core','Abdominal','Peso corporal','peso corporal']
].map(([group,name,equipment,unit],i)=>({group,name,equipment,unit,exercise_id:'balanced_ex_'+i,variant_id:'balanced_var_'+i,is_catalog:true,last:null}));
const complementary={costas:['triceps','ombros'],peito:['biceps','ombros'],pernas:['ombros','biceps'],ombros:['triceps','biceps'],biceps:['costas','ombros'],triceps:['peito','ombros'],core:[]};
const label={costas:'costas',peito:'peito',pernas:'pernas',ombros:'ombros',biceps:'bíceps',triceps:'tríceps',core:'core'};
export function classifyExercise(ex){
 const n=normalize(ex?.name);if(/voador inverso|crucifixo inverso|face pull/.test(n))return 'ombros';
 const verified=normalize(ex?.muscle_group);if(ex?.classification_verified&&label[verified])return verified;
 return rules.find(([,pattern])=>pattern.test(n))?.[0]||null;
}
// Calendar-day windows avoid UTC shifts and do not infer physiological recovery.
export function analyzeHistory(entities,today=new Date().toLocaleDateString('en-CA')){
 const day=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return NaN;const t=Date.parse(value+'T12:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value?t/86400000:NaN};
 const now=day(today);if(!Number.isFinite(now))throw new Error('Data de análise inválida.');
 const groups=Object.fromEntries(Object.keys(label).map(g=>[g,{direct:0,indirect:0,last:null,sessions:0}]));
 const sessions=new Map((entities.sessions||[]).filter(s=>s.status==='completed').map(s=>[s.id,s]));
 const variants=new Map((entities.exercise_variants||[]).map(v=>[v.id,v]));
 const exercises=new Map((entities.exercises||[]).map(e=>[e.id,e]));
 const seen=new Set(),visits=new Set();let unknown=0,invalid=0,total=0;
 for(const s of entities.sets||[]){
  const session=sessions.get(s.session_id);if(!session||s.set_type==='warmup')continue;
  const age=now-day(session.date);if(!Number.isFinite(age)||s.date!==session.date){invalid++;continue;}if(age<0||age>=7)continue;
  if(s.id&&seen.has(s.id))continue;if(s.id)seen.add(s.id);
  const v=variants.get(s.variant_id),ex=exercises.get(v?.exercise_id);if(!ex||s.exercise_id!==ex.id){invalid++;continue;}
  const group=classifyExercise(ex);if(!group){unknown++;continue;}
  total++;const g=groups[group];g.direct++;g.last=!g.last||session.date>g.last?session.date:g.last;
  const key=session.id+':'+group;if(!visits.has(key)){visits.add(key);g.sessions++;}
  // Secondary participation is kept separate: never converted into effective sets.
  const name=normalize(ex.name);let secondary=[];
  if(group==='costas'&&/remada|puxad|barra fixa/.test(name))secondary=['biceps'];
  if(group==='peito'&&/supino|chest press/.test(name))secondary=['triceps','ombros'];
  if(group==='ombros'&&/desenvolvimento/.test(name))secondary=['triceps'];
  for(const x of secondary)groups[x].indirect++;
 }
 const recent=Object.keys(groups).filter(g=>groups[g].last&&now-day(groups[g].last)<=1);
 return {today,groups,total,unknown,invalid,recent};
}
export function historySummary(h){
 const rows=Object.entries(h.groups).map(([g,x])=>`${label[g]}: ${x.direct} diretas, ${x.indirect} participações secundárias${x.last?', último '+x.last:''}`).join('; ');
 return `Últimos 7 dias (incluindo hoje), séries registradas sem aquecimento: ${rows}. `+
  (h.total?'Complementos ordenados por menor quantidade de séries diretas; isso não define uma meta de volume. ':'Sem séries classificadas nesse período; mantive a composição padrão. ')+
  (h.recent.length?'Treinados hoje ou ontem: '+h.recent.map(g=>label[g]).join(', ')+'. Confira como se sente antes de repetir. ':'')+
  ` ${h.unknown} séries sem classificação; ${h.invalid} registros inconsistentes ignorados. Participação secundária não equivale a série direta. O histórico disponível neste aparelho não comprova recuperação nem ausência de treino.`;
}
export function readinessAdjustment(report={}){
 const fatigue=report.fatigue??'unknown',recovery=report.recovery??'unknown',pain=report.pain??'unknown';
 if(!['unknown','low','moderate','high'].includes(fatigue)||!['unknown','good','partial','poor'].includes(recovery)||!['unknown','no','yes'].includes(pain))throw new Error('Relato de recuperação inválido.');
 const area=report.area??'all';if(area!=='all'&&!label[area])throw new Error('Grupo do relato inválido.');
 const blocked=pain==='yes';const reduced=fatigue==='moderate'||fatigue==='high'||recovery==='partial'||recovery==='poor';
 const cap=fatigue==='high'||recovery==='poor'?4:reduced?6:8;
 const summary=blocked?'Você informou dor ou desconforto durante o movimento. Não vou montar um treino para contornar esse sintoma. Interrompa o movimento doloroso e procure orientação profissional.':
  reduced?'Seu relato pediu uma proposta mais curta: limite de '+cap+' exercícios. É uma regra conservadora do app, não uma medida de recuperação. Ajuste o esforço durante o treino; a carga anterior é apenas referência.':
  fatigue==='unknown'&&recovery==='unknown'?'Cansaço e recuperação não informados: não presumi que você esteja recuperado.':'Mantive a quantidade padrão conforme seu relato, sem aumentar carga ou presumir recuperação completa.';
 return {fatigue,recovery,pain,area,blocked,reduced,cap,summary};
}
export function balancedPlan(entities,requested,message='',{ranker=null,today,readiness={}}={}){
 const adjustment=readinessAdjustment(readiness);
 const input=normalize(message),excluded=new Set();
 for(const [id,word] of Object.entries(label)){const term=id==='ombros'?'ombros?':id==='pernas'?'pernas?':normalize(word);if(new RegExp('\\b(?:sem|nao quero|nao treinar)\\s+(?:o\\s+|os\\s+)?'+term+'\\b').test(input))excluded.add(id);}
 const groupWords={costas:/\b(?:costas|dorsais?|back)\b/,peito:/\b(?:peito|peitoral|chest)\b/,pernas:/\b(?:pernas?|quadriceps|posterior|inferior|coxa)\b/,ombros:/\b(?:ombros?|deltoides?)\b/,biceps:/\b(?:biceps|bicep)\b/,triceps:/\b(?:triceps|tricep)\b/,core:/\b(?:core|abdomen|abdominal|abdome)\b/};
 const groups=[...new Set(requested)].filter(g=>label[g]&&!excluded.has(g));
 groups.sort((a,b)=>{const ai=input.search(groupWords[a]),bi=input.search(groupWords[b]);return (ai<0?Infinity:ai)-(bi<0?Infinity:bi)});
 if(!groups.length)throw new Error('Informe pelo menos um grupo que deseja treinar.');
 const only=/\b(?:so|somente|apenas)\s+(?:(?:quero|vou)\s+)?(?:treinar\s+)?(?:costas|peito|pernas|ombros?|biceps|triceps|core)\b/.test(input);
 const tm=input.match(/\b(\d{1,3})\s*(?:min(?:utos?)?|m)\b/);const mins=tm?Number(tm[1]):null;
 if(mins!==null&&(mins<10||mins>240))throw new Error('Informe um tempo entre 10 e 240 minutos.');
 const budget=Math.min(adjustment.cap,mins===null?8:mins<=30?4:mins<=45?5:mins<=60?6:8);
 const history=analyzeHistory(entities,today);
 const focus=groups[0],complements=[...(complementary[focus]||[])];
 if(history.total)complements.sort((a,b)=>history.groups[a].direct-history.groups[b].direct);
 const pool=only?[...groups]:[...groups,...complements,'core'];
 // A specific poorly recovered area is omitted as a complement, never silently replaces the requested focus.
 if(adjustment.reduced&&adjustment.area!=='all'&&!groups.includes(adjustment.area))excluded.add(adjustment.area);
 const order=[...new Set(pool)].filter(x=>!excluded.has(x));
 let slots=[];
 if(groups.length===1&&!only&&focus==='costas'&&budget===8&&!excluded.has('triceps')&&!excluded.has('ombros')&&!excluded.has('core'))slots=['costas','costas','costas','costas',complements[0],complements[0],complements[1],'core'];
 else if(only)slots=Array.from({length:budget},(_,i)=>groups[i%groups.length]);
 else {const core=order.includes('core')&&focus!=='core';const target=core?budget-1:budget;const primary=Math.min(target,Math.max(1,Math.ceil(target/2)));slots=Array(primary).fill(focus);let others=order.filter(g=>g!==focus&&g!=='core');for(let i=slots.length;i<target;i++)slots.push(others.length?others[(i-primary)%others.length]:focus);if(core)slots.push('core');}
 const exMap=new Map((entities.exercises||[]).map(e=>[e.id,e]));
 const completed=new Set((entities.sessions||[]).filter(x=>x.status==='completed').map(x=>x.id));
 const last=new Map();for(const s of entities.sets||[]){if(!completed.has(s.session_id)||!s.variant_id)continue;let old=last.get(s.variant_id);if(!old||String(s.date||'')>String(old.date||'')||s.date===old.date&&(s.set_number||0)>=(old.set_number||0))last.set(s.variant_id,s);}
 const known=[];for(const v of entities.exercise_variants||[]){let ex=exMap.get(v.exercise_id),group=classifyExercise(ex);if(!ex||!group)continue;let verdict=typeof ranker==='function'?ranker(ex,v):null;if(verdict?.blocked)continue;let recent=last.get(v.id);known.push({group,name:ex.name,equipment:v.equipment_or_variation||'',unit:v.unit||'',exercise_id:ex.id,variant_id:v.id,is_catalog:false,last:recent?{load_value:recent.load_value,repetitions:recent.repetitions,rir:recent.rir,date:recent.date}:null,bonus:Number(verdict?.bonus)||0});}
 known.sort((a,b)=>b.bonus-a.bonus||String(b.last?.date||'').localeCompare(String(a.last?.date||''))||a.name.localeCompare(b.name,'pt-BR'));
 const candidates=[...known,...catalog.filter(x=>{let verdict=typeof ranker==='function'?ranker({name:x.name},{equipment_or_variation:x.equipment,unit:x.unit}):null;return !verdict?.blocked;})];
 if(adjustment.blocked)return {groups,items:[],minutes:mins,budget:0,only,excluded:[...excluded],short:0,options:[],history,adjustment};
 const used=new Set(),items=[];for(const group of slots){const c=candidates.find(x=>x.group===group&&!used.has(normalize(x.name)));if(c){items.push({...c});used.add(normalize(c.name));}}
 const short=slots.length-items.length;return {groups,items,minutes:mins,budget,only,excluded:[...excluded],short,options:candidates,history,adjustment};
}
export function replacementFor(plan,index){
 const current=plan.items[index];if(!current)return null;
 const used=new Set(plan.items.map(x=>normalize(x.name)));const candidates=plan.options.filter(x=>x.group===current.group&&!used.has(normalize(x.name)));
 return candidates[0]||null;
}
export function catalogEntities(items){
 const exercises=[],variants=[];for(const x of items.filter(x=>x.is_catalog)){exercises.push({id:x.exercise_id,name:x.name,muscle_group:x.group,classification_verified:false,notes:'Sugestão inicial para testes; ajuste o equipamento antes de registrar.'});variants.push({id:x.variant_id,exercise_id:x.exercise_id,equipment_or_variation:x.equipment,unit:x.unit,unit_confirmed:false,comparison_policy:'match_same_variant_only'});}return {exercises,variants};
}
