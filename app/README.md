# Treino & Evolução — app (React + Vite)

Interface nova do app, com visual de jogo de mundo aberto (identidade original) e mecânicas de progressão.

## Estrutura

- `src/legacy/` — **lógica do app anterior** (armazenamento, backup, Google Sheets, assistente, séries), fonte única. Testada por `legacy-tests/run.mjs` em toda publicação.
- `src/engine/` — ponte entre a interface e a lógica: gravação (`store.ts`), fluxo de treino (`workout.ts`), Google Sheets (`sheets.ts`), backup (`backup.ts`), edições (`edits.ts`).
- `src/game/progress.ts` — XP, níveis, títulos, ritmo semanal, atributos por músculo, recordes e conquistas. Tudo **derivado** do histórico: não grava dados nem vai para a planilha.
- `src/ui/` — telas (Missões/mapa, Treino, Histórico, Personagem, Celular) e componentes.
- `src/fx/` — efeitos sonoros sintetizados (Web Audio) e partículas.
- `sw-template.js` — modo offline; o build gera `sw.js` com a lista exata de arquivos.

## Compatibilidade

Mesmo endereço, mesmo banco local (`treino-evolucao-local-android-v1`) e mesmo formato de documento: os dados do app anterior abrem sem migração. O novo service worker substitui o antigo e apaga apenas os caches de programa antigos.

## Comandos

```bash
npm ci
npm run dev          # http://localhost:5173  (?demo cria histórico fictício só em localhost)
npm run build        # gera dist/ para o GitHub Pages
node legacy-tests/run.mjs                      # regressões da lógica
npm run build:e2e-b && npx playwright test     # testes de ponta a ponta (usa Chrome instalado)
VITE_DEMO=1 npx vite build   # demo em arquivo único (dist-demo/index.html)
```
