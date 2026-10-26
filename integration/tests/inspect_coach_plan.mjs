import {readFileSync} from 'node:fs';
for(const name of ['coach_logic.js','coach_commands.js']){
 const s=readFileSync('dist/'+name,'utf8');
 console.log('COACH_SOURCE_BEGIN '+name+' LEN='+s.length);
 const chunks=s.match(/[\s\S]{1,3500}/g)||[];
 for(let i=0;i<Math.min(chunks.length,12);i++)console.log('COACH_SOURCE_CHUNK '+name+' '+i+' '+JSON.stringify(chunks[i]));
 console.log('COACH_SOURCE_END '+name);
}
const app=readFileSync('dist/app.js','utf8');
const keys=['coachPlan=','coachPlan =','coachMode=','coachMode =','function coach','async function coach','coach-plan','coachPlan','createCoach','suggestExercises','draftCoach','coach-recommendation'];
const seen=new Set();
for(const key of keys){
 let at=-1,num=0;while((at=app.indexOf(key,at+1))>=0&&num++<12){
  const k=Math.floor(at/250);if(seen.has(k))continue;seen.add(k);
  const start=Math.max(0,at-700),end=Math.min(app.length,at+1600);
  console.log('COACH_APP_SNIP '+key+' '+at+' '+JSON.stringify(app.slice(start,end)));
 }
}
