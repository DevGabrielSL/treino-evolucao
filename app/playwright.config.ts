import { defineConfig, devices } from '@playwright/test';

// Testes de ponta a ponta do app publicado (build de produção, com service worker e CSP).
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://127.0.0.1:4173/treino-evolucao/',
    launchOptions: { executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', args: ['--no-sandbox'] },
    trace: 'retain-on-failure',
  },
  webServer: { command: 'node e2e/server.mjs', port: 4173, reuseExistingServer: !process.env.CI },
});
