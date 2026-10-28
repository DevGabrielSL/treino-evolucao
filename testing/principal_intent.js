const norm=x=>String(x??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function expandArmRequest(message){
 return norm(message).replace(/\b(sem|nao quero|nao treinar)\s+(?:os?\s+)?bracos?\b/g,(_,neg)=>`${neg} biceps ${neg} triceps`).replace(/\bbracos?\b/g,'biceps e triceps');
}
export function armSlots(message,plan){
 const input=norm(message);if(!/\bbracos?\b/.test(input)||!plan.groups.every(g=>['biceps','triceps'].includes(g)))return null;
 const groups=plan.groups.filter(g=>!plan.excluded.includes(g));if(!groups.length)return null;
 const only=/\b(?:so|somente|apenas)\s+(?:(?:quero|vou)\s+)?(?:treinar\s+)?bracos?\b/.test(input);
 const slots=[],core=!only&&!plan.excluded.includes('core'),shoulder=!only&&plan.budget>=6&&!plan.excluded.includes('ombros');
 const count=plan.budget-Number(core)-Number(shoulder);
 for(let i=0;i<count;i++)slots.push(groups[i%groups.length]);
 if(shoulder)slots.push('ombros');if(core)slots.push('core');return slots;
}
