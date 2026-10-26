/* Non-destructive exact legacy-series reconciliation.
 * No personal dataset, mutation, network, or persistence.
 * On ambiguous equivalence, stop instead of merging or duplicating data.
 */
const text=v=>String(v??'').trim();
const norm=v=>text(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
const numeral=v=>{
 const raw=text(v).replace(/\s/g,'');
 if(!raw)return '';
 const m=raw.match(/^(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)$/);
 if(m)return String((Number(m[1].replace(',','.'))+Number(m[2].replace(',','.')))/2);
 if(/^[-+]?\d+(?:[.,]\d+)?$/.test(raw))return String(Number(raw.replace(',','.')));
 return norm(raw);
};
const standard=(row,i)=>{
 const value=row?.[i];
 if(i===3)return norm(value||'Variação não informada');
 if(i===7)return norm(value||'reps');
 if([5,6,8,9,10].includes(i))return numeral(value);
 return norm(value);
};
const full=(r)=>[0,1,2,3,4,5,6,7,8,9,10,12,13].map(i=>standard(r,i)).join('\u001f');
const slot=(r)=>[0,1,2,3,4,5,7].map(i=>standard(r,i)).join('\u001f');
const gather=(doc,key)=>[...(doc.base?.entities?.[key]||[]),...(doc.overlay?.[key]||[])];
/** Returns uniquely established legacy matches only; does not edit the document. */
export function matchLegacySeries(doc,remoteRows,serialize){
 const rows=remoteRows||[],sets=gather(doc,'sets'),sessions=gather(doc,'sessions'),exercises=gather(doc,'exercises'),variants=gather(doc,'exercise_variants');
 const entities={sessions,exercises,exercise_variants:variants};
 const candidates=[];
 for(const collection of ['base','overlay']){
  const list=collection==='base'?(doc.base?.entities?.sets||[]):(doc.overlay?.sets||[]);
  for(const s of list){
   // Explicitly user-created Android records must never be silently adopted.
   if(s.provenance?.sheet||s.provenance?.source==='android_local'||s.provenance?.source==='assistant')continue;
   let values;try{values=serialize(s,entities);}catch{continue;}
   candidates.push({id:s.id,collection,full:full(values),slot:slot(values)});
  }
 }
 const alreadyKnown=remoteRow=>
  sets.some(s=>s.provenance?.sheet==='Series'&&s.provenance?.row===remoteRow.row ||
   (remoteRow.id&&s.id===remoteRow.id));
 const pending=rows.slice(1).map((r,i)=>({r,row:i+2,id:text(r?.[14])})).filter(x=>text(x.r?.[0])&&!alreadyKnown(x));
 const remoteByFull=new Map();
 for(const item of pending){const key=full(item.r);if(!remoteByFull.has(key))remoteByFull.set(key,[]);remoteByFull.get(key).push(item);}
 const used=new Set(),links=[];
 for(const [signature,group] of remoteByFull){
  const exact=candidates.filter(x=>x.full===signature);
  if(!exact.length){
   for(const remote of group){
    const possible=candidates.filter(x=>x.slot===slot(remote.r));
    if(possible.length)throw new Error('Conflito de série histórica sem ID no Sheets, linha '+remote.row+'. Valores diferentes na mesma posição. Revise o backup antes de importar.');
   }
   continue;
  }
  if(group.length!==1||exact.length!==1||used.has(exact[0].id))throw new Error('Séries históricas ambíguas sem ID no Sheets (linha '+group[0].row+'). Não mesclamos séries iguais automaticamente.');
  const hit=exact[0];used.add(hit.id);
  links.push({row:group[0].row,id:hit.id,collection:hit.collection});
 }
 return links;
}

/** A historical session may have an identical natural identity without provenance.
 * Never adopt an Android-created session; surface changed values as a conflict.
 */
export function matchLegacySessions(doc,remoteRows,serialize){
 const entries=gather(doc,'sessions'),links=[];
 const occupied=new Set();
 for(let i=1;i<(remoteRows||[]).length;i++){
  const row=i+1,r=remoteRows[i];if(!text(r?.[0]))continue;
  const remoteId=text(r[9]);
  if(entries.some(s=>s.provenance?.sheet==='Treinos'&&s.provenance?.row===row||(remoteId&&s.id===remoteId)))continue;
  const key=norm(r[0])+'|'+norm(r[2]);
  const candidates=entries.filter(s=>!s.provenance?.sheet && s.provenance?.source!=='android_local' && s.provenance?.source!=='assistant' && norm(s.date)+'|'+norm(s.name)===key);
  if(!candidates.length)continue;
  if(candidates.length!==1||occupied.has(candidates[0].id))throw new Error('Sessão histórica ambígua sem ID, linha '+row+'. Revise antes de importar.');
  const local=candidates[0];
  const a=serialize(local);
  if([0,2,3,4,5,6,7,8].some(col=>standard(a,col)!==standard(r,col)))throw new Error('Sessão histórica com diferenças no Sheets, linha '+row+'. Revise antes de importar.');
  occupied.add(local.id);
  links.push({row,id:local.id,collection:(doc.overlay?.sessions||[]).some(x=>x.id===local.id)?'overlay':'base'});
 }
 return links;
}
/** Match imported local weight records only when date, weight and notes agree. */
export function matchLegacyWeights(doc,remoteRows){
 const entries=gather(doc,'weigh_ins'),links=[],occupied=new Set();
 for(let i=1;i<(remoteRows||[]).length;i++){
  const row=i+1,r=remoteRows[i];if(!text(r?.[0]))continue;
  const remoteId=text(r[6]);
  if(entries.some(w=>w.provenance?.sheet==='Peso'&&w.provenance?.row===row||(remoteId&&w.id===remoteId)))continue;
  const candidates=entries.filter(w=>!w.provenance?.sheet && w.provenance?.source!=='android_local' && w.provenance?.source!=='assistant' && norm(w.date)===norm(r[0])&&numeral(w.weight_kg)===numeral(r[1]));
  if(!candidates.length)continue;
  if(candidates.length!==1||occupied.has(candidates[0].id))throw new Error('Pesagem histórica ambígua sem ID, linha '+row+'. Revise antes de importar.');
  const local=candidates[0];
  if(norm(local.notes)!==norm(r[5]))throw new Error('Pesagem histórica com observação diferente no Sheets, linha '+row+'. Revise antes de importar.');
  occupied.add(local.id);
  links.push({row,id:local.id,collection:(doc.overlay?.weigh_ins||[]).some(x=>x.id===local.id)?'overlay':'base'});
 }
 return links;
}
