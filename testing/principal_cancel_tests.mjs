import assert from 'node:assert/strict';
import {cancelLocalSession} from '../dist/principal_cancel.js';
const make=()=>({overlay:{sessions:[{id:'a',status:'in_progress'},{id:'b',status:'completed'}],sets:[{id:'1',session_id:'a',repetitions:10}],exercises:[]}});
const doc=make(),sets=JSON.stringify(doc.overlay.sets);cancelLocalSession(doc,'a');
assert.equal(doc.overlay.sessions.length,2);assert.equal(doc.overlay.sessions[0].status,'cancelled');assert.equal(doc.overlay.sessions[1].status,'completed');assert.equal(JSON.stringify(doc.overlay.sets),sets);
const empty=make();empty.overlay.sets=[];cancelLocalSession(empty,'a');assert.equal(empty.overlay.sessions[0].status,'cancelled');assert.equal(empty.overlay.sets.length,0);
for(const id of ['b','missing']){const d=make(),before=JSON.stringify(d);assert.throws(()=>cancelLocalSession(d,id));assert.equal(JSON.stringify(d),before);}
const imported=make();imported.overlay.sessions[0].provenance={sheet:{row:1}};assert.throws(()=>cancelLocalSession(imported,'a'));assert.equal(imported.overlay.sessions[0].status,'in_progress');
console.log('CANCEL_EMPTY_PRESERVE_SETS_REJECT_STALE=PASS');
