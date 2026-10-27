/**
 * App Fitness -> Strava (CANDIDATO APENAS PARA TESTES).
 * Nunca colocar client_secret, refresh/access token ou callback URL no GitHub.
 * Implantacao como Google Apps Script INDEPENDENTE, nao como pagina publica.
 */
const STRAVA_TEST_SPREADSHEET_ID = '1ZWow3SHWxgy-j7s3GWTJd1AxYXQb-E-ca_GTgK2_5CA';
const STRAVA_LOG_SHEET = '_StravaPublicacoes';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

function stravaProps_() { return PropertiesService.getScriptProperties(); }
function stravaRequired_(key) {
  const value = stravaProps_().getProperty(key);
  if (!value) throw new Error('Configuracao ausente: ' + key);
  return value;
}
function stravaTestSheet_() {
  const id = stravaRequired_('STRAVA_SPREADSHEET_ID');
  if (id !== STRAVA_TEST_SPREADSHEET_ID) throw new Error('BLOQUEADO: destino diferente da planilha ficticia de testes.');
  return SpreadsheetApp.openById(id);
}
function stravaLog_(book) {
  const tab = book.getSheetByName(STRAVA_LOG_SHEET);
  if (!tab) throw new Error('Nao ha controle Strava inicializado. Execute stravaInitializeTest primeiro.');
  return tab;
}
function stravaInitializeTest() {
  // Preenche apenas IDs PUBLICOS e ambiente de testes, nunca segredos OAuth.
  const p=stravaProps_();
  const configuredSheet=p.getProperty('STRAVA_SPREADSHEET_ID');
  if(configuredSheet && configuredSheet!==STRAVA_TEST_SPREADSHEET_ID)throw new Error('Projeto ja configurado para outra planilha: nao substituir.');
  if(!configuredSheet)p.setProperty('STRAVA_SPREADSHEET_ID',STRAVA_TEST_SPREADSHEET_ID);
  if(!p.getProperty('STRAVA_CLIENT_ID'))p.setProperty('STRAVA_CLIENT_ID','291398');
  // A inicializacao nao habilita uploads nem altera a planilha oficial.
  const book = stravaTestSheet_();
  const sheets = ['Treinos','Series'];
  sheets.forEach(name=>{if(!book.getSheetByName(name))throw new Error('Aba ausente: '+name);});
  if (!book.getSheetByName(STRAVA_LOG_SHEET)) {
    const tab = book.insertSheet(STRAVA_LOG_SHEET);
    tab.getRange(1,1,1,7).setValues([['ID do treino','Estado','External ID','Upload ID','Activity ID','Atualizacao','Observacao']]);
    tab.setFrozenRows(1);
    tab.hideSheet();
  }
  if (!stravaProps_().getProperty('STRAVA_ENABLED')) stravaProps_().setProperty('STRAVA_ENABLED','false');
  return 'Controle criado/validado no ambiente ficticio. Envio continua bloqueado ate ativacao explicita.';
}

/** OAuth: gere o link no editor, autorize no Strava, cole a URL REDIRECIONADA nas propriedades do script. */
function stravaAuthorizationUrl() {
  const id = stravaRequired_('STRAVA_CLIENT_ID');
  if (!/^\d+$/.test(id)) throw new Error('Client ID Strava invalido.');
  const state = Utilities.getUuid().replace(/-/g,'');
  stravaProps_().setProperty('STRAVA_OAUTH_STATE',state);
  const redirect = 'http://localhost';
  const url='https://www.strava.com/oauth/authorize?client_id='+encodeURIComponent(id)
    +'&response_type=code&redirect_uri='+encodeURIComponent(redirect)
    +'&approval_prompt=force&scope=activity%3Awrite&state='+encodeURIComponent(state);
  Logger.log('Abra esta URL para autorizar o Strava: '+url);
  return url;
}
function stravaCompleteAuthorization() {
  const raw = stravaRequired_('STRAVA_CALLBACK_URL');
  if (!/^http:\/\/localhost(?:[/?#]|$)/.test(raw)) throw new Error('Callback precisa ser localhost.');
  const query = (raw.split('?')[1]||'').split('#')[0];
  const params = {};
  query.split('&').forEach(part=>{
    if(!part)return;const i=part.indexOf('=');
    const k=decodeURIComponent(i<0?part:part.slice(0,i));
    const v=decodeURIComponent((i<0?'':part.slice(i+1)).replace(/\+/g,' '));
    params[k]=v;
  });
  if (params.state !== stravaRequired_('STRAVA_OAUTH_STATE')) throw new Error('State OAuth divergente.');
  if (!params.code || params.error) throw new Error('Autorizacao nao concedida.');
  const p=stravaProps_();
  const json=stravaTokenRequest_({client_id:stravaRequired_('STRAVA_CLIENT_ID'),client_secret:stravaRequired_('STRAVA_CLIENT_SECRET'),code:params.code,grant_type:'authorization_code'});
  if (!String(json.scope||'').split(/[ ,]+/).includes('activity:write')) throw new Error('Permissao activity:write nao concedida.');
  stravaSaveTokens_(json);
  p.deleteProperty('STRAVA_CALLBACK_URL');
  p.deleteProperty('STRAVA_OAUTH_STATE');
  return 'Strava autorizado. Publicacao permanece desativada; valide testes e configure STRAVA_ENABLED=true.';
}
function stravaTokenRequest_(payload) {
  const response=UrlFetchApp.fetch('https://www.strava.com/oauth/token',{
    method:'post',contentType:'application/x-www-form-urlencoded',payload:payload,muteHttpExceptions:true
  });
  if(response.getResponseCode()!==200)throw new Error('Falha OAuth Strava. HTTP '+response.getResponseCode());
  return JSON.parse(response.getContentText());
}
function stravaSaveTokens_(data) {
  const p=stravaProps_();
  if(!data.refresh_token||!data.access_token||!Number.isFinite(Number(data.expires_at)))throw new Error('Resposta de token incompleta.');
  p.setProperties({
    STRAVA_REFRESH_TOKEN:String(data.refresh_token),
    STRAVA_ACCESS_TOKEN:String(data.access_token),
    STRAVA_EXPIRES_AT:String(data.expires_at)
  },false);
}
function stravaAccessToken_() {
  const p=stravaProps_(),now=Math.floor(Date.now()/1000);
  const current=p.getProperty('STRAVA_ACCESS_TOKEN');
  if(current&&Number(p.getProperty('STRAVA_EXPIRES_AT'))>now+600)return current;
  const json=stravaTokenRequest_({
    client_id:stravaRequired_('STRAVA_CLIENT_ID'),
    client_secret:stravaRequired_('STRAVA_CLIENT_SECRET'),
    refresh_token:stravaRequired_('STRAVA_REFRESH_TOKEN'),
    grant_type:'refresh_token'
  });
  stravaSaveTokens_(json);
  return String(json.access_token);
}

/** Mapeamento conservador. Nao converter plaquetas nem cargas de composicao ambigua para kg. */
function stravaExerciseType_(label,variant) {
  const name=String(label||'').toLowerCase();
  const extra=String(variant||'').toLowerCase();
  if(name.includes('crucifixo')||name.includes('voador'))return name.includes('inverso')?'MACHINE_REAR_DELT_REVERSE_FLY':'MACHINE_CHEST_FLY';
  if(name.includes('supino')||name.includes('peito inferior')){
    if(name.includes('inferior'))return 'MACHINE_DECLINE_BENCH_PRESS';
    if(name.includes('inclinado'))return 'MACHINE_INCLINE_CHEST_PRESS';
    return extra.includes('halter')?'DUMBBELL_BENCH_PRESS':'MACHINE_CHEST_PRESS';
  }
  if(name.includes('rosca direta')&&extra.includes('halter'))return 'STANDING_DUMBBELL_BICEPS_CURL';
  if(name.includes('rosca scott'))return 'PREACHER_CURL_MACHINE';
  if(name.includes('elevação lateral')||name.includes('elevacao lateral'))return 'LATERAL_RAISE_GENERIC';
  if(name.includes('prancha lateral'))return 'SIDE_PLANK_HOLD';
  if(name.includes('prancha frontal'))return 'PLANK_HOLD';
  if(name.includes('puxada'))return 'LAT_PULLDOWN';
  if(name.includes('remada'))return 'ROW_GENERIC';
  if(name.includes('tríceps')||name.includes('triceps'))return 'TRICEPS_EXTENSION_GENERIC';
  return null; // Exercicios nao mapeados vao para a descricao; sem tipo falso.
}
function stravaDateKey_(v,tz) {
  if(v instanceof Date)return Utilities.formatDate(v,tz,'yyyy-MM-dd');
  const s=String(v||'').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):'';
}
function stravaWeightKg_(load,unit) {
  const u=String(unit||'').trim().toLowerCase();
  // kg/halter: valor POR HALTER; nao duplicar ou inferir carga total.
  if(u!=='kg'&&u!=='kg/halter')return null;
  if(typeof load!=='number'||!Number.isFinite(load)||load<0)return null;
  return load;
}
function stravaBuildUpload_(session,series,tz) {
  // Entradas: arrays com o esquema atual da planilha (A:L e A:O).
  const id=String(session[9]||'').trim(),status=String(session[3]||'').trim();
  if(status!=='Concluído'||!/^[a-zA-Z0-9_-]{8,120}$/.test(id))throw new Error('ID estavel ausente ou treino nao concluido.');
  const start=String(session[10]||'').trim(),duration=Number(session[4]);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(start)||!Number.isFinite(Date.parse(start)))throw new Error('Treino sem inicio ISO local e fuso valido.');
  if(!Number.isFinite(duration)||duration<=0||duration>480)throw new Error('Duracao real em minutos obrigatoria.');
  const m=start.match(/([+-])(\d{2}):(\d{2})$/);
  const hh=Number(m[2]),mm=Number(m[3]);
  if(hh>14||mm>59)throw new Error('Offset UTC invalido.');
  const utcOffset=(m[1]==='-'?-1:1)*(hh*3600+mm*60);
  const date=stravaDateKey_(session[0],tz),sessionName=String(session[2]||'').trim();
  if(start.slice(0,10)!==date||!sessionName)throw new Error('Data de inicio diferente da sessao.');
  const included=series.filter(r=>stravaDateKey_(r[0],tz)===date&&String(r[1]||'')===sessionName);
  const sets=[],details=[];
  for(const r of included) {
    const kind=String(r[4]||''),exercise=String(r[2]||''),variant=String(r[3]||'');
    const type=stravaExerciseType_(exercise,variant);
    const reps=Number(r[8]),unit=String(r[7]||'').trim();
    const load=r[6],rir=r[9];
    const part=[kind,exercise,variant,
      load!==''&&load!=null?String(load)+' '+unit:'',
      Number.isInteger(reps)&&reps>0?(unit==='segundos'?reps+'s':reps+' reps'):'',
      rir!==''&&rir!=null?'RIR '+rir:''].filter(Boolean).join(' | ');
    details.push(part);
    if(!type)continue;
    const set={exercise_type:type};
    if(unit==='segundos'){
      if(Number.isInteger(reps)&&reps>0)set.duration=reps;
    } else if(Number.isInteger(reps)&&reps>0){set.repetitions=reps;}
    const kg=stravaWeightKg_(load,unit);
    if(kg!==null)set.weight=kg;
    if(set.duration||set.repetitions)sets.push(set);
  }
  if(!sets.length)throw new Error('Nenhuma serie exportavel.');
  const filename='appfitness-'+id+'.json';
  const description='Registro original no App Fitness (cargas por halter quando indicado; plaquetas sem conversao para kg).\n'
    +details.join('\n');
  return {
    externalId:filename,
    name:'App Fitness | '+sessionName,
    description:description.slice(0,9500),
    payload:{version:'1.0',start_time:start,utc_offset:utcOffset,elapsed_time:Math.round(duration*60),creator:{name:'App Fitness'},sets:sets}
  };
}
function stravaResponse_(url,token,params) {
  const r=UrlFetchApp.fetch(url,Object.assign({
    muteHttpExceptions:true,headers:{Authorization:'Bearer '+token}
  },params||{}));
  const raw=r.getContentText(),body=raw?JSON.parse(raw):{};
  return {status:r.getResponseCode(),body:body};
}
function stravaSetLedger_(tab,row,state,uploadId,activityId,note) {
  tab.getRange(row,2,1,6).setValues([[state,tab.getRange(row,3).getValue(),uploadId||'',activityId||'',new Date(),String(note||'').slice(0,250)]]);
  SpreadsheetApp.flush();
}
function stravaPublisherTick() {
  if(stravaProps_().getProperty('STRAVA_ENABLED')!=='true')return 'Desativado';
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(3000))return 'Ocupado';
  try {
    const book=stravaTestSheet_(),log=stravaLog_(book),tz=book.getSpreadsheetTimeZone();
    const startCutoff=stravaRequired_('STRAVA_START_DATE');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(startCutoff))throw new Error('STRAVA_START_DATE invalida.');
    const ledger=log.getDataRange().getValues(),known=new Map();
    for(let i=1;i<ledger.length;i++) {
      const id=String(ledger[i][0]||'');
      if(known.has(id))throw new Error('ID duplicado no ledger Strava: '+id);
      if(id)known.set(id,{row:i+1,status:String(ledger[i][1]),uploadId:String(ledger[i][3]||'')});
    }
    // Publicacao com resultado desconhecido bloqueia novos envios ate reconciliacao manual.
    for(const [id,v] of known) {
      if(v.status==='UNCERTAIN'||v.status==='SUBMITTING')return 'Pausado: conferir publicacao de '+id;
    }
    // Sempre consultar uploads existentes antes de tentar novas publicacoes.
    for(const [id,v] of known){
      if(v.status!=='PROCESSING')continue;
      if(!/^\d+$/.test(v.uploadId))throw new Error('Upload ID invalido no ledger.');
      const r=stravaResponse_(STRAVA_API_BASE+'/uploads/'+v.uploadId,stravaAccessToken_());
      if(r.status!==200)throw new Error('Nao foi possivel consultar status de upload HTTP '+r.status);
      if(r.body.error){stravaSetLedger_(log,v.row,'ERROR',v.uploadId,'',r.body.error);return 'Erro Strava: '+id;}
      if(r.body.activity_id){stravaSetLedger_(log,v.row,'PUBLISHED',v.uploadId,String(r.body.activity_id),'');return 'Publicado: '+id;}
    }
    const treinos=book.getSheetByName('Treinos').getDataRange().getValues();
    const series=book.getSheetByName('Series').getDataRange().getValues();
    for(let i=1;i<treinos.length;i++){
      const s=treinos[i],id=String(s[9]||'').trim();
      if(String(s[3]||'')!=='Concluído'||!id||known.has(id))continue;
      const d=stravaDateKey_(s[0],tz);
      if(!d||d<startCutoff)continue; // Nao importar treinos antigos automaticamente.
      const duplicates=treinos.filter(x=>String(x[3]||'')==='Concluído'&&stravaDateKey_(x[0],tz)===d&&String(x[2]||'')===String(s[2]||''));
      if(duplicates.length!==1)continue; // Agrupamento ambiguo das series.
      let data;
      try{data=stravaBuildUpload_(s,series.slice(1),tz);}catch(e){continue;} // Campos incompletos: nao inventar horario/carga.
      const token=stravaAccessToken_(); // Falha de auth ANTES de registrar intencao.
      log.appendRow([id,'SUBMITTING',data.externalId,'','',new Date(),'Aguardando recibo HTTP; nao reenviar caso a execucao pare.']);
      SpreadsheetApp.flush();
      const ledgerRow=log.getLastRow();
      try{
        const blob=Utilities.newBlob(JSON.stringify(data.payload),'application/json',data.externalId);
        const r=stravaResponse_(STRAVA_API_BASE+'/uploads',token,{
          method:'post',payload:{
            sport_type:'WeightTraining',name:data.name,description:data.description,
            trainer:'1',data_type:'json',external_id:data.externalId,file:blob
          }
        });
        if(r.status!==201||!r.body.id) {
          stravaSetLedger_(log,ledgerRow,'UNCERTAIN','','','HTTP '+r.status+'; verificar Strava antes de decidir por novo envio.');
          return 'Resultado incerto: '+id;
        }
        stravaSetLedger_(log,ledgerRow,'PROCESSING',String(r.body.id),'','Aguardando processamento do Strava.');
        return 'Upload enviado: '+id;
      }catch(e) {
        stravaSetLedger_(log,ledgerRow,'UNCERTAIN','','','Falha apos iniciar requisicao; revisar antes de novo envio.');
        return 'Resultado incerto: '+id;
      }
    }
    return 'Nenhum treino novo com campos completos.';
  }finally{lock.releaseLock();}
}
function stravaInstallTestTrigger() {
  stravaTestSheet_();stravaLog_(stravaTestSheet_());
  const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='stravaPublisherTick');
  if(existing.length) return 'Gatilho ja existe.';
  ScriptApp.newTrigger('stravaPublisherTick').timeBased().everyMinutes(15).create();
  return 'Gatilho criado para 15 min; STRAVA_ENABLED permanece sob controle manual.';
}
