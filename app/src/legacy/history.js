/* Histórico consultável v0.7. Somente leitura: nenhuma escrita em dados pessoais. */
import {activity,dateLocal,datePT,fmt} from './metrics.js';
import {startDate} from './insights.js';

const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
const STATUS=['all','completed','in_progress','planned','cancelled'];
const PERIODS=['all','30','90','180','custom'];
const SORT=['recent','oldest','sets'];
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const validDate=d=>typeof d==='string'&&DATE.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
function shift(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function defaultHistoryFilters(){return {query:'',status:'all',period:'all',from:'',to:'',variant:'all',sort:'recent',page:0};}
export function sanitizeHistoryFilters(value={}){
 return {
  query:String(value.query??'').slice(0,120),
  status:STATUS.includes(value.status)?value.status:'all',
  period:PERIODS.includes(value.period)?value.period:'all',
  from:validDate(value.from)?value.from:'',to:validDate(value.to)?value.to:'',
  variant:typeof value.variant==='string'&&value.variant.length<190?value.variant:'all',
  sort:SORT.includes(value.sort)?value.sort:'recent',
  page:Number.isSafeInteger(value.page)&&value.page>=0?Math.min(value.page,100000):0
 };
}
function boundaries(f,today){
 if(f.period==='all')return {from:null,to:null,error:''};
 if(f.period==='custom'){
  if(f.from&&f.to&&f.from>f.to)return {from:f.from,to:f.to,error:'A data inicial não pode ser posterior à data final.'};
  return {from:f.from||null,to:f.to||null,error:''};
 }
 if(!validDate(today))throw new Error('Data de referência inválida');
 return {from:startDate(f.period,today),to:today,error:''};
}
function groupSets(m){
 const bySession=new Map();
 for(const s of m.sets){let rows=bySession.get(s.session_id);if(!rows){rows=[];bySession.set(s.session_id,rows);}rows.push(s);}
 return bySession;
}
export function searchHistory(m,filters={},today=dateLocal(),pageSize=20){
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw new Error('Tamanho de página inválido');
 const f=sanitizeHistoryFilters(filters),bounds=boundaries(f,today),setsBySession=groupSets(m),needle=norm(f.query);
 if(bounds.error)return {rows:[],total:0,page:0,pages:0,pageSize,bounds,error:bounds.error};
 const eligible=m.sessions.filter(session=>{
  if(f.status!=='all'&&session.status!==f.status)return false;
  if(bounds.from&&session.date<bounds.from||bounds.to&&session.date>bounds.to)return false;
  const sets=setsBySession.get(session.id)||[];
  if(f.variant!=='all'&&!sets.some(s=>s.variant_id===f.variant))return false;
  if(!needle)return true;
  const names=sets.map(s=>{
    const v=m.variantMap.get(s.variant_id),ex=m.exerciseMap.get(s.exercise_id);
    return `${ex?.name||''} ${v?.equipment_or_variation||''} ${v?.unit||''}`;
  });
  return norm([session.name,session.date,session.notes||'',...names].join(' ')).includes(needle);
 });
 eligible.sort((a,b)=>{
  if(f.sort==='sets')return (setsBySession.get(b.id)?.length||0)-(setsBySession.get(a.id)?.length||0)||b.date.localeCompare(a.date)||a.id.localeCompare(b.id);
  return (f.sort==='oldest'?a.date.localeCompare(b.date):b.date.localeCompare(a.date))||a.id.localeCompare(b.id);
 });
 const total=eligible.length,pages=Math.ceil(total/pageSize),page=Math.min(f.page,Math.max(0,pages-1));
 const rows=eligible.slice(page*pageSize,(page+1)*pageSize).map(s=>({...s,setCount:setsBySession.get(s.id)?.length||0}));
 return {rows,total,pages,page,pageSize,bounds,error:''};
}
/** Two adjacent, non-overlapping windows, each of exactly N inclusive UTC calendar days. */
export function compareHistoryPeriods(m,period='30',today=dateLocal()){
 if(!['30','90','180'].includes(period))return null;
 if(!validDate(today))throw new Error('Data de referência inválida');
 const n=Number(period),currentStart=startDate(period,today),previousEnd=shift(currentStart,-1),previousStart=shift(previousEnd,-n+1);
 const summarize=(from,to)=>{
  const sessions=m.done.filter(s=>s.date>=from&&s.date<=to),ids=new Set(sessions.map(s=>s.id));
  const eff=m.eff.filter(s=>ids.has(s.session_id));
  const rir=eff.map(s=>s.rir).filter(Number.isFinite);
  return {from,to,completed:sessions.length,strength:sessions.filter(s=>activity(s)!=='cardio').length,sets:eff.length,exercises:new Set(eff.map(s=>s.exercise_id)).size,rirAvg:rir.length?rir.reduce((a,b)=>a+b,0)/rir.length:null,rirCount:rir.length};
 };
 const current=summarize(currentStart,today),previous=summarize(previousStart,previousEnd);
 return {period:Number(period),current,previous,delta:{completed:current.completed-previous.completed,strength:current.strength-previous.strength,sets:current.sets-previous.sets,exercises:current.exercises-previous.exercises},rirChange:current.rirAvg!==null&&previous.rirAvg!==null?current.rirAvg-previous.rirAvg:null};
}
const opt=(value,label,current)=>`<option value="${escapeHTML(value)}" ${value===current?'selected':''}>${escapeHTML(label)}</option>`;
const statusLabel=s=>({completed:'Concluído',in_progress:'Em andamento',planned:'Planejado',cancelled:'Cancelado'})[s]||s;
export function renderHistoryBrowser(m,filters={}){
 const f=sanitizeHistoryFilters(filters),variants=m.entities.exercise_variants.map(v=>({id:v.id,name:`${m.exerciseMap.get(v.exercise_id)?.name||'Exercício'} · ${v.equipment_or_variation} (${v.unit})`})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 return `<section class="surface"><h2>Pesquisar e filtrar</h2>
  <label class="field"><span>Nome, observação ou exercício</span><input id="history-query" class="input" type="search" maxlength="120" value="${escapeHTML(f.query)}" placeholder="Ex.: supino, costas, remada"></label>
  <div class="form-grid">
   <label class="field"><span>Período</span><select class="input" id="history-period">${[['all','Todo o histórico'],['30','Últimos 30 dias'],['90','Últimos 90 dias'],['180','Últimos 180 dias'],['custom','Datas personalizadas']].map(([v,l])=>opt(v,l,f.period)).join('')}</select></label>
   <label class="field"><span>Status</span><select class="input" id="history-status">${[['all','Todos'],...STATUS.slice(1).map(s=>[s,statusLabel(s)])].map(([v,l])=>opt(v,l,f.status)).join('')}</select></label>
   <label class="field"><span>Data inicial</span><input id="history-from" class="input" type="date" ${f.period!=='custom'?'disabled':''} value="${escapeHTML(f.from)}"></label>
   <label class="field"><span>Data final</span><input id="history-to" class="input" type="date" ${f.period!=='custom'?'disabled':''} value="${escapeHTML(f.to)}"></label>
   <label class="field span2"><span>Exercício e equipamento (opcional)</span><select id="history-variant" class="input">${opt('all','Todas as variantes',f.variant)}${variants.map(v=>opt(v.id,v.name,f.variant)).join('')}</select></label>
   <label class="field"><span>Ordenar</span><select id="history-sort" class="input">${[['recent','Mais recentes'],['oldest','Mais antigos'],['sets','Mais séries']].map(([v,l])=>opt(v,l,f.sort)).join('')}</select></label>
  </div>
  <button class="btn block" data-action="reset-history">Limpar filtros</button>
 </section><div id="history-results" aria-live="polite">${renderHistoryResults(m,f)}</div>`;
}
export function renderHistoryResults(m,filters={}){
 const f=sanitizeHistoryFilters(filters),results=searchHistory(m,f);
 if(results.error)return `<section class="surface danger"><p role="alert">${escapeHTML(results.error)}</p></section>`;
 const comparison=f.status==='all'&&f.variant==='all'&&!f.query.trim()&&f.sort==='recent'?compareHistoryPeriods(m,f.period):null;
 const comparisonHTML=comparison?`<section class="surface"><h2>Comparar períodos equivalentes</h2><p class="text-small">${datePT(comparison.current.from)}–${datePT(comparison.current.to)} comparado a ${datePT(comparison.previous.from)}–${datePT(comparison.previous.to)}. Somente sessões concluídas.</p><div class="grid">${[['Treinos concluídos','completed'],['Musculação','strength'],['Séries efetivas','sets'],['Exercícios distintos','exercises']].map(([label,key])=>`<div class="stat"><span>${label}</span><b>${comparison.current[key]}</b><small>Antes: ${comparison.previous[key]} · Diferença: ${comparison.delta[key]>0?'+':''}${comparison.delta[key]}</small></div>`).join('')}</div><p class="text-small">RIR médio: ${fmt(comparison.current.rirAvg,2)} (anterior: ${fmt(comparison.previous.rirAvg,2)}); apenas séries com RIR informado. Esses números não incluem treinos em andamento.</p></section>`:'';
 const listHTML=results.rows.length?results.rows.map(s=>`<div class="list-item"><div class="grow"><div class="item-title">${escapeHTML(s.name)}</div><div class="item-sub">${datePT(s.date)} · ${s.setCount} séries · ${escapeHTML(statusLabel(s.status))}</div></div><button class="btn small" data-open-session="${escapeHTML(s.id)}">Abrir</button></div>`).join(''):'<div class="empty">Nenhuma sessão corresponde aos filtros.</div>';
 const start=results.total?results.page*results.pageSize+1:0,end=Math.min(results.total,(results.page+1)*results.pageSize);
 return `${comparisonHTML}<section class="surface"><div class="row between wrap"><h2>Resultados</h2><span class="tag gray">${results.total} sessões</span></div><p class="text-small">Exibindo ${start}–${end} de ${results.total}. Consulte cada sessão para ver todas as séries e cargas.</p>${listHTML}${results.pages>1?`<div class="inline-actions mt"><button class="btn" data-history-page="${results.page-1}" ${results.page===0?'disabled':''}>Anterior</button><span class="text-small">Página ${results.page+1} de ${results.pages}</span><button class="btn" data-history-page="${results.page+1}" ${results.page===results.pages-1?'disabled':''}>Próxima</button></div>`:''}</section>`;
}
