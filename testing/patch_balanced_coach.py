"""Integrate the balanced coach into the test app only."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
dest=root/'dist/testes'
(dest/'balanced_coach.js').write_text((root/'testing/balanced_coach.js').read_text())
for name in ('sw.js','integrity.js'):
 p=dest/name;s=p.read_text();assert s.count("'./app.js'")==1;s=s.replace("'./app.js'","'./balanced_coach.js','./app.js'");p.write_text(s)
p=dest/'app.js';s=p.read_text();s="import {balancedPlan,replacementFor,catalogEntities} from './balanced_coach.js';\n"+s
old="const items=suggestExercises(m.entities,groups,{limit:groups.length>1?6:5,ranker:policy.evaluate});"
new="const proposal=balancedPlan(m.entities,groups,input,{ranker:policy.evaluate});const items=proposal.items;"
assert s.count(old)==1;s=s.replace(old,new)
old="coachPlan={groups,items,notes:policy.notes};coachSelected=items[0].variant_id;"
new="coachPlan={...proposal,notes:policy.notes};coachSelected=items[0].variant_id;"
assert s.count(old)==1;s=s.replace(old,new)
old="coachSay('assistant','Sugeri '+items.length+' exercícios de '+groupLabel(groups)+' com base no histórico '+(policy.hasPlan?'e nas regras do planejamento. ':'(sem Plano local disponível neste acesso). ')+policy.notes.join(' ')+' Confira e toque em Confirmar e começar treino.');"
new="coachSay('assistant','Montei '+items.length+' exercícios com foco em '+groupLabel(proposal.groups)+'. '+(proposal.minutes?'Você informou '+proposal.minutes+' minutos; ajuste pausas e quantidade conforme necessário. ':'Informe o tempo em minutos para uma sugestão mais curta. ')+(proposal.short?'Faltam '+proposal.short+' opções compatíveis; cadastre outras variações se desejar. ':'')+'Sugestões sem histórico não têm carga presumida. Revise e ajuste antes de começar.');"
assert s.count(old)==1;s=s.replace(old,new)
old="const v=m.variantMap.get(id),ex=m.exerciseMap.get(v?.exercise_id),q=activeSets.filter(s=>s.variant_id===id).length;return item(`${i+1}. ${ex?.name||'Exercício'}`,`${v?.equipment_or_variation||''} · ${v?.unit||''} · ${q} série(s) registrada(s)`, `<button class=\"btn small ${id===selected?'primary':''}\" data-coach-action=\"select\" data-coach-variant=\"${e(id)}\">${id===selected?'Selecionado':'Selecionar'}</button>`);"
new="const draft=!active?coachPlan?.items.find(x=>x.variant_id===id):null,v=m.variantMap.get(id),ex=m.exerciseMap.get(v?.exercise_id),q=activeSets.filter(s=>s.variant_id===id).length;const desc=draft?`${draft.group} · ${draft.equipment} · ${draft.last?.load_value!=null?'Última carga: '+draft.last.load_value+' '+draft.unit:'Sem carga de referência'}`:`${v?.equipment_or_variation||''} · ${v?.unit||''} · ${q} série(s) registrada(s)`;const controls=draft?`<button class=\"btn small\" data-coach-action=\"replace-preview\" data-coach-variant=\"${e(id)}\">Trocar</button> <button class=\"btn small\" data-coach-action=\"remove-preview\" data-coach-variant=\"${e(id)}\">Remover</button>`:`<button class=\"btn small ${id===selected?'primary':''}\" data-coach-action=\"select\" data-coach-variant=\"${e(id)}\">${id===selected?'Selecionado':'Selecionar'}</button>`;return item(`${i+1}. ${draft?.name||ex?.name||'Exercício'}`,desc,controls);"
assert s.count(old)==1;s=s.replace(old,new)
old='Exercícios do histórico filtrados pelas regras locais do Plano e suas preferências. Revise o roteiro: nenhuma série foi criada.'
new='Equilíbrio sugerido a partir do grupo pedido, tempo informado e opções disponíveis. Sem carga de referência não significa carga zero. Revise o roteiro: nenhuma série foi criada.'
assert s.count(old)==1;s=s.replace(old,new)
needle=" if(action==='select'){const vid=btn.dataset.coachVariant;"
insert=""" if(action==='remove-preview'||action==='replace-preview'){
  if(coachActive()||!coachPlan)return;
  const index=coachPlan.items.findIndex(x=>x.variant_id===btn.dataset.coachVariant);if(index<0)return;
  if(action==='remove-preview'){coachPlan.items.splice(index,1);coachSay('assistant','Exercício removido da sugestão.');}
  else{const replacement=replacementFor(coachPlan,index);if(!replacement){coachSay('assistant','Não há outra opção cadastrada para esse grupo. Você pode remover ou cadastrar uma variação.');render();return;}coachPlan.items[index]=replacement;coachSay('assistant','Troquei por '+replacement.name+'. Confira equipamento e carga.');}
  coachSelected=coachPlan.items[0]?.variant_id||'';render();return;
 }
"""
assert s.count(needle)==1;s=s.replace(needle,insert+needle)
needle="   const available=new Set([...d.base?.entities?.exercise_variants||[],...d.overlay.exercise_variants].map(v=>v.id));"
insert="""   const catalog=catalogEntities(coachPlan.items);
   const allEx=[...(d.base?.entities?.exercises||[]),...d.overlay.exercises];
   const allVar=[...(d.base?.entities?.exercise_variants||[]),...d.overlay.exercise_variants];
   for(const ex of catalog.exercises){const existing=allEx.find(x=>x.id===ex.id);if(existing&&existing.name!==ex.name)throw new Error('Identificador de exercício já está em uso.');if(!existing)d.overlay.exercises.push(ex);}
   for(const v of catalog.variants){const existing=allVar.find(x=>x.id===v.id);if(existing&&existing.exercise_id!==v.exercise_id)throw new Error('Identificador de variação já está em uso.');if(!existing)d.overlay.exercise_variants.push(v);}
"""
assert s.count(needle)==1;s=s.replace(needle,insert+needle)
p.write_text(s)
print('BALANCED_COACH_TEST_APP=APPLIED')
