#!/usr/bin/env python3
"""Etapa 5: personalização do assistente com plano local e preferências.
Não altera dados do usuário ou Google Sheets.
"""
from pathlib import Path
app=Path('dist/app.js')
logic=Path('dist/coach_logic.js')
a=app.read_text('utf8');s=logic.read_text('utf8')
def one(text,old,new,label):
 count=text.count(old)
 if count!=1:raise ValueError('Etapa 5: âncora '+label+' '+str(count))
 return text.replace(old,new,1)

s=one(s,"export function suggestExercises(entities,groups,{limit=6}={}){",
"export function suggestExercises(entities,groups,{limit=6,ranker=null}={}){","ranker option")
s=one(s,"  const score=Math.max(...scores);if(!Number.isFinite(score))continue;\n  const recent=last.get(v.id);",
"""  const score=Math.max(...scores);if(!Number.isFinite(score))continue;
  const decision=typeof ranker==='function'?ranker(exercise,v):null;
  if(decision?.blocked)continue;
  const adjustedScore=score+(Number.isFinite(decision?.bonus)?decision.bonus:0);
  const recent=last.get(v.id);""","evaluate before list")
s=one(s,"unit:v.unit||'reps',score,hasHistory:!!recent",
"unit:v.unit||'reps',score:adjustedScore,hasHistory:!!recent","weighted score")
# As abas Plano podem armazenar rótulo da regra e valor em colunas
# diferentes. Apenas uma linha com ambos é elegível como faixa RIR.
policyFile=Path('dist/coach_policy.js')
p=policyFile.read_text('utf8')
old="const rirLine=lines.find(line=>/rir\\s+alvo|repeticoes?\\s+em\\s+reserva/i.test(normal(line)))||'';"
new="const rirLine=lines.find(line=>/rir\\s+alvo|repeticoes?\\s+em\\s+reserva/i.test(normal(line))&&/\\d+\\s*[–—-]\\s*\\d+/.test(normal(line)))||'';"
if p.count(old)!=1:raise ValueError('Âncora da faixa RIR inválida')
p=p.replace(old,new)
oldPriority="const priorityWords=normal(lines.find(x=>/^(prioridades|objetivo principal)/i.test(normal(x)))||'');"
newPriority="const priorityWords=normal(lines.find(x=>/^(prioridades|objetivo principal)/i.test(normal(x))&&x.includes(' — '))||'');"
if p.count(oldPriority)!=1:raise ValueError('Âncora da prioridade inválida')
p=p.replace(oldPriority,newPriority)
policyFile.write_text(p,'utf8')
logic.write_text(s,'utf8')
a=one(a,"import {parseGoal,groupLabel,suggestExercises,parseSeriesMessage} from './coach_logic.js';",
"""import {parseGoal,groupLabel,suggestExercises,parseSeriesMessage} from './coach_logic.js';
import {buildCoachPolicy} from './coach_policy.js';""","policy import")
a=one(a,"  const groups=parseGoal(input),m=g(),items=suggestExercises(m.entities,groups,{limit:groups.length>1?6:5});",
"""  const rawGroups=parseGoal(input),m=g(),policy=buildCoachPolicy(m.entities,doc.settings.coach_preferences||{});
  const groups=policy.orderGroups(rawGroups);
  const items=suggestExercises(m.entities,groups,{limit:groups.length>1?6:5,ranker:policy.evaluate});""","suggestion")
a=one(a,"  coachPlan={groups,items};coachSelected=items[0].variant_id;",
"  coachPlan={groups,items,notes:policy.notes};coachSelected=items[0].variant_id;","session draft")
a=one(a,
"  coachSay('assistant','Sugeri '+items.length+' exercícios de '+groupLabel(groups)+' com base no histórico. Confira e toque em Confirmar e começar treino.');",
"  coachSay('assistant','Sugeri '+items.length+' exercícios de '+groupLabel(groups)+' com base no histórico e nas regras locais do planejamento. '+policy.notes.join(' ')+' Confira e toque em Confirmar e começar treino.');",
"assistant explanation")
a=one(a,"const preview=(coachPlan&&!active)?panel(",
"const preview=(coachPlan&&!active)?panel(","no-op check")
a=one(a,"Escolhida exclusivamente dentre seus exercícios registrados. Revise o roteiro: nenhuma série foi criada.",
"Exercícios do histórico filtrados pelas regras locais do Plano e suas preferências. Revise o roteiro: nenhuma série foi criada.",
"plan UI attribution")
app.write_text(a,'utf8')
print('ETAPA5_COACH_PATCH=APPLIED')
