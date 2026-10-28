const key='treino-evolucao-rest-v1';
export function createRestTimer({storage=null,now=()=>Date.now()}={}){
 let memory=null;
 try{memory=JSON.parse(storage?.getItem(key)||'null');}catch{}
 function valid(x){return x&&typeof x.sessionId==='string'&&x.sessionId.length<200&&Number.isInteger(x.seconds)&&x.seconds>=10&&x.seconds<=3600&&typeof x.auto==='boolean'&&Number.isFinite(x.remainingMs)&&x.remainingMs>=0&&x.remainingMs<=3600000&&(x.endsAt===null||Number.isFinite(x.endsAt)&&x.endsAt>=0&&x.endsAt<=now()+3600000);}
 if(!valid(memory))memory=null;
 function save(){try{if(memory)storage?.setItem(key,JSON.stringify(memory));else storage?.removeItem(key);}catch{}}
 function state(id){const x=memory?.sessionId===id?memory:{sessionId:id,seconds:90,auto:false,remainingMs:0,endsAt:null};return {...x,remaining:Math.max(0,Math.ceil((x.endsAt===null?x.remainingMs:x.endsAt-now())/1000)),running:x.endsAt!==null&&x.endsAt>now()};}
 function configure(id,seconds,auto){if(!id||!Number.isInteger(seconds)||seconds<10||seconds>3600||typeof auto!=='boolean')throw new Error('Descanso inválido. Use de 10 a 3600 segundos.');const x=state(id);memory={sessionId:id,seconds,auto,remainingMs:x.remaining*1000,endsAt:x.endsAt};save();return state(id);}
 function start(id,seconds=state(id).seconds){configure(id,seconds,state(id).auto);memory.remainingMs=seconds*1000;memory.endsAt=now()+seconds*1000;save();return state(id);}
 function pause(id){if(memory?.sessionId!==id)return state(id);memory.remainingMs=Math.max(0,memory.endsAt===null?memory.remainingMs:memory.endsAt-now());memory.endsAt=null;save();return state(id);}
 function resume(id){if(memory?.sessionId!==id||memory.endsAt!==null||memory.remainingMs<=0)return state(id);memory.endsAt=now()+memory.remainingMs;save();return state(id);}
 function stop(id){if(memory?.sessionId===id){memory.remainingMs=0;memory.endsAt=null;save();}return state(id);}
 return {state,configure,start,pause,resume,stop};
}
let storage=null;try{storage=globalThis.localStorage;}catch{}
export const restTimer=createRestTimer({storage});
export function clockLabel(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
// Only replace timer text; never rerender the form or alter training records.
if(typeof document!=='undefined'&&typeof setInterval==='function')setInterval(()=>{for(const element of document.querySelectorAll('[data-rest-session]')){const x=restTimer.state(element.dataset.restSession);element.textContent=x.remaining?clockLabel(x.remaining)+(x.running?' · contando':' · pausado'):'Descanso encerrado / não iniciado';}},1000);
