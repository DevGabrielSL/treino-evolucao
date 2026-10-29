import {analyzeHistory,readinessAdjustment} from './balanced_coach.js?v=121';
const norm=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
// Equipment descriptions are explicit. Machine load conventions must be confirmed by the user.
const registry={
 bench:['peito','Supino reto','Barra livre',8,12], inclineMachine:['peito','Supino inclinado','Máquina',8,12], inclineDB:['peito','Supino inclinado','Halteres',8,12,'kg/halter'], fly:['peito','Crucifixo de peito','Máquina inclinada com anilhas',10,15],
 curlCable:['biceps','Rosca direta','Polia',10,15], hammer:['biceps','Rosca martelo','Halteres',10,15,'kg/halter'], scott:['biceps','Rosca Scott','Máquina',10,15],
 lateral:['ombros','Elevação lateral','Halteres',12,20,'kg/halter'], lateralCable:['ombros','Elevação lateral','Polia',12,20], rear:['ombros','Crucifixo inverso','Máquina',12,20], press:['ombros','Desenvolvimento de ombros','Máquina',8,12],
 latNeutral:['costas','Puxada alta neutra','Polia alta',8,12], latPronated:['costas','Puxada alta pronada','Polia alta',8,12], rowSupport:['costas','Remada com apoio no peito','Máquina',8,12], rowOne:['costas','Remada unilateral','Polia',10,15], rowLow:['costas','Remada baixa neutra','Polia',8,12], rowMachine:['costas','Remada','Máquina',8,12],
 tri:['triceps','Tríceps','Polia',10,15], triOver:['triceps','Tríceps acima da cabeça','Polia',10,15],
 hack:['pernas','Agachamento hack','Máquina hack',8,12], leg:['pernas','Leg press','Máquina',10,15], extension:['pernas','Cadeira extensora','Máquina',12,15], flexLying:['pernas','Mesa flexora','Máquina',10,15], flexSeated:['pernas','Cadeira flexora','Máquina',10,15], rdl:['pernas','Levantamento romeno (stiff)','Halteres',8,12,'kg/halter'], hip:['pernas','Elevação pélvica','Máquina',8,12], lunge:['pernas','Afundo com apoio','Halteres',8,12,'kg/halter'], calfStanding:['pernas','Panturrilha em pé','Máquina',12,20], calfSeated:['pernas','Panturrilha sentada','Máquina',12,20], goblet:['pernas','Agachamento goblet','Halter',8,12,'kg/halter'],
 absCable:['core','Abdominal','Polia',10,15], absMachine:['core','Abdominal','Máquina',10,15], reverse:['core','Abdominal reverso','Peso corporal',10,15,'peso corporal']
};
const spec=(id,name,items,note='')=>({id:'rpg_deck_'+id,name,items,note});
export const PRESET_DECKS=[
 spec('01','Peito + bíceps + ombros + core',['bench','inclineMachine','fly',['curlCable',10,12],'hammer','lateral','absCable']),
 spec('02','Costas + tríceps + ombro posterior + core',['latNeutral','rowSupport','rowOne','tri','triOver','rear','reverse']),
 spec('03','Quadríceps + panturrilhas + core',['hack','leg','extension','flexLying',['calfStanding',10,20],'absMachine']),
 spec('04','Posteriores + glúteos + panturrilhas + core',['rdl','hip','flexSeated','lunge','calfSeated','reverse'],'Romeno e afundo exigem familiaridade com a técnica; no afundo, repetições por perna.'),
 spec('05','Empurrar: peito + ombros + tríceps + core',['bench','inclineDB','press','lateralCable','tri','absCable']),
 spec('06','Puxar: costas + bíceps + ombro posterior + core',['latPronated','rowLow',['rowSupport',10,12],'rear','scott','reverse']),
 spec('07','Pernas completas + core',['hack','rdl','leg','flexSeated','calfStanding','absMachine']),
 spec('08','Superiores A: ênfase em peito',['inclineDB','bench','rowSupport',['latNeutral',10,12],'lateral','tri','absCable']),
 spec('09','Superiores B: ênfase em costas',['latNeutral','rowSupport','rowOne','bench','rear','curlCable','reverse']),
 spec('10','Corpo inteiro A: pesos livres',['goblet','bench','rowSupport','rdl','lateral','absCable']),
 spec('11','Corpo inteiro B: máquinas e glúteos',['leg','hip','latNeutral','inclineMachine','calfSeated','absMachine']),
 spec('12','Braços + ombros + core',['scott','tri','hammer','triOver','lateral','rear','reverse']),
 spec('13','Ombros + costas + core',['press','latNeutral','rowSupport','lateralCable','rear','absCable']),
 spec('14','Base em máquinas + supino com barra',['hack','flexSeated','bench','rowMachine','calfStanding','absMachine'],'Supino reto com barra, conforme sua preferência; os demais exercícios usam máquinas.'),
 spec('15','Express: corpo inteiro + core',['leg','bench','rowMachine','absCable'],'Opção mais curta; complemente os movimentos e grupos ao longo da semana. Não há duração garantida.')
];
export function presetItems(deck){return deck.items.map(value=>{
 const [key,min,max]=Array.isArray(value)?value:[value];const [group,name,equipment,lo,hi,unit='a confirmar']=registry[key];
 const dose={sets:3,min:min??lo,max:max??hi,unit:'repetições',source:'Deck predefinido aprovado; faixas iniciais, sem carga presumida.',effort:'Use carga adequada à sua técnica, mantendo repetições em reserva.'};
 if(/unilateral|afundo/.test(norm(name)))dose.effort+=' Repetições por lado.';
 dose.label=`Sugestão: 3 série(s) de ${dose.min}–${dose.max} repetições`;
 return {group,name,equipment,unit,exercise_id:'preset_ex_'+key,variant_id:'preset_var_'+key,is_catalog:true,last:null,dose};
});}
export function presetPlan(id,entities,today,readiness={}){
 const deck=PRESET_DECKS.find(x=>x.id===id);if(!deck)throw new Error('Deck pronto não encontrado.');
 const adjustment=readinessAdjustment(readiness);if(adjustment.blocked)throw new Error(adjustment.summary);
 const all=presetItems(deck).map(item=>{
  const matching=(entities.exercise_variants||[]).find(v=>v.unit_confirmed===true&&['kg','kg/lado','kg/halter','plaquetas','peso corporal'].includes(v.unit)&&norm(v.equipment_or_variation)===norm(item.equipment)&&(entities.exercises||[]).some(e=>e.id===v.exercise_id&&norm(e.name)===norm(item.name)));
  const completed=new Set((entities.sessions||[]).filter(s=>s.status==='completed'&&s.date<=today).map(s=>s.id));
  const last=matching?(entities.sets||[]).filter(s=>s.variant_id===matching.id&&s.exercise_id===matching.exercise_id&&completed.has(s.session_id)&&s.date<=today&&s.set_type==='effective'&&Number.isFinite(s.load_value)&&Number.isInteger(s.repetitions)&&s.repetitions>0).sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1)||null:null;
  return matching?{...item,exercise_id:matching.exercise_id,variant_id:matching.id,unit:matching.unit,is_catalog:false,last}:item;
 });
 let items=all;
 if(adjustment.reduced&&all.length>adjustment.cap){const core=all.find(x=>x.group==='core');items=[...all.filter(x=>x!==core).slice(0,adjustment.cap-(core?1:0)),...(core?[core]:[])];}
 const groups=[...new Set(items.filter(x=>x.group!=='core').map(x=>x.group))];
 return {presetId:deck.id,presetName:deck.name,presetNote:deck.note,groups,items,minutes:null,budget:items.length,only:true,excluded:[],short:0,options:all,history:analyzeHistory(entities,today),adjustment,notes:[]};
}
export function presetHistorySummary(plan){return 'Deck predefinido: a ordem não foi reorganizada pelo histórico. '+plan.history.total+' séries sem aquecimento classificadas nos últimos 7 dias. '+(plan.history.recent.length?'Há grupos treinados hoje ou ontem: '+plan.history.recent.join(', ')+'. Confira sua condição antes de repetir. ':'')+(plan.presetNote||'');}
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPresetLibrary(){return `<details class="preset-library" open><summary>15 decks prontos</summary><p class="text-small">3 séries de trabalho por exercício. Sem cargas predefinidas. Revise as cartas antes de iniciar; escolha os treinos conforme sua semana.</p><div class="preset-list">${PRESET_DECKS.map((d,i)=>`<article class="preset-item"><div><span class="preset-number">DECK ${String(i+1).padStart(2,'0')}</span><h3>${escape(d.name)}</h3><p class="text-small">${d.items.length} exercícios · ${d.items.length*3} séries sugeridas</p></div><button class="btn primary small" data-coach-action="preset" data-preset-id="${d.id}">Ver deck</button></article>`).join('')}</div></details>`;}
