import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=n=>fs.readFileSync(new URL('../dist/'+n,import.meta.url),'utf8');
const m=JSON.parse(read('manifest.webmanifest'));
assert.equal(m.id,'./');assert.equal(m.start_url,'./index.html');
assert.equal(m.background_color,'#10171e');assert.equal(m.theme_color,'#10171e');
for(const size of [192,512]){
 const name='icons/icon-rpg-'+size+'.png',png=fs.readFileSync(new URL('../dist/'+name,import.meta.url));
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
 assert.ok(m.icons.some(x=>x.src==='./'+name&&x.purpose.includes('maskable')));
 for(const cache of ['sw.js','integrity.js'])assert.ok(read(cache).includes("'./"+name+"'"));
}
const html=read('index.html'),css=read('principal_launch.css'),app=read('app.js');
assert.ok(html.includes('class="rpg-launch"'));assert.ok(html.includes('role="status" class="launch-status"'));
assert.ok(html.includes('manifest.webmanifest?v=150'));assert.ok(html.includes('principal_launch.css?v=150'));
assert.ok(css.includes('prefers-reduced-motion'));assert.ok(!html.includes('Preparando seus dados locais'));
// Existing successful render replaces the initial main content; initialization remains asynchronous.
assert.ok(app.includes("$('#app').innerHTML=pages[page](m)"));assert.ok(app.includes('const snap=await readSnapshot()'));
assert.ok(app.includes('Erro ao abrir dados locais'));
for(const cache of ['sw.js','integrity.js'])assert.ok(read(cache).includes("'./manifest.webmanifest?v=150'"));
console.log('PRINCIPAL_LAUNCH_ICONS_MANIFEST_CACHE_BOOT=PASS');
