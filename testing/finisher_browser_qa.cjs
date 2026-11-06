const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER_PAGE_ERROR:',e.message);});
 await page.goto('http://127.0.0.1:8123/');
 await page.evaluate(async()=>{const store=await import('/store.js'),doc=store.emptyDocument();doc.overlay.exercises.push({id:'ex',name:'Supino reto',muscle_group:'peito'});doc.overlay.exercise_variants.push({id:'v',exercise_id:'ex',equipment_or_variation:'Barra livre',unit:'kg/lado',unit_confirmed:true});doc.overlay.sessions.push({id:'s',name:'QA · treino fictício',date:new Date().toISOString().slice(0,10),status:'in_progress',started_at:new Date(Date.now()-65000).toISOString(),planned_variant_ids:['v'],planned_guidance:{v:{sets:3,min:8,max:12,unit:'repetições'}},duration_minutes:null});const old=await store.readSnapshot();await store.saveSnapshot(doc,old.generation);});
 await page.reload();
 await page.locator('[data-page="workout"]').first().click();
 await page.locator('#quick-set-form').waitFor();
 await page.locator('#quick-set-form [name="load"]').fill('30');
 await page.locator('#quick-set-form [name="reps"]').fill('10');
 await page.locator('#quick-set-form [name="rir"]').fill('2');
 await page.locator('#quick-set-form [name="kind"]').selectOption('effective');
 await page.locator('#quick-set-form button[type="submit"]').click();
 await page.locator('[data-last-set-clock]').waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-last-set-clock]')?.textContent!=='00:00:00',{},{timeout:5000});
 assert.notEqual(await page.locator('[data-last-set-clock]').innerText(),'00:00:00');
 await page.locator('#quick-set-form [name="load"]').scrollIntoViewIfNeeded();
 const entryBounds=await page.evaluate(()=>{const save=document.querySelector('#quick-set-form button[type="submit"]').getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect();return {saveBottom:save.bottom,saveTop:save.top,navTop:nav.top,overflow:document.documentElement.scrollWidth>innerWidth};});
 assert.ok(entryBounds.saveTop>=0&&entryBounds.saveBottom<=entryBounds.navTop-6,JSON.stringify(entryBounds));
 assert.equal(entryBounds.overflow,false);
 const feedbackClear=await page.evaluate(()=>{const toast=document.querySelector('#toast'),save=document.querySelector('#quick-set-form button[type="submit"]').getBoundingClientRect();if(toast.hidden)return true;const rect=toast.getBoundingClientRect();return rect.bottom<=save.top-6||rect.top>=save.bottom+6;});
 assert.equal(feedbackClear,true,'Save feedback must not cover the save action');

 console.log('ENTRY_SCREENSHOT_JPEG='+(await page.locator('.focus-entry').screenshot({type:'jpeg',quality:65})).toString('base64'));
 await page.screenshot({path:'/tmp/fitness-qa-rest.png'});
 await page.locator('[data-finisher-action="open"]').click();
 const form=page.locator('#finisher-set-form');
 await form.locator('[name="load"]').fill('0');await form.locator('[name="reps"]').fill('20');await form.locator('[name="rir"]').fill('0');await form.locator('[name="kind"]').selectOption('effective');await form.locator('[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('.finisher-goal.selected strong')?.textContent==='20 / 50');
 await page.locator('[data-finisher-action="resume-plank"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-plank-clock]')?.textContent!=='00:00:00',{},{timeout:5000});
 assert.ok(Number(await page.locator('[data-plank-progress]').getAttribute('value'))>=1);
 await page.locator('[data-finisher-action="pause-plank"]').click();
 await page.locator('[data-finisher-action="resume-plank"]').waitFor();
 assert.match(await page.locator('[data-plank-clock]').innerText(),/00:00:0[1-9]/);
 await page.reload();await page.locator('[data-page="workout"]').first().click();
 assert.equal(await page.locator('.finisher-goal.selected strong').innerText(),'20 / 50');
 const paused=await page.locator('[data-plank-clock]').innerText();await page.waitForTimeout(1100);assert.equal(await page.locator('[data-plank-clock]').innerText(),paused);
 await page.locator('[data-finisher-action="pause-workout"]').click();await page.locator('[data-finisher-action="resume-workout"]').waitFor();const workoutPaused=await page.locator('[data-session-clock]').innerText();await page.waitForTimeout(1200);assert.equal(await page.locator('[data-session-clock]').innerText(),workoutPaused);assert.equal(await page.locator('[data-finisher-action="resume-plank"]').isDisabled(),true);
 await page.locator('[data-finisher-action="resume-workout"]').click();
 await page.locator('[data-finisher-key="abs"]').click();
 await form.locator('[name="load"]').fill('6');await form.locator('[name="reps"]').fill('25');await form.locator('[name="rir"]').fill('1');await form.locator('[name="kind"]').selectOption('effective');await form.locator('[name="unit"]').selectOption('plaquetas');await form.locator('[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelector('.finisher-goal.selected strong')?.textContent==='25 / 100');
 await form.locator('[name="load"]').scrollIntoViewIfNeeded();
 const finishBounds=await page.evaluate(()=>{const save=document.querySelector('#finisher-set-form button[type="submit"]').getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect(),a=document.querySelector('#finisher-set-form [name="load"]').getBoundingClientRect(),b=document.querySelector('#finisher-set-form [name="reps"]').getBoundingClientRect();return {top:save.top,bottom:save.bottom,nav:nav.top,aligned:Math.abs(a.top-b.top)<2};});
 assert.ok(finishBounds.top>=0&&finishBounds.bottom<=finishBounds.nav-6,JSON.stringify(finishBounds));assert.equal(finishBounds.aligned,true);
 assert.equal(await page.locator('.finisher-goal.selected progress').getAttribute('value'),'25');
 await page.setViewportSize({width:320,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:390,height:844});
 await page.locator('#toast').waitFor({state:'hidden',timeout:6000});
 await page.locator('#finisher-panel').scrollIntoViewIfNeeded();
 console.log('FINISHER_SCREENSHOT_JPEG='+(await page.locator('#finisher-panel').screenshot({type:'jpeg',quality:50})).toString('base64'));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
 await page.screenshot({path:'/tmp/fitness-qa-finisher.png',fullPage:true});
 // Finish review includes unfinished targets and preserves cancellation.
 page.once('dialog',async dialog=>{assert.match(dialog.message(),/Bloco final pendente/);await dialog.dismiss();});
 await page.locator('#finisher-panel [data-coach-action="finish"]').click();
 assert.equal(await page.locator('#finisher-panel').count(),1);
 // Correction of a timed record uses seconds, without mandatory fictitious reps.
 const snapshot=()=>page.evaluate(async()=>{const {readSnapshot}=await import('/store.js');return (await readSnapshot()).document;});
 let doc=await snapshot();const plank=doc.overlay.sets.find(s=>s.finisher_key==='plank');assert.ok(plank);assert.equal(plank.repetitions,null);
 await page.locator('[data-edit-set="'+plank.id+'"]').first().click();
 await page.locator('#edit-plank-form [name="seconds"]').fill('30');await page.locator('#edit-plank-form [type="submit"]').click();
 await page.locator('#finisher-panel').waitFor();doc=await snapshot();assert.equal(doc.overlay.sets.find(s=>s.id===plank.id).duration_ms,30000);
 page.once('dialog',d=>d.accept());await page.locator('#finisher-panel [data-coach-action="finish"]').click();
 await page.getByRole('heading',{name:'Treino concluído'}).waitFor();doc=await snapshot();assert.equal(doc.overlay.sessions[0].status,'completed');assert.ok(doc.overlay.sessions[0].finished_at);
 await page.locator('[data-preset-id="rpg_deck_01"]').click();
 const imageNames=['supino-inclinado-halteres','supino-reto-barra','supino-declinado-maquina','crucifixo-maquina-inclinada','rosca-scott-unilateral','rosca-inclinada-45','rosca-martelo','elevacao-lateral-polia'];
 const cards=page.locator('.proposal-list .sport-card.has-exercise-art');assert.equal(await cards.count(),8);
 for(let i=0;i<8;i++){
  const img=cards.nth(i).locator('.exercise-card-image');await img.scrollIntoViewIfNeeded();
  await page.waitForFunction(src=>[...document.images].some(im=>im.getAttribute('src')===src&&im.complete&&im.naturalWidth>0),'./exercise-'+imageNames[i]+'.webp');
  assert.equal(await img.getAttribute('src'),'./exercise-'+imageNames[i]+'.webp');
  const ratio=await img.evaluate(im=>{const r=im.getBoundingClientRect();return r.height/r.width;});assert.ok(Math.abs(ratio-1.5)<0.02,'Full portrait must retain its aspect ratio');
  const fits=await img.evaluate(im=>{const a=im.getBoundingClientRect(),b=im.parentElement.getBoundingClientRect();return Math.abs(a.height-b.height)<2&&Math.abs(a.width-b.width)<2;});assert.equal(fits,true,'Portrait container must not clip any part of the artwork');

 }
 await cards.first().scrollIntoViewIfNeeded();console.log('UPLOADED_CARD_SCREENSHOT_JPEG='+(await cards.first().screenshot({type:'jpeg',quality:55})).toString('base64'));
 console.log('UPLOADED_ART_EIGHT_CORRECT_LOADED_UNCROPPED=PASS');
 await page.locator('[data-coach-action="clear"]').click();await page.locator('[data-preset-id="rpg_deck_02"]').click();
 const secondImages=['puxada-alta','remada-articulada-apoio','puxada-alta-unilateral','remada-alta-apoio-peito','triceps-frances-polia-barra-v','triceps-polia-barra-v','triceps-testa-barra-v','crucifixo-inverso-maquina'];
 const secondCards=page.locator('.proposal-list .sport-card.has-exercise-art');assert.equal(await secondCards.count(),8);
 for(let i=0;i<8;i++){
  const img=secondCards.nth(i).locator('.exercise-card-image');await img.scrollIntoViewIfNeeded();
  const src='./exercise-'+secondImages[i]+'.webp';assert.equal(await img.getAttribute('src'),src);
  await page.waitForFunction(src=>[...document.images].some(im=>im.getAttribute('src')===src&&im.complete&&im.naturalWidth>0),src);
  assert.equal(await img.evaluate(im=>{const a=im.getBoundingClientRect(),b=im.parentElement.getBoundingClientRect();return Math.abs(a.height/a.width-1.5)<0.02&&Math.abs(a.height-b.height)<2&&Math.abs(a.width-b.width)<2;}),true);
 }
 const thirdArts=await page.evaluate(async()=>{const {presetPlan}=await import('/principal_presets.js'),{exerciseArt}=await import('/principal_exercise_art.js');return presetPlan('rpg_deck_03',{sessions:[],sets:[],exercises:[],exercise_variants:[]},'2026-11-06').items.map(x=>exerciseArt(x.name,x.equipment)?.src||null);});
 assert.equal(thirdArts[1],'./exercise-triceps-frances-polia-barra-v.webp');assert.equal(thirdArts[3],'./exercise-triceps-polia-barra-v.webp');assert.equal(thirdArts[5],'./exercise-triceps-testa-halteres.webp');assert.equal(thirdArts[8],'./exercise-crucifixo-inverso-maquina.webp');
 await page.locator('#toast').waitFor({state:'hidden',timeout:6000});
 await secondCards.first().scrollIntoViewIfNeeded();console.log('SECOND_DECK_ART_SCREENSHOT_JPEG='+(await secondCards.first().screenshot({type:'jpeg',quality:55})).toString('base64'));
 console.log('SECOND_DECK_EIGHT_IMAGES_LOADED_UNCROPPED_AND_THIRD_DECK_VARIANTS=PASS');
 await page.locator('[data-coach-action="clear"]').click();await page.locator('[data-preset-id="rpg_deck_03"]').click();
 const thirdImages=['rosca-scott-unilateral','triceps-frances-polia-barra-v','rosca-polia-alongada','triceps-polia-barra-v','rosca-martelo','triceps-testa-halteres','desenvolvimento-ombros-maquina','elevacao-lateral-polia','crucifixo-inverso-maquina'];
 const thirdCards=page.locator('.proposal-list .sport-card.has-exercise-art');assert.equal(await thirdCards.count(),9);
 for(let i=0;i<9;i++){
  const img=thirdCards.nth(i).locator('.exercise-card-image');await img.scrollIntoViewIfNeeded();
  const src='./exercise-'+thirdImages[i]+'.webp';assert.equal(await img.getAttribute('src'),src);
  await page.waitForFunction(src=>[...document.images].some(im=>im.getAttribute('src')===src&&im.complete&&im.naturalWidth>0),src);
  assert.equal(await img.evaluate(im=>{const a=im.getBoundingClientRect(),b=im.parentElement.getBoundingClientRect();return Math.abs(a.height/a.width-1.5)<0.02&&Math.abs(a.height-b.height)<2&&Math.abs(a.width-b.width)<2;}),true);
 }
 await thirdCards.nth(2).scrollIntoViewIfNeeded();console.log('THIRD_DECK_ART_SCREENSHOT_JPEG='+(await thirdCards.nth(2).screenshot({type:'jpeg',quality:55})).toString('base64'));
 console.log('THIRD_DECK_ALL_NINE_IMAGES_LOADED_UNCROPPED_CORRECT_VARIANTS=PASS');
 await page.locator('[data-coach-action="clear"]').click();await page.locator('[data-preset-id="rpg_deck_04"]').click();
 const fourthImages=["leg-press-45", "hack-machine", "cadeira-extensora", "cadeira-flexora", "cadeira-abdutora", "cadeira-adutora", "panturrilha-sentada"];
 const fourthCards=page.locator('.proposal-list .sport-card.has-exercise-art');assert.equal(await fourthCards.count(),7);
 for(let i=0;i<7;i++){
  const img=fourthCards.nth(i).locator('.exercise-card-image');await img.scrollIntoViewIfNeeded();
  const src='./exercise-'+fourthImages[i]+'.webp';assert.equal(await img.getAttribute('src'),src);
  await page.waitForFunction(src=>[...document.images].some(im=>im.getAttribute('src')===src&&im.complete&&im.naturalWidth>0),src);
  assert.equal(await img.evaluate(im=>{const a=im.getBoundingClientRect(),b=im.parentElement.getBoundingClientRect();return Math.abs(a.height/a.width-1.5)<0.02&&Math.abs(a.height-b.height)<2&&Math.abs(a.width-b.width)<2;}),true);
 }
 await fourthCards.nth(0).scrollIntoViewIfNeeded();console.log('FOURTH_DECK_ART_SCREENSHOT_JPEG='+(await fourthCards.nth(0).screenshot({type:'jpeg',quality:55})).toString('base64'));
 console.log('FOURTH_DECK_SEVEN_IMAGES_LOADED_UNCROPPED=PASS');



 assert.deepEqual(errors,[]);console.log('BROWSER_MOBILE_FINISHER_REST_PAUSE_REOPEN_EDIT_FINISH=PASS');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});






