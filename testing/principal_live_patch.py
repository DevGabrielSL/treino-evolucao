"""Add live guidance to the principal distribution."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
shutil.copy2(root / 'testing/principal_live.js', dist / 'principal_live.js')
p = dist / 'app.js'
s = p.read_text()
def replace(old, new):
    global s
    assert s.count(old) == 1, old
    s = s.replace(old, new)
replace("import {balancedPlan,replacementFor} from './principal_variety.js';", "import {liveGuidance,nextPending} from './principal_live.js';\nimport {balancedPlan,replacementFor} from './principal_variety.js';")
needle='function renderCoach(m){'
replace(needle,'''function renderLiveGuidance(active,selected,m){
 const state=liveGuidance(active,selected,m.entities),variant=m.variantMap.get(selected),unit=variant?.unit||'';
 const value=x=>x==null?'não informado':String(x);
 return `<div class="tinted"><h3>Orientação do exercício atual</h3><p>${e(state.dose?.label||'Sem sugestão salva para este exercício.')}</p><p>${state.count}${state.target!==null?' de '+state.target:''} série(s) de trabalho registrada(s) · ${state.warmups} aquecimento(s).</p><p>${state.reached} de ${state.total} exercícios com quantidade sugerida atingida.</p><p>${e(state.message)}</p><p class="text-small">${e(state.dose?.effort||'Ajuste o esforço conforme sua condição de hoje.')}</p>${state.latest?`<p>Última série de trabalho neste treino: ${e(value(state.latest.load_value))} ${e(unit)} · ${e(value(state.latest.repetitions))} reps · RIR ${e(value(state.latest.rir))}.</p>`:''}<p class="text-small">${state.reference?'Referência anterior da mesma variação ('+e(state.reference.date)+'): '+e(value(state.reference.load_value))+' '+e(unit)+' · '+e(value(state.reference.repetitions))+' reps.':'Sem referência de série de trabalho em treino anterior concluído desta variação.'}</p><p class="text-small">As metas orientam o roteiro; não são uma confirmação de execução. Dor durante o movimento: interrompa o movimento e procure orientação profissional.</p></div>`;
}
'''+needle)
replace(" · Última carga registrada: ${last?.load_value??'Não informada'} ${e(picked?.unit||'')}</p>", "</p>${renderLiveGuidance(active,selected,m)}")
replace("O envio à planilha ocorre em Dados.", "A sincronização automática envia o treino após a conclusão quando estiver habilitada; acompanhe a confirmação em Dados.")
replace('Para gravar na planilha, conclua o treino e sincronize em Dados.', 'Ao concluir, a sincronização automática tentará enviar se estiver habilitada. Confira a confirmação em Dados.')
replace('Treino concluído. Abra Dados → Sincronização com Google Sheets e confirme o envio. Até lá, os dados estão somente no celular.', 'Treino concluído e salvo no celular. A sincronização automática tentará enviar quando habilitada. Acompanhe a confirmação em Dados; salvar localmente não confirma o envio.')
replace('${composer}${preview}${current}${actions}', "${active?current+composer:composer+preview}${actions}")
replace("if(action==='next'){const ids=coachActive()?.planned_variant_ids||[];if(!ids.length)return;const pos=ids.indexOf(coachSelected);coachSelected=ids[(pos+1)%ids.length];render();return;}", "if(action==='next'){const active=coachActive();if(!active)return;const next=nextPending(active,coachSelected,g().entities);if(next)coachSelected=next;else coachSay('assistant','Não há outro exercício com meta pendente no roteiro. Você pode selecionar qualquer exercício ou revisar e concluir o treino.');render();return;}")
replace("coachSelected=ids[(ids.indexOf(coachSelected)+1)%ids.length];", "const next=nextPending(active,coachSelected,g().entities);if(!next){coachSay('assistant','Não há outro exercício com meta pendente. Revise o roteiro antes de concluir.');render();return;}coachSelected=next;")
p.write_text(s)
for name in ('sw.js','integrity.js'):
    p=dist/name
    s=p.read_text()
    assert s.count("'./principal_dose.js'")==1
    p.write_text(s.replace("'./principal_dose.js'", "'./principal_live.js','./principal_dose.js'"))
