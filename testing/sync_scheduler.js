export function createAutomaticSyncScheduler({
 getSnapshot,run,delayMs=1200,
 setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),
 onFailure=()=>{}
}={}){
 if(typeof getSnapshot!=='function'||typeof run!=='function')throw new Error('Agendador precisa de estado e executor.');
 let handle=null,inFlight=false,lastRevision=-1,queued=null,runningRevision=-1,pendingSave=false,epoch=0;
 function cancel(){if(handle!==null){clearTimer(handle);handle=null;}queued=null;pendingSave=false;epoch++;}
 function request(reason='save'){
  const snap=getSnapshot();
  // A local save must remain pending even while the transport marks the app busy.
  if(inFlight){
   const gate=automaticSyncEligibility({...snap,busy:false,sheetsBusy:false,reason});
   if(gate.allowed&&reason==='save'&&(snap.doc.revision??0)!==runningRevision)pendingSave=true;
   return {allowed:false,reason:'in_flight'};
  }
  const gate=automaticSyncEligibility({...snap,reason});
  if(!gate.allowed)return gate;
  const revision=snap.doc.revision??0;
  if(reason==='save'&&revision===lastRevision)return {allowed:false,reason:'already_checked'};
  if(handle!==null)clearTimer(handle);
  queued=reason;
  handle=setTimer(async()=>{
   handle=null;
   const origin=queued;queued=null;
   const actual=getSnapshot(),live=automaticSyncEligibility({...actual,reason:origin});
   if(!live.allowed||inFlight)return;
   const currentRev=actual.doc.revision??0;
   if(origin==='save'&&currentRev===lastRevision)return;
   inFlight=true;runningRevision=currentRev;pendingSave=false;
   const startedEpoch=epoch;let succeeded=false;
   try{succeeded=(await run({automatic:true}))!==false;}
   catch(error){onFailure(error);}
   finally{
    inFlight=false;
    // Failed or skipped runs never consume the revision. A retry needs a new event;
    // no unattended retry loop is started after an uncertain write.
    if(succeeded){
     lastRevision=startedEpoch===epoch&&!pendingSave?(getSnapshot()?.doc?.revision??currentRev):currentRev;
     if(pendingSave&&startedEpoch===epoch){lastRevision=-1;pendingSave=false;request('save');}
    }
   }
  },delayMs);
  return {allowed:true,reason:'scheduled'};
 }
 return {request,cancel,isRunning:()=>inFlight,hasSchedule:()=>handle!==null};
}
