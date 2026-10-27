# Strava automático — candidato isolado (NÃO ATIVADO)

**Data:** 27/10/2026. Este código é um protótipo para publicar treino concluído no Strava, em 15 minutos ou menos após a próxima execução periódica, **somente depois de configurar, autenticar e habilitar o serviço**. Nada foi autorizado/publicado durante a criação deste código.

## Situação e limites

- O app principal em GitHub Pages e a planilha oficial **não foram alterados**.
- `testing/strava/Code.gs` aceita **apenas** a planilha fictícia de testes ID `1ZWow3SHWxgy-j7s3GWTJd1AxYXQb-E-ca_GTgK2_5CA`, com essa identidade fixada no código. Qualquer ID diferente lança erro.
- O script exige `STRAVA_ENABLED=true`. Sua inicialização cria/valida o controle, mas deixa o envio desabilitado.
- A estrutura atual do painel **não contém início exato nem duração de todos os treinos**. Por isso, os treinos anteriores, incluindo 26/10, não são automaticamente enviados.
- Nada foi implantado no Google Apps Script e nenhum acesso Strava foi concedido. Testes de código sem rede não demonstram upload real bem-sucedido.
- Esta integração não depende da ativação do coordenador Apps Script de sincronização PWA/Sheets, que segue em homologação separada. No futuro, consolidar serviços e contratos antes da produção.

## Requisitos para publicação de um treino futuro

Na aba `Treinos`, os campos abaixo devem estar presentes e ser verdadeiros:
- `A` Data: data do treino, `YYYY-MM-DD` (ou célula de data).
- `C` Sessão: nome da sessão (igual à coluna `B` de `Series`).
- `D` Status: exatamente `Concluído`.
- `E` Duração (min): tempo real decorrido (numérico, maior que zero).
- `J` ID do aplicativo: ID único, estável, alfanumérico/hífen/underscore, de 8 a 120 caracteres.
- `K` Início ISO local: texto em formato `2026-10-27T18:00:00-03:00`, obtido do relógio no início real do treino. Configurar coluna K como texto simples. **Não inventar horário ou duração retrospectivamente**.

As séries de `Series` são relacionadas por **data + nome da sessão**; o script não publica se houver mais de um treino concluído com essa combinação, por ser ambíguo. Essa vinculação é provisória: o caminho de produção deve associar sessões e séries por IDs de origem imutáveis.

O JSON de musculação publica séries reconhecidas, repetições, peso **apenas quando a unidade é kg ou kg/halter** e duração de prancha quando unidade for `segundos`. Não converte `plaquetas` nem carga com montagem incerta em kg. RIR, aquecimento/aproximação, variações exatas e exercícios ainda não mapeados vão para a descrição. Não envia calorias, frequência cardíaca ou GPS inventados.

## Preparação pelo titular da conta (apenas ambiente de testes)

1. Criar sua própria aplicação Strava em https://www.strava.com/settings/api. Para este fluxo manual de OAuth, definir **Authorization Callback Domain = `localhost`**; usar seu site do App Fitness como Website URL quando solicitado.
2. Criar **projeto Google Apps Script independente de TESTES** na sua conta; colar o conteúdo de `Code.gs`. Não tornar um endpoint web público executado como proprietário.
3. Em **Project Settings > Script properties** (Propriedades do script), definir `STRAVA_SPREADSHEET_ID=1ZWow3SHWxgy-j7s3GWTJd1AxYXQb-E-ca_GTgK2_5CA`, `STRAVA_ENABLED=false`, `STRAVA_START_DATE=2026-10-27`, `STRAVA_CLIENT_ID` e `STRAVA_CLIENT_SECRET`. Segredos só no Apps Script; nunca em chat, GitHub, logs ou HTML público.
4. Executar `stravaInitializeTest`. Conferir a aba oculta `_StravaPublicacoes` e a planilha fictícia. **Nunca executar com o ID do painel oficial**.
5. Executar `stravaAuthorizationUrl`. Abrir no navegador o link gerado no log de execução, conceder somente `activity:write`. Após o redirecionamento a `http://localhost/?code=...&scope=...&state=...`, a página local pode dar erro; copiar a URL completa visível no endereço do navegador, com o código e o state.
6. Colar essa URL **diretamente** em `STRAVA_CALLBACK_URL` nas propriedades do mesmo script, executar `stravaCompleteAuthorization`; o script verifica o state, troca o código por tokens e remove o callback das propriedades. Nunca enviar o código/tokens ao ChatGPT. O refresh token fica no Google Apps Script.
7. Preparar **dados de treino fictícios**, com IDs e horários reais apenas se for de fato um treino realizado, ou conta Strava isolada de testes caso se use atividade sintética. Validar o JSON, escopos e tempo antes de liberar uploads para a conta pessoal. Nada deve ser publicado como treino real se não foi realizado.
8. Somente depois de homologar manualmente, colocar `STRAVA_ENABLED=true` e executar `stravaInstallTestTrigger`. Isso cria gatilho a cada 15 minutos. **Habilitar esta propriedade autoriza publicações reais** dos treinos elegíveis após `STRAVA_START_DATE`; mantê-la falsa até estar preparado. O ritmo é periódico, não instantâneo.
9. Conferir no Strava e em `_StravaPublicacoes` os estados `SUBMITTING`, `PROCESSING`, `PUBLISHED`, `UNCERTAIN`, `ERROR`. `SUBMITTING` ou `UNCERTAIN` pausa novas submissões: não apagar essas linhas e não reenviar às cegas. Apenas `PUBLISHED` confirma atividade efetivamente criada. `PROCESSING` exige consulta subsequente.

## Segurança operacional

- O OAuth Strava usa `activity:write` e tokens que expiram; o script atualiza refresh token sem publicá-lo.
- Cada treino usa `external_id` fixo `appfitness-<ID>.json` e recibo persistente em planilha. O marcador `SUBMITTING` é escrito antes da requisição: se uma resposta se perder, o treino fica bloqueado para reconciliação e **não é reenviado automaticamente**. Isso reduz duplicações, mas não é prova universal de exatamente uma publicação.
- Os gatilhos periódicos só existem depois da instalação e têm limites do Apps Script. Custos e cotas devem ser validados sem contratar serviços pagos.
- A visibilidade da atividade segue a configuração de privacidade da conta Strava; revisar no Strava antes de ativar publicações automáticas.
- A partir de janeiro de 2027 a API Strava terá nova URL-base documentada; revisar antes dessa mudança.
- **Não promover a produção** sem homologação OAuth/JSON com Strava real, confirmação de dados de início/duração no App Fitness, vínculo de sessão/séries, gestão de expiração e retentativas incertas, e revisão do coordenador já escolhido.

## Verificações locais

```bash
node testing/strava/strava_publisher_tests.mjs
```

As verificações sem rede checam o bloqueio por padrão, validação de duração/horário/ID, mapeamento de exercícios e pesos, séries em segundos e inclusão de notas de RIR. Nenhuma chamada real é feita ao Google ou ao Strava.

Fontes oficiais:
- https://developers.strava.com/docs/uploads/
- https://developers.strava.com/docs/authentication/
- https://developers.strava.com/docs/changelog/
