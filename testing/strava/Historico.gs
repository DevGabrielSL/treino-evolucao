/**
 * MIGRACAO UNICA do historico 2026. ADICIONAR COMO "Historico.gs" ao Apps Script
 * existente que contem Code.gs. Nao coloca planilha oficial nem dados no GitHub.
 * Nao executa uploads sem ativacao EXPLICITA e revisao de duplicidade.
 */
const HISTORY_LEDGER_PROPERTY = 'STRAVA_HISTORY_LEDGER_V1';
const HISTORY_EXPECTED_COUNT = 17;
const HISTORY_FROM = '2026-08-24';
const HISTORY_TO = '2026-10-26';
const HISTORY_START_CLOCK = '18:00:00';
const HISTORY_UTC_OFFSET = '-03:00';

function historicDate_(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return Utilities.formatDate(value, 'America/Sao_Paulo', 'yyyy-MM-dd');
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
    return Utilities.formatDate(new Date(ms), 'UTC', 'yyyy-MM-dd');
  }
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
}
function historicRows_() {
  const sourceId = stravaRequired_('STRAVA_HISTORY_SOURCE_ID');
  if (sourceId === STRAVA_TEST_SPREADSHEET_ID || !/^[A-Za-z0-9_-]{20,100}$/.test(sourceId)) {
    throw new Error('A fonte deve ser a planilha oficial, diferente da planilha ficticia.');
  }
  // Fonte APENAS LEITURA. O script nao chama getRange(...).setValues nesta fonte.
  const source = SpreadsheetApp.openById(sourceId);
  if (source.getName() !== 'Painel de Treino e Evolução') {
    throw new Error('O nome da planilha fonte nao corresponde ao painel oficial.');
  }
  const treinos = source.getSheetByName('Treinos');
  const series = source.getSheetByName('Series');
  if (!treinos || !series) throw new Error('Abas Treinos e Series nao encontradas.');
  const sessions = treinos.getDataRange().getValues().slice(1);
  const sets = series.getDataRange().getValues().slice(1);
  const candidates = [];
  const seenDate = new Set();
  for (let index=0; index<sessions.length; index++) {
    const s = sessions[index];
    const date = historicDate_(s[0]);
    if (date < HISTORY_FROM || date > HISTORY_TO || s[3] !== 'Concluído') continue;
    if (seenDate.has(date)) throw new Error('Mais de um treino na mesma data; nao importar automaticamente: '+date);
    seenDate.add(date);
    const name=String(s[2] || '').trim();
    if (!name) throw new Error('Treino sem nome na data '+date);
    const matching=sets.filter(row=>historicDate_(row[0])===date && String(row[1]||'').trim()===name);
    const recordCount=matching.length;
    const durationActual=Number(s[4]);
    let duration;
    let estimated;
    if (s[4]!=='' && s[4]!=null && Number.isFinite(durationActual) && durationActual>0) {
      duration=Math.round(durationActual);estimated=false;
    } else {
      duration=recordCount < 12 ? 45 : recordCount >= 20 ? 75 : 60;
      if (/cardio:\s*3,5\s*km\s*em\s*40\s*min/i.test(String(s[8]||''))) duration=Math.max(75,duration);
      if (/cardio:\s*2,0\s*km\s*em\s*20\s*min/i.test(String(s[8]||''))) duration=Math.max(75,duration);
      estimated=true;
    }
    const id='historic-'+date.replace(/-/g,'');
    candidates.push({
      id,date,name,session:s,series:matching,recordCount,duration,estimated,
      startISO:date+'T'+HISTORY_START_CLOCK+HISTORY_UTC_OFFSET,
      description:String(s[8]||'')
    });
  }
  candidates.sort((a,b)=>a.date.localeCompare(b.date));
  if (candidates.length !== HISTORY_EXPECTED_COUNT) {
    throw new Error('Quantidade alterada: esperados '+HISTORY_EXPECTED_COUNT+'; encontrados '+candidates.length+'. Revisar antes de importar.');
  }
  return candidates;
}
function historicExercise_(label, variant) {
  const name=String(label||'').toLocaleLowerCase('pt-BR'),v=String(variant||'').toLocaleLowerCase('pt-BR');
  if (name.includes('prancha lateral'))return 'SIDE_PLANK_HOLD';
  if (name.includes('prancha frontal'))return 'PLANK_HOLD';
  if (name.includes('bird dog'))return 'BIRD_DOG';
  if (name.includes('reverse crunch'))return 'REVERSE_CRUNCH';
  if (name.includes('abdominal infra'))return 'CORE_GENERIC';
  if (name.includes('extensora'))return 'MACHINE_LEG_EXTENSION';
  if (name.includes('leg press'))return 'MACHINE_LEG_PRESS';
  if (name.includes('terra'))return 'BARBELL_DEADLIFT';
  if (name.includes('mesa flexora'))return 'LEG_CURL_GENERIC';
  if (name.includes('panturrilha'))return 'CALF_RAISE_GENERIC';
  if (name.includes('posterior de ombro')||name.includes('voador inverso'))return 'MACHINE_REAR_DELT_REVERSE_FLY';
  if (name.includes('remada com apoio'))return 'MACHINE_CHEST_SUPPORTED_ROW';
  if (name.includes('remada baixa'))return 'MACHINE_SEATED_ROW';
  if (name.includes('puxada'))return 'LAT_PULLDOWN';
  if (name.includes('máquina peito inferior'))return 'MACHINE_DECLINE_BENCH_PRESS';
  if (name.includes('crucifixo')||name.includes('voador'))return 'MACHINE_CHEST_FLY';
  if (name.includes('elevação lateral'))return 'LATERAL_RAISE_GENERIC';
  if (name.includes('desenvolvimento'))return 'MACHINE_SEATED_SHOULDER_PRESS';
  if (name.includes('rosca martelo'))return 'DUMBBELL_HAMMER_CURL';
  if (name.includes('rosca scott'))return v.includes('máquina')?'PREACHER_CURL_MACHINE':'CURL_GENERIC';
  if (name.includes('rosca direta com halteres'))return 'STANDING_DUMBBELL_BICEPS_CURL';
  if (name.includes('rosca direta'))return v.includes('barra')?'BARBELL_BICEPS_CURL':'CURL_GENERIC';
  if (name.includes('rosca bíceps'))return 'CABLE_BICEPS_CURL';
  if (name.includes('tríceps')||name.includes('triceps'))return 'TRICEPS_PRESSDOWN';
  if (name.includes('supino inclinado'))return 'MACHINE_INCLINE_CHEST_PRESS';
  if (name.includes('supino na máquina'))return 'MACHINE_CHEST_PRESS';
  if (name.includes('supino reto')||name === 'supino')return v.includes('barra')?'BARBELL_BENCH_PRESS':'CHEST_PRESS';
  return null;
}
function historicWeightKg_(load,unit,variant) {
  if (typeof load!=='number' || !Number.isFinite(load) || load<0) return null;
  const u=String(unit||'').trim().toLowerCase(),v=String(variant||'').toLowerCase();
  if (u==='kg/halter')return load; // por halter, NAO dobrar.
  if (u==='kg' && !v.includes('halter'))return load;
  // kg/lado, barra desconhecida, plaquetas e cargas de montagem ambigua: descricao.
  return null;
}
function historicPayload_(item) {
  const sets=[], notes=[];
  for(const r of item.series) {
    const exercise=String(r[2]||''),variant=String(r[3]||''),unit=String(r[7]||'');
    const load=r[6],count=Number(r[8]),rir=r[9],kind=String(r[4]||'');
    const desc=[kind,exercise,variant,load===''||load==null?'':String(load)+' '+unit,
      Number.isInteger(count)&&count>0?(unit==='s'||unit==='segundos'?count+' s':count+' reps'):'',
      rir===''||rir==null?'':'RIR '+rir].filter(Boolean).join(' | ');
    if(desc)notes.push(desc);
    const type=historicExercise_(exercise,variant);
    if (!type||!Number.isInteger(count)||count<=0)continue;
    const set={exercise_type:type};
    if(unit==='s'||unit==='segundos')set.duration=count;
    else set.repetitions=count;
    const kg=historicWeightKg_(load,unit,variant);
    if(kg!==null)set.weight=kg;
    sets.push(set);
  }
  const header=[
    'Importado do historico App Fitness.',
    'HORARIO ESTIMADO: '+item.date+' '+HISTORY_START_CLOCK+' (-03:00).',
    item.estimated?'DURACAO ESTIMADA: '+item.duration+' min.':'DURACAO REGISTRADA: '+item.duration+' min.',
    'Carga por halter, plaquetas e kg/lado mantidos conforme registros; sem conversao arbitraria.',
    item.description?'Notas originais: '+item.description:''
  ].filter(Boolean);
  const description=(header.concat(notes)).join('\n').slice(0,9500);
  if(!sets.length) {
    return {kind:'manual',description,payload:{
      name:'App Fitness | '+item.name+' (historico)',
      sport_type:'Workout',start_date_local:item.startISO,
      elapsed_time:item.duration*60,description
    }};
  }
  return {kind:'json',description,payload:{
    version:'1.0',start_time:item.startISO,utc_offset:-10800,
    elapsed_time:item.duration*60,creator:{name:'App Fitness'},sets
  }};
}
function historicReadLedger_() {
  const json=stravaProps_().getProperty(HISTORY_LEDGER_PROPERTY);
  if (!json)return {};
  const val=JSON.parse(json);
  if (!val || Array.isArray(val) || typeof val !=='object') throw new Error('Ledger historico invalido.');
  return val;
}
function historicWriteLedger_(ledger) {
  const json=JSON.stringify(ledger);
  if(json.length>8500)throw new Error('Ledger muito grande, operacao bloqueada.');
  stravaProps_().setProperty(HISTORY_LEDGER_PROPERTY,json);
}
function stravaHistoryPreview() {
  const entries=historicRows_(),ledger=historicReadLedger_();
  const overview=entries.map(x=>({
    date:x.date,id:x.id,activity:x.name,sets:x.recordCount,
    durationMinutes:x.duration,durationEstimated:x.estimated,
    state:ledger[x.id]?.state||'PENDENTE',
    uploadType:historicPayload_(x).kind
  }));
  Logger.log(JSON.stringify(overview,null,2));
  return {count:overview.length,items:overview};
}
function stravaHistoryPublishNext() {
  if(stravaProps_().getProperty('STRAVA_HISTORY_ENABLED')!=='true')
    return 'Publicacao historica desativada. Execute stravaHistoryPreview primeiro.';
  if(stravaProps_().getProperty('STRAVA_HISTORY_DUPLICATES_REVIEWED')!=='true')
    return 'BLOQUEADO: confira atividades antigas ja existentes no Strava antes de publicar.';
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(3000))return 'Outra publicacao em andamento.';
  try {
    const entries=historicRows_(),ledger=historicReadLedger_();
    // Falhas de resultado incerto nunca autorizam novo envio.
    const blocked=Object.entries(ledger).find(([id,v])=>['SUBMITTING','UNCERTAIN','ERROR'].includes(v.state));
    if(blocked) return 'PAUSADO para revisao: '+blocked[0]+' - '+blocked[1].state;
    const processing=Object.entries(ledger).find(([id,v])=>v.state==='PROCESSING');
    if(processing) {
      const [id,v]=processing;
      const resp=stravaResponse_(STRAVA_API_BASE+'/uploads/'+encodeURIComponent(v.uploadId),stravaAccessToken_());
      if(resp.status!==200)throw new Error('Consulta ao upload falhou HTTP '+resp.status);
      if(resp.body.error) {
        ledger[id]={...v,state:'ERROR',note:String(resp.body.error).slice(0,150)};historicWriteLedger_(ledger);
        return 'Upload rejeitado: '+id;
      }
      if(resp.body.activity_id) {
        ledger[id]={...v,state:'PUBLISHED',activityId:String(resp.body.activity_id)};
        historicWriteLedger_(ledger);return 'Publicado no Strava: '+id;
      }
      return 'Aguardando processamento do Strava: '+id;
    }
    const next=entries.find(x=>!Object.hasOwn(ledger,x.id));
    if (!next)return 'Sem pendencias: todas as 17 atividades tem estado registrado.';
    const data=historicPayload_(next),auth=stravaAccessToken_();
    // A intencao persistente antecede a chamada HTTP, preservando duvidas sobre resposta.
    ledger[next.id]={state:'SUBMITTING',date:next.date,kind:data.kind};
    historicWriteLedger_(ledger);
    try {
      let r;
      if(data.kind==='json') {
        const external='appfitness-'+next.id+'.json';
        const blob=Utilities.newBlob(JSON.stringify(data.payload),'application/json',external);
        r=stravaResponse_(STRAVA_API_BASE+'/uploads',auth,{method:'post',payload:{
          sport_type:'WeightTraining',name:'App Fitness | '+next.name+' (historico)',
          description:data.description,trainer:'1',data_type:'json',external_id:external,file:blob
        }});
        if(r.status!==201||!r.body.id) {
          ledger[next.id]={...ledger[next.id],state:'UNCERTAIN',http:r.status};
          historicWriteLedger_(ledger);return 'Envio incerto; revisar: '+next.id;
        }
        ledger[next.id]={...ledger[next.id],state:'PROCESSING',uploadId:String(r.body.id)};
        historicWriteLedger_(ledger);return 'Upload recebido, confirmar processamento: '+next.id;
      }
      r=stravaResponse_(STRAVA_API_BASE+'/activities',auth,{method:'post',payload:data.payload});
      if(r.status!==201||!r.body.id) {
        ledger[next.id]={...ledger[next.id],state:'UNCERTAIN',http:r.status};
        historicWriteLedger_(ledger);return 'Criacao manual incerta; revisar: '+next.id;
      }
      ledger[next.id]={...ledger[next.id],state:'PUBLISHED',activityId:String(r.body.id)};
      historicWriteLedger_(ledger);return 'Condicionamento publicado: '+next.id;
    } catch(e) {
      ledger[next.id]={...ledger[next.id],state:'UNCERTAIN'};
      historicWriteLedger_(ledger);
      return 'PAUSADO: resultado desconhecido; nao repetir automaticamente '+next.id;
    }
  } finally {lock.releaseLock();}
}

/**
 * Processa o lote historico em uma unica execucao manual, ate 60 transicoes.
 * Suspende se a API demorar ou se qualquer retorno ficar incerto.
 */
function stravaHistoryImportBatch() {
  const results=[];
  let consecutiveWaits=0;
  for(let i=0;i<60;i++) {
    const answer=String(stravaHistoryPublishNext());
    results.push(answer);
    Logger.log(answer);
    if(answer.includes('Sem pendencias: todas'))return {done:true,steps:results.length,summary:answer};
    if(answer.startsWith('PAUSADO')||answer.startsWith('BLOQUEADO')||
       answer.includes('desativada')||answer.includes('rejeitado')||
       answer.includes('incerto')||answer.includes('incerta')||
       answer.includes('Outra publicacao')) return {done:false,steps:results.length,summary:answer};
    if(answer.startsWith('Aguardando processamento')) {
      consecutiveWaits++;
      if(consecutiveWaits>5)return {done:false,steps:results.length,summary:'Strava ainda processando; executar novamente apos conferir upload.'};
      Utilities.sleep(2000);
    } else {
      consecutiveWaits=0;
      Utilities.sleep(1000);
    }
  }
  return {done:false,steps:results.length,summary:'Limite preventivo do lote atingido; confira estados antes de repetir.'};
}


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
