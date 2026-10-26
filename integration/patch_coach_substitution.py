#!/usr/bin/env python3
"""Complemento Etapa 5: substituir exercício sem apagar séries existentes."""
from pathlib import Path
p=Path('dist/coach_commands.js');s=p.read_text('utf8')
anchor=" if(/^(?:proximo|proxima|avancar|seguir)(?:\\s+exercicio)?[.!]?$/.test(msg))return {kind:'next'};"
if s.count(anchor)!=1:raise ValueError('Âncora de comandos não encontrada')
new=""" const substitution=source.match(/^\\s*(?:substituir|trocar)\\s+(?:.+?\\s+)?(?:por|para)\\s+(.+)$/i);
 if(substitution&&!/^\s*trocar\s+para\b/i.test(source))return {kind:'replace',name:substitution[1].trim()};
"""+anchor
s=s.replace(anchor,new,1)
p.write_text(s,'utf8')
app=Path('dist/app.js');a=app.read_text('utf8')
old="import {buildCoachPolicy} from './coach_policy.js';"
if a.count(old)!=1:raise ValueError('Importação da política não está presente')
a=a.replace(old,old+"\nimport {replaceCoachVariant} from './coach_substitution.js';",1)
marker=" if(command.kind==='undo'){"
if a.count(marker)!=1:raise ValueError('Ponto de inserção da conversa não é único')
replace=""" if(command.kind==='replace'){
  if(!active)throw new Error('Inicie um treino antes de substituir exercícios.');
  if(!coachSelected)throw new Error('Selecione primeiro o exercício atual.');
  const m=g(),cached=doc.settings.coach_plan_rules||{};
  const planEntities={...m.entities,
   plan_parameters:[...(cached.plan_parameters||[]),...(m.entities.plan_parameters||[])],
   training_rules:[...(cached.training_rules||[]),...(m.entities.training_rules||[])],
   weekly_schedule:[...(cached.weekly_schedule||[]),...(m.entities.weekly_schedule||[])]};
  const policy=buildCoachPolicy(planEntities,doc.settings.coach_preferences||{});
  const allowed=m.entities.exercise_variants.filter(v=>{
    const exercise=m.exerciseMap.get(v.exercise_id);
    return exercise&&!policy.evaluate(exercise,v).blocked;
  }).map(v=>v.id);
  const nextId=resolvePlannedExercise(command.name,allowed,m.variantMap,m.exerciseMap);
  if(nextId===coachSelected){coachSay('assistant','Esta variação já está selecionada.');render();return;}
  let outcome;
  const ok=await perform(d=>{outcome=replaceCoachVariant(d,active.id,coachSelected,nextId);},
   'Roteiro atualizado sem alterar séries já salvas.');
  if(ok){coachSelected=outcome.selected;
   coachSay('assistant',outcome.mode==='added_after'?
    'Nova variação adicionada após o exercício anterior, que conserva suas séries já registradas.':
    'Exercício substituído no roteiro. As cargas e séries anteriores não foram alteradas.');
   render();
  }
  return;
 }
"""
a=a.replace(marker,replace+marker,1)
oldHelp='dizer "resumo", "corrigir última: 55 kg 8 reps RIR 2" ou "desfazer".'
newHelp='dizer "resumo", "substituir atual por voador", "corrigir última: 55 kg 8 reps RIR 2" ou "desfazer".'
if a.count(oldHelp)!=1:raise ValueError('Ajuda da conversa alterada')
a=a.replace(oldHelp,newHelp,1)
app.write_text(a,'utf8')
print('ETAPA5_SUBSTITUTION_PATCH=APPLIED')
