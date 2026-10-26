// Synthetic Google Sheets CellData response; never contacts a live spreadsheet.
export function gridResponse(displayed,underlying=displayed){
 return {sheets:['Treinos','Series','Peso'].map(title=>({properties:{title},data:[{rowData:(displayed[title]||[]).map((row,r)=>({values:Array.from({length:Math.max(row.length,underlying[title]?.[r]?.length||0)},(_,c)=>{
  const shown=row[c],raw=underlying[title]?.[r]?.[c];
  return {...(shown!=null?{formattedValue:String(shown)}:{}),...(raw!=null?{effectiveValue:typeof raw==='number'?{numberValue:raw}:typeof raw==='boolean'?{boolValue:raw}:{stringValue:String(raw)}}:{})};
 })}))}]}))};
}
