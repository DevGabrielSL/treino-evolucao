const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function collectNewCompletions(cards,seen){
 const out=[];for(const card of cards){if(!card.session_id||!card.variant_id||!Number.isInteger(card.target)||card.target<3)continue;const key=card.session_id+':'+card.variant_id,reached=card.count>=card.target;
  if(seen.get(key)===false&&reached)out.push(card);
  seen.set(key,reached);
 }return out;
}
export function showCardCompletion(card){
 if(typeof document==='undefined')return;
 const overlay=document.createElement('div');overlay.className='rpg-achievement';overlay.setAttribute('role','status');overlay.innerHTML=`<div class="rpg-seal" aria-hidden="true">✦</div><div><span>META DA CARTA ATINGIDA</span><strong>${escape(card.name||'Exercício')}</strong><small>${escape(card.count)} série(s) de trabalho registradas</small></div><div class="rpg-sparks" aria-hidden="true">${Array.from({length:7},(_,i)=>`<i class="spark-${i}"></i>`).join('')}</div>`;
 document.body.append(overlay);setTimeout(()=>overlay.remove(),2800);
}
if(typeof document!=='undefined'&&typeof MutationObserver!=='undefined'){
 const seen=new Map(),root=document.getElementById('app');
 if(root){const scan=()=>{const cards=Array.from(root.querySelectorAll('[data-card-session]')).map(el=>({session_id:el.dataset.cardSession,variant_id:el.dataset.cardId,count:Number(el.dataset.cardCount),target:Number(el.dataset.cardTarget),name:el.querySelector('h3')?.textContent||''}));for(const card of collectNewCompletions(cards,seen))showCardCompletion(card);};new MutationObserver(scan).observe(root,{childList:true,subtree:true});scan();}
}
