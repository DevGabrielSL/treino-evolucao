# Importação histórica para Strava — 17 treinos (2026)

**Estado em 27/10/2026: código pronto para testes; nenhuma atividade antiga enviada ao Strava.**

O proprietário autorizou o uso de horários e durações aproximados onde não foram medidos. Foram conferidos 17 treinos na planilha oficial entre 24/08/2026 e 26/10/2026; 16 têm registros de musculação e um, 30/09/2026, é apenas de condicionamento (47 minutos efetivamente anotados).

## Política de dados

- Fonte: Painel de Treino e Evolução, acessada **somente para leitura** pelo Apps Script. O ID da fonte fica em uma propriedade privada; não codifique no GitHub.
- Início estimado de cada sessão: **18h (-03:00)**. Está explicitamente identificado como estimativa em cada descrição.
- Duração: **45, 60 ou 75 minutos estimados** dependendo do volume registrado. Para 30/09 usa 47 minutos que já constam do painel.
- Preserva, no texto da atividade, os valores e unidades originais de carga, RIR e variação. Não converte plaquetas, kg/lado, barra de massa desconhecida ou cargas ambíguas em peso numérico inventado.
- Séries com peso em kg inequívoco são estruturadas no JSON do Strava; tempos de prancha registrados viram sets com duração em segundos.
- O condicionamento sem séries é importado via API de atividade manual, como Workout, sem inventar GPS ou exercícios.
- Identificadores de envio por data: historic-YYYYMMDD. A função bloqueia mais de uma sessão por data até revisão manual.

## Preparar (não publicar ainda)

1. No projeto Google Apps Script **App Fitness – Strava TESTES**, crie **um segundo arquivo de código**, chamado Historico.gs. Não substitua Código.gs. Copie o conteúdo do arquivo Historico.gs disponível nesta pasta.
2. Vá em **Configurações do projeto > Propriedades do script** e crie uma propriedade chamada **STRAVA_HISTORY_SOURCE_ID**. O valor é o identificador da planilha oficial **Painel de Treino e Evolução**, aquela que já usamos para registrar seus 17 treinos.
3. Não altere as propriedades existentes **STRAVA_SPREADSHEET_ID** e **STRAVA_ENABLED=false**. Não crie nenhum segredo adicional e não cole tokens em arquivos de código.
4. Volte ao editor, selecione a função **stravaHistoryPreview** e clique em Executar. Ela apenas lê a planilha e escreve no registro do Apps Script o resumo de 17 sessões, sem publicar nem alterar dados. Confira 16 atividades JSON e 1 atividade manual, as datas e as estimativas.

## Condição de segurança antes da importação

A autorização do Strava foi concedida apenas com **activity:write**, suficiente para publicar, mas não para consultar toda sua biblioteca, especialmente atividades privadas. Portanto o programa **não consegue assegurar que não existam treinos antigos já publicados manualmente**. É necessário revisar sua conta Strava nas 17 datas ou adicionar um passo de reconciliação com escopo de leitura autorizado.

Se houver algum treino já presente em uma das datas, **não habilite o envio em lote** até excluir aquela data da importação de maneira controlada. A prevenção de duplicidade por ID do App Fitness protege reenvios do nosso programa, mas não detecta automaticamente atividades publicadas manualmente antes.

## Publicar (somente depois da conferência)

1. Depois de confirmar que as atividades a importar não existem no Strava, defina nas Propriedades do script **STRAVA_HISTORY_DUPLICATES_REVIEWED=true** e **STRAVA_HISTORY_ENABLED=true**.
2. Volte ao editor e execute manualmente **stravaHistoryImportBatch**. Não instale gatilhos nessa função. Um lote faz envios e consulta o status de processamento, interrompendo diante de erro ou resultado incerto. Nenhuma nova publicação ocorre silenciosamente se a execução parar.
3. Execute **stravaHistoryPreview** para conferir o estado de cada entrada (PUBLISHED indica resposta confirmada). Confira também as atividades efetivamente visíveis no aplicativo Strava.
4. Volte a definir **STRAVA_HISTORY_ENABLED=false** ao terminar. **STRAVA_ENABLED=false** controla o publicador futuro separadamente e deve continuar falso até sua própria homologação.

## Propriedades e privacidade

A autenticação já aprovada tem scope activity:write, sem precisar repetir OAuth para publicar este histórico. Os tokens ficam na conta Google Apps Script do titular. Nenhuma carga, nota de treino, token ou segredo é publicado no repositório GitHub; testes locais usam somente registros sintéticos.

Caso a API retorne erro/resultado desconhecido após iniciar um envio, a linha fica SUBMITTING, UNCERTAIN ou ERROR e o processo para. **Não exclua manualmente o ledger, não gere novos IDs e não force reenvios.** A correção requer conferir a conta Strava antes de liberar a continuação.

Documentação: https://developers.strava.com/docs/uploads/ e https://developers.strava.com/docs/reference/ .
