import {liveGuidance} from './principal_live.js';

const LOAD_BONUS = 10;
function loadBonus(row) {
 const reference = row.xp_load_reference;
 return row.set_type === 'effective' && reference && reference.variant === row.variant_id &&
   reference.unit === row.load_unit_original && row.load_value > reference.load
   ? LOAD_BONUS : 0;
}

export function markLoadBonus(row, session, variant, entities) {
 if (row.set_type !== 'effective' || variant?.unit_confirmed !== true ||
     !['kg', 'kg/lado', 'kg/halter', 'plaquetas'].includes(variant.unit)) return;
 const reference = liveGuidance(session, variant.id, entities).reference;
 const previousVariant = entities.exercise_variants.find(item => item.id === reference?.variant_id);
 if (previousVariant?.unit !== variant.unit || row.load_unit_original !== variant.unit) return;
 if (reference?.load_value > 0 && row.load_value > reference.load_value) {
  row.xp_load_reference = {variant: variant.id, unit: variant.unit, load: reference.load_value};
 }
}

export function xpState(entities){
 const sets=[...new Map((entities.sets||[]).filter(s=>s.id).map(s=>[s.id,s])).values()];
 const valid=sets.filter(s=>Number(s.repetitions)>0&&s.finisher_key!=='plank');
 const completed=[...new Map((entities.sessions||[]).map(s=>[s.id,s])).values()].filter(s=>s.status==='completed'&&sets.some(x=>x.session_id===s.id));
 const total=valid.reduce((n,s)=>n+(s.set_type==='warmup'?5:10)+loadBonus(s),0)+completed.length*100;
 return {total,level:Math.floor(total/500)+1,progress:total%500};
}
export function xpReward(before,after){
 const oldSets=new Set((before.sets||[]).map(s=>s.id)),oldSessions=new Map((before.sessions||[]).map(s=>[s.id,s.status]));
 const added=(after.sets||[]).filter(s=>!oldSets.has(s.id)&&Number(s.repetitions)>0&&s.finisher_key!=='plank');
 const bonus=added.reduce((total,row)=>total+loadBonus(row),0);
 const finished=(after.sessions||[]).some(s=>s.status==='completed'&&oldSessions.get(s.id)==='in_progress');
 const from=xpState(before),to=xpState(after),gain=to.total-from.total;
 return gain>0&&(added.length||finished)?{from,to,gain,finished,bonus}:null;
}
let rewardTimer;
export function showXpReward(reward){
 if(!reward||typeof document==='undefined')return;
 clearTimeout(rewardTimer);
 document.querySelectorAll('.xp-reward, .rpg-achievement').forEach(el=>el.remove());
 const el=document.createElement('aside');
 const {from,to,gain,finished,bonus}=reward;
 const levelUp=to.level>from.level;
 const title=finished?'Missão concluída':'Série salva';
 const level=levelUp?'Novo nível':'Nível';
 el.className='xp-reward'+(finished?' is-finish':'')+(levelUp?' is-level-up':'');
 el.dataset.xpGain=gain;
 el.dataset.xpTotal=to.total;
 el.setAttribute('aria-hidden','true');
 el.style.setProperty('--xp-from',levelUp?0:from.progress/500);
 el.style.setProperty('--xp-to',to.progress/500);
 el.innerHTML=`
  <span class="xp-emblem" aria-hidden="true">${finished?'✦':'✓'}</span>
  <div class="xp-content">
   <span class="xp-title">${title}</span>
   <span class="xp-meta">${level} ${to.level} · ${to.total} XP no total</span>
  </div>
  <strong class="xp-gain">+${gain} <small>XP</small></strong>
  ${bonus?'<span class="xp-bonus">Carga anterior superada</span>':''}
  <div class="xp-track" aria-hidden="true"><span></span></div>`;
 document.body.append(el);
 const status=document.getElementById('xp-status');
 if(status)status.textContent=`${title}. Mais ${gain} XP. ${level} ${to.level}. ${to.total} XP no total.`+
  (bonus?' Carga anterior superada.':'');
 rewardTimer=setTimeout(()=>el.remove(),finished?3900:2400);
}

