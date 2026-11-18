/* Leitura estritamente local da aba Plano. Dados da planilha não entram no
 * GitHub nem são incorporados ao código público.
 */
const cell=value=>String(value??'').trim();
export function parseCoachPlanRows(rows){
 if(!Array.isArray(rows)||!rows.length)throw new Error('A aba Plano está vazia ou indisponível.');
 const first=rows[0]||[];
 if(!/^par[aâ]metro$/i.test(cell(first[0]))||!/defini[cç][aã]o/i.test(cell(first[1]))||
    !/^regra$/i.test(cell(first[7]))||!/^aplica[cç][aã]o$/i.test(cell(first[8])))
   throw new Error('Cabeçalhos inesperados na aba Plano; nenhuma regra foi substituída.');
 const plan_parameters=[],training_rules=[],weekly_schedule=[];
 for(let i=1;i<rows.length;i++){
  const r=rows[i]||[];
  if(cell(r[0])&&cell(r[1]))plan_parameters.push({parameter:cell(r[0]),value:cell(r[1])});
  if(cell(r[7])&&cell(r[8]))training_rules.push({rule:cell(r[7]),application:cell(r[8])});
  if(cell(r[3])&&cell(r[4]))weekly_schedule.push({day:cell(r[3]),session:cell(r[4]),intention:cell(r[5])});
 }
 if(!plan_parameters.length&&!training_rules.length&&!weekly_schedule.length)
  throw new Error('Nenhuma regra válida na aba Plano; dados locais preservados.');
 return {plan_parameters,training_rules,weekly_schedule};
}
