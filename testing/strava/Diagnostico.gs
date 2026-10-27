/**
 * Diagnostico estritamente de LEITURA: nao chama uploads POST,
 * nao altera o ledger e nao apaga falhas anteriores.
 * O relatorio nunca inclui tokens, segredo ou descricao pessoal.
 */
function stravaHistoryDiagnoseFirst() {
  const key='historic-20260824';
  const saved=historicReadLedger_()[key];
  if(!saved) throw new Error('Nenhuma tentativa historica encontrada para '+key);
  const session=historicRows_().find(x=>x.id===key);
  if(!session) throw new Error('Treino de origem nao encontrado, sem alterar historico.');
  const generated=historicPayload_(session);
  const info={
    id:key,
    ledgerState:String(saved.state||''),
    uploadType:generated.kind,
    exerciseRows:session.recordCount,
    fileVersion:generated.payload.version||null,
    startTime:generated.payload.start_time||null,
    utcOffset:generated.payload.utc_offset??null,
    elapsedSeconds:generated.payload.elapsed_time,
    setCount:Array.isArray(generated.payload.sets)?generated.payload.sets.length:0,
    types:{}, invalidSetIndexes:[],
    uploadReceipt:null
  };
  for(const [index,set] of (generated.payload.sets||[]).entries()) {
    info.types[set.exercise_type]=(info.types[set.exercise_type]||0)+1;
    if(typeof set.exercise_type!=='string'||!set.exercise_type||
       (!Number.isInteger(set.repetitions)&&!Number.isInteger(set.duration))||
       (set.repetitions!==undefined&&set.repetitions<=0)||
       (set.duration!==undefined&&set.duration<=0)||
       (set.weight!==undefined&&(!Number.isFinite(set.weight)||set.weight<0))) {
      info.invalidSetIndexes.push(index);
    }
  }
  if(saved.uploadId) {
    // Acesso READ ao upload previamente enviado; sem escrever no Strava.
    if(!/^[0-9]+$/.test(String(saved.uploadId)))throw new Error('ID remoto invalido.');
    const resp=stravaResponse_(STRAVA_API_BASE+'/uploads/'+encodeURIComponent(saved.uploadId),stravaAccessToken_());
    info.uploadReceipt={
      httpStatus:resp.status,
      status:resp.body&&typeof resp.body.status==='string'?resp.body.status:null,
      error:resp.body&&typeof resp.body.error==='string'?resp.body.error:null,
      activityPresent:Boolean(resp.body&&resp.body.activity_id)
    };
  }
  Logger.log(JSON.stringify(info,null,2));
  return info;
}
