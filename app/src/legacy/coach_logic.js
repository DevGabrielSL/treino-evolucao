import {expandArmRequest} from './principal_intent.js';
/* Treino & Evolução: assistente local baseado no histórico.
 * Sem API paga, sem envio de conversas, sem novos dados pessoais no código.
 */
const normalize=v=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const GROUPS=[
 {id:'peito',label:'Peito',words:/\b(peito|peitoral|chest)\b/,patterns:[/supino/,/crucifixo/,/voador(?! inverso)/,/peck deck(?! inverso)/,/chest press/,/press de peito/]},
 {id:'costas',label:'Costas',words:/\b(costas|dorsal|dorsais|back)\b/,patterns:[/puxad/,/remada/,/barra fixa/,/pullover/,/voador inverso/,/face pull/]},
 {id:'ombros',label:'Ombros',words:/\b(ombros?|deltoides?)\b/,patterns:[/desenvolvimento/,/elevacao lateral/,/elevacao frontal/,/voador inverso/,/face pull/,/crucifixo inverso/]},
 {id:'biceps',label:'Bíceps',words:/\b(biceps|bicep)\b/,patterns:[/rosca/,/biceps/]},
 {id:'triceps',label:'Tríceps',words:/\b(triceps|tricep)\b/,patterns:[/triceps/,/testa/]},
 {id:'pernas',label:'Pernas',words:/\b(pernas?|quadriceps|posterior|inferior|coxa)\b/,patterns:[/agachamento/,/leg press/,/extensora/,/flexora/,/stiff/,/panturrilha/,/adutora/,/abdutora/,/afundo/]},
 {id:'core',label:'Core/abdômen',words:/\b(core|abdomen|abdominal|abdome)\b/,patterns:[/prancha/,/abdominal/,/pallof/,/bird dog/,/dead bug/]}
];
export function parseGoal(message){
 const input=normalize(expandArmRequest(message));
 const groups=GROUPS.filter(g=>g.words.test(input)).map(g=>g.id);
 if(!groups.length)throw new Error('Não reconheci o grupo muscular. Experimente: Hoje quero treinar peito, costas, pernas, ombros, braços, bíceps, tríceps ou core.');
 return groups;
}
export function groupLabel(ids){return ids.map(id=>GROUPS.find(g=>g.id===id)?.label||id).join(' + ');}
export function suggestExercises(entities,groups,{limit=6,ranker=null}={}){
 const requested=groups.map(id=>GROUPS.find(g=>g.id===id)).filter(Boolean);
 if(!requested.length)throw new Error('Escolha pelo menos um grupo muscular.');
 const exercises=new Map((entities.exercises||[]).map(e=>[e.id,e]));
 const completed=new Set((entities.sessions||[]).filter(s=>s.status==='completed').map(s=>s.id));
 const sets=(entities.sets||[]).filter(s=>completed.has(s.session_id)&&s.variant_id);
 const last=new Map();
 for(const s of sets){const prev=last.get(s.variant_id);if(!prev||s.date>prev.date||(s.date===prev.date&&(s.set_number||0)>=(prev.set_number||0)))last.set(s.variant_id,s);}
 const candidates=[];
 for(const v of entities.exercise_variants||[]){
  const exercise=exercises.get(v.exercise_id);if(!exercise)continue;
  const name=normalize(exercise.name);
  const scores=requested.map((g,i)=>{
    const positions=g.patterns.map((p,n)=>p.test(name)?n:-1).filter(n=>n>=0);
    return positions.length?100-i*5-Math.min(...positions)*8:-Infinity;
  });
  const score=Math.max(...scores);if(!Number.isFinite(score))continue;
  const decision=typeof ranker==='function'?ranker(exercise,v):null;
  if(decision?.blocked)continue;
  const adjustedScore=score+(Number.isFinite(decision?.bonus)?decision.bonus:0);
  const recent=last.get(v.id);
  candidates.push({variant_id:v.id,exercise_id:exercise.id,name:exercise.name,equipment:v.equipment_or_variation||'',unit:v.unit||'reps',score:adjustedScore,hasHistory:!!recent,last:recent?{load_value:recent.load_value,repetitions:recent.repetitions,rir:recent.rir,date:recent.date}:null});
 }
 // Keep only one equipment variant per exercise, choosing the one with recent completed history.
 const choices=new Map();
 for(const c of candidates){const key=normalize(c.name),old=choices.get(key);if(!old||c.score>old.score||(c.score===old.score&&((c.last?.date||'')>(old.last?.date||''))))choices.set(key,c);}
 const selected=[...choices.values()].sort((a,b)=>b.score-a.score||(b.last?.date||'').localeCompare(a.last?.date||'')||a.name.localeCompare(b.name,'pt-BR'));
 // For multi-group requests, include at least one recognized exercise from each group when present.
 const initial=[];
 for(const group of requested){const found=selected.find(c=>group.patterns.some(p=>p.test(normalize(c.name)))&&!initial.some(x=>x.variant_id===c.variant_id));if(found)initial.push(found);}
 for(const c of selected){if(initial.length>=Math.max(1,Math.min(9,limit)))break;if(!initial.some(x=>x.variant_id===c.variant_id))initial.push(c);}
 return initial.slice(0,Math.max(1,Math.min(9,limit)));
}
const num=raw=>Number(String(raw).replace(',','.'));
const numberPattern='(\\d+(?:[.,]\\d+)?)';
const UNIT_RE=/\b(kg\s*\/\s*lado|kg\s*\/\s*halter|quilos?\s*\/\s*lado|plaquetas?|kg|quilos?|peso corporal)\b/i;
function unitKey(s){const n=normalize(s).replace(/\s/g,'');if(/plaqueta/.test(n))return 'plaquetas';if(/\/lado/.test(n))return 'kg/lado';if(/\/halter/.test(n))return 'kg/halter';if(/kg|quilo/.test(n))return 'kg';if(/pesocorporal/.test(n))return 'peso corporal';return null;}
export function parseSeriesMessage(message,expectedUnit='kg'){
 const src=normalize(message).replace(/\u00d7/g,'x');
 // Validate full numeric tokens before the legacy parser can match a suffix.
 let checked=src;
 const rirTokens=[...src.matchAll(/\brir\s*[:=]?\s*([+-]?\d+(?:[.,]\d+)?)(?:\s*[-–—]\s*([+-]?\d+(?:[.,]\d+)?))?(?![\w.,])/g)];
 if(/\brir\b/.test(src)&&rirTokens.length!==1)throw new Error('Informe um RIR válido entre 0 e 10.');
 for(const m of rirTokens){const low=Number(m[1].replace(',','.')),high=m[2]===undefined?low:Number(m[2].replace(',','.'));if(low<0||high>10||high<low)throw new Error('RIR deve estar entre 0 e 10 e a faixa deve ser crescente.');checked=checked.replace(m[0],' ');}
 if(/(^|[\s:=])[-−]\s*\d/.test(checked))throw new Error('Carga ou repetições negativas não são permitidas.');
 for(const m of checked.matchAll(/(?<![\d.,])([+-]?\d+(?:[.,]\d+)?)\s*(?:reps?|repetic(?:oes|ao))\b/g))if(/[.,]/.test(m[1])||!Number.isInteger(Number(m[1].replace(',','.'))))throw new Error('Repetições devem ser inteiras.');
 for(const m of checked.matchAll(/\b\d+(?:[.,]\d+)?\s*x\s*([+-]?\d+(?:[.,]\d+)?)/g))if(/[.,]/.test(m[1])||!Number.isInteger(Number(m[1].replace(',','.'))))throw new Error('Repetições devem ser inteiras.');
 if(/(?<![a-z])(?:lb|lbs|pounds?|libras?|g|gramas?)\b/.test(checked))throw new Error('Unidade incompatível ou não suportada.');
 if(/[\d][.,]\d+[.,]\d/.test(src))throw new Error('Número ambíguo. Confira a entrada.');

 if(!src||src.length>280)throw new Error('Envie uma série curta: por exemplo, 50 kg, 10 reps, RIR 2.');
 if(/\b(concluir|finalizar|proximo|trocar|peito|costas|ombro)\b/.test(src)&&!/[0-9]/.test(src))throw new Error('Use os botões para trocar exercício ou concluir treino.');
 const rirMatch=src.match(/\b(?:rir|rep(?:etic(?:oe|o)es?)?s?\s+em\s+reserva)\s*[:=]?\s*(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\b/);
 const rir=rirMatch?rirMatch[2]?(num(rirMatch[1])+num(rirMatch[2]))/2:num(rirMatch[1]):null;
 if(rir!==null&&(!Number.isFinite(rir)||rir<0||rir>10||rirMatch?.[2]&&num(rirMatch[2])<num(rirMatch[1])))throw new Error('RIR deve estar entre 0 e 10 e a faixa deve ser crescente.');
 let cleaned=rirMatch?src.replace(rirMatch[0],' '):src;
 const repsMatch=cleaned.match(/\b(\d{1,3})\s*(?:reps?|repetic(?:oes|ao))\b/);
 const loadMatch=cleaned.match(new RegExp(numberPattern+'\\s*(?:kg\\s*\\/\\s*lado|kg\\s*\\/\\s*halter|plaquetas?|kg|quilos?|peso corporal)\\b','i'));
 const compact=cleaned.match(/\b(\d+(?:[.,]\d+)?)\s*[x]\s*(\d{1,3})\b/);
 let load=loadMatch?num(loadMatch[1]):null,reps=repsMatch?Number(repsMatch[1]):null;
 if(compact){if(load===null)load=num(compact[1]);if(reps===null)reps=Number(compact[2]);}
 // Allow positional '50 10 rir 2' only with a clear explicit separator.
 if(load===null||reps===null)throw new Error('Informe carga e repetições de forma clara: "50 kg 10 reps RIR 2" ou "50 x 10 RIR 2".');
 if(!Number.isFinite(load)||load<0||load>10000||!Number.isInteger(reps)||reps<1||reps>500)throw new Error('Carga ou repetições fora dos limites permitidos.');
 const typedUnit=unitKey(loadMatch?.[0].replace(/^\s*[0-9.,]+\s*/,''));const expected=unitKey(expectedUnit);
 if(typedUnit&&expected&&typedUnit!==expected)throw new Error('Unidade incompatível: este exercício usa '+expectedUnit+'. Informe a carga nessa unidade.');
 const warmup=/\b(aquecimento|warmup)\b/.test(src),drop=/\b(drop\s*set|dropset)\b/.test(src);
 return {load_value:load,repetitions:reps,rir,set_type:warmup?'warmup':drop?'drop_set':'effective',notes:rirMatch?.[2]?'RIR informado: '+rirMatch[1]+'-'+rirMatch[2]:null,unit:expectedUnit};
}
