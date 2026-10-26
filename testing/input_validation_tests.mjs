import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSeriesMessage as parse} from '../dist/testes/coach_logic.js';
import {createSandboxDocument} from '../dist/testes/test_seed.js';
import {decodeBackup} from '../dist/testes/backup.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures.json',import.meta.url)));let n=0;
for(const text of ['50 kg 10.0 reps RIR 2','50 x 10,0 RIR 2','50 x 10lb RIR 2','50 kg 10 reps RIR 2abc','-50 kg 10 reps RIR 2','50 kg -10 reps RIR 2','50 kg 10.5 reps RIR 2','50 kg 10,5 reps RIR 2','50 x 10.5 RIR 2','50 kg 10 reps RIR -2','50 kg 10 reps RIR 0-20','50 x 10 lb RIR 2','50 kg 10 reps RIR abc','50 kg 10 reps RIR 3-1','50 kg 10 reps RIR 1 RIR 2','50.5.2 kg 10 reps']){assert.throws(()=>parse(text,'kg'),text);n++;}
for(const text of ['50 kg 10 reps RIR 2','50,5 kg 10 reps RIR 1,5','50 x 10 RIR 1-2','50 kg 10 reps','0 kg 10 reps RIR 0','50 kg 10 reps RIR 1 - 2']){const r=parse(text,'kg');assert.equal(r.repetitions,10);n++;}
assert.equal(parse('50,5 kg 10 reps RIR 1,5').load_value,50.5);n++;
for(const [field,value] of [['rpe',99],['rpe',-1],['rpe','8'],['rpe',Infinity]]){const d=createSandboxDocument(fixture);d.overlay.sets[0][field]=value;await assert.rejects(decodeBackup(d,''));n++;}
for(const value of [-1,'45',Infinity]){const d=createSandboxDocument(fixture);d.overlay.sessions[0].duration_minutes=value;await assert.rejects(decodeBackup(d,''));n++;}
const d=createSandboxDocument(fixture);d.overlay.sets[0].rir=20;assert.deepEqual(await decodeBackup(d,''),d);n++;
console.log('INPUT_VALIDATION_TESTS='+n);
