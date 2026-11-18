/* Receipt validation for Google Sheets append-only writes.
 * Pure, offline-testable, and independent of the user's workout data.
 * A remote ID only proves existence: all written values must also match.
 */
const ID_COLUMNS=Object.freeze({Treinos:9,Series:14,Peso:6});
const NUMBER_COLUMNS=Object.freeze({Treinos:[4,5,6,7],Series:[5,6,8,9,10,11],Peso:[1,2,3,4]});
const cell=x=>String(x??'').trim();
const decimal=x=>{
 const s=cell(x).replace(/\s/g,'').replace(',','.');
 if(!s)return '';
 const n=Number(s);
 return Number.isFinite(n)?String(n):s;
};
/** Determine whether one unique row with the expected complete payload exists.
 * Does not mutate the sheet, infer a write from HTTP alone, or rely on row order.
 */
export function locateWriteReceipt(tab,rows,item,{columns=null}={}){
 const idIndex=ID_COLUMNS[tab];
 if(idIndex===undefined||!Array.isArray(rows)||!Array.isArray(item?.values)||!cell(item.id))throw new Error('Recibo inválido: aba ou linha não reconhecida.');
 if(cell(item.values[idIndex])!==cell(item.id))throw new Error('Recibo inválido: ID local inconsistente.');
 const matches=rows.slice(1).map((record,i)=>({record,row:i+2})).filter(x=>cell(x.record?.[idIndex])===cell(item.id));
 if(matches.length>1)throw new Error('ID duplicado no Google Sheets ('+tab+'): '+item.id+'. Verificação manual necessária.');
 if(matches.length===0)return {status:'absent'};
 const stored=matches[0];
 const numeric=new Set(NUMBER_COLUMNS[tab]);
 const selected=columns??Array.from({length:idIndex+1},(_,i)=>i);
 for(const col of selected){
  if(!Number.isInteger(col)||col<0||col>idIndex)throw new Error('Coluna de recibo inválida.');
  const expected=numeric.has(col)?decimal(item.values[col]):cell(item.values[col]);
  const actual=numeric.has(col)?decimal(stored.record[col]):cell(stored.record[col]);
  if(expected!==actual)throw new Error('Recibo divergente no Google Sheets: '+tab+', ID '+item.id+', coluna '+(col+1)+'. O envio foi interrompido para revisão.');
 }
 return {status:'confirmed',row:stored.row};
}
export const WRITE_RECEIPT_TABLES=Object.freeze(['Treinos','Series','Peso']);
