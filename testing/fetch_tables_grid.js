/** One response supplies displayed dates/text and effective numeric values from
 * each cell. Never join separate snapshots by row position. This is a read,
 * not a transaction lock against later edits by other clients.
 */
export async function fetchTables(sheetId,{fetchImpl=fetch}={}){
 const id=parseSheetId(sheetId),widths={Treinos:10,Series:15,Peso:7};
 const numeric={Treinos:new Set([4,5,6,7]),Series:new Set([5,6,8,9,10,11]),Peso:new Set([1,2,3,4])};
 const url=new URL(SHEETS_ORIGIN+'/v4/spreadsheets/'+encodeURIComponent(id));
 for(const range of ["'Treinos'!A:J","'Series'!A:O","'Peso'!A:G"])url.searchParams.append('ranges',range);
 url.searchParams.set('fields','sheets(properties(title),data(startRow,startColumn,rowData(values(formattedValue,effectiveValue))))');
 const response=await request(url.toString(),{fetchImpl});
 const invalid=detail=>new Error('Leitura inconsistente ou incompleta da planilha: '+detail+'. Nenhum dado desta resposta será importado.');
 if(!Array.isArray(response.sheets))throw invalid('abas ausentes');
 const result={};
 for(const [name,width] of Object.entries(widths)){
  const matches=response.sheets.filter(s=>s?.properties?.title===name);
  if(matches.length!==1)throw invalid('aba ausente ou duplicada: '+name);
  const blocks=matches[0].data;
  if(!Array.isArray(blocks)||blocks.length!==1)throw invalid('intervalo ausente ou ambíguo: '+name);
  const block=blocks[0];
  if(!block||typeof block!=='object'||(block.startRow??0)!==0||(block.startColumn??0)!==0)throw invalid('origem do intervalo: '+name);
  const rows=block.rowData??[];
  if(!Array.isArray(rows))throw invalid('linhas inválidas: '+name);
  result[name]=rows.map((row,r)=>{
   if(!row||typeof row!=='object')throw invalid('linha inválida: '+name);
   const cells=row.values??[];
   if(!Array.isArray(cells)||cells.length>width)throw invalid('colunas inválidas: '+name);
   return cells.map((cell,c)=>{
    if(!cell||typeof cell!=='object'||Array.isArray(cell))throw invalid('célula inválida: '+name);
    const effective=cell.effectiveValue;
    const formatted=cell.formattedValue;
    if(formatted!==undefined&&typeof formatted!=='string')throw invalid('texto inválido: '+name);
    if(effective!==undefined&&(!effective||typeof effective!=='object'||Array.isArray(effective)))throw invalid('valor inválido: '+name);
    if(effective?.errorValue)throw invalid('erro de fórmula ou célula: '+name+' linha '+(r+1));
    const kinds=['numberValue','stringValue','boolValue'].filter(k=>effective?.[k]!==undefined);
    if(kinds.length>1)throw invalid('valor ambíguo: '+name);
    if(effective?.numberValue!==undefined&&(typeof effective.numberValue!=='number'||!Number.isFinite(effective.numberValue)))throw invalid('número inválido: '+name);
    if(effective?.stringValue!==undefined&&typeof effective.stringValue!=='string')throw invalid('valor textual inválido: '+name);
    if(r>0&&numeric[name].has(c)){
     if(effective?.numberValue!==undefined)return effective.numberValue;
     if(effective?.stringValue!==undefined)return effective.stringValue;
     if(effective?.boolValue!==undefined||formatted)throw invalid('número ausente: '+name+' linha '+(r+1));
     return '';
    }
    if(formatted!==undefined)return formatted;
    if(effective?.stringValue!==undefined)return effective.stringValue;
    if(kinds.length)throw invalid('valor exibido ausente: '+name+' linha '+(r+1));
    return '';
   });
  });
  // Match Values API trimming without removing interior blank rows/columns.
  for(const row of result[name])while(row.length&&row.at(-1)==='')row.pop();
  while(result[name].length&&result[name].at(-1).length===0)result[name].pop();
 }
 return result;
}
