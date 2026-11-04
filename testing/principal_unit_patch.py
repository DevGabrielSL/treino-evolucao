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
  let confirmedId;
  const ok=await perform(d=>{confirmedId=confirmSessionVariant(d,{sessionId:active.id,sourceId:coachSelected,newId:id,equipment:values.get('equipment'),unit:values.get('unit')}).id;},'Equipamento e unidade confirmados neste aparelho.');
  if(ok){coachSelected=confirmedId;variantSelected=confirmedId;render();document.querySelector('#quick-set-form')?.scrollIntoView({block:'center',behavior:'smooth'});}return;
 }
''')
s=s.replace('Use a conversa ou o modo manual para registrar na unidade cadastrada.','Confirme o equipamento e a unidade acima para registrar a série.')
s=s.replace('Treino & Evolução · v1.5.4','Treino & Evolução · v1.5.5');p.write_text(s)
p=dist/'index.html';s=p.read_text().replace('app.js?v=154','app.js?v=155').replace('v1.5.4 Cartas proporcionais','v1.5.5 Registro de séries');p.write_text(s)
for name in ('sw.js','integrity.js'):
 p=dist/name;s=p.read_text().replace('app.js?v=154','app.js?v=155').replace('shell-v154-cards','shell-v155-unit').replace("'./principal_cancel.js?v=152'","'./principal_unit.js?v=155','./principal_cancel.js?v=152'");p.write_text(s)

p=dist/'app.js';s=p.read_text()
def replace_once(old,new):
 global s
 assert s.count(old)==1,old
 s=s.replace(old,new)

replace_once('import {confirmSessionVariant}', 'import {confirmSessionVariant,correctLocalSetUnit,loadUnits}')
start=s.index('  const v=g().variantMap.get(latest.variant_id);',s.index("if(action==='edit-last')"))
end=s.index('\n }',start)
s=s[:start]+"""  if(!doc.overlay.sets.some(row=>row.id===latest.id))throw new Error('Esta série não é editável.');
  editSetId=latest.id;
  render();
  $('#edit-set-form')?.scrollIntoView({behavior:'smooth',block:'center'});
  return;"""+s[end:]
replace_once('Somente séries criadas no celular são editáveis; a variante é preservada.', 'Se a unidade estava errada, escolha a correta e informe a carga correspondente.')
start=s.index('function renderSetEditor(')
pos=s.index('<span>Carga</span>',start)
s=s[:pos]+'''<span>Unidade da carga</span><select class="input" name="load_unit" required>${[...new Set([s.load_unit_original||v?.unit,...loadUnits].filter(Boolean))].map(unit=>`<option value="${e(unit)}" ${unit===(s.load_unit_original||v?.unit)?'selected':''}>${e(unit)}</option>`).join('')}</select></label><label class="field">'''+s[pos:]
replace_once('d=>mutateLocalSet(d,x.set_id,{load_value:load,repetitions:reps,rir,set_type:x.type})', 'd=>correctLocalSetUnit(d,x.set_id,x.load_unit,makeId(\'variant\'),{load_value:load,repetitions:reps,rir,set_type:x.type},mutateLocalSet)')
replace_once('function onChange(event){const el=event.target;', """function onChange(event){const el=event.target;
 if(el.form?.id==='edit-set-form'&&el.name==='load_unit'){
  const field=el.form.elements.namedItem('load');
  if(field){field.value='';field.focus();}
  return;
 }""")
p.write_text(s)
