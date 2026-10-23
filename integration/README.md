# Treino & Evolução — integração Google Sheets (fundação técnica, NÃO ativada no Android)

## Estado em 23/10/2026

- Planilha original identificada e lida via Google Drive do usuário. Abas relevantes: `Treinos`, `Series`, `Peso`.
- 16 treinos, 238 séries e uma pesagem presentes na planilha, último treino em 22/10/2026.
- Importação inicial antiga do aplicativo preservava apenas 15 treinos e 225 séries até 21/10/2026.
- Cópia de segurança nativa da planilha feita antes de qualquer modificação. A planilha original **não foi editada nesta etapa**.
- Esta pasta inclui adaptador com detecção de novos registros, plano de anexação, IDs para evitar duplicação e transporte autorizado por OAuth2 (Google Identity Services).
- **Não é uma sincronização ativa no aplicativo publicado.** O app Android v0.9 continua no modo local; adicionar autenticação, configuração de conexão, tratamento de conflitos de edição e UI será a próxima integração depois de obter o Client ID Web.

## Princípio de arquitetura

O Sheets é o registro oficial. O IndexedDB é cache para modo offline e fila de alterações locais ainda não sincronizadas. Não confundir a confirmação de salvamento local com envio ao Sheets.

Uma vez integrado ao app, o processo será:
1. Autorização Google no próprio aparelho (sem guardar token OAuth em IndexedDB, no GitHub ou em logs).
2. Leitura das abas Treinos, Series e Peso, confrontando com os registros existentes.
3. Reconciliar linhas novas sem substituir o histórico, verificando que o esquema local continua válido.
4. Anexar sessões **concluídas**, suas séries e pesagens criadas no app nas abas originais, com IDs novos em J/O/G. Ler novamente após escrever para confirmar.
5. Em falhas de rede ou autorização, manter dados locais e marcar pendência. Não enviar a mesma linha duas vezes ao repetir operação.
6. Divergências em dados já sincronizados, exclusões e alterações concorrentes requerem tratamento de conflitos antes de ativar sincronização automática na produção.

## Autenticação — configuração única necessária

O conector Drive dentro do ChatGPT **não** autoriza uma PWA pública instalada no Chrome. Para o acesso direto e privado à planilha via Sheets API:
- Google Cloud Console: criar ou selecionar projeto de uso pessoal.
- Habilitar **Google Sheets API**.
- Configurar o público OAuth/Test users para a própria conta Google.
- Criar credencial **OAuth Client ID, tipo Web application**, com Authorized JavaScript origins `https://devgabrielsl.github.io` (**somente origem, sem `/treino-evolucao/`**).
- Informar ao desenvolvedor **somente o Client ID** terminado em `.apps.googleusercontent.com`; **nunca enviar o Client Secret**, access token, senha nem chaves de serviço.
- Em produção, a PWA só solicitará acesso ao Sheets mediante toque e consentimento da conta dona da planilha.

Documentação oficial: https://developers.google.com/identity/oauth2/web/guides/overview ; https://developers.google.com/workspace/guides/create-credentials

## Segurança e limites explícitos

- O Client ID não é segredo. O token de acesso é secreto e fica somente em memória; uma nova autenticação poderá ser necessária depois de fechar a PWA.
- O acesso OAuth `https://www.googleapis.com/auth/spreadsheets` autoriza leitura/escrita em planilhas acessíveis pela conta, mas o programa restringirá todas as chamadas ao ID da planilha escolhido e validado. Não há segurança por ocultar o ID em código público.
- A REST API `spreadsheets.values.append` não fornece transação atômica com outros intervalos. O transporte sempre lê e confere IDs antes/depois das gravações, mas gravações simultâneas em vários dispositivos requerem protocolo adicional.
- A sincronização de *edições* e *exclusões* em registros previamente enviados ainda não está habilitada; não ativar upload silencioso com esses casos pendentes.
- O campo de recuperação física e os modelos deverão ganhar esquema próprio na planilha (ainda não criado).
- Nunca publicar backup da planilha, histórico JSON ou tokens no GitHub público.

## Testes

    node tests/sheets_core.mjs
    node tests/sheets_browser.mjs

O primeiro usa dados sintéticos e aceita um arquivo privado pelo `HISTORY_FIXTURE=...` para conferir a compatibilidade com a importação antiga. O segundo utiliza transporte falso, não efetua nenhuma operação externa. Ambos não escrevem na planilha real.