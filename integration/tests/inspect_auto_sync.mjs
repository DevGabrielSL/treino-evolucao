/* Build-only inspection of automatic Sheets sync. No user data. */
import fs from 'node:fs';
const s=fs.readFileSync('dist/app.js','utf8');
const words=['verifiedWrite','sheets-auto','sheets-sync','autoSync','auto_sync','sheetsAutomatic','syncAutomatic','sheets_auto','sheetsLast','sheetsBusy','syncInProgress','document.addEventListener','window.addEventListener'];
const seen=new Set();
let n=0;
for(const word of words){
 let pos=-1,count=0;
 while((pos=s.indexOf(word,pos+1))>=0 && count++<9){
  const key=Math.floor(pos/300);
  if(seen.has(key))continue;seen.add(key);
  const begin=Math.max(0,pos-380),end=Math.min(s.length,pos+850);
  const snippet=s.slice(begin,end).replaceAll('\n',' ⏎ ').slice(0,1220);
  console.log('AUTO_FIND_'+word+'_'+(++n)+'='+snippet);
 }
}
console.log('AUTO_FIND_COUNT='+n);
