/**
 * App Fitness -> Strava: historico SOMENTE de horas de treino.
 *
 * Depende de Code.gs e Historico.gs existentes no projeto Apps Script.
 * Fonte original: planilha OFICIAL em modo somente leitura.
 * Destino: Strava POST /api/v3/activities (atividades manuais).
 * Nenhuma serie, carga, peso, GPS, descricao ou treino FIT/JSON sera enviado.
 *
 * Por padrao NAO publica. Exige STRAVA_HOURS_ENABLED=true; os outros
 * publicadores precisam estar desligados. Estados sao salvos ANTES
 * de cada tentativa para impedir repeticao em caso de erro/timeout.
 */
const HOURS_LEDGER_KEY='STRAVA_HOURS_LEDGER_V1';
const HOURS_START_HOUR=18;
const HOURS_SOURCE_FIRST_ID='historic-20260824';

function stravaHoursLedger_() {
  const value=stravaProps_().getProperty(HOURS_LEDGER_KEY);
  if(!value)return {};
  const data=JSON.parse(value);
  if(!data||Array.isArray(data)||typeof data!=='object')throw new Error('Ledger de horas invalido.');
  return data;
}
function stravaHoursSave_(ledger) {
  const value=JSON.stringify(ledger);
  if(value.length>9000)throw new Error('Ledger de horas grande demais.');
  stravaProps_().setProperty(HOURS_LEDGER_KEY,value);
}
function stravaHoursClock_(minutes) {
  const m=Number(minutes);
  if(!Number.isInteger(m)||m<0||m>=1440)throw new Error('Horario estimado atravessa dia; revisar.');
  return ('0'+Math.floor(m/60)).slice(-2)+':'+('0'+m%60).slice(-2);
}
function stravaHoursBuild_(session) {
  // A origem das duracoes e historicRows_ (16 estimadas, 30/09 medida).
  if(!Number.isInteger(session.duration)||session.duration<1||session.duration>180)
    throw new Error('Duracao fora da faixa de seguranca em '+session.date);
  if(session.startISO!==session.date+'T18:00:00-03:00')
    throw new Error('Horario fonte inesperado em '+session.date);
  const conditioning=session.date==='2026-09-30';
  return {
    name:conditioning?'Condicionamento físico':'Musculação',
    sport_type:conditioning?'Workout':'WeightTraining',
    start_date_local:session.startISO,
    elapsed_time:String(session.duration*60)
  };
}
function stravaHoursExistingGuard_(session) {
  const prior=historicReadLedger_()[session.id];
  if(!prior)return {ok:true};
  if(prior.state==='PUBLISHED')
    return {ok:false,skip:true,reason:'Ja publicado pelo importador anterior'};
  if(prior.state==='ERROR' && prior.uploadId && /^[0-9]+$/.test(String(prior.uploadId))) {
    // Confirmar na API que o upload JSON anterior realmente falhou sem atividade.
    const receipt=stravaResponse_(STRAVA_API_BASE+'/uploads/'+String(prior.uploadId),stravaAccessToken_());
    if(receipt.status!==200||!receipt.body||!receipt.body.error||receipt.body.activity_id)
      return {ok:false,reason:'Nao confirmado erro definitivo do upload JSON anterior'};
    return {ok:true};
  }
  return {ok:false,reason:'Estado anterior nao reconciliado: '+String(prior.state||'')};
}
function stravaHoursPreview() {
  const items=historicRows_(),ledger=stravaHoursLedger_(),prior=historicReadLedger_();
  const list=items.map(x=>{
    const form=stravaHoursBuild_(x);
    return {
      date:x.date,activity:form.name,start:'18:00',
      end:stravaHoursClock_(HOURS_START_HOUR*60+x.duration),
      minutes:x.duration,durationEstimated:x.estimated,
      status:ledger[x.id]?.state|| (prior[x.id]?.state==='PUBLISHED'?'JA_PUBLICADO':'PENDENTE')
    };
  });
  const minutes=list.reduce((sum,x)=>sum+x.minutes,0);
  const out={
    count:list.length,
    totalMinutes:minutes,
    totalHours:Math.floor(minutes/60),
    remainingMinutes:minutes%60,
    recordedDurations:list.filter(x=>!x.durationEstimated).length,
    approximateDurations:list.filter(x=>x.durationEstimated).length,
    description:'Somente data, inicio, duracao e tipo de atividade; nenhuma descricao enviada ao Strava',
    activities:list
  };
  Logger.log(JSON.stringify(out,null,2));
  return out;
}
function stravaHoursPublishNext() {
  const props=stravaProps_();
  if(props.getProperty('STRAVA_HOURS_ENABLED')!=='true')
    return 'DESATIVADO: configure STRAVA_HOURS_ENABLED=true antes de enviar.';
  if(props.getProperty('STRAVA_HISTORY_DUPLICATES_REVIEWED')!=='true')
    return 'BLOQUEADO: falta confirmacao de duplicidades.';
  if(['STRAVA_ENABLED','STRAVA_HISTORY_ENABLED','STRAVA_HISTORY_MANUAL_FALLBACK_ENABLED'].some(x=>props.getProperty(x)==='true'))
    return 'BLOQUEADO: desative os outros publicadores antes de enviar.';
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(3000))return 'BLOQUEADO: outra publicacao em andamento.';
  try {
    const sessions=historicRows_();
    const ledger=stravaHoursLedger_();
    const previous=historicReadLedger_();
    // Intencoes inacabadas nunca podem ser convertidas em reenvio cego.
    const notConfirmed=Object.entries(ledger).find(([id,entry])=>entry.state==='SUBMITTING'||entry.state==='UNCERTAIN'||entry.state==='ERROR');
    if(notConfirmed)return 'PAUSADO: conferir '+notConfirmed[0]+' ('+notConfirmed[1].state+') antes de prosseguir.';
    for(const item of sessions) {
      if(ledger[item.id]?.state==='PUBLISHED'||ledger[item.id]?.state==='SKIPPED')continue;
      if(previous[item.id]?.state==='PUBLISHED') {
        ledger[item.id]={state:'SKIPPED',note:'Ja publicada por outro importador autorizado'};
        stravaHoursSave_(ledger);
        Logger.log('IGNORADO '+item.id+': atividade ja publicada.');
        return 'IGNORADO '+item.id+': atividade ja publicada.';
      }
      const guard=stravaHoursExistingGuard_(item);
      if(!guard.ok)return 'BLOQUEADO '+item.id+': '+guard.reason;
      const form=stravaHoursBuild_(item);
      // Gravar intencao antes da chamada, para proteger resultado incerto.
      ledger[item.id]={state:'SUBMITTING',date:item.date,minutes:item.duration};
      stravaHoursSave_(ledger);
      let answer;
      try {
        answer=stravaResponse_(STRAVA_API_BASE+'/activities',stravaAccessToken_(),{
          method:'post',payload:form
        });
      }catch(err) {
        ledger[item.id]={...ledger[item.id],state:'UNCERTAIN',note:'Falha de comunicacao; conferir Strava antes de repetir.'};
        stravaHoursSave_(ledger);
        Logger.log('INCERTO '+item.id+': rede; nao reenviar.');
        return 'INCERTO '+item.id+': conferir Strava; nao reenviar.';
      }
      if(answer.status!==201||!answer.body||!answer.body.id) {
        ledger[item.id]={...ledger[item.id],state:'UNCERTAIN',httpStatus:answer.status};
        stravaHoursSave_(ledger);
        Logger.log('INCERTO '+item.id+': HTTP '+answer.status);
        return 'INCERTO '+item.id+': HTTP '+answer.status+'; verificar antes de reenviar.';
      }
      ledger[item.id]={
        ...ledger[item.id],state:'PUBLISHED',
        method:'manual_hours',activityId:String(answer.body.id)
      };
      stravaHoursSave_(ledger);
      Logger.log('PUBLICADO '+item.id+' ('+form.sport_type+', '+item.duration+' min), Strava ID '+String(answer.body.id));
      return 'PUBLICADO '+item.id+' ('+item.duration+' min)';
    }
    Logger.log('CONCLUIDO: nenhuma atividade historica pendente.');
    return 'CONCLUIDO: nenhuma atividade historica pendente.';
  }finally{lock.releaseLock();}
}
function stravaHoursImportRemaining() {
  // O PRIMEIRO envio deve ser feito antes com stravaHoursPublishNext
  // e verificado no app Strava; so entao habilitar HOURS_BATCH_APPROVED=true.
  if(stravaProps_().getProperty('STRAVA_HOURS_BATCH_APPROVED')!=='true') {
    Logger.log('BLOQUEADO: revise a primeira atividade e configure STRAVA_HOURS_BATCH_APPROVED=true.');
    return 'BLOQUEADO: falta conferir a primeira atividade.';
  }
  const ledger=stravaHoursLedger_();
  if(ledger[HOURS_SOURCE_FIRST_ID]?.state!=='PUBLISHED')
    return 'BLOQUEADO: primeiro treino ainda nao foi confirmado.';
  const results=[];
  for(let i=0;i<17;i++) {
    const result=String(stravaHoursPublishNext());
    results.push(result);
    if(result.startsWith('CONCLUIDO'))break;
    if(!result.startsWith('PUBLICADO')&&!result.startsWith('IGNORADO'))break;
    Utilities.sleep(750);
  }
  const out={attempted:results.length,publications:results.filter(x=>x.startsWith('PUBLICADO')).length,last:results.at(-1)};
  Logger.log(JSON.stringify(out));
  return out;
}


/**
 * Limpa a descricao SOMENTE da atividade de 24/08 ja criada por este script.
 * Nao cria atividades, nao mexe em horarios, duracao ou visibilidade.
 * Requer activity:write e a capacidade de editar a atividade no Strava.
 */
function stravaHoursClearFirstDescription() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(3000)) {
    Logger.log('BLOQUEADO: operacao de Strava em andamento.');
    return 'BLOQUEADO: outra operacao em andamento.';
  }
  try {
    const ledger=stravaHoursLedger_();
    const record=ledger[HOURS_SOURCE_FIRST_ID];
    if(!record || record.state!=='PUBLISHED' || !/^\d+$/.test(String(record.activityId||''))) {
      Logger.log('BLOQUEADO: primeira atividade nao foi confirmada no controle.');
      return 'BLOQUEADO: primeira atividade nao confirmada.';
    }
    if(record.descriptionCleared===true) {
      Logger.log('A descricao do primeiro treino ja foi limpa segundo o controle.');
      return 'JA CONCLUIDO: confira o Strava.';
    }
    const result=stravaResponse_(
      STRAVA_API_BASE+'/activities/'+String(record.activityId),
      stravaAccessToken_(),
      {
        method:'put',
        contentType:'application/json',
        payload:JSON.stringify({description:''})
      }
    );
    if(result.status!==200) {
      Logger.log('FALHOU: Strava HTTP '+result.status+'. Se a atividade estiver restrita a seguidores, pode ser necessario escopo de leitura adicional. Alternativa: remover a descricao manualmente no Strava.');
      return 'FALHOU HTTP '+result.status+': remova a descricao manualmente no Strava.';
    }
    if(result.body && result.body.description!=null &&
       String(result.body.description).trim()!=='') {
      Logger.log('NAO CONFIRMADO: resposta Strava manteve descricao. Conferir manualmente.');
      return 'NAO CONFIRMADO: confira no Strava; nao repetir automaticamente.';
    }
    ledger[HOURS_SOURCE_FIRST_ID]={...record,descriptionCleared:true};
    stravaHoursSave_(ledger);
    Logger.log('CONCLUIDO: limpeza solicitada para a descricao da atividade de 24/08. Confira no Strava.');
    return 'CONCLUIDO: confira atividade de 24/08 no Strava.';
  } finally {lock.releaseLock();}
}
