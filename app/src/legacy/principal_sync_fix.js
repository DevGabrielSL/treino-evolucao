export function timedSeconds(unit,notes){
 if(unit!=='segundos')return null;
 const match=/^Bloco final · Prancha · (\d+(?:\.\d+)?) segundos$/.exec(String(notes||''));
 const n=match?Number(match[1]):NaN;
 return Number.isFinite(n)&&n>0?n:null;
}
export function outboundSeriesLabel(values){
 const seconds=timedSeconds(values[7],values[13]);
 return 'Série: '+values[0]+' · '+values[2]+' · '+(seconds===null?values[6]+' '+values[7]+' × '+values[8]:seconds+' segundos');
}
const messages={
 INVALID_SET:'O coordenador recusou o formato de uma série. Se houver prancha, atualize a implantação do Apps Script para aceitar séries por duração. A fila foi preservada.',
 OWNER_REQUIRED:'A conta Google autorizada não corresponde ao proprietário configurado no coordenador. Use a conta do proprietário ou revise SYNC_OWNER_EMAIL.',
 WRONG_SPREADSHEET:'O destino configurado no Apps Script difere da planilha do aplicativo. Revise SYNC_SPREADSHEET_ID.',
 COORDINATOR_DISABLED:'O coordenador está desativado no Apps Script. Confira SYNC_ENABLED na implantação.',
 INITIALIZATION_REQUIRED:'O controle de sincronização ainda não foi inicializado no Google. Configure o coordenador antes de enviar.',
 SCHEMA_REQUIRED:'O formato das abas ou os cabeçalhos de identificação no Google precisam de revisão.',
 EXTERNAL_CHANGE:'A planilha foi alterada fora do coordenador. É necessária uma revisão antes de enviar.',
 UNCERTAIN:'O resultado da operação anterior não pôde ser confirmado. A fila foi preservada para conferir o recibo.',
 INVALID_CONTROL:'O controle de sincronização no Google precisa de revisão.',
 SESSION_REQUIRED:'Uma série não encontrou seu treino correspondente no Google. Revise o vínculo antes de enviar.',
 RECORD_CONFLICT:'Um registro com o mesmo identificador tem valores diferentes no Google. Revise o conflito antes de enviar.',
 ALREADY_INITIALIZED:'O controle já foi inicializado. Preserve o estado existente.'
};
export function coordinatorExecutionFailure(execution){
 if(!execution?.error&&execution?.done===true)return null;
 const detail=execution?.error?.details?.find(d=>typeof d?.errorMessage==='string');
 const message=String(detail?.errorMessage||execution?.error?.message||'');
 const code=Object.keys(messages).find(code=>new RegExp('(^|[^A-Z_])'+code+'($|[^A-Z_])').test(message));
 if(code)return {code:'COORDINATOR_'+code,message:messages[code]+' Código: '+code+'.'};
 if(/Sheets is not defined/.test(message))return {code:'COORDINATOR_SERVICE_REQUIRED',message:'O serviço avançado Google Sheets não está disponível no Apps Script. Ative o serviço na implantação do coordenador.'};
 return {code:'COORDINATOR_EXECUTION_ERROR',message:'A execução do Apps Script falhou. Abra Execuções no projeto do coordenador para conferir o erro da tentativa; os registros e a fila continuam no celular.'};
}
