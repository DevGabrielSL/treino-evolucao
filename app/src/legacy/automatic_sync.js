import {coordinatorReady} from './coordinator_client.js';
/* Etapa 4 — automatic sync policy.
 * Offline-first: automatic synchronization only with user consent, a prior
 * verified manual write for this exact spreadsheet, valid in-memory OAuth,
 * an online/idle foreground page, and a completed local record.
 * This module never starts background jobs or saves private data itself.
 */
const items=(doc,key)=>Array.isArray(doc?.overlay?.[key])?doc.overlay[key]:[];
export function completedCandidates(doc){
 if(!doc)return false;
 const sessions=[...(doc.base?.entities?.sessions||[]),...items(doc,'sessions')];
 const done=new Set(sessions.filter(s=>s.status==='completed').map(s=>s.id));
 return items(doc,'sessions').some(s=>s.status==='completed'&&!s.provenance?.sheet)
  ||items(doc,'sets').some(s=>done.has(s.session_id)&&!s.provenance?.sheet)
  ||items(doc,'weigh_ins').some(w=>!w.provenance?.sheet);
}
export function automaticSyncEligibility({doc,sheetId,online,authorized,busy,sheetsBusy,reason='save'}={}){
 const state=doc?.settings?.sheet_sync;
 if(!doc||!state?.auto)return {allowed:false,reason:'disabled'};
 if(!coordinatorReady())return {allowed:false,reason:'coordinator_unavailable'};
 if(!state.last_write_confirmed_at)return {allowed:false,reason:'first_write_not_verified'};
 if(!sheetId||state.spreadsheet_id!==sheetId)return {allowed:false,reason:'wrong_spreadsheet'};
 if(!online)return {allowed:false,reason:'offline'};
 if(!authorized)return {allowed:false,reason:'reauthorize'};
 if(busy||sheetsBusy)return {allowed:false,reason:'busy'};
 if(reason!=='online'&&reason!=='authorization'&&!completedCandidates(doc))
  return {allowed:false,reason:'no_completed_records'};
 return {allowed:true,reason:'ready'};
}
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
