import {classifyExercise} from './balanced_coach.js?v=121';
import {liveGuidance} from './principal_live.js';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups={costas:['COSTAS','PUXAR'],peito:['PEITO','EMPURRAR'],ombros:['OMBROS','ESTABILIZAR'],biceps:['BÍCEPS','FLEXIONAR'],triceps:['TRÍCEPS','ESTENDER'],pernas:['PERNAS','SUSTENTAR'],core:['CORE','ESTABILIZAR'],unknown:['EXERCÍCIO','MOVIMENTO']};
export function muscleSymbol(group){
 const highlights={costas:'<path d="M35 34h30l-6 24H41z"/>',peito:'<path d="M35 34h30v12H35z"/>',ombros:'<circle cx="32" cy="34" r="8"/><circle cx="68" cy="34" r="8"/>',biceps:'<path d="m27 37 9 3-6 19-9-3zm37 3 9-3 6 19-9 3z"/>',triceps:'<path d="m23 35 8 2-5 24-8-2zm46 2 8-2 5 24-8 2z"/>',pernas:'<path d="M36 67h12l-3 37H32zm16 0h12l4 37H55z"/>',core:'<path d="M41 48h18v21H41z"/>'};
 return `<svg viewBox="0 0 100 116" class="muscle-symbol" aria-hidden="true"><g fill="currentColor" opacity=".18"><circle cx="50" cy="16" r="10"/><path d="M32 29h36l14 33-10 4-9-21 2 25 4 38H55l-5-31-5 31H31l4-38 2-25-9 21-10-4z"/></g><g fill="currentColor">${highlights[group]||'<circle cx="50" cy="50" r="10"/>'}</g></svg>`;
}
export function deckModels(session,selected,entities){
 const variants=new Map((entities.exercise_variants||[]).map(v=>[v.id,v])),exercises=new Map((entities.exercises||[]).map(x=>[x.id,x]));
 return [...new Set(session.planned_variant_ids||[])].flatMap((id,index)=>{const v=variants.get(id),ex=exercises.get(v?.exercise_id);if(!v||!ex)return [];const state=liveGuidance(session,id,entities);return [{variant_id:id,name:ex.name,equipment:v.equipment_or_variation||'',unit:v.unit||'',group:classifyExercise(ex)||'unknown',dose:state.dose,last:state.reference,count:state.count,target:state.target,reached:state.target!==null&&state.count>=state.target,selected:id===selected,index}];});
}
export function recommendedCards(models,selected){
 const at=models.findIndex(x=>x.variant_id===selected),ordered=at<0?models:[...models.slice(at+1),...models.slice(0,at+1)];
 return ordered.filter(x=>!x.reached&&!x.selected).slice(0,3);
}
export function renderSportCard(item,{controls='',index=0,active=false,recommended=false}={}){
 const group=groups[item.group]?item.group:'unknown',info=groups[group],dose=item.dose;
 const target=Number.isInteger(item.target)?item.target:Number.isInteger(dose?.sets)?dose.sets:null;
 const count=Math.max(0,item.count||0),pips=target?Array.from({length:Math.min(20,target)},(_,i)=>`<span class="series-pip ${i<count?'filled':''}" aria-hidden="true"></span>`).join(''):'';
 const status=active?(item.selected?'Selecionada':item.reached?'Meta atingida':'Disponível'):'No seu deck';
 return `<article class="sport-card card--${group} ${item.selected?'is-selected':''} ${item.reached?'is-reached':''}"><header class="sport-card-top"><span>${e(info[0])}</span><span class="card-number">#${String(index+1).padStart(2,'0')}</span></header><div class="sport-card-art">${muscleSymbol(group)}<span class="card-art-label">${e(info[1])}</span></div><div class="sport-card-body"><div class="card-state">${recommended?'Próxima opção · ':''}${status}</div><h3>${e(item.name)}</h3><p class="card-equipment">${e(item.equipment||'Confira o equipamento')}</p><div class="card-attributes"><div><span>SÉRIES SUGERIDAS</span><strong>${target??'—'}</strong></div><div><span>${dose?.unit==='segundos'?'SEGUNDOS':'REPETIÇÕES'}</span><strong>${dose?e(dose.min)+'–'+e(dose.max):'—'}</strong></div></div>${active?`<div class="card-progress"><span>${count}${target!==null?' / '+target:''} séries de trabalho registradas</span><div class="series-pips">${pips}</div></div>`:''}<div class="card-reference">${item.last?.load_value!=null?'Referência anterior: '+e(item.last.load_value)+' '+e(item.unit):'Sem carga anterior confirmada para esta variação.'}</div>${item.movementLabel?`<p class="text-small">${e(item.movementLabel)}</p>`:''}<details><summary>Orientação da carta</summary><p class="text-small">${e(dose?.source||'Use seu roteiro e ajuste o exercício às suas condições.')}</p><p class="text-small">${e(dose?.effort||'As metas são sugestões, não séries realizadas.')}</p></details><div class="card-actions">${controls}</div></div></article>`;
}
export function renderDeckChooser(session,selected,entities){
 const models=deckModels(session,selected,entities),options=recommendedCards(models,selected);
 const render=(item,recommended=false)=>renderSportCard(item,{active:true,recommended,index:item.index,controls:`<button class="btn ${recommended?'primary':''} block" data-coach-action="select" data-coach-variant="${e(item.variant_id)}">${item.selected?'Carta selecionada':'Escolher esta carta'}</button>`});
 return `<section class="surface deck-chooser"><div class="eyebrow">Seu deck em movimento</div><h2>Escolha a próxima carta</h2><p class="text-small">Opções pendentes do seu roteiro. Escolher não registra séries; você decide quando avançar.</p>${options.length?`<div class="card-hand" role="group" aria-label="Cartas de exercícios pendentes" tabindex="0">${options.map(x=>render(x,true)).join('')}</div>`:'<p class="empty">Não há outra carta com meta pendente. Continue a atual ou revise o deck antes de concluir.</p>'}<details class="deck-all"><summary>Ver todas as cartas (${models.length})</summary><div class="deck-grid">${models.map(x=>render(x)).join('')}</div></details></section>`;
}
export function renderDeckRecap(session,entities){
 const models=deckModels(session,'',entities),played=models.filter(x=>x.count>0).length,reached=models.filter(x=>x.reached).length;
 return `<section class="surface deck-recap"><div class="eyebrow">Jornada registrada</div><h2>Seu treino em cartas</h2><div class="card-attributes"><div><span>CARTAS COM SÉRIES</span><strong>${played} / ${models.length}</strong></div><div><span>METAS ATINGIDAS</span><strong>${reached}</strong></div></div><p>Você registra o que realizou. Descansar, reduzir ou pular um exercício não gera penalidade.</p><p class="text-small">Este resumo não confirma envio ao Google. Confira a sincronização em Dados.</p><button class="btn block" data-page="data">Ver sincronização</button></section>`;
}
