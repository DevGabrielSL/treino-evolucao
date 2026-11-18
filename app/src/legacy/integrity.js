/* Release QA: local verification only. Never sends workout data to a server. */
import {decodeBackup} from './backup.js';
import {validateDocument} from './store.js';

export const CACHE_NAME='treino-evolucao-android-shell-v208-mission-effects';
export const OFFLINE_ASSETS=['./','./index.html','./styles.css','./store.js','./metrics.js','./backup.js','./edit_ops.js','./template_ops.js','./insights.js','./history.js','./body.js','./integrity.js','./legacy_identity.js','./remote_reconcile.js','./sheet_sync_core.js?v=196','./write_receipt.js','./automatic_sync.js','./principal_transport.js?v=201','./sheet_sync_browser.js?v=201','./sheets_config.js','./coach_plan_read.js','./coach_substitution.js','./coach_policy.js','./coach_logic.js?v=121','./coach_commands.js','./coordinator_client.js?v=200','./principal_sync_fix.js?v=196','./principal_cards.js?v=198','./principal_rpg.js','./principal_xp.js?v=208','./principal_rpg.css','./rpg-training.webp','./principal_planner.css?v=149','./rpg-planner.webp','./principal_visibility.css?v=144','./principal_entry.css?v=141','./principal_world.css?v=140','./rpg-citadel.webp','./rpg-arena.webp','./rpg-archive.webp','./principal_cards.css','./principal_cards_premium.css?v=131r2','./principal_motion.js?v=132','./principal_intent.js','./principal_visual.js','./principal_visual.css','./principal_rest.js','./principal_live.js?v=198','./principal_dose.js?v=131','./principal_variety.js?v=131','./balanced_coach.js?v=121','./app.js?v=208','./deck-cover-01.webp','./deck-cover-02.webp','./deck-cover-03.webp','./deck-cover-04.webp','./exercise-rosca-scott-maquina.webp','./exercise-rosca-direta-polia.webp','./brand-waterfront.webp','./principal_brand.css?v=205','./principal_mission.css?v=208','./mission-cover.webp','./mission-deck.webp','./mission-avenue.webp','./mission-incline.webp','./principal_coastal.css?v=203','./coastal-training.webp','./coastal-city.webp','./principal_exercise_art.js?v=206','./exercise-supino-inclinado-halteres.webp','./exercise-rosca-inclinada-45.webp','./exercise-rosca-martelo.webp','./exercise-elevacao-lateral-polia.webp','./exercise-supino-reto-barra.webp','./exercise-rosca-scott-unilateral.webp','./exercise-supino-declinado-maquina.webp','./exercise-crucifixo-maquina-inclinada.webp','./exercise-puxada-alta.webp','./exercise-remada-articulada-apoio.webp','./exercise-puxada-alta-unilateral.webp','./exercise-remada-alta-apoio-peito.webp','./exercise-triceps-frances-polia-barra-v.webp','./exercise-triceps-polia-barra-v.webp','./exercise-triceps-testa-barra-v.webp','./exercise-crucifixo-inverso-maquina.webp','./exercise-desenvolvimento-ombros-maquina.webp','./exercise-rosca-polia-alongada.webp','./exercise-triceps-testa-halteres.webp','./exercise-leg-press-45.webp','./exercise-hack-machine.webp','./exercise-cadeira-extensora.webp','./exercise-cadeira-flexora.webp','./exercise-cadeira-abdutora.webp','./exercise-cadeira-adutora.webp','./exercise-panturrilha-sentada.webp','./principal_finisher.js?v=198','./manifest.webmanifest?v=205','./principal_deckrow.css?v=165','./principal_presets.js?v=198','./principal_presets.css?v=163','./principal_focus.css?v=208','./principal_relics.css?v=169','./relic-emblem.svg','./relic-group-scenes.webp','./relic-supino-card.webp','./principal_relics_art.css?v=194','./principal_unit.js?v=198','./principal_cancel.js?v=152','./principal_install.js?v=151','./principal_launch.css?v=150','./icons/icon-mission-192.png','./icons/icon-mission-512.png','./icons/icon-192.png','./icons/icon-512.png'];

export async function fingerprintDocument(doc){
 validateDocument(doc);
 if(!globalThis.crypto?.subtle)throw new Error('Verificação criptográfica indisponível. Use HTTPS.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(doc)));
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}

/** Checks the file the user actually selects, not merely a reported download. */
export async function verifyExportedBackup(text,password,{revision,fingerprint}){
 if(typeof text!=='string'||text.length>15*1024*1024)throw new Error('Arquivo de backup excede 15 MB.');
 if(!Number.isInteger(revision)||revision<0||!/^[a-f0-9]{64}$/.test(fingerprint||''))throw new Error('Nenhuma exportação pendente de verificação.');
 let raw;
 try{raw=JSON.parse(text);}catch{throw new Error('Arquivo não é JSON válido.');}
 const decoded=await decodeBackup(raw,password);
 if(decoded.revision!==revision)throw new Error('O arquivo selecionado corresponde a outra revisão.');
 const found=await fingerprintDocument(decoded);
 if(found!==fingerprint)throw new Error('Este arquivo não corresponde exatamente ao backup exportado.');
 return {revision:decoded.revision,valid:true};
}

export async function inspectOfflineCache(cacheStorage,scope,CACHE=CACHE_NAME,assets=OFFLINE_ASSETS){
 if(!cacheStorage||typeof cacheStorage.open!=='function')return {complete:false,cached:0,total:assets.length,missing:[...assets]};
 const names=typeof cacheStorage.keys==='function'?await cacheStorage.keys():[];
 if(!names.includes(CACHE))return {complete:false,cached:0,total:assets.length,missing:[...assets]};
 const cache=await cacheStorage.open(CACHE),missing=[];
 for(const relative of assets){
  const url=new URL(relative,scope).href;
  if(!await cache.match(url))missing.push(relative);
 }
 return {complete:missing.length===0,cached:assets.length-missing.length,total:assets.length,missing};
}
