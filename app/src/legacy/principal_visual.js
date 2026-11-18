const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function visualSyncState({error,busy,pending={},last,online,active}){
 if(error)return {text:'Revisar sincronização',tone:'error',detail:error};
 if(busy)return {text:'Sincronizando…',tone:'pending',detail:'Aguarde a confirmação da leitura no Google.'};
 const count=Object.values(pending).reduce((sum,n)=>sum+(Number.isFinite(n)?n:0),0);
 if(count)return {text:'Envio pendente',tone:'pending',detail:count+' registro(s) local(is) ainda sem confirmação no Google.'};
 if(active)return {text:'Treino no aparelho',tone:'local',detail:'O treino em andamento está salvo localmente; o envio ocorre após concluir.'};
 if(!online)return {text:'Sem conexão',tone:'local',detail:'Os registros permanecem no aparelho.'};
 if(last)return {text:'Última sync confirmada',tone:'confirmed',detail:'Última confirmação: '+new Date(last).toLocaleString('pt-BR')+'. Isso não substitui uma nova conferência.'};
 return {text:'Conferência pendente',tone:'local',detail:'Nenhuma sincronização confirmada neste aparelho.'};
}
export function renderPlanSummary(plan){
 const counts={};let sets=0;for(const item of plan.items||[]){counts[item.group]=(counts[item.group]||0)+1;sets+=Number(item.dose?.sets)||0;}
 const names={costas:'Costas',peito:'Peito',ombros:'Ombros',biceps:'Bíceps',triceps:'Tríceps',pernas:'Pernas',core:'Core'};
 return `<div class="plan-summary"><strong>${plan.items?.length||0} exercícios${sets?' · '+sets+' séries sugeridas':''}</strong><div class="muscle-tags">${Object.entries(counts).map(([g,n])=>`<span class="tag">${escape(names[g]||g)} <b>${n}</b></span>`).join('')}</div></div>`;
}
if(typeof document!=='undefined'&&typeof ResizeObserver!=='undefined'){
 const nav=document.querySelector('.bottom-nav');if(nav)new ResizeObserver(()=>document.documentElement.style.setProperty('--nav-height',nav.getBoundingClientRect().height+'px')).observe(nav);
}
