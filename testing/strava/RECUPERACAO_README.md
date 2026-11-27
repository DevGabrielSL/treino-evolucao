# Strava: recuperação do treino de 24/08/2026 — envio isolado

O primeiro envio estruturado retornou `Error Processing Data` com `activityPresent=false`. A documentação oficial confirma que JSON de musculação é suportado e os 9 identificadores de exercício deste treino constam da lista de tipos reconhecidos. **A causa específica da rejeição não foi comprovada.**

O arquivo `Recuperacao.gs` permite publicar **somente o primeiro treino** como atividade manual `WeightTraining` com data 24/08/2026 às 18h (HORÁRIO ESTIMADO), duração 75 min (ESTIMADA) e todas as 21 séries preservadas em **texto na descrição**. Este caminho **NÃO** produz os sets estruturados, mapa muscular e indicadores de volume do Strava. É uma alternativa de importação com perda na riqueza visual, não uma correção do uploader JSON.

## Preparação de leitura

1. No mesmo projeto Apps Script com `Código.gs` e `Historico.gs`, adicionar o arquivo `Recuperacao.gs` do GitHub. Não substituir os arquivos existentes.
2. Manter `STRAVA_ENABLED=false` e `STRAVA_HISTORY_ENABLED=false`.
3. Executar `stravaHistoryManualPreviewFirst`. Conferir data, 21 séries e descrição; sem publicação.

## Envio real (somente se aceitar o formato manual)

1. Confirmar no Strava que **não há atividade** de 24/08/2026.
2. Em Propriedades do script, configurar `STRAVA_HISTORY_DUPLICATES_REVIEWED=true` e `STRAVA_HISTORY_MANUAL_FALLBACK_ENABLED=true`. Essa propriedade nova é a autorização explícita da recuperação pontual.
3. Selecionar `stravaHistoryPublishFirstManual` e executar **uma única vez**. A função exige no ledger que o envio JSON anterior esteja em `ERROR`, consulta esse upload via GET e exige `activity_id` ausente e `error` presente antes de permitir POST /activities. Em caso de dúvida, **não publica**.
4. Se retorno `PUBLICADO: historic-20260824`, verificar o Strava. A descrição conterá exercícios, séries, cargas e RIR; o log estruturado de exercícios não estará preenchido.
5. Após verificar, deixar `STRAVA_HISTORY_MANUAL_FALLBACK_ENABLED=false` e manter os demais publicadores desligados. Não executar lote antigo, pois este continua usando JSON e pode gerar novos erros.

Nunca apagar o ledger `STRAVA_HISTORY_LEDGER_V1`, nunca enviar credenciais por mensagem ou reexecutar uma tentativa marcada `UNCERTAIN`. O controle guarda o ID de upload original mesmo após sucesso manual e impede repetição deste treino.

É possível continuar investigando o envio estruturado posteriormente, testando a transmissão multipart e eventualmente formato FIT com sets; isso requer homologação sem produzir atividades duplicadas.

Referências oficiais:
- https://developers.strava.com/docs/uploads/
- https://developers.strava.com/docs/reference/
