import assert from 'node:assert/strict';
import {inspectSyncPreflight,summarizeForPublicCI} from './sync_preflight.mjs';
import {stageInbound,previewRemote} from '../integration/sheet_sync_core.js';
let count=0;const ok=(title,check)=>{check();count++;console.log('PASS '+title);};
const makeRows=()=>({
 Treinos:[['Data','Dia','Sessão','Status'],['2026-10-20','Terça','Peito sintético','Concluído']],
 Series:[['Data','Sessão','Exercício','Equipamento / variação','Tipo','Série','Carga','Unidade','Reps','RIR','RPE'],['2026-10-20','Peito sintético','Supino sintético','Barra','Efetiva','1','50','kg','10','2','8']],
 Peso:[['Data','Peso (kg)']]
});
const makeDoc=()=>({format:'treino-evolucao-android-v1',version:1,base:null,overlay:{sessions:[],sets:[],exercises:[],exercise_variants:[],weigh_ins:[]},settings:{weekly_goal:4,templates:[]},revision:0,last_backup_revision:0});
const localSet=(provenance)=>{
 const doc=makeDoc();
 doc.overlay.sessions.push({id:'s1',date:'2026-10-20',name:'Peito sintético',status:'completed'});
 doc.overlay.exercises.push({id:'ex1',name:'Supino sintético'});
 doc.overlay.exercise_variants.push({id:'v1',exercise_id:'ex1',equipment_or_variation:'Barra',unit:'kg',unit_confirmed:true});
 doc.overlay.sets.push({id:'set1',date:'2026-10-20',session_id:'s1',exercise_id:'ex1',variant_id:'v1',set_type:'effective',set_number:1,load_value:50,repetitions:10,rir:2,rpe:8,...(provenance?{provenance}:{})});
 return doc;
};
const clean=inspectSyncPreflight(makeDoc(),makeRows());
ok('Reconhece 1 treino',()=>assert.equal(clean.counts.remote.sessions,1));
ok('Reconhece 1 série',()=>assert.equal(clean.counts.remote.sets,1));
ok('Base vazia não cria alarme',()=>assert.equal(clean.safeForUnattendedMigration,true));
const legacy=localSet();
const before=JSON.stringify(legacy);
const risk=inspectSyncPreflight(legacy,makeRows());
ok('Detecta série legada sem proveniência',()=>assert.equal(risk.counts.missingProvenance,1));
ok('Bloqueia mesclagem desassistida ambígua',()=>assert.equal(risk.safeForUnattendedMigration,false));
ok('Diagnóstico não altera dados locais',()=>assert.equal(JSON.stringify(legacy),before));
const copied=stageInbound(legacy,makeRows()).next;
ok('Regressão corrigida: série histórica não identificada vinculada sem duplicação',()=>{assert.equal(copied.overlay.sets.length,1);assert.deepEqual(copied.overlay.sets[0].provenance?.sheet,'Series');});
const linked=localSet({sheet:'Series',row:2});
const safe=inspectSyncPreflight(linked,makeRows());
ok('Identidade de linha existente reconhecida',()=>assert.equal(safe.safeForUnattendedMigration,true));
ok('Identidade existente não cria cópia',()=>assert.equal(previewRemote(linked,makeRows()).counts.Series,0));
const changed=makeRows();changed.Series[1][6]='55';
const drift=inspectSyncPreflight(linked,changed);
ok('Edição remota de carga sinalizada',()=>assert.equal(drift.counts.changedImported,1));
ok('Mudança remota não é silenciosamente aprovada',()=>assert.equal(drift.safeForUnattendedMigration,false));
const different=localSet();different.overlay.exercise_variants[0].unit='plaquetas';
ok('Variações de unidades não confundidas',()=>assert.equal(inspectSyncPreflight(different,makeRows()).counts.missingProvenance,0));
const repeated=makeRows();repeated.Series.push([...repeated.Series[1]]);
ok('Duas séries remotas iguais exigem revisão sem apagar nenhuma',()=>assert.equal(inspectSyncPreflight(makeDoc(),repeated).review.some(x=>x.reason==='series_remotas_equivalentes'),true));
const multi=localSet();multi.overlay.sessions.push({id:'s2',name:'Peito sintético',date:'2026-10-20',status:'completed'});
ok('Sessões duplicadas sinalizadas',()=>assert.equal(inspectSyncPreflight(multi,makeRows()).counts.overlappingSessions,1));
const invalid=makeRows();invalid.Treinos[0][0]='Erro';
ok('Esquema de cabeçalho inválido rejeitado',()=>assert.throws(()=>inspectSyncPreflight(makeDoc(),invalid),/Cabeçalho/));
const duplicateIds=makeRows();duplicateIds.Series[1][14]='app1';duplicateIds.Series.push([...duplicateIds.Series[1]]);
ok('IDs remotos repetidos rejeitados',()=>assert.throws(()=>inspectSyncPreflight(makeDoc(),duplicateIds),/duplicado/));
const summary=summarizeForPublicCI(risk);
ok('Resumo de CI sem conteúdos privados',()=>assert.deepEqual(Object.keys(summary).sort(),['ambiguousRows','changedImported','missingProvenance','overlappingSessions','safeForUnattendedMigration'].sort()));
console.log('ETAPA0_PREFLIGHT_TESTS='+count);
