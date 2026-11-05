/**
 * Envia atividades concluídas e REGISTRADAS NO CHAT para o Strava.
 * Tipo: Musculacao (WeightTraining), SEM DESCRICAO, series ou pesos.
 * A planilha oficial e apenas LIDA. Os dados das series permanecem nela.
 *
 * Depende de Code.gs e Historico.gs ja existentes no Apps Script privado.
 * Requer STRAVA_CHAT_ENABLED=true em Propriedades do script.
 * Exige os outros publicadores desligados.
 *
 * Cada execucao publica no maximo UMA atividade.
 * Falha/timeout ambiguo bloqueia novas tentativas ate reconciliacao.
 */
const STRAVA_CHAT_LEDGER='STRAVA_CHAT_LEDGER_V1';
const STRAVA_CHAT_SOURCE='STRAVA_HISTORY_SOURCE_ID';

function stravaChatLedger_() {
  const saved=stravaProps_().getProperty(STRAVA_CHAT_LEDGER);
  if(!saved)return {};
  const data=JSON.parse(saved);
  if(!data||typeof data!=='object'||Array.isArray(data))
    throw new Error('Ledger de treinos do chat invalido.');
  return data;
}
function stravaChatSave_(ledger) {
  const raw=JSON.stringify(ledger);
  if(raw.length>8500)throw new Error('Ledger excedeu o limite de armazenamento.');
  stravaProps_().setProperty(STRAVA_CHAT_LEDGER,raw);
}
function stravaChatSource_() {
  const id=stravaRequired_(STRAVA_CHAT_SOURCE);
  if(id===STRAVA_TEST_SPREADSHEET_ID)
    throw new Error('A planilha de testes nao pode ser fonte de publicacao real.');
  const book=SpreadsheetApp.openById(id);
  if(book.getName()!=='Painel de Treino e Evolução')
    throw new Error('A origem nao e o painel de treino oficial.');
  const sheet=book.getSheetByName('Treinos');
  if(!sheet)throw new Error('Aba Treinos inexistente.');
  const rows=sheet.getDataRange().getValues();
  if(rows[0][0]!=='Data'||rows[0][3]!=='Status'||rows[0][4]!=='Duração (min)'||rows[0][9]!=='ID do aplicativo')
    throw new Error('Colunas esperadas mudaram; verificar estrutura antes de publicar.');
  return rows.slice(1);
}
function stravaChatSessions_() {
  const source=stravaChatSource_();
  const results=[],seen=new Set();
  for(let i=0;i<source.length;i++) {
    const row=source[i];
    const id=String(row[9]||'').trim();
    if(!/^chat_\d{8}_\d{6}$/.test(id))continue;
    if(seen.has(id))throw new Error('ID duplicado na planilha oficial: '+id);
    seen.add(id);
    if(row[3]!=='Concluído')continue;
    const date=historicDate_(row[0]);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new Error('Data invalida no treino '+id);
    if(id.slice(5,13)!==date.replace(/-/g,''))
      throw new Error('Identificador e data nao conferem no treino '+id);
    const duration=Number(row[4]);
    if(!Number.isInteger(duration)||duration<1||duration>240)
      throw new Error('Duracao ausente ou invalida para '+id);
    const notes=String(row[8]||'');
    // A nota registrada na conversa informa hora e dia reais de inicio,
    // nunca presumir 18h para atividades futuras.
    const match=notes.match(/\bInício\s+(\d{2}:\d{2}:\d{2})\s+\((\d{2})\/(\d{2})(?:[,)])/);
    if(!match)throw new Error('Hora de inicio nao identificada nas notas do treino '+id);
    const isoDay=date.slice(8,10),isoMonth=date.slice(5,7);
    if(match[2]!==isoDay||match[3]!==isoMonth||match[1]!==id.slice(-6,-4)+':'+id.slice(-4,-2)+':'+id.slice(-2)) {
      throw new Error('Hora/data nao conferem entre ID e notas para '+id);
    }
    const started=date+'T'+match[1]+'-03:00';
    results.push({id,date,started,duration,sheetRow:i+2});
  }
  results.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  return results;
}
function stravaChatPreview() {
  const ledger=stravaChatLedger_();
  const list=stravaChatSessions_().map(x=>({
    id:x.id,date:x.date,start:x.started,durationMinutes:x.duration,
    name:'Musculação',description:'',
    status:ledger[x.id]?.state||'PENDENTE'
  }));
  Logger.log(JSON.stringify(list,null,2));
  return list;
}
function stravaChatPublishNext() {
  const properties=stravaProps_();
  if(properties.getProperty('STRAVA_CHAT_ENABLED')!=='true') {
    Logger.log('DESATIVADO: configurar STRAVA_CHAT_ENABLED=true.');
    return 'DESATIVADO';
  }
  const other=['STRAVA_ENABLED','STRAVA_HISTORY_ENABLED',
    'STRAVA_HOURS_ENABLED','STRAVA_HISTORY_MANUAL_FALLBACK_ENABLED'];
  if(other.some(x=>properties.getProperty(x)==='true')) {
    Logger.log('BLOQUEADO: outros publicadores Strava estao ativos.');
    return 'BLOQUEADO: desligue os outros publicadores.';
  }
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(3000))return 'BLOQUEADO: outra execucao em andamento.';
  try {
    const entries=stravaChatSessions_(),ledger=stravaChatLedger_();
    const stalled=Object.entries(ledger).find(([id,row])=>['SUBMITTING','UNCERTAIN','ERROR'].includes(row.state));
    if(stalled) {
      const msg='PAUSADO: envio anterior ainda nao reconciliado '+stalled[0];
      Logger.log(msg);return msg;
    }
    const next=entries.find(x=>!ledger[x.id]);
    if(!next) {
      Logger.log('CONCLUIDO: nenhum treino do chat pendente.');
      return 'CONCLUIDO: nenhum treino do chat pendente.';
    }
    // Protecao contra atividades ja incluidas na importacao historica.
    const historicId='historic-'+next.date.replace(/-/g,'');
    const historic=historicReadLedger_()[historicId];
    const hoursRaw=properties.getProperty('STRAVA_HOURS_LEDGER_V1');
    const oldHours=hoursRaw?JSON.parse(hoursRaw):{};
    if(historic?.state==='PUBLISHED'||oldHours[historicId]?.state==='PUBLISHED') {
      const msg='BLOQUEADO: existe atividade historica publicada para '+next.date;
      Logger.log(msg);return msg;
    }
    ledger[next.id]={state:'SUBMITTING',date:next.date,started:next.started,durationMinutes:next.duration};
    stravaChatSave_(ledger);
    const form={
      name:'Musculação',
      sport_type:'WeightTraining',
      start_date_local:next.started,
      elapsed_time:String(next.duration*60)
      // Deliberadamente sem campo description.
    };
    let response;
    try {
      response=stravaResponse_(STRAVA_API_BASE+'/activities',stravaAccessToken_(),{
        method:'post',payload:form
      });
    } catch(err) {
      ledger[next.id]={...ledger[next.id],state:'UNCERTAIN'};
      stravaChatSave_(ledger);
      Logger.log('INCERTO: erro de comunicacao. Nao repetir sem conferir o Strava.');
      return 'INCERTO: nao repetir sem verificar Strava.';
    }
    if(response.status!==201||!response.body?.id) {
      ledger[next.id]={...ledger[next.id],state:'UNCERTAIN',httpStatus:response.status};
      stravaChatSave_(ledger);
      Logger.log('INCERTO: Strava HTTP '+response.status+'. Nao repetir.');
      return 'INCERTO HTTP '+response.status;
    }
    ledger[next.id]={...ledger[next.id],state:'PUBLISHED',activityId:String(response.body.id)};
    stravaChatSave_(ledger);
    const result='PUBLICADO '+next.date+': Musculação, '+next.duration+' min; ID Strava '+response.body.id;
    Logger.log(result);
    return result;
  } finally {lock.releaseLock();}
}
