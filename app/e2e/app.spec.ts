import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Cada teste começa com um navegador limpo (sem dados), como um aparelho novo.

const problems: string[] = [];
function watch(page: Page) {
  problems.length = 0;
  page.on('pageerror', e => problems.push('erro de página: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/accounts\.google\.com|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_TUNNEL|Failed to load resource/.test(t)) problems.push('console: ' + t);
    if (/Content Security Policy/i.test(t)) problems.push('CSP: ' + t);
  });
}
async function boot(page: Page) {
  watch(page);
  await page.goto('./');
  await expect(page.getByText('Mapa · toque num distrito')).toBeVisible();
}
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

test.afterEach(() => { expect(problems, problems.join('\n')).toEqual([]); });

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
  await expect(page.getByText(/3\/24 séries/)).toBeVisible();

  // concluir
  await page.getByRole('button', { name: 'Concluir missão' }).click();
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Missão\s*concluída/i })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

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

test('treino em andamento sobrevive a recarregar a página', async ({ page }) => {
  await boot(page);
  await startFeaturedMission(page);
  await confirmKg(page);
  await registerSet(page, '50', '8');
  await page.reload();
  await expect(page.getByText('Missão em andamento')).toBeVisible();
  await expect(page.getByText(/1\/24 séries/)).toBeVisible();
});

test('bloco final: abdominal e prancha', async ({ page }) => {
  await boot(page);
  await startFeaturedMission(page);
  await page.getByRole('button', { name: 'Bloco final · abdominal + prancha' }).click();
  await page.getByLabel('Carga do abdominal').fill('35');
  await page.getByLabel('Repetições do abdominal').fill('20');
  await page.getByRole('button', { name: 'Salvar série' }).click();
  await expect(page.getByText('20/100 reps')).toBeVisible();
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
