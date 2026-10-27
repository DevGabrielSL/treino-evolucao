import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync(new URL('./diagnostico_conexao.js',import.meta.url),'utf8');
async function simulate(response){let handler,request,display={textContent:''},button={disabled:false,addEventListener:(_,f)=>handler=f};
 let ctx={document:{getElementById:id=>id==='result'?display:button},google:{accounts:{oauth2:{initTokenClient:({callback})=>({requestAccessToken:()=>callback({access_token:'dummy-token'})})}}},fetch:async(url,o)=>{request={url,...o};return response},URL,encodeURIComponent};
 vm.runInNewContext(code,ctx);await handler();return {display,button,request};}
let result=await simulate({ok:true,json:async()=>({done:true,response:{result:{ok:true,protocol:1,spreadsheetId:'15Nntilky9pyv1OrQMyOd6k97DsE_tU7I4aJtISQdL2M',environment:'production'}}})});
assert.match(result.display.textContent,/Conexão confirmada/);assert.equal(JSON.parse(result.request.body).parameters[0].action,'read');assert.equal(result.button.disabled,false);
result=await simulate({ok:false,status:403,json:async()=>({error:{message:'Denied dummy-token',details:[{reason:'PERMISSION_DENIED'}]}})});
assert.match(result.display.textContent,/PERMISSION_DENIED/);assert.doesNotMatch(result.display.textContent,/dummy-token/);
console.log('DIAGNOSTIC_TESTS=PASS');
