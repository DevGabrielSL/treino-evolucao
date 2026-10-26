/* Coordinator candidate for the SYNTHETIC test spreadsheet only.
 * NOT DEPLOYED. API executable access must be MYSELF. All app writers must
 * share this script project. External edits require a maintenance review.
 */
var SYNC_TEST_SHEET_='1ZWow3SHWxgy-j7s3GWTJd1AxYXQb-E-ca_GTgK2_5CA';
var SYNC_CONTROL_='_SyncEstado';
var SYNC_TABS_={Treinos:{width:10,id:9},Series:{width:15,id:14},Peso:{width:7,id:6}};
function syncError_(code){throw new Error(code);}
function config_(initializing){
 var p=PropertiesService.getScriptProperties(),owner=p.getProperty('SYNC_OWNER_EMAIL');
 if(!owner||Session.getActiveUser().getEmail().toLowerCase()!==owner.toLowerCase())syncError_('OWNER_REQUIRED');
 if(!initializing&&p.getProperty('SYNC_ENABLED')!=='true')syncError_('COORDINATOR_DISABLED');
 if(p.getProperty('SYNC_SPREADSHEET_ID')!==SYNC_TEST_SHEET_)syncError_('WRONG_SPREADSHEET');
 return p;
}
function canonical_(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical_).join(',')+']';
 return '{'+Object.keys(value).sort().map(function(k){return JSON.stringify(k)+':'+canonical_(value[k]);}).join(',')+'}';
}
function hash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,canonical_(value),Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function value_(v){
 if(typeof v==='number'&&!Number.isFinite(v))syncError_('INVALID_NUMBER');
 if(!['string','number','boolean'].includes(typeof v)&&v!==null)syncError_('INVALID_CELL');
 if(typeof v==='string'&&v.length>1000)syncError_('CELL_TOO_LONG');
 if(v===null||v==='')return {};
 return {userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:v}};
}
function snapshot_(initializing){
 var response=Sheets.Spreadsheets.get(SYNC_TEST_SHEET_,{ranges:["'Treinos'!A:J","'Series'!A:O","'Peso'!A:G","'"+SYNC_CONTROL_+"'!A1"],fields:'sheets(properties(sheetId,title),data(startRow,startColumn,rowData(values(formattedValue,effectiveValue))))'});
 var sheets={},rows={},ids={};
 (response.sheets||[]).forEach(function(s){if(sheets[s.properties.title])syncError_('DUPLICATE_TAB');sheets[s.properties.title]=s;});
 Object.keys(SYNC_TABS_).forEach(function(tab){
  var s=sheets[tab],spec=SYNC_TABS_[tab];if(!s||!s.data||s.data.length!==1)syncError_('SCHEMA_REQUIRED');
  var block=s.data[0];if((block.startRow||0)!==0||(block.startColumn||0)!==0)syncError_('INVALID_GRID');
  rows[tab]=(block.rowData||[]).map(function(r){return (r.values||[]).map(function(c){
   var e=c.effectiveValue||{};if(e.errorValue)syncError_('FORMULA_ERROR');
   if(e.numberValue!==undefined)return e.numberValue;
   if(e.stringValue!==undefined)return e.stringValue;
   if(e.boolValue!==undefined)return e.boolValue;
   return '';
  });});
  // Preserve the displayed date in the same CellData record.
  (block.rowData||[]).forEach(function(r,i){if(r.values&&r.values[0]&&r.values[0].formattedValue!==undefined)rows[tab][i][0]=r.values[0].formattedValue;});
  rows[tab].forEach(function(r){while(r.length&&r[r.length-1]==='')r.pop();});
  while(rows[tab].length&&!rows[tab][rows[tab].length-1].length)rows[tab].pop();
  if(!rows[tab][0]||rows[tab][0][0]!=='Data'||rows[tab][0][spec.id]!=='ID do aplicativo')syncError_('SCHEMA_REQUIRED');
  ids[tab]={};rows[tab].slice(1).forEach(function(r,i){var id=String(r[spec.id]||'');if(!id)return;if(ids[tab][id])syncError_('DUPLICATE_ID');ids[tab][id]={row:i+1,values:r};});
 });
 var control=sheets[SYNC_CONTROL_],cell=control&&control.data&&control.data[0]&&control.data[0].rowData&&control.data[0].rowData[0];
 var text=cell&&cell.values&&cell.values[0]&&cell.values[0].effectiveValue&&cell.values[0].effectiveValue.stringValue;
 if(!text){if(initializing)return {sheets:sheets,rows:rows,ids:ids,state:null};syncError_('INITIALIZATION_REQUIRED');}
 var state;try{state=JSON.parse(text);}catch(e){syncError_('INVALID_CONTROL');}
 if(state.protocol!==1||!Number.isInteger(state.revision)||state.revision<0||!state.operations||typeof state.operations!=='object'||Array.isArray(state.operations)||typeof state.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(state.fingerprint)||state.mode!=='ready')syncError_('INVALID_CONTROL');
 return {sheets:sheets,rows:rows,ids:ids,state:state};
}
function fingerprint_(rows){
 // Peso D/E are computed by formulas and are excluded from authored content.
 var copy=JSON.parse(JSON.stringify(rows));copy.Peso=copy.Peso.map(function(r){var v=r.slice();v[3]='';v[4]='';while(v.length&&v[v.length-1]==='')v.pop();return v;});
 return hash_(copy);
}
function operation_(input){
 if(!input||input.protocol!==1||!['read','append','receipt'].includes(input.action))syncError_('INVALID_REQUEST');
 if(input.action==='read')return input;
 if(typeof input.operationId!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(input.operationId))syncError_('INVALID_OPERATION_ID');
 if(input.action==='receipt')return input;
 if(!Number.isInteger(input.expectedRevision)||input.expectedRevision<0||!Array.isArray(input.records)||input.records.length<1||input.records.length>20)syncError_('INVALID_BATCH');
 var seen={};
 input.records.forEach(function(r){
  var spec=SYNC_TABS_[r.tab];if(!spec||!Array.isArray(r.values)||r.values.length!==spec.width)syncError_('INVALID_RECORD');
  r.values.forEach(value_);
  var id=r.values[spec.id];if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,180}$/.test(id)||seen[r.tab+':'+id])syncError_('INVALID_RECORD_ID');seen[r.tab+':'+id]=true;
  var d=r.values[0];if(typeof d!=='string'||!/^\d{4}-\d\d-\d\d$/.test(d)||isNaN(Date.parse(d+'T12:00:00Z'))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)syncError_('INVALID_DATE');
  var numeric=r.tab==='Treinos'?[4,5,6,7]:r.tab==='Series'?[5,6,8,9,10,11]:[1,2];
  numeric.forEach(function(c){var n=r.values[c];if(n!==''&&n!==null&&(typeof n!=='number'||!Number.isFinite(n)||n<0))syncError_('INVALID_NUMBER');});
  if(r.tab==='Treinos'&&(!r.values[2]||r.values[3]!=='Concluído'))syncError_('INVALID_SESSION');
  if(r.tab==='Series'&&(!r.values[1]||!r.values[2]||!r.values[7]||!Number.isInteger(r.values[8])||r.values[8]<1||r.values[8]>500||(r.values[9]!==''&&r.values[9]>10)||(r.values[10]!==''&&r.values[10]>10)))syncError_('INVALID_SET');
  if(r.tab==='Peso'&&(!(r.values[1]>0)||r.values[1]>500||r.values[3]!==''||r.values[4]!==''))syncError_('INVALID_WEIGHT');
 });
 return input;
}
function sameRow_(a,b,tab){var cols=tab==='Peso'?[0,1,2,5,6]:a.map(function(_,i){return i;});return cols.every(function(i){return canonical_(a[i]===undefined?'':a[i])===canonical_(b[i]===undefined?'':b[i]);});}
function stateWrite_(snapshot,state){
 var text=JSON.stringify(state);if(text.length>45000)syncError_('CONTROL_CAPACITY_REACHED');
 return {updateCells:{range:{sheetId:snapshot.sheets[SYNC_CONTROL_].properties.sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:1},rows:[{values:[{userEnteredValue:{stringValue:text}}]}],fields:'userEnteredValue'}};
}
/** The only intended API entry point; the deployment must restrict to MYSELF. */
function coordinateSync_(request){
 var props=config_(),op=operation_(request),lock=LockService.getScriptLock();
 if(!lock.tryLock(5000))return {ok:false,code:'BUSY'};
 try{
  var snap=snapshot_(),state=snap.state,intent=props.getProperty('SYNC_INTENT');
  if(intent){
   var pending;try{pending=JSON.parse(intent);}catch(e){syncError_('INVALID_INTENT');}
   var previous=state.operations[pending.operationId];
   if(!previous||previous.digest!==pending.digest||state.fingerprint!==fingerprint_(snap.rows))return {ok:false,code:'UNCERTAIN',revision:state.revision};
   props.deleteProperty('SYNC_INTENT');
  }
  if(state.fingerprint!==fingerprint_(snap.rows))return {ok:false,code:'EXTERNAL_CHANGE',revision:state.revision};
  if(op.action==='read')return {ok:true,protocol:1,revision:state.revision,rows:snap.rows};
  if(op.action==='receipt')return state.operations[op.operationId]?{ok:true,receipt:state.operations[op.operationId]}:{ok:false,code:'NOT_FOUND'};
  var digest=hash_(op),existing=state.operations[op.operationId];
  if(existing){if(existing.digest!==digest)return {ok:false,code:'OPERATION_REUSED'};return {ok:true,receipt:existing};}
  if(op.expectedRevision!==state.revision)return {ok:false,code:'VERSION_CONFLICT',revision:state.revision};
  var next=JSON.parse(JSON.stringify(snap.rows)),requests=[],applied=[];
  op.records.forEach(function(record){
   var tab=record.tab,spec=SYNC_TABS_[tab],id=record.values[spec.id],old=snap.ids[tab][id];
   if(old){if(!sameRow_(record.values,old.values,tab))syncError_('RECORD_CONFLICT');return;}
   if(tab==='Treinos'&&next.Treinos.slice(1).some(function(r){return r[0]===record.values[0]&&r[2]===record.values[2];}))syncError_('SESSION_CONFLICT');
   if(tab==='Series'&&!next.Treinos.slice(1).some(function(r){return r[0]===record.values[0]&&r[2]===record.values[1];}))syncError_('SESSION_REQUIRED');
   if(tab==='Peso'&&next.Peso.slice(1).some(function(r){return r[0]===record.values[0]&&r[1]===record.values[1];}))syncError_('WEIGHT_CONFLICT');
   var row=next[tab].length,sheetId=snap.sheets[tab].properties.sheetId;
   if(tab==='Peso'){
    [ [0,3],[5,7] ].forEach(function(pair){requests.push({updateCells:{range:{sheetId:sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:pair[0],endColumnIndex:pair[1]},rows:[{values:record.values.slice(pair[0],pair[1]).map(value_)}],fields:'userEnteredValue'}});});
   }else requests.push({updateCells:{range:{sheetId:sheetId,startRowIndex:row,endRowIndex:row+1,startColumnIndex:0,endColumnIndex:spec.width},rows:[{values:record.values.map(value_)}],fields:'userEnteredValue'}});
   next[tab].push(record.values.slice());applied.push({tab:tab,id:id});
  });
  state=JSON.parse(JSON.stringify(state));state.revision++;
  var receipt={operationId:op.operationId,digest:digest,revision:state.revision,applied:applied};state.operations[op.operationId]=receipt;state.fingerprint=fingerprint_(next);
  requests.push(stateWrite_(snap,state));
  var marker=JSON.stringify({operationId:op.operationId,digest:digest});props.setProperty('SYNC_INTENT',marker);
  if(props.getProperty('SYNC_INTENT')!==marker)syncError_('INTENT_NOT_SAVED');
  // Data and receipt share one Sheets batch. If the outcome is unknown the
  // marker remains, blocking further mutations until its receipt is observed.
  try{Sheets.Spreadsheets.batchUpdate({requests:requests},SYNC_TEST_SHEET_);}catch(e){return {ok:false,code:'UNCERTAIN'};}
  var check=snapshot_(),saved=check.state.operations[op.operationId];
  if(!saved||saved.digest!==digest||check.state.fingerprint!==fingerprint_(check.rows))return {ok:false,code:'UNCERTAIN'};
  props.deleteProperty('SYNC_INTENT');return {ok:true,receipt:saved};
 }finally{lock.releaseLock();}
}

/** Run once in the owner editor with SYNC_ENABLED=false, after backup and
 * confirming the test-only Sheet and existing ID headers. Never resets state.
 */
function initializeCoordinator(){
 var props=config_(true);if(props.getProperty('SYNC_ENABLED')==='true'||props.getProperty('SYNC_INTENT'))syncError_('INITIALIZATION_BLOCKED');
 var lock=LockService.getScriptLock();if(!lock.tryLock(5000))syncError_('BUSY');
 try{
  var meta=Sheets.Spreadsheets.get(SYNC_TEST_SHEET_,{fields:'sheets(properties(sheetId,title))'});
  if(!(meta.sheets||[]).some(function(s){return s.properties.title===SYNC_CONTROL_;}))Sheets.Spreadsheets.batchUpdate({requests:[{addSheet:{properties:{title:SYNC_CONTROL_,hidden:true}}}]},SYNC_TEST_SHEET_);
  var snap=snapshot_(true);if(snap.state)syncError_('ALREADY_INITIALIZED');
  var state={protocol:1,revision:0,mode:'ready',fingerprint:fingerprint_(snap.rows),operations:{}};
  Sheets.Spreadsheets.batchUpdate({requests:[stateWrite_(snap,state)]},SYNC_TEST_SHEET_);
  var check=snapshot_();if(check.state.fingerprint!==fingerprint_(check.rows))syncError_('INITIALIZATION_UNCERTAIN');
  return {ok:true,revision:0,enabled:false};
 }finally{lock.releaseLock();}
}

function coordinateSync(request){
 var result=coordinateSync_(request);
 result.protocol=1;result.spreadsheetId=SYNC_TEST_SHEET_;result.environment='test';
 return result;
}
