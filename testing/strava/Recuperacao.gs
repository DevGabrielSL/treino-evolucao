/**
 * Recuperacao pontual do historico como atividade manual Strava.
 * Usar APENAS apos falha confirmada do upload JSON; nao chama uploads POST.
 *
 * Arquivo separado do Apps Script: Recuperacao.gs.
 * Depende dos arquivos Code.gs e Historico.gs ja instalados.
 *
 * ATENCAO: importacao manual guarda os detalhes das series na DESCRICAO,
 * nao no painel estruturado de exercicios do Strava.
 */
function stravaHistoryManualPreviewFirst() {
  const candidates=historicRows_(),ledger=historicReadLedger_();
  const item=candidates.find(x=>x.id==='historic-20260824');
  if(!item)throw new Error('Treino original 24/08 nao encontrado.');
  const s=ledger[item.id];
  if(!s)throw new Error('Nao foi encontrado recibo do envio JSON original.');
  const data=historicPayload_(item);
  const view={
    id:item.id,
    date:item.date,
    name:'App Fitness | '+item.name+' (historico)',
    sportType:'WeightTraining',
    startEstimate:item.startISO,
    durationMinutes:item.duration,
    durationEstimated:item.estimated,
    sourceSetRows:item.series.length,
    destination:'Descricao do Strava (nao painel estruturado de exercicios)',
    previousLedgerState:String(s.state||''),
    previousUploadIdPresent:Boolean(s.uploadId),
    notesCharacters:data.description.length
  };
  Logger.log(JSON.stringify(view,null,2));
  return view;
}
/**
 * Envia somente o treino de 24/08, sob autorizacao EXPLICITA.
 * Nao faz retry automatico, nem libera o restante.
 */
function stravaHistoryPublishFirstManual() {
  const p=stravaProps_();
  if(p.getProperty('STRAVA_HISTORY_MANUAL_FALLBACK_ENABLED')!=='true')
    return 'BLOQUEADO: STRAVA_HISTORY_MANUAL_FALLBACK_ENABLED nao esta true.';
  if(p.getProperty('STRAVA_HISTORY_DUPLICATES_REVIEWED')!=='true')
    return 'BLOQUEADO: ainda falta conferir duplicidades.';
  if(p.getProperty('STRAVA_HISTORY_ENABLED')==='true'||p.getProperty('STRAVA_ENABLED')==='true')
    return 'BLOQUEADO: desative publicacao historica JSON e automatica antes da recuperacao.';
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(3000))return 'Ocupado.';
  try {
    const all=historicRows_(),item=all.find(x=>x.id==='historic-20260824');
    if(!item)throw new Error('Treino de 24/08 ausente.');
    const ledger=historicReadLedger_(),prior=ledger[item.id];
    if(!prior)return 'BLOQUEADO: falta registro da tentativa original.';
    if(prior.state==='PUBLISHED')return 'Ja publicado: nenhum novo envio.';
    if(prior.state!=='ERROR'||!/^[0-9]+$/.test(String(prior.uploadId||'')))
      return 'BLOQUEADO: estado original diferente de ERROR com uploadId; revisar antes de qualquer envio.';
    const receipt=stravaResponse_(
      STRAVA_API_BASE+'/uploads/'+encodeURIComponent(String(prior.uploadId)),
      stravaAccessToken_()
    );
    if(receipt.status!==200)return 'BLOQUEADO: nao foi possivel conferir a rejeicao original.';
    if(!receipt.body||!receipt.body.error||receipt.body.activity_id)
      return 'BLOQUEADO: Strava nao confirmou que o envio original falhou sem criar atividade.';
    const historic=historicPayload_(item);
    // Manter TODAS as series e notas, embora o destino nao crie sets estruturados.
    const description=historic.description;
    if(item.series.length!==21||description.indexOf('HORARIO ESTIMADO')<0)
      throw new Error('Treino historico mudou; revisar antes de publicar.');
    const form={
      name:'App Fitness | '+item.name+' (historico)',
      sport_type:'WeightTraining',
      start_date_local:item.startISO,
      elapsed_time:String(item.duration*60),
      description:description
    };
    // Persistir a intencao ANTES do POST para impedir reenvio cego.
    ledger[item.id]={
      ...prior,
      state:'SUBMITTING_MANUAL',
      originalUploadId:String(prior.uploadId),
      originalError:String(prior.note||'Error Processing Data').slice(0,200),
      intent:'stravaHistoryPublishFirstManual'
    };
    historicWriteLedger_(ledger);
    let response;
    try{
      response=stravaResponse_(STRAVA_API_BASE+'/activities',stravaAccessToken_(),{
        method:'post',
        payload:form
      });
    }catch(err){
      ledger[item.id]={...ledger[item.id],state:'UNCERTAIN',note:'Falha de comunicacao durante o POST manual; verificar no Strava antes de qualquer repeticao.'};
      historicWriteLedger_(ledger);
      return 'INCERTO: confira atividade no Strava; nao execute novamente.';
    }
    if(response.status!==201||!response.body?.id){
      ledger[item.id]={...ledger[item.id],state:'UNCERTAIN',note:'POST manual HTTP '+response.status+' sem comprovacao de criacao.'};
      historicWriteLedger_(ledger);
      return 'INCERTO: HTTP '+response.status+'; revisar antes de tentar novamente.';
    }
    ledger[item.id]={
      ...ledger[item.id],
      state:'PUBLISHED',
      method:'manual_fallback',
      activityId:String(response.body.id),
      note:'Atividade manual publicada; series e RIR na descricao (nao estruturados).'
    };
    historicWriteLedger_(ledger);
    return 'PUBLICADO: historic-20260824; activityId='+String(response.body.id);
  }finally{
    lock.releaseLock();
  }
}
