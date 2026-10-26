import fs from 'node:fs';
const src=fs.readFileSync('dist/app.js','utf8');
for(const [name,start,end] of [
 ['SYNC','async function sheetsSyncNow','function updateConnectivity'],
 ['SAVE','async function perform','function parseNumber'],
 ['INIT','async function init','window.addEventListener(\'beforeinstallprompt\''],
 ['EVENT','window.addEventListener(\'online\'','window.addEventListener(\'offline\'']
]){
 const a=src.indexOf(start),b=a<0?-1:src.indexOf(end,a+start.length);
 const data=a<0?'MISSING':src.slice(a,b>a?Math.min(b,a+11500):a+9500);
 console.log('AUTO_DETAIL_'+name+'='+data.replaceAll('\\n',' ⏎ ').slice(0,11500));
}
