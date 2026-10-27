/* Read-only diagnostic: never records or displays OAuth tokens. */
const clientId='602777854503-374on96suo3909l98m0fadbgp9mso5fn.apps.googleusercontent.com';
const sheetId='15Nntilky9pyv1OrQMyOd6k97DsE_tU7I4aJtISQdL2M';
const deployment='AKfycbzUX-IlqYS0PFc0B759EHpMmrfoIxOmh4lJha3QQQBrP6NG7M46claSoRny2lAOdVsnBQ';
const scope='https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email';
const display=document.getElementById('result'),button=document.getElementById('check');
function message(text){display.textContent=text;}
function token(){return new Promise((resolve,reject)=>{
 if(!globalThis.google?.accounts?.oauth2)return reject(new Error('O login do Google não carregou. Confira a conexão e tente novamente.'));
 google.accounts.oauth2.initTokenClient({client_id:clientId,scope,callback:r=>r.error||!r.access_token?reject(new Error('Autorização não concluída.')):resolve(r.access_token),error_callback:()=>reject(new Error('A janela de autorização foi cancelada ou bloqueada.'))}).requestAccessToken({prompt:''});
});}
button.addEventListener('click',async()=>{
 button.disabled=true;message('Consultando o coordenador…');let access='';
 try{
  access=await token();
  const response=await fetch('https://script.googleapis.com/v1/scripts/'+encodeURIComponent(deployment)+':run',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({function:'coordinateSync',parameters:[{protocol:1,action:'read'}],devMode:false}),cache:'no-store',redirect:'error'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const reason=String(data?.error?.details?.[0]?.reason||'').slice(0,80);const detail=String(data?.error?.message||'').split(access).join('[removido]').replace(/Bearer\s+\S+/gi,'Bearer [removido]').slice(0,400);throw new Error('Apps Script recusou a consulta ('+response.status+').'+(reason?' Motivo: '+reason+'.':'')+(detail?' '+detail:''));}
  const result=data?.response?.result;
  if(data.done!==true||data.error||!result||result.protocol!==1||result.spreadsheetId!==sheetId||result.environment!=='production'||result.ok!==true)throw new Error('A API respondeu, mas o coordenador não confirmou a leitura: '+String(result?.code||data?.error?.status||'resposta inválida').slice(0,80));
  message('Conexão confirmada. O coordenador respondeu à leitura da planilha principal. Nenhum treino foi enviado.');
 }catch(e){message('Não foi possível concluir a leitura. '+String(e?.message||'Erro de conexão.').split(access||'\u0000').join('[removido]'));}
 finally{access='';button.disabled=false;}
});
