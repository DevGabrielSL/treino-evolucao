const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function xpState(entities){
 const sets=[...new Map((entities.sets||[]).filter(s=>s.id).map(s=>[s.id,s])).values()];
 const valid=sets.filter(s=>Number(s.repetitions)>0&&s.finisher_key!=='plank');
 const completed=[...new Map((entities.sessions||[]).map(s=>[s.id,s])).values()].filter(s=>s.status==='completed'&&sets.some(x=>x.session_id===s.id));
 const total=valid.reduce((n,s)=>n+(s.set_type==='warmup'?5:10),0)+completed.length*100;
 return {total,level:Math.floor(total/500)+1,progress:total%500};
}
export function xpReward(before,after){
 const oldSets=new Set((before.sets||[]).map(s=>s.id)),oldSessions=new Map((before.sessions||[]).map(s=>[s.id,s.status]));
 const added=(after.sets||[]).some(s=>!oldSets.has(s.id)&&Number(s.repetitions)>0&&s.finisher_key!=='plank');
 const finished=(after.sessions||[]).some(s=>s.status==='completed'&&oldSessions.get(s.id)==='in_progress');
 const from=xpState(before),to=xpState(after),gain=to.total-from.total;
 return gain>0&&(added||finished)?{from,to,gain,finished}:null;
}
let dispose=null;
export function showXpReward(reward){
 if(!reward||typeof document==='undefined')return;
 dispose?.();
 // Replace the older exercise-goal toast with this single reward surface.
 document.querySelectorAll('.rpg-achievement').forEach(el=>el.remove());
 const el=document.createElement('aside'),big=reward.finished,up=reward.to.level>reward.from.level;
 el.className='xp-reward'+(big?' is-finish':'')+(up?' is-level-up':'');
 el.dataset.xpGain=reward.gain;el.dataset.xpTotal=reward.to.total;
 el.setAttribute('role','status');el.setAttribute('aria-label',(big?'Treino concluído. ':'Série salva. ')+'Mais '+reward.gain+' XP. Nível '+reward.to.level+(up?'. Subiu de nível.':''));
 el.style.setProperty('--xp-from',up?0:reward.from.progress/500);el.style.setProperty('--xp-to',reward.to.progress/500);
 el.innerHTML='<div class="xp-particles" aria-hidden="true">'+Array.from({length:12},(_,i)=>'<i style="--i:'+i+'"></i>').join('')+'</div><div class="xp-emblem" aria-hidden="true">✦</div><div class="xp-content" aria-hidden="true"><span class="xp-eyebrow">'+(big?'TREINO CONCLUÍDO':up?'NOVO NÍVEL':'SÉRIE REGISTRADA')+'</span><strong class="xp-gain">+'+reward.gain+' <small>XP</small></strong><div class="xp-meta"><b>Nível '+reward.to.level+'</b><span class="xp-counter">'+reward.from.total+' XP</span></div><div class="xp-track"><span></span></div><p>'+(up?'Você subiu de nível!':big?'Mais uma conquista na sua jornada.':'Seu esforço faz a jornada avançar.')+'</p></div>';
 document.body.append(el);
 const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 let frame=0,timer=0,start=performance.now();
 const counter=el.querySelector('.xp-counter');
 function tick(now){const p=Math.min(1,(now-start)/900),n=Math.round(reward.from.total+reward.gain*(1-Math.pow(1-p,3)));counter.textContent=n+' XP';if(p<1)frame=requestAnimationFrame(tick);}
 if(reduced)counter.textContent=reward.to.total+' XP';else frame=requestAnimationFrame(tick);
 const cleanup=()=>{cancelAnimationFrame(frame);clearTimeout(timer);el.remove();if(dispose===cleanup)dispose=null;};
 dispose=cleanup;timer=setTimeout(cleanup,big?4400:2600);
}
