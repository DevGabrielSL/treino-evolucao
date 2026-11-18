/** Retry only interrupted coordinator exchanges. The same captured operation is
 * replayed; the coordinator's persistent receipt prevents duplicate writes.
 * Never apply this policy to direct Sheets writes or generate a new operation ID.
 */
export async function recoverCoordinatorExchange(operation,send,{wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const captured=structuredClone(operation);
 for(let attempt=0;attempt<3;attempt++){
  try{return await send(structuredClone(captured));}
  catch(error){
   const interrupted=error?.name==='TypeError'&&/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(String(error.message||''));
   if(!interrupted)throw error;
   if(attempt===2){
    const failure=new Error('Não foi possível confirmar a resposta do Google após três tentativas. Seus registros e a fila continuam salvos neste celular. Confira a conexão e toque novamente em Importar novidades e enviar pendências; o aplicativo conferirá o recibo antes de repetir a gravação.');
    failure.code='COORDINATOR_NETWORK_ERROR';throw failure;
   }
   await wait(750*(attempt+1));
  }
 }
}
