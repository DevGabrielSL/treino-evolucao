import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Cada teste começa com um navegador limpo (sem dados), como um aparelho novo.

const problems: string[] = [];
// Registra violações da política de segurança (CSP) com a origem de quem as causou.
const recordCsp = () => {
  (window as any).__csp = [];
  document.addEventListener('securitypolicyviolation', (e: any) => (window as any).__csp.push({ directive: e.violatedDirective, source: e.sourceFile || '', blocked: e.blockedURI || '' }));
};
function watch(page: Page) {
  problems.length = 0;
  page.on('pageerror', e => problems.push('erro de página: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/accounts\.google\.com|Content Security Policy|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_TUNNEL|ERR_FAILED|Failed to load resource/.test(t)) problems.push('console: ' + t);
  });
}
async function boot(page: Page, { google = false } = {}) {
  watch(page);
  await page.addInitScript(recordCsp);
  // O app carrega o login do Google ao abrir (como o app anterior). Nos testes do app ele fica
  // bloqueado, para o resultado não depender da rede; há um teste próprio para o Google abaixo.
  if (!google) await page.route(/accounts\.google\.com/, r => r.abort());
  await page.goto('./');
  await expect(page.getByText('Mapa · toque num distrito')).toBeVisible();
}
const cspViolations = (page: Page) => page.evaluate(() => (window as any).__csp || []).catch(() => []);
async function startFeaturedMission(page: Page) {
  await page.getByRole('button', { name: 'Iniciar missão' }).first().click();
  await page.getByText('Toque para começar').click();
  await expect(page.getByText('Missão em andamento')).toBeVisible();
}
async function confirmKg(page: Page) {
  await page.getByRole('button', { name: /^kg Peso total$/ }).click();
  await expect(page.getByRole('button', { name: 'Registrar série' })).toBeVisible();
}
async function registerSet(page: Page, load: string, reps: string) {
  await page.getByLabel('Carga · kg', { exact: true }).fill(load);
  await page.getByLabel('Repetições', { exact: true }).fill(reps);
  await page.getByRole('button', { name: 'Registrar série' }).click();
  // descanso em tela cheia abre sozinho depois de uma série de trabalho
  await expect(page.getByRole('button', { name: 'Minimizar' })).toBeVisible();
  await page.getByRole('button', { name: 'Minimizar' }).click();
}

test.afterEach(async ({ page }, info) => {
  if (info.title.startsWith('Google:')) return;
  expect(problems, problems.join('\n')).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
});

test('Google: o login carrega e nenhuma violação de segurança vem do código do app', async ({ page }) => {
  await boot(page, { google: true });
  const loaded = await page.waitForFunction(() => Boolean((window as any).google?.accounts?.oauth2), null, { timeout: 15000 }).then(() => true, () => false);
  test.skip(!loaded, 'Sem acesso ao Google neste ambiente.');
  const all: { directive: string; source: string; blocked: string }[] = await cspViolations(page);
  const origin = new URL(page.url()).origin;
  test.info().annotations.push({ type: 'csp', description: JSON.stringify(all) });
  // O script do Google tenta inserir estilos internos, bloqueados pela política (comportamento já existente no app anterior).
  expect(all.filter(v => v.source.startsWith(origin))).toEqual([]);
  expect(problems, problems.join('\n')).toEqual([]);
});

test('abre sem erros, mostra o mapa e as quatro missões', async ({ page }) => {
  await boot(page);
  for (const d of ['Orla do Sol', 'Porto Neon', 'Terraço Central', 'Marina Oeste']) await expect(page.getByRole('button', { name: `Distrito ${d}` })).toBeVisible();
  await page.getByRole('button', { name: 'Distrito Marina Oeste' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Pernas completas' })).toBeVisible();
});

test('missão completa: unidade, séries, drop set, pular, concluir e histórico', async ({ page }) => {
  await boot(page);
  await startFeaturedMission(page);
  await confirmKg(page);
  await registerSet(page, '40', '10');
  await expect(page.locator('#xp-target')).toHaveText('10 XP');

  // drop set: série de trabalho + uma redução
  await page.getByRole('button', { name: '+ Drop set (redução de carga)' }).click();
  await page.getByLabel('Carga do drop 1').fill('30');
  await page.getByLabel('Repetições do drop 1').fill('8');
  await registerSet(page, '40', '9');
  await expect(page.getByText('DROP', { exact: true })).toBeVisible();

  // pular a terceira série do exercício
  await page.getByRole('button', { name: 'Opções do exercício' }).click();
  await page.getByRole('button', { name: /Pular uma série/ }).click();
  await expect(page.getByText(/3\/21 séries/)).toBeVisible();

  // concluir
  await page.getByRole('button', { name: 'Concluir missão' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Missão\s*concluída/i })).toBeVisible();
  // cartão compartilhável (no navegador de teste vira download)
  const card = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Compartilhar cartão da missão' }).click();
  const png = readFileSync(await (await card).path());
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(50_000);
  await expect(page.getByTestId('season-tier')).toContainText('Temporada');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // mapa evolui: primeira luz da cidade e domínio do distrito concluído
  await expect(page.getByTestId('city-lights')).toContainText('Cidade 1/10 luzes');
  await expect(page.getByRole('button', { name: 'Distrito Orla do Sol, domínio 25%' })).toBeVisible();
  // passe da temporada com desafios e chefão
  await page.getByTestId('season-card').click();
  const season = page.getByRole('dialog', { name: 'Temporada' });
  await expect(season.getByText('Turnê pela cidade')).toBeVisible();
  await expect(season.getByTestId('season-boss')).toBeVisible();
  await season.getByRole('button', { name: 'Fechar' }).click();
  await expect(season).toBeHidden();

  await page.getByRole('button', { name: 'Histórico' }).click();
  await expect(page.getByText('Concluída').first()).toBeVisible();
  await page.getByRole('button', { name: 'Personagem' }).click();
  await expect(page.getByRole('heading', { name: 'Atributos' })).toBeVisible();
  await expect(page.locator('div.panel', { has: page.getByText('Missões', { exact: true }) }).locator('p').first()).toHaveText('1');

  // continua lá depois de recarregar
  await page.reload();
  await page.getByRole('button', { name: 'Histórico' }).click();
  await expect(page.getByText('Concluída').first()).toBeVisible();
});

test('esforço (RIR), repetir série e corrigir a última série', async ({ page }) => {
  await boot(page);
  await startFeaturedMission(page);
  await confirmKg(page);
  await page.getByLabel('Carga · kg', { exact: true }).fill('42,5');
  await page.getByLabel('Repetições', { exact: true }).fill('10');
  await page.getByRole('radio', { name: 'RIR 2' }).click();
  await page.getByRole('button', { name: 'Registrar série' }).click();
  await page.getByRole('button', { name: 'Minimizar' }).click();
  await expect(page.getByText('RIR 2')).toBeVisible();
  // repetir num toque
  await page.getByRole('button', { name: /Repetir série · 42,5 kg × 10/ }).click();
  await page.getByRole('button', { name: 'Minimizar' }).click();
  await expect(page.getByText(/2\/21 séries/)).toBeVisible();
  // corrigir a última
  await page.getByRole('button', { name: 'Corrigir última série' }).click();
  await page.getByLabel('Repetições corrigidas').fill('8');
  await page.getByRole('radio', { name: 'RIR 0' }).last().click();
  await page.getByRole('button', { name: 'Salvar correção' }).click();
  await expect(page.getByText('RIR 0')).toBeVisible();
  await expect(page.locator('li', { hasText: '× 8' })).toBeVisible();
});

test('sugestão de progressão (opcional): sobe um degrau depois do topo da faixa com RIR', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Celular' }).click();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByLabel('Sugestão de progressão de carga').check();
  await page.getByRole('button', { name: 'Missões' }).click();

  await startFeaturedMission(page);
  await confirmKg(page);
  await expect(page.getByTestId('progression')).toHaveCount(0); // sem histórico, sem sugestão
  for (let i = 0; i < 2; i++) {
    await page.getByLabel('Carga · kg', { exact: true }).fill('40');
    await page.getByLabel('Repetições', { exact: true }).fill('20');
    await page.getByRole('radio', { name: 'RIR 2' }).click();
    await page.getByRole('button', { name: 'Registrar série' }).click();
    await page.getByRole('button', { name: 'Minimizar' }).click();
  }
  await page.getByRole('button', { name: 'Concluir missão' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: /Missão\s*concluída/i })).toBeHidden();

  // mesmo deck de novo: o briefing já mostra a seta e o treino sugere 42,5 kg
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Distrito Orla do Sol' }).click({ force: true });
  await expect(page.getByText(/Deck 01 · Orla do Sol/)).toBeVisible();
  await page.getByRole('button', { name: 'Briefing' }).click();
  await expect(page.getByText('↑ 42,5 kg').first()).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar missão' }).last().click();
  await page.getByText('Toque para começar').click();
  const hint = page.getByTestId('progression');
  await expect(hint).toHaveAttribute('data-kind', 'subir');
  await expect(hint).toContainText('Suba para 42,5 kg');
  // a carga só muda com o toque
  await expect(page.getByLabel('Carga · kg', { exact: true })).toHaveValue(/^40$/);
  await hint.getByRole('button', { name: /Usar 42,5/ }).click();
  await expect(page.getByLabel('Carga · kg', { exact: true })).toHaveValue(/^42[.,]5$/);
});

test('ajustes: descanso após aquecimento (2:30), cronômetro desde a última série, séries extras e horário no final', async ({ page }) => {
  await boot(page);
  await startFeaturedMission(page);
  await confirmKg(page);
  await expect(page.getByTestId('since-last')).toContainText('--:--');
  // aquecimento também inicia o descanso, com padrão de 2:30
  await page.getByRole('button', { name: 'Aquecimento · +5 XP' }).click();
  await page.getByLabel('Carga · kg', { exact: true }).fill('20');
  await page.getByLabel('Repetições', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Registrar série' }).click();
  await expect(page.getByRole('button', { name: 'Minimizar' })).toBeVisible();
  await expect(page.getByText(/^02:(2\d|30)$/).first()).toBeVisible();
  await expect(page.getByTestId('since-last-overlay')).toContainText('00:0');
  await page.getByRole('button', { name: 'Minimizar' }).click();
  await expect(page.getByTestId('since-last')).not.toContainText('--:--');
  // passa de 3 séries de trabalho no mesmo exercício
  await page.getByRole('button', { name: 'Trabalho · +10 XP' }).click();
  for (let i = 0; i < 4; i++) await registerSet(page, '40', '10');
  await expect(page.getByText('Série extra 5 liberada.')).toBeVisible();
  await expect(page.getByText(/^S4$/)).toBeVisible();
  await page.getByRole('button', { name: 'Concluir missão' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.getByText(/Horário/)).toBeVisible();
  await expect(page.getByText(/^\d\d:\d\d – \d\d:\d\d$/)).toBeVisible();
});

test('treino em casa: peso corporal e tempo sem confirmar unidade; conta nos desafios do dia', async ({ page }) => {
  await boot(page);
  await page.getByTestId('home-card').click();
  await page.getByRole('button', { name: 'Iniciar treino em casa' }).click();
  await page.getByText('Toque para começar').click();
  await expect(page.getByText('Missão em andamento')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Polichinelo' })).toBeVisible();
  await page.getByLabel('Segundos realizados').fill('45');
  await page.getByRole('button', { name: 'Salvar tempo' }).click();
  await page.getByRole('button', { name: 'Minimizar' }).click();
  await page.getByRole('button', { name: 'Próximo alvo' }).click();
  await expect(page.getByRole('heading', { name: 'Agachamento livre' })).toBeVisible();
  const extra = page.getByLabel('Carga extra · kg (0 = só o corpo)', { exact: true });
  await expect(extra).toHaveValue('0');
  await page.getByLabel('Repetições', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Registrar série' }).click();
  await page.getByRole('button', { name: 'Minimizar' }).click();
  await page.getByRole('button', { name: 'Concluir missão' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByTestId('quest-cardio')).toContainText('45s/10:00');
  await expect(page.getByText('Concluir 4 missões')).toBeVisible();
  await expect(page.getByText('1/4', { exact: true })).toBeVisible();
});

test('core profundo: vácuo por tempo, prancha conta no desafio e não conta como missão da semana', async ({ page }) => {
  await boot(page);
  await page.getByTestId('core-card').click();
  const brief = page.getByRole('dialog', { name: 'Core profundo' });
  await expect(brief.getByText('Vácuo abdominal')).toBeVisible();
  await expect(brief.getByText('4×15–30s')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar core profundo' }).click();
  await page.getByText('Toque para começar').click();
  await expect(page.getByRole('heading', { name: 'Vácuo abdominal' })).toBeVisible();
  await page.getByLabel('Segundos realizados').fill('20');
  await page.getByRole('button', { name: 'Salvar tempo' }).click();
  await page.getByRole('button', { name: 'Minimizar' }).click();
  await page.getByRole('button', { name: 'Concluir missão' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('0/4', { exact: true })).toBeVisible();
  await expect(page.getByTestId('core-card')).toContainText('último');
});

test('desafio diário: monta só o que falta e não conta como missão da semana', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Fazer o que falta agora' }).click();
  await page.getByText('Toque para começar').click();
  await expect(page.getByRole('heading', { name: 'Abdominal' })).toBeVisible();
  await page.getByLabel('Repetições', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Registrar série' }).click();
  await page.getByRole('button', { name: 'Minimizar' }).click();
  await page.getByRole('button', { name: 'Concluir missão' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByTestId('quest-abs')).toContainText('30/50');
  await expect(page.getByText('0/4', { exact: true })).toBeVisible();
});

test('adicionar exercício no meio do treino, alarme do descanso minimizado e ranqueada', async ({ page }) => {
  await boot(page);
  await startFeaturedMission(page);
  await page.getByRole('button', { name: 'Adicionar exercício' }).click();
  await page.getByLabel('Buscar exercício').fill('polichinelo');
  await page.getByRole('button', { name: /Polichinelo/ }).click();
  await expect(page.getByRole('heading', { name: 'Polichinelo' })).toBeVisible();
  await expect(page.getByLabel('Segundos realizados')).toBeVisible();
  // registra por tempo, encurta o descanso e minimiza: o aviso aparece mesmo fora da tela cheia
  await page.getByLabel('Segundos realizados').fill('40');
  await page.getByRole('button', { name: 'Salvar tempo' }).click();
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: '−15s' }).click();
  await page.getByRole('button', { name: 'Minimizar' }).click();
  await expect(page.getByTestId('rest-flash')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('rest-flash')).toContainText('Descanso acabou!');
  // conclui e vê a ranqueada
  await page.getByRole('button', { name: 'Concluir missão' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.getByTestId('ranked-result')).toContainText('Ranqueada +12 pts');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByTestId('rank-label')).toHaveText('Ferro III');
  await page.getByTestId('ranked-card').click();
  await expect(page.getByRole('dialog', { name: 'Ranqueada' }).getByTestId('ranked-events')).toContainText('+12');
});

test('editor de deck: tirar, mudar séries, incluir do catálogo e salvar', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Briefing' }).click();
  await page.getByRole('button', { name: 'Editar deck' }).click();
  const editor = page.getByRole('dialog', { name: 'Editar deck' });
  const rows = editor.getByTestId('deck-row');
  await expect(rows).toHaveCount(7);
  await rows.first().getByRole('button', { name: /^Remover/ }).click();
  await expect(rows).toHaveCount(6);
  await rows.first().getByRole('button', { name: /^Mais séries/ }).click();
  await editor.getByRole('button', { name: 'Adicionar exercício ao deck' }).click();
  await editor.getByLabel('Buscar exercício').fill('polichinelo');
  await editor.getByRole('button', { name: /Polichinelo/ }).click();
  await expect(rows).toHaveCount(7);
  await expect(editor.getByText('7 exercícios · 22 séries')).toBeVisible();
  await editor.getByRole('button', { name: 'Salvar deck' }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText('Deck personalizado por você.', { exact: false })).toBeVisible();
  await expect(page.getByText(/^4×/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).first().click();
  await expect(page.getByText(/· editado/)).toBeVisible();

  // inicia com o deck editado: 22 séries
  await startFeaturedMission(page);
  await expect(page.getByText(/0\/22 séries/)).toBeVisible();
});

test('editor de deck: restaurar o original', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Briefing' }).click();
  await page.getByRole('button', { name: 'Editar deck' }).click();
  const editor = page.getByRole('dialog', { name: 'Editar deck' });
  await editor.getByTestId('deck-row').first().getByRole('button', { name: /^Remover/ }).click();
  await editor.getByRole('button', { name: 'Salvar deck' }).click();
  await page.getByRole('button', { name: 'Editar deck' }).click();
  await expect(editor.getByTestId('deck-row')).toHaveCount(6);
  await editor.getByRole('button', { name: 'Restaurar deck original' }).click();
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByText('3 séries de trabalho por alvo.', { exact: false })).toBeVisible();
});

test('roteiro no treino: mais séries planejadas, mudar ordem e descanso salvo por exercício', async ({ page }) => {
  await boot(page);
  await startFeaturedMission(page);
  await confirmKg(page);
  await page.getByRole('button', { name: 'Opções do exercício' }).click();
  await page.getByRole('button', { name: 'Mais uma série planejada' }).click();
  await expect(page.getByTestId('planned-sets')).toHaveText('4');
  await page.getByRole('button', { name: 'Mover para depois' }).click();
  await expect(page.getByTestId('plan-controls')).toContainText('2 de 7');
  await page.getByRole('button', { name: 'Fechar' }).last().click();
  await expect(page.getByText(/de 4 · /)).toBeVisible();
  // descanso de 1:30 só para este exercício
  await page.getByRole('button', { name: 'Descanso de 90 segundos' }).click();
  await registerSet(page, '40', '10');
  await expect(page.getByText(/^01:(2\d|30)$/).first()).toBeVisible();
});

test('treino em andamento sobrevive a recarregar a página', async ({ page }) => {
  await boot(page);
  await startFeaturedMission(page);
  await confirmKg(page);
  await registerSet(page, '50', '8');
  await page.reload();
  await expect(page.getByText('Missão em andamento')).toBeVisible();
  await expect(page.getByText(/1\/21 séries/)).toBeVisible();
});

test('bloco final: abdominal e prancha', async ({ page }) => {
  await boot(page);
  await startFeaturedMission(page);
  await page.getByRole('button', { name: 'Bloco final · abdominal + prancha' }).click();
  await page.getByLabel('Carga do abdominal').fill('35');
  await page.getByLabel('Repetições do abdominal').fill('20');
  await page.getByRole('button', { name: 'Salvar série' }).click();
  await expect(page.getByTestId('abs-done')).toHaveText('20 reps');
  await expect(page.getByTestId('abs-vs')).toContainText('Primeira vez'); // sem meta fixa: sem histórico ainda
  await page.getByRole('button', { name: 'Iniciar' }).last().click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Salvar trecho' }).click();
  await expect(page.getByText(/Prancha · \d/)).toBeVisible();
});

test('missão personalizada com relato de prontidão', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: /Missão personalizada/ }).click();
  await page.getByRole('button', { name: 'Peito', exact: true }).click();
  await page.getByRole('button', { name: 'Moderado' }).click();
  await page.getByRole('button', { name: 'Montar missão' }).click();
  await expect(page.getByText('Proposta do assistente')).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await page.getByText('Toque para começar').click();
  await expect(page.getByText('Missão em andamento')).toBeVisible();
});

test('série por tempo no roteiro (prancha)', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: /Missão personalizada/ }).click();
  await page.getByRole('button', { name: 'Core', exact: true }).click();
  await page.getByRole('button', { name: 'Montar missão' }).click();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await page.getByText('Toque para começar').click();
  await page.getByRole('button', { name: /Prancha frontal/ }).first().click();
  await expect(page.getByText(/Meta:\s*20–30 segundos/)).toBeVisible();
  await page.getByLabel('Segundos realizados').fill('31,5');
  await page.getByRole('button', { name: 'Salvar tempo' }).click();
  await page.getByRole('button', { name: 'Minimizar' }).click();
  await expect(page.getByText(/⏱ 31,5/)).toBeVisible();
  // cronômetro
  await page.getByRole('button', { name: 'Iniciar cronômetro' }).click();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Parar e salvar' }).click();
  await page.getByRole('button', { name: 'Minimizar' }).click();
  await expect(page.getByText(/^T2$/)).toBeVisible();
});

test('relato de dor bloqueia a montagem da missão', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: /Missão personalizada/ }).click();
  await page.getByRole('button', { name: 'Costas', exact: true }).click();
  await page.getByRole('button', { name: 'Sim', exact: true }).click();
  await page.getByRole('button', { name: 'Montar missão' }).click();
  await expect(page.getByRole('alert')).toContainText('dor');
});

test('corpo: registrar pesagem', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Celular' }).click();
  await page.getByRole('button', { name: 'Corpo' }).click();
  await page.getByPlaceholder('80,5').fill('82,4');
  await page.getByRole('button', { name: 'Registrar pesagem' }).click();
  await expect(page.getByText('82,4 kg').first()).toBeVisible();
});

test('backup: exportar e validar o arquivo baixado', async ({ page }, info) => {
  await boot(page);
  await page.getByRole('button', { name: 'Celular' }).click();
  await page.getByRole('button', { name: 'Corpo' }).click();
  await page.getByPlaceholder('80,5').fill('80');
  await page.getByRole('button', { name: 'Registrar pesagem' }).click();
  await page.getByRole('button', { name: 'Voltar à tela inicial do celular' }).click();
  await page.getByRole('button', { name: /Backup/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON sem criptografia' }).click();
  await page.getByRole('button', { name: 'Exportar' }).click();
  const file = info.outputPath('backup.json');
  await (await download).saveAs(file);
  expect(JSON.parse(readFileSync(file, 'utf8')).format).toBe('treino-evolucao-android-v1');
  await page.getByLabel('Arquivo de backup baixado').setInputFiles(file);
  await page.getByRole('button', { name: 'Validar arquivo salvo' }).click();
  await expect(page.getByText('validado e marcado como conferido')).toBeVisible();
});

test('funciona sem internet depois da primeira visita', async ({ page, context }) => {
  await boot(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Mapa · toque num distrito')).toBeVisible();
  await context.setOffline(false);
});

test('avisa quando há versão nova e atualiza no toque', async ({ page, request }) => {
  await request.get('http://127.0.0.1:4173/__use?dir=a');
  await boot(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await request.get('http://127.0.0.1:4173/__use?dir=b');
  try {
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r?.update(); });
    await expect(page.getByText('Nova versão pronta.')).toBeVisible();
    await page.getByRole('button', { name: 'Atualizar' }).click();
    await page.getByRole('button', { name: 'Celular' }).click();
    await page.getByRole('button', { name: 'Sobre' }).click();
    await expect(page.getByTestId('release')).toHaveText('Versão e2e-b');
  } finally {
    await request.get('http://127.0.0.1:4173/__use?dir=a');
  }
});
