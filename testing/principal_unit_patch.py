from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];dist=root/'dist'
shutil.copy2(root/'testing/principal_unit.js',dist/'principal_unit.js')
p=dist/'app.js';s=p.read_text();s="import {confirmSessionVariant} from './principal_unit.js?v=155';\n"+s
needle=" const entry=safeUnit&&!timed?";assert s.count(needle)==1
s=s.replace(needle," const entry=!safeUnit&&!timed?renderUnitConfirmation(active,selected):safeUnit&&!timed?")
s+='''
function renderUnitConfirmation(active,selected){return `<p class="text-small">Confirme o equipamento e a unidade para liberar o registro. Uma variação confirmada será criada; cargas e séries anteriores continuam na variação original.</p><form id="quick-unit-form"><input type="hidden" name="session_id" value="${e(active.id)}"><input type="hidden" name="source_id" value="${e(selected)}"><label class="field"><span>Equipamento ou variação usada</span><input class="input" name="equipment" maxlength="100" required placeholder="Ex.: barra livre, máquina ou halteres"></label><label class="field"><span>Como você informa a carga?</span><select class="input" name="unit" required><option value="">Selecione a unidade</option><option value="kg">kg — carga total</option><option value="kg/lado">kg por lado</option><option value="kg/halter">kg por halter</option><option value="plaquetas">Plaquetas</option><option value="peso corporal">Peso corporal</option></select></label><button class="btn primary block" type="submit">Confirmar e liberar registro</button></form>`;}
'''
needle='async function onSubmit(event){';assert s.count(needle)==1
s=s.replace(needle,needle+'''
 if(event.target?.id==='quick-unit-form'){
  event.preventDefault();if(busy||quickSaving)return;
  const values=new FormData(event.target),active=coachActive();
  if(!active||values.get('session_id')!==active.id||values.get('source_id')!==coachSelected)throw new Error('Treino ou exercício mudou. Confira a seleção.');
  const id=makeId('variant');
  const ok=await perform(d=>confirmSessionVariant(d,{sessionId:active.id,sourceId:coachSelected,newId:id,equipment:values.get('equipment'),unit:values.get('unit')}),'Equipamento e unidade confirmados neste aparelho.');
  if(ok){coachSelected=id;variantSelected=id;render();document.querySelector('#quick-set-form')?.scrollIntoView({block:'center',behavior:'smooth'});}return;
 }
''')
s=s.replace('Use a conversa ou o modo manual para registrar na unidade cadastrada.','Confirme o equipamento e a unidade acima para registrar a série.')
s=s.replace('Treino & Evolução · v1.5.4','Treino & Evolução · v1.5.5');p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=154','app.js?v=155').replace('v1.5.4 Cartas proporcionais','v1.5.5 Registro de séries');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=154','app.js?v=155').replace('shell-v154-cards','shell-v155-unit').replace("'./principal_cancel.js?v=152'","'./principal_unit.js?v=155','./principal_cancel.js?v=152'");p.write_text(s)
