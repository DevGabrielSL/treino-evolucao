"""Apply session-only Google token persistence to the isolated candidate."""
from pathlib import Path

p = dist / 'sheet_sync_browser.js'
s = p.read_text()
def one(source, old, new):
    assert source.count(old) == 1, old
    return source.replace(old, new)
s = one(s, '/* Browser-only Google Sheets transport. No token is persisted, logged, or embedded. */',
        '/* Google access token lives in this browser tab session only. */')
old = 'let accessToken=null,expiresAt=0;'
new = '''let accessToken=null,expiresAt=0;
const SESSION_KEY='treino-evolucao-google-token-v1';
function clearSessionToken(){try{globalThis.sessionStorage?.removeItem(SESSION_KEY);}catch{}}
function saveSessionToken(){try{globalThis.sessionStorage?.setItem(SESSION_KEY,JSON.stringify({token:accessToken,expiresAt,scope:SHEETS_SCOPE}));}catch{}}
function restoreSessionToken(){
 try{
  const raw=globalThis.sessionStorage?.getItem(SESSION_KEY);if(!raw)return;
  const v=JSON.parse(raw);
  if(typeof v.token!=='string'||!v.token||v.token.length>8192||!Number.isFinite(v.expiresAt)||v.expiresAt<=Date.now()||v.scope!==SHEETS_SCOPE){clearSessionToken();return;}
  accessToken=v.token;expiresAt=v.expiresAt;
 }catch{clearSessionToken();}
}
restoreSessionToken();'''
s = one(s, old, new)
old="accessToken=response.access_token;expiresAt=Date.now()+Math.max(60,Number(response.expires_in||3600)-90)*1000;resolve(true);"
new="const seconds=Number(response.expires_in);if(!Number.isFinite(seconds)||seconds<=0){reject(new Error('Prazo da autorização Google inválido.'));return;}accessToken=response.access_token;expiresAt=Date.now()+Math.max(0,seconds-Math.min(90,seconds/10))*1000;saveSessionToken();resolve(true);"
s = one(s, old, new)
s = one(s, "client.requestAccessToken({prompt:'consent'});", "client.requestAccessToken({prompt:''});")
s = one(s, 'export function authorized(){return !!accessToken&&Date.now()<expiresAt;}',
        'export function authorized(){if(accessToken&&Date.now()>=expiresAt)disconnect();return !!accessToken;}')
s = one(s, 'export function disconnect(){accessToken=null;expiresAt=0;}',
        'export function disconnect(){accessToken=null;expiresAt=0;clearSessionToken();}')
s = one(s, "if(!r.ok)throw new Error(r.status===401?", "if(r.status===401)disconnect();\n if(!r.ok)throw new Error(r.status===401?")
old="if(!r.ok)throw new Error(r.status===401?'A sessão Google expirou. Conecte novamente.':r.status===403?'Sem permissão para esta planilha ou Google Sheets API não ativada.':`Google Sheets recusou a operação (${r.status}). ${String(json?.error?.message||'').slice(0,150)}`);"
new="""if(!r.ok){
  const service=new URL(url).hostname==='script.googleapis.com'?'Apps Script':'Google Sheets';
  const reason=typeof json?.error?.details?.[0]?.reason==='string'?json.error.details[0].reason:'';
  let detail=typeof json?.error?.message==='string'?json.error.message:'';
  detail=detail.split(token).join('[removido]').replace(/Bearer\\s+\\S+/gi,'Bearer [removido]').slice(0,350);
  if(r.status===401)throw new Error('A sessão Google expirou. Conecte novamente.');
  throw new Error(service+' recusou a solicitação ('+r.status+').'+(reason?' Motivo: '+reason.slice(0,80)+'.':'')+(detail?' '+detail:''));
 }"""
s = one(s, old, new)
p.write_text(s)

p = dist / 'app.js'
s = p.read_text()
s = one(s, 'Não armazena tokens de acesso.', 'A autorização fica nesta aba até expirar ou ser desconectada.')
s = one(s, "notify('Conta Google autorizada. Confira a planilha antes da sincronização.');", "notify('Conta Google autorizada.');automaticSheets.request('authorization');")
s = one(s, 'render();updatePersistence(); if(navigator.onLine)loadGoogleIdentity().catch(()=>{});',
        "render();updatePersistence(); if(navigator.onLine)loadGoogleIdentity().catch(()=>{});if(authorized())automaticSheets.request('authorization');")
p.write_text(s)
