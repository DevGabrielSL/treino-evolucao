import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=n=>fs.readFileSync(new URL('../dist/'+n,import.meta.url),'utf8');
for(const name of ['citadel','arena','archive']){
 const file='rpg-'+name+'.webp',b=fs.readFileSync(new URL('../dist/'+file,import.meta.url));
 assert.equal(b.subarray(8,12).toString(),'WEBP');assert.ok(b.length<250000);
 for(const cache of ['sw.js','integrity.js'])assert.ok(read(cache).includes("'./"+file+"'"));
}
const css=read('principal_world.css'),app=read('app.js');
assert.ok(app.includes('document.body.dataset.realm=page;'));
assert.ok(app.includes('header class="realm-banner"'));
assert.ok(read('index.html').includes('app.js?v=162'));
assert.ok(read('index.html').includes('principal_world.css?v=140'));
for(const p of ['workout','history','progress','more','templates','body','data'])assert.ok(css.includes('data-page='+p));
assert.ok(css.includes('prefers-reduced-motion'));
// WCAG contrast of the real theme's plain panel text and secondary text.
const lum=h=>{const c=h.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722};
for(const [fg,bg] of [['f2eee4','15212b'],['c3c9cb','15212b'],['161d23','ac8847'],['f7f4ed','0e1922']])assert.ok((Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05)>=4.5);
console.log('PRINCIPAL_WORLD_ASSETS_ROUTES_CACHE_CONTRAST=PASS');
