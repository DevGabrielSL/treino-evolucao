# Regressões da lógica

`node legacy-tests/run.mjs` roda 27 arquivos de teste (cerca de 600 verificações) diretamente sobre `app/src/legacy`, os mesmos módulos que vão para o app. Os testes ficam como foram escritos; o script só monta, numa pasta temporária, a estrutura de pastas que eles esperam.

Antes, a publicação remontava o app a partir de pacotes compactados (`payload/`, `patches/`, `release-staging/`, `assistant-v10x/`) e rodava os testes em cada etapa. Essa cadeia foi aposentada; os testes que estavam dentro dos pacotes foram extraídos para `packaged/`.

## Testes aposentados

Ficam no histórico do git (último commit com eles: `77d239b`). Foram removidos por um destes motivos:

- **Conferiam a interface antiga** (textos e ligações do `app.js`, `index.html`, `sw.js` e CSS que não existem mais): `testing/principal_*_tests.mjs` de cartas, foco, missão, mundo, visual, premium, ferramentas, RPG, lançamento, finisher, dose e live; `testing/principal_update_worker_tests.mjs`, `testing/production_candidate_tests.mjs`, `testing/finisher_browser_qa.cjs`, `integration/tests/automatic_wiring.mjs`, `inspect_auto_sync.mjs`, `inspect_coach_plan.mjs` e `coach_substitution.mjs`. A interface nova é coberta pelos testes de ponta a ponta em `app/e2e`.
- **Testavam versões intermediárias do transporte do Google Sheets** (ambiente de teste com outra planilha, antes da trava que só aceita a planilha principal): `integration/tests/sheets_browser.mjs`, `sheets_numeric_formats.mjs`, `sheets_write_confirmation.mjs`, `write_receipt_recovery.mjs`, `coach_plan_read.mjs` e os testes do ambiente isolado em `testing/` (`grid_*`, `isolation`, `missing_ids`, `concurrency_gate`, `coordinator_client`, `sync_queue`, `balanced_coach`, `input_validation`). O transporte que vai para o app continua coberto por `coordinator_tests`, `principal_transport_tests`, `principal_transport_integration` e `production_session_tests`, que rodam contra os módulos atuais.
- **Conferiam o cache offline antigo** (lista de arquivos do service worker anterior): a parte correspondente do teste da v0.9 saiu de `packaged/v09_backup.mjs`; o modo offline novo é testado de ponta a ponta.
