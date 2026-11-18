# Treino & Evolução — Android

Aplicativo pessoal PWA de registro de treinos. O código é público, mas os dados de treinamento permanecem exclusivamente no aparelho e em backups privados.

Os arquivos públicos do app serão publicados na raiz do repositório para uso com GitHub Pages.

## Nova interface (pasta `app/`)

A partir desta versão, o GitHub Pages publica o app em React + Vite da pasta `app/` (veja `app/README.md`).
Os pacotes e patches das versões anteriores continuam no repositório como **bateria de regressões**: o workflow ainda monta e testa a lógica por eles e, antes de publicar, confere que o app novo usa exatamente esses mesmos módulos.
