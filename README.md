# Treino & Evolução — Android

Aplicativo pessoal PWA de registro de treinos. O código é público, mas os dados de treinamento permanecem exclusivamente no aparelho e em backups privados.

Os arquivos públicos do app serão publicados na raiz do repositório para uso com GitHub Pages.

## Estrutura

- `app/` — o aplicativo (React + Vite). Veja `app/README.md`.
- `app/src/legacy/` — lógica de dados, backup, Google Sheets e assistente (fonte única).
- `app/legacy-tests/` — regressões da lógica; `app/e2e/` — testes de ponta a ponta no navegador.
- `production/coordinator/` — coordenador em Apps Script da planilha.
- `integration/tests/`, `quality/`, `testing/` — testes históricos ainda em uso pela bateria de regressões.

A publicação (GitHub Actions) roda as regressões e os testes de ponta a ponta antes de publicar. Se algo falhar, nada é publicado.
