/* Temporary build-time audit of automatic sync control. No runtime behavior. */
import fs from 'node:fs';
const p='dist/app.js',s=fs.readFileSync(p,'utf8');
const patterns=[/auto[_ -]?sync/ig,/sincroniza[^\n]{0,25}autom[aá]tic/ig,/first.*(upload|send|write)/ig,/sheetSync/ig,/syncEnabled/ig,/sync.*timer/ig];
const spans=[];
for(const re of patterns){let m,c=0;while((m=re.exec(s))&&c++<16){spans.push([Math.max(0,m.index-300),Math.min(s.length,m.index+580)]);}}
spans.sort((a,b)=>a[0]-b[0]);
let out=[],prev=-1;for(const [a,b] of spans){if(a<=prev)continue;out.push(s.slice(a,b).replace(/\n/g,'\\n'));prev=b;if(out.length>=24)break;}
console.log('AUTO_SYNC_BUILD_INSPECT_MATCHES='+out.length);
out.forEach((v,i)=>console.log('AUTO_SYNC_INSPECT_'+i+'='+v.slice(0,850)));
