/** Analysis and presentation for the local-only progress screen.
 * No storage writes; no network requests. Individual variants are never mixed.
 */
import {dateLocal,datePT,fmt,monday,activity} from './metrics.js';
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const dateWithin=(d,lower,upper)=>typeof d==='string'&&d>=lower&&d<=upper;
const labelUnit=unit=>escapeHTML(unit||'unidade');
let period='90',selected='';
export const PERIODS=['30','90','180','all'];
/** A calendar-day window, inclusive of today; no reliance on the local timezone in UTC arithmetic. */
export function startDate(periodCode,today=dateLocal()){
 if(periodCode==='all')return '0000-01-01';
 if(!['30','90','180'].includes(periodCode))throw new Error('Período de análise inválido.');
 const days=Number(periodCode),d=new Date(today+'T12:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==today)throw new Error('Data de referência inválida.');
 d.setUTCDate(d.getUTCDate()-(days-1));return d.toISOString().slice(0,10);
}
export function overview(m,periodCode='90',today=dateLocal()){
 const since=startDate(periodCode,today),done=m.done.filter(s=>dateWithin(s.date,since,today)),ids=new Set(done.map(s=>s.id)),sets=m.eff.filter(s=>ids.has(s.session_id));
 const rir=sets.filter(s=>finite(s.rir)).map(s=>s.rir);
 const weeks=new Map();
 for(const s of done){const wk=monday(s.date);if(!weeks.has(wk))weeks.set(wk,{week:wk,weight:0,cardio:0,sets:0});weeks.get(wk)[activity(s)==='cardio'?'cardio':'weight']++;}
 for(const s of sets){const wk=monday(s.date);if(!weeks.has(wk))weeks.set(wk,{week:wk,weight:0,cardio:0,sets:0});weeks.get(wk).sets++;}
 // Include empty intervening weeks, with a hard cap to protect render speed on very old imports.
 const start=periodCode==='all' ? ([...weeks.keys()].sort()[0]||monday(today)) : monday(since);
 const end=monday(today);let d=new Date(start+'T12:00:00Z'),count=0;
 while(d.toISOString().slice(0,10)<=end&&count<1200){const wk=d.toISOString().slice(0,10);if(!weeks.has(wk))weeks.set(wk,{week:wk,weight:0,cardio:0,sets:0});d.setUTCDate(d.getUTCDate()+7);count++;}
 return {since,today,completed:done.length,strength:done.filter(s=>activity(s)!=='cardio').length,cardio:done.filter(s=>activity(s)==='cardio').length,effectiveSets:sets.length,rirAvg:rir.length?rir.reduce((a,b)=>a+b,0)/rir.length:null,rirCount:rir.length,weekly:[...weeks.values()].sort((a,b)=>a.week.localeCompare(b.week)),uniqueVariants:new Set(sets.map(s=>s.variant_id)).size,uniqueExercises:new Set(sets.map(s=>s.exercise_id)).size};
}
/** Only completed effective sets on one confirmed variant; never sum incomparable machines or units. */
export function variantTrend(m,variantId,periodCode='90',today=dateLocal()){
 const variant=m.variantMap.get(variantId);const since=startDate(periodCode,today);
 if(!variant?.unit_confirmed)return {variant:null,rows:[],eligible:0,volume:null,latest:null,previous:null,delta:null,deltaPct:null,best:null};
 const sessionsById=new Map(m.done.map(s=>[s.id,s]));const bySession=new Map();
 for(const set of m.eff){
   if(set.variant_id!==variantId||!sessionsById.has(set.session_id)||!dateWithin(set.date,since,today))continue;
   let item=bySession.get(set.session_id);
   if(!item){item={sessionId:set.session_id,date:set.date,name:sessionsById.get(set.session_id).name,sets:0,valid:0,best:null,volume:0,volumeAvailable:false};bySession.set(set.session_id,item);}
   item.sets++;
   if(!finite(set.load_value)||set.load_value<=0||!Number.isInteger(set.repetitions)||set.repetitions<=0)continue;
   item.valid++;item.volume+=set.load_value*set.repetitions;item.volumeAvailable=true;
   for(const part of m.sets||[]){
    if(part.set_type==='drop_set'&&part.notes==='Drop de '+set.id&&
       part.session_id===set.session_id&&part.variant_id===variantId&&
       finite(part.load_value)&&part.load_value>=0&&Number.isInteger(part.repetitions)&&part.repetitions>0){
     item.volume+=part.load_value*part.repetitions;
    }
   }
   if(item.best===null||set.load_value>item.best)item.best=set.load_value;
 }
 const rows=[...bySession.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.sessionId.localeCompare(b.sessionId));
 const eligible=rows.filter(r=>r.best!==null),latest=eligible.at(-1)||null,previous=eligible.at(-2)||null;
 const best=eligible.length?Math.max(...eligible.map(x=>x.best)):null;
 const volume=rows.some(x=>x.volumeAvailable)?rows.reduce((n,x)=>n+x.volume,0):null;
 const delta=latest&&previous?latest.best-previous.best:null;
 return {variant,rows,eligible:eligible.length,volume,latest,previous,delta,deltaPct:delta!==null&&previous.best>0?100*delta/previous.best:null,best};
}
/** Aggregate completed sets by named exercise without asserting equivalence between variants. */
export function exerciseRanking(m,periodCode='90',today=dateLocal(),limit=8){
 const since=startDate(periodCode,today),counts=new Map();
 for(const s of m.eff){if(!dateWithin(s.date,since,today))continue;counts.set(s.exercise_id,(counts.get(s.exercise_id)||0)+1);}
 return [...counts.entries()].map(([id,sets])=>({id,name:m.exerciseMap.get(id)?.name||'Exercício',sets})).sort((a,b)=>b.sets-a.sets||a.name.localeCompare(b.name,'pt-BR')).slice(0,limit);
}
function miniBars(weekly,key,label){const shown=weekly.slice(-12),max=Math.max(1,...shown.map(x=>x[key]));if(!shown.length)return '<p class="empty">Nenhum dado no período.</p>';
 const gap=40,w=Math.max(330,shown.length*gap+20),bottom=126;
 return `<svg class="trend-chart" role="img" aria-label="${escapeHTML(label)}, por semana" viewBox="0 0 ${w} 160" xmlns="http://www.w3.org/2000/svg"><path d="M8 ${bottom} H${w-8}" stroke="#DCE6ED"/>${shown.map((r,i)=>{const n=r[key],x=17+i*gap,h=n?Math.max(4,(n/max)*94):0;return `<rect x="${x}" y="${bottom-h}" width="25" height="${h}" rx="4" fill="#008F84"/><text x="${x+12}" y="${bottom-h-5}" font-size="10" text-anchor="middle" fill="#52677D">${n}</text><text x="${x+12}" y="145" font-size="9" text-anchor="middle" fill="#52677D">${r.week.slice(5,10).replace('-','/')}</text>`;}).join('')}</svg>`;
}
function loadChart(rows,unit){const eligible=rows.filter(r=>r.best!==null).slice(-10);if(!eligible.length)return '<div class="empty">Sem cargas positivas comparáveis neste período.</div>';
 const max=Math.max(1,...eligible.map(r=>r.best)),gap=44,w=Math.max(330,eligible.length*gap+28),base=125;
 return `<svg class="trend-chart" role="img" aria-label="Maior carga positiva por sessão em ${labelUnit(unit)}" viewBox="0 0 ${w} 165" xmlns="http://www.w3.org/2000/svg"><path d="M8 ${base} H${w-8}" stroke="#DCE6ED"/>${eligible.map((r,i)=>{const n=r.best,x=19+i*gap,h=Math.max(4,92*n/max);return `<rect x="${x}" y="${base-h}" width="26" height="${h}" rx="5" fill="#15677A"/><text x="${x+13}" y="${base-h-5}" font-size="10" text-anchor="middle" fill="#52677D">${escapeHTML(fmt(n))}</text><text x="${x+13}" y="146" font-size="9" text-anchor="middle" fill="#52677D">${r.date.slice(5).replace('-','/')}</text>`;}).join('')}</svg>`;
}
const stat=(name,value,hint='')=>`<div class="stat"><span>${escapeHTML(name)}</span><b>${escapeHTML(value)}</b>${hint?`<small>${escapeHTML(hint)}</small>`:''}</div>`;
const surface=content=>`<section class="surface">${content}</section>`;
export function handleProgressChange(element){if(element.id==='progress-period'){period=PERIODS.includes(element.value)?element.value:'90';return true;}if(element.id==='progress-variant'){selected=element.value;return true;}return false;}
export function renderProgressV06(m){
 const o=overview(m,period),variants=m.entities.exercise_variants.filter(v=>v.unit_confirmed).map(v=>({...v,label:`${m.exerciseMap.get(v.exercise_id)?.name||'Exercício'} · ${v.equipment_or_variation} (${v.unit})`})).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
 const curr=variants.find(v=>v.id===selected)||variants[0];if(curr)selected=curr.id;
 const trend=curr?variantTrend(m,curr.id,period):null,top=exerciseRanking(m,period);
 const rangeLabel=period==='all'?'Todo o histórico':`Últimos ${period} dias`;
 return `<div class="eyebrow">Painel analítico</div><h1>Evolução dos seus treinos</h1><p class="sub">Somente sessões concluídas. Comparações de carga limitadas à mesma variante e unidade confirmada.</p>
 ${surface(`<label class="field"><span>Período de análise</span><select id="progress-period" class="input">${[['30','30 dias'],['90','90 dias'],['180','180 dias'],['all','Todo o histórico']].map(([v,l])=>`<option value="${v}" ${v===period?'selected':''}>${l}</option>`).join('')}</select></label><div class="text-small">${rangeLabel} · até ${datePT(o.today)}</div>`)}
 <section class="grid" aria-label="Indicadores do período">${stat('Treinos de musculação',String(o.strength),'Concluídos')}${stat('Séries efetivas',String(o.effectiveSets),'Sem aquecimentos')}${stat('RIR médio',fmt(o.rirAvg,2),`${o.rirCount} séries com RIR`)}${stat('Exercícios treinados',String(o.uniqueExercises),'Nomes distintos')}</section>
 ${surface(`<h2>Frequência semanal</h2>${miniBars(o.weekly,'weight','Treinos de musculação')}<p class="text-small">Até 12 semanas exibidas; a soma dos indicadores respeita o período selecionado. Cardio concluído: ${o.cardio}.</p>`)}
 ${surface(`<h2>Volume de séries efetivas</h2>${miniBars(o.weekly,'sets','Séries efetivas')}<p class="text-small">Número de séries efetivas por semana. Não mistura cargas de máquinas diferentes.</p>`)}
 ${surface(`<h2>Progresso por variante</h2>${variants.length?`<label class="field"><span>Escolher exercício, equipamento e unidade</span><select id="progress-variant" class="input">${variants.map(v=>`<option value="${escapeHTML(v.id)}" ${curr?.id===v.id?'selected':''}>${escapeHTML(v.label)}</option>`).join('')}</select></label><div class="grid">${stat('Maior carga positiva',fmt(trend.best),curr.unit)}${stat('Sessões comparáveis',String(trend.eligible),'Com carga e reps válidas')}${stat('Mudança entre 2 sessões',trend.delta===null?'—':`${trend.delta>0?'+':''}${fmt(trend.delta)}`,curr.unit)}${stat('Índice carga × reps',fmt(trend.volume,0),`${curr.unit} × rep; só esta variante`)}</div>${loadChart(trend.rows,curr.unit)}<p class="text-small">Cada coluna representa a maior carga positiva de uma sessão concluída. A variação compara as últimas duas sessões elegíveis; não é ganho de força estimado. Peso corporal e outras variantes não são somados.</p>${trend.rows.length?`<h3 class="mt">Sessões da variante (${trend.rows.length})</h3><div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Data</th><th>Séries</th><th>Maior carga</th><th>Carga × reps</th></tr></thead><tbody>${trend.rows.slice(-15).reverse().map(r=>`<tr><td>${datePT(r.date)}</td><td>${r.sets}</td><td>${fmt(r.best)} ${labelUnit(curr.unit)}</td><td>${r.volumeAvailable?fmt(r.volume,0):'—'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">Nenhuma série efetiva nessa variante e período.</p>'}`:'<div class="empty">Importe seu histórico ou cadastre variantes com unidade confirmada.</div>'}`)}
 ${surface(`<h2>Exercícios mais registrados</h2>${top.length?top.map((x,i)=>`<div class="list-item"><div><div class="item-title">${i+1}. ${escapeHTML(x.name)}</div><div class="item-sub">Séries efetivas de todas as variantes deste exercício</div></div><span class="tag">${x.sets} séries</span></div>`).join(''):'<div class="empty">Sem séries efetivas no período selecionado.</div>'}<p class="text-small mt">A classificação soma apenas a quantidade de séries por exercício; nunca combina cargas entre variantes.</p>`)}
 `;
}
