import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {timedSeconds,outboundSeriesLabel,coordinatorExecutionFailure} from '../dist/principal_sync_fix.js';
assert.equal(timedSeconds('segundos','Bloco final · Prancha · 30.25 segundos'),30.25);
assert.equal(timedSeconds('segundos','Bloco final · Prancha · 0 segundos'),null);
assert.equal(timedSeconds('kg','Bloco final · Prancha · 30 segundos'),null);
const row=['2026-11-06','Treino','Prancha','Peso corporal','Trabalho',1,0,'segundos','',0,'','','','Bloco final · Prancha · 30.25 segundos','set_timed'];
assert.match(outboundSeriesLabel(row),/30.25 segundos$/);
assert.ok(!outboundSeriesLabel(row).includes('×'));
for(const file of ['testing/coordinator/Code.gs','Code.gs']){
 const code=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx=vm.createContext({});vm.runInContext(code,ctx);
 const op={protocol:1,action:'append',operationId:'test_operation_196',expectedRevision:0,records:[{tab:'Series',values:row}]};
 ctx.op=op;vm.runInContext('operation_(op)',ctx);
 for(const change of [r=>r[8]=1,r=>r[13]='Bloco final · Prancha · 0 segundos',r=>r[7]='kg']){
  const bad=structuredClone(op);change(bad.records[0].values);ctx.op=bad;
  assert.throws(()=>vm.runInContext('operation_(op)',ctx),/INVALID_SET/);
 }
}
assert.equal(coordinatorExecutionFailure({done:true,response:{}}),null);
const issue=coordinatorExecutionFailure({done:true,error:{details:[{errorMessage:'Error: INVALID_SET'}]}});
assert.equal(issue.code,'COORDINATOR_INVALID_SET');assert.match(issue.message,/prancha/);
assert.equal(coordinatorExecutionFailure({done:true,error:{details:[{errorMessage:'ReferenceError: Sheets is not defined'}]}}).code,'COORDINATOR_SERVICE_REQUIRED');
const privateMsg='token_private_person@example.com';
assert.ok(!coordinatorExecutionFailure({done:true,error:{message:privateMsg}}).message.includes(privateMsg));
console.log('TIMED_SERIES_SERVER_AND_EXECUTION_DIAGNOSTICS=PASS');
