// Extraído do workflow antigo (etapa v0.9): conferência de backups. A parte do cache offline antigo foi aposentada (substituída pelos testes de ponta a ponta).
import assert from 'node:assert/strict';
import {emptyDocument,commit} from '../store.js';
import {encryptBackup} from '../backup.js';
import {fingerprintDocument,verifyExportedBackup} from '../integrity.js';
const doc=emptyDocument(),hash=await fingerprintDocument(doc);
assert.equal(hash.length,64);
assert.equal((await verifyExportedBackup(JSON.stringify(doc),'',{revision:0,fingerprint:hash})).valid,true);
await assert.rejects(verifyExportedBackup(JSON.stringify(doc),'',{revision:1,fingerprint:hash}),/revisão/);
await assert.rejects(verifyExportedBackup(JSON.stringify(commit(doc,d=>d.settings.weekly_goal=5)),'',{revision:0,fingerprint:hash}),/revisão/);
const different=structuredClone(doc);different.settings.weekly_goal=5;
await assert.rejects(verifyExportedBackup(JSON.stringify(different),'',{revision:0,fingerprint:hash}),/exatamente/);
const encrypted=await encryptBackup(doc,'senha-publica-sintetica-longa');
assert.equal((await verifyExportedBackup(JSON.stringify(encrypted),'senha-publica-sintetica-longa',{revision:0,fingerprint:hash})).valid,true);
await assert.rejects(verifyExportedBackup(JSON.stringify(encrypted),'errada',{revision:0,fingerprint:hash}),/Senha incorreta/);
console.log('V09_BACKUP_SMOKE=7');
