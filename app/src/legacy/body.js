/* Acompanhamento pessoal: simples observações não são avaliação clínica. */
const iso=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateBR=s=>iso(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'—';
const val=(v,d=1)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:d}):'—';
const day=s=>Math.floor(Date.parse(s+'T12:00:00Z')/86400000);
export function recoveryRecords(doc){return doc.settings?.recovery_entries??[];}
export function validateRecovery(doc){
 const arr=recoveryRecords(doc);
 if(!Array.isArray(arr)||arr.length>5000)throw new Error('Diário de recuperação inválido.');
 const ids=new Set(),dates=new Set();
 for(const r of arr){
  if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id||r.id.length>180||!iso(r.date)||ids.has(r.id)||dates.has(r.date))throw new Error('Registro duplicado ou inválido no diário de recuperação.');
  ids.add(r.id);dates.add(r.date);
  if(r.sleep_hours!==null&&(!Number.isFinite(r.sleep_hours)||r.sleep_hours<0||r.sleep_hours>24))throw new Error('Horas de sono fora do intervalo 0–24.');
  if(r.energy!==null&&(!Number.isInteger(r.energy)||r.energy<1||r.energy>5))throw new Error('Energia fora do intervalo 1–5.');
  if(r.soreness!==null&&(!Number.isInteger(r.soreness)||r.soreness<0||r.soreness>10))throw new Error('Desconforto fora do intervalo 0–10.');
  if(typeof r.notes!=='string'||r.notes.length>400||[r.sleep_hours,r.energy,r.soreness].every(x=>x===null)&&!r.notes.trim())throw new Error('Informe ao menos um dado ou observação de recuperação.');
 }
 return true;
}
export function upsertRecovery(doc,data){
 const date=data.date,notes=String(data.notes??'').trim();
 if(!iso(date))throw new Error('Data do diário inválida.');
 const arr=(doc.settings.recovery_entries??=[]),index=arr.findIndex(r=>r.id===data.id);
 if(index<0&&arr.some(r=>r.date===date))throw new Error('Já existe um registro nessa data. Edite o registro anterior.');
 if(index<0&&(!data.id||arr.some(r=>r.id===data.id)))throw new Error('ID do diário inválido.');
 const entry={id:data.id,date,sleep_hours:data.sleep_hours??null,energy:data.energy??null,soreness:data.soreness??null,notes};
 const candidate=index<0?[...arr,entry]:arr.map((r,i)=>i===index?entry:r);
 const test={settings:{recovery_entries:candidate}};validateRecovery(test);
 doc.settings.recovery_entries=candidate;
}
export function removeRecovery(doc,id){if(!recoveryRecords(doc).some(r=>r.id===id))throw new Error('Registro local não encontrado.');doc.settings.recovery_entries=recoveryRecords(doc).filter(r=>r.id!==id);}
export function changeWeighIn(doc,{id,date,weight_kg,notes}){
 const row=doc.overlay.weigh_ins.find(x=>x.id===id);
 if(!row)throw new Error('Pesagem importada não pode ser alterada.');
 if(!iso(date)||!Number.isFinite(weight_kg)||weight_kg<20||weight_kg>500||typeof notes!=='string'||notes.length>300)throw new Error('Pesagem inválida.');
 Object.assign(row,{date,weight_kg,notes});
}
export function removeWeighIn(doc,id){if(!doc.overlay.weigh_ins.some(w=>w.id===id))throw new Error('Pesagem importada não pode ser excluída.');doc.overlay.weigh_ins=doc.overlay.weigh_ins.filter(w=>w.id!==id);}
export function weightInsights(weighIns,goal=null,asOf=null){
 const dates=[...weighIns].filter(w=>iso(w.date)&&Number.isFinite(w.weight_kg)&&(!asOf||w.date<=asOf)).sort((a,b)=>a.date.localeCompare(b.date));
 const latest=dates.at(-1)||null,first=dates[0]||null,span=first&&latest?day(latest.date)-day(first.date):0;
 const current=latest?.weight_kg??null;
 const change=span>=7?+(current-first.weight_kg).toFixed(2):null;
 const goalDifference=Number.isFinite(goal)&&current!==null?+(current-goal).toFixed(2):null;
 const daily=new Map();for(const w of dates)daily.set(w.date,(daily.get(w.date)||[]).concat(w.weight_kg));
 const points=[...daily.entries()].map(([date,values])=>({date,weight:values.reduce((a,b)=>a+b,0)/values.length}));
 const averages=weekOffset=>{if(!latest)return null;const hi=day(latest.date)-7*weekOffset,lo=hi-6,items=points.filter(p=>day(p.date)>=lo&&day(p.date)<=hi);return items.length?{value:items.reduce((a,p)=>a+p.weight,0)/items.length,days:items.length}:null;};
 const recent=averages(0),previous=averages(1),weeklyDifference=recent&&previous&&recent.days>=2&&previous.days>=2?+(recent.value-previous.value).toFixed(2):null;
 return {latest,first,points,span,change,goalDifference,weeklyDifference,recent,previous};
}
const avg=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
export function recoveryInsights(entries,sessions=[],asOf=null){
 const rows=[...entries].filter(r=>!asOf||r.date<=asOf).sort((a,b)=>b.date.localeCompare(a.date));
 const sleep=rows.map(r=>r.sleep_hours).filter(Number.isFinite),energy=rows.map(r=>r.energy).filter(Number.isFinite),soreness=rows.map(r=>r.soreness).filter(Number.isFinite);
 const completed=new Set(sessions.filter(s=>s.status==='completed').map(s=>s.date));
 const withTrain=rows.filter(r=>completed.has(r.date)),withoutTrain=rows.filter(r=>!completed.has(r.date));
 const contrast=withTrain.length>=3&&withoutTrain.length>=3?{withTraining:avg(withTrain.map(r=>r.energy).filter(Number.isFinite)),withoutTraining:avg(withoutTrain.map(r=>r.energy).filter(Number.isFinite)),trainingDays:withTrain.length,otherDays:withoutTrain.length}:null;
 return {rows,averageSleep:avg(sleep),sleepCount:sleep.length,averageEnergy:avg(energy),energyCount:energy.length,averageSoreness:avg(soreness),sorenessCount:soreness.length,contrast};
}
function graph(points){
 const data=points.slice(-24);if(data.length<2||data[0].date===data.at(-1).date)return '<div class="empty">São necessárias pesagens em dois dias diferentes para traçar a evolução.</div>';
 const n=data.length,low=Math.min(...data.map(p=>p.weight)),high=Math.max(...data.map(p=>p.weight));const range=Math.max(1,high-low),ys=data.map(p=>102-70*(p.weight-low)/range),xs=data.map((_,i)=>24+312*i/(n-1));
 const poly=data.map((_,i)=>`${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
 return `<svg viewBox="0 0 360 147" role="img" aria-label="Evolução das últimas ${n} médias diárias de peso" class="trend-chart"><path d="M18 115H342" stroke="#DCE6ED"/><polyline fill="none" stroke="#008F84" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${poly}"/>${data.map((p,i)=>`<circle cx="${xs[i].toFixed(1)}" cy="${ys[i].toFixed(1)}" r="3" fill="#10243D"><title>${esc(dateBR(p.date))}: ${esc(val(p.weight))} kg</title></circle>`).join('')}<text x="18" y="12" fill="#5F7083" font-size="10">${esc(val(high))} kg</text><text x="18" y="132" fill="#5F7083" font-size="10">${esc(dateBR(data[0].date))}</text><text x="342" y="132" text-anchor="end" fill="#5F7083" font-size="10">${esc(dateBR(data.at(-1).date))}</text></svg>`;
}
const card=(label,v,small='')=>`<div class="stat"><span>${esc(label)}</span><b>${esc(v)}</b><small>${esc(small)}</small></div>`;
export function renderBodyV08(doc,m,{editingWeight='',editingRecovery='',today}={}){
 const wis=weightInsights(m.weights,m.goal,today),rec=recoveryInsights(recoveryRecords(doc),m.sessions,today);
 const eWeight=doc.overlay.weigh_ins.find(x=>x.id===editingWeight)||null;
 const eRec=rec.rows.find(x=>x.id===editingRecovery)||null;
 const bodyText=wis.change===null?'São necessárias pesagens com pelo menos 7 dias de intervalo para informar uma mudança desde a primeira pesagem.':`Mudança entre a primeira e a última pesagem (${wis.span} dias): ${wis.change>0?'+':''}${val(wis.change,2)} kg. Não representa velocidade prevista de mudança.`;
 const comparator=rec.contrast&&rec.contrast.withTraining!==null&&rec.contrast.withoutTraining!==null?`Energia média em dias com treino concluído: ${val(rec.contrast.withTraining,2)}/5; em outros dias: ${val(rec.contrast.withoutTraining,2)}/5. Comparação apenas descritiva, sem indicar causalidade.`:'São necessários pelo menos três registros em dias com treino concluído e três em outros dias, com energia informada, para mostrar uma comparação descritiva.';
 return `<div class="eyebrow">Corpo & recuperação</div><h1>Seu acompanhamento</h1><p class="sub">Pesagens, hábitos e sensações ficam somente no seu dispositivo. Registros subjetivos não são avaliações médicas.</p>
 <section class="grid">${card('Peso mais recente',wis.latest?`${val(wis.latest.weight_kg)} kg`:'—',wis.latest?dateBR(wis.latest.date):'Nenhuma pesagem')}${card('Meta registrada',m.goal===null?'—':`${val(m.goal)} kg`,'Meta importada')}${card('Diferença para a meta',wis.goalDifference===null?'—':`${wis.goalDifference>0?'+':''}${val(wis.goalDifference,2)} kg`,'Atual menos meta')}${card('Variação entre semanas',wis.weeklyDifference===null?'—':`${wis.weeklyDifference>0?'+':''}${val(wis.weeklyDifference,2)} kg`,'Exige ≥2 dias em cada janela')}</section>
 <section class="surface"><h2>Evolução do peso</h2>${graph(wis.points)}<p class="text-small">${esc(bodyText)} As pesagens do mesmo dia são agrupadas pela média; a curva não é uma previsão.</p></section>
 <section class="surface"><h2>${eWeight?'Corrigir pesagem local':'Registrar pesagem'}</h2><form id="${eWeight?'edit-weigh-form':'weigh-form'}">${eWeight?`<input type="hidden" name="id" value="${esc(eWeight.id)}">`:''}<div class="form-grid"><label class="field"><span>Data</span><input class="input" type="date" name="date" required value="${esc(eWeight?.date||today)}"></label><label class="field"><span>Peso (kg)</span><input class="input" type="number" inputmode="decimal" min="20" max="500" step="0.1" required value="${eWeight?esc(eWeight.weight_kg):''}" placeholder="Ex.: 87.5"></label></div><label class="field"><span>Observação opcional</span><input class="input" name="notes" maxlength="300" value="${esc(eWeight?.notes||'')}"></label><div class="inline-actions"><button class="btn primary" type="submit">${eWeight?'Salvar correção':'Salvar pesagem'}</button>${eWeight?'<button type="button" class="btn" data-action="cancel-body-edit">Cancelar</button>':''}</div></form></section>
 <section class="surface"><h2>Histórico de pesagens</h2>${m.weights.length?m.weights.slice().reverse().slice(0,60).map(w=>`<div class="list-item"><div class="grow"><div class="item-title">${esc(dateBR(w.date))} · ${esc(val(w.weight_kg))} kg</div><div class="item-sub">${esc(w.notes||'Sem observação')}</div></div>${doc.overlay.weigh_ins.some(x=>x.id===w.id)?`<div class="model-actions"><button class="btn small" data-edit-weight="${esc(w.id)}">Editar</button><button class="btn small danger" data-delete-weight="${esc(w.id)}">Excluir</button></div>`:'<span class="tag gray">Importado</span>'}</div>`).join(''):'<div class="empty">Nenhuma pesagem registrada.</div>'}</section>
 <section class="grid">${card('Sono médio',rec.averageSleep===null?'—':`${val(rec.averageSleep,1)} h`,`${rec.sleepCount} registros`)}${card('Energia média',rec.averageEnergy===null?'—':`${val(rec.averageEnergy,1)}/5`,`${rec.energyCount} registros`)}${card('Desconforto médio',rec.averageSoreness===null?'—':`${val(rec.averageSoreness,1)}/10`,`${rec.sorenessCount} registros`)}</section>
 <section class="surface"><h2>${eRec?'Editar anotação do dia':'Diário de recuperação'}</h2><p class="text-small">Preenchimento opcional por campo. Energia: 1 muito baixa, 5 muito boa; desconforto: 0 nenhum, 10 muito intenso. Use no máximo um registro por data.</p><form id="recovery-form"><input type="hidden" name="id" value="${esc(eRec?.id||'')}"><div class="form-grid"><label class="field"><span>Data</span><input type="date" class="input" name="date" required value="${esc(eRec?.date||today)}"></label><label class="field"><span>Horas de sono</span><input type="number" class="input" name="sleep" inputmode="decimal" min="0" max="24" step="0.25" placeholder="Ex.: 7.5" value="${eRec?.sleep_hours??''}"></label><label class="field"><span>Energia (1–5)</span><select class="input" name="energy"><option value="">Não informar</option>${[1,2,3,4,5].map(v=>`<option value="${v}" ${eRec?.energy===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>Desconforto (0–10)</span><select class="input" name="soreness"><option value="">Não informar</option>${Array.from({length:11},(_,v)=>`<option value="${v}" ${eRec?.soreness===v?'selected':''}>${v}</option>`).join('')}</select></label></div><label class="field"><span>Notas opcionais</span><textarea name="notes" class="input" maxlength="400" placeholder="Sono, energia, desconforto ou recuperação percebida">${esc(eRec?.notes||'')}</textarea></label><div class="inline-actions"><button class="btn primary" type="submit">${eRec?'Salvar alterações':'Salvar anotação'}</button>${eRec?'<button type="button" class="btn" data-action="cancel-body-edit">Cancelar</button>':''}</div></form></section>
 <section class="surface"><h2>Relação com a rotina de treino</h2><p class="text-small">${esc(comparator)}</p></section>
 <section class="surface"><h2>Últimas anotações</h2>${rec.rows.length?rec.rows.slice(0,45).map(r=>`<div class="list-item"><div class="grow"><div class="item-title">${esc(dateBR(r.date))}</div><div class="item-sub">Sono ${esc(r.sleep_hours===null?'—':val(r.sleep_hours)+' h')} · Energia ${esc(r.energy??'—')}/5 · Desconforto ${esc(r.soreness??'—')}/10${r.notes?' · '+esc(r.notes):''}</div></div><div class="model-actions"><button class="btn small" data-edit-recovery="${esc(r.id)}">Editar</button><button class="btn small danger" data-delete-recovery="${esc(r.id)}">Excluir</button></div></div>`).join(''):'<div class="empty">Ainda não há anotações de recuperação.</div>'}</section>`;
}
