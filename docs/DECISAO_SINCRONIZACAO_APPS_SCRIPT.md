# Decisão de arquitetura — sincronização coordenada no Google Apps Script

Data: 26/10/2026. Passo 5 da Etapa 1 do App fitness.

**Decisão escolhida para implementação posterior:** manter a interface no endereço atual e o Google Sheets como histórico central, usando um coordenador autenticado em Google Apps Script para as leituras de sincronização e todas as gravações do aplicativo.

**Estado: desenho escolhido; serviço não criado, implantado ou homologado.** Esta decisão não corrige a versão atual e não é prova de garantia em produção. Referência do projeto ao decidir: `6c9cbc604514d03a87b1b4c71390b972b14e9a66`.

## 1. Por que esta opção

O aplicativo precisa conservar seu histórico no Sheets, funcionar conectado, tratar correções/exclusões e ter custo adicional alvo de R$0. O acesso direto a partir dos celulares não fornece a coordenação necessária entre aparelhos. Web Locks ajuda entre abas que compartilham o recurso, mas não é um bloqueio remoto da planilha.

A proposta é concentrar as operações de cada ambiente em um único projeto coordenador. Os aparelhos solicitam operações identificadas; o coordenador controla concorrência, verifica versões e devolve recibos. O app não continua escrevendo diretamente no Sheets quando esse fluxo estiver ativo.

| Opção | Benefício | Limite decisivo | Decisão |
|---|---|---|---|
| Sheets direto + releitura + Web Locks | Menor mudança no app | Não coordena aparelhos e não resolve sozinho escrita incerta | Não usar como estratégia definitiva de gravação |
| Apps Script autenticado + bloqueio de script + operações persistidas | Mantém Sheets e centraliza o protocolo no ecossistema Google | Exige configuração, cotas e disciplina sobre outros escritores | Escolhida, condicionada à homologação |
| Aplicativo hospedado no próprio Apps Script | Permite outro caminho de integração Google | Exigiria reestruturar a interface e migrar de origem os dados locais | Alternativa a reavaliar se o caminho escolhido for inviável; sem troca silenciosa |
| Firestore com transações | Tem mecanismo transacional e cota gratuita documentados | Acrescenta outra base e transforma Sheets em integração/projeção, mudando a premissa de histórico central | Não escolher nesta fase |

A comparação é julgamento de arquitetura para este projeto, não uma afirmação de que qualquer plataforma executa o contrato automaticamente.

## 2. Fundamentos consultados

A documentação do LockService descreve um bloqueio de script compartilhado entre execuções do mesmo projeto, adquirido explicitamente com tryLock/waitLock. Esse é o recurso escolhido para serializar trechos críticos dos clientes que usam o coordenador. [1]

O método spreadsheets.batchUpdate aplica as alterações de uma mesma requisição em conjunto e rejeita uma requisição com item inválido. A própria documentação ressalva alterações concorrentes de colaboradores; atomicidade de um lote não equivale a uma transação de leitura-comparação-escrita ou a uma chave única para IDs. [2]

A chamada scripts.run exige implantação como executável de API, autorização OAuth adequada e projeto Cloud padrão compartilhado entre script e cliente. O manifesto permite restringir o executável ao usuário implantador. Esses são pré-requisitos a verificar na conta; não foram configurados nesta etapa. [3][4]

O uso padrão da API Sheets está documentado sem custo adicional, com aviso de cobrança futura planejada para excessos de cota. Apps Script tem limites de execução e consumo. Não há promessa de preço ou capacidade ilimitada; a implantação deve confirmar que o perfil de uso continua sem faturamento adicional. [5][6]

Firestore tem cota gratuita e transações documentadas, mas sua adoção mudaria o desenho de armazenamento deste projeto. [7][8]

## 3. Componentes e responsabilidades

### Interface existente

Manter o app principal no endereço atual e o ambiente de testes em `/testes/`. IndexedDB continua protegendo rascunhos e operações pendentes. O cliente conserva IDs, versões capturadas e estados definidos no contrato v1. Ele solicita uma operação e confirma o resultado; não decide sozinho que uma operação remota terminou porque o HTTP respondeu.

### Coordenador

Usar a Apps Script API autenticada, via scripts.run, como caminho preferido. Não publicar um webhook anônimo executado com poderes do proprietário nem colocar segredo de servidor no JavaScript público. A configuração de acesso deverá ser somente o usuário implantador, coerente com o uso individual atual.

O coordenador terá operações lógicas de leitura consistente, aplicação de operações, consulta de recibo e entrada/saída de manutenção. O ambiente é definido na configuração do serviço; o navegador não pode escolher arbitrariamente um ID de planilha.

Manter um projeto coordenador por ambiente, com destino permitido próprio. Todos os aparelhos de um mesmo ambiente usam o mesmo projeto. Dois projetos independentes não compartilham um script lock e não podem gravar simultaneamente na mesma planilha sob essa garantia.

### Histórico e controle

Preservar as abas e fórmulas atuais de Treinos, Series e Peso. Acrescentar, primeiro só no ambiente de testes, estruturas de controle equivalentes a:

- `_SyncRegistros`: ID, tipo, versão remota, impressão digital dos campos geridos e marca de exclusão.
- `_SyncOperacoes`: ID da operação, conteúdo identificado, resultado e recibo correspondente.
- `_SyncControle`: versão do protocolo, estado de manutenção e eventual bloqueio por operação incerta.

Esses nomes são uma proposta de implementação, ainda não abas criadas. A versão de controle não depende da posição da linha nem de relógios dos aparelhos. Abas ocultas ou protegidas não serão tratadas como mecanismo de confidencialidade.

Não usar CacheService, memória do processo ou localStorage como único registro da confirmação. Metadados de dados e recibos devem ser persistidos no mesmo arquivo e no mesmo lote de mutação quando aplicável. Um marcador pequeno e persistente de intenção pode existir antes do lote, com recuperação explícita; seu mecanismo será validado antes de qualquer escrita real.

## 4. Protocolo escolhido

1. O cliente gera um ID permanente para a operação, ligado ao ambiente, registro, ação, versão esperada e conteúdo canônico. Uma repetição conserva esse ID e conteúdo. Reusar o mesmo ID com outro conteúdo é erro.
2. O serviço autentica e valida usuário, ambiente, formato e limites antes de entrar na seção crítica.
3. Adquire o script lock com espera limitada. Se não conseguir, devolve ocupado sem escrever. Não mantém o bloqueio enquanto espera interação do usuário.
4. Verifica manutenção, versão mínima do protocolo, operações incertas e recibos já existentes. Uma operação confirmada retorna o recibo anterior, sem reaplicar.
5. Lê os registros e a referência de controle, confere ID, conteúdo e versão esperada. Colisão de IDs, referência divergente ou modificação externa bloqueia o lote para revisão.
6. Persiste e confere a intenção antes de iniciar a mutação. Se essa preparação não puder ser confirmada, não inicia a gravação dos dados.
7. Aplica dados, nova versão e recibo em um único spreadsheets.batchUpdate. Para Peso, escreve somente os campos pertencentes ao app e preserva D/E. Não misturar várias chamadas independentes e chamá-las de transação.
8. Faz a leitura de conferência sob o protocolo coordenado e devolve o recibo. Só a versão capturada na operação fica confirmada; alterações locais posteriores continuam pendentes.
9. Libera o lock em finally. Se a resposta ou a conferência ficar incerta, conserva o marcador e pausa novas mutações desse ambiente até conciliação segura.

O desenho pretende impedir repetição efetiva de uma operação entre clientes coordenados. A comprovação depende do armazenamento das intenções/recibos, das falhas exercitadas e dos limites do serviço. Não declarar “exactly once” universal com base apenas no LockService.

### Caso crítico: gravação com conclusão tardia

Uma chamada ao Sheets pode ter resultado desconhecido depois de um erro ou encerramento. Liberar o lock e observar ausência de recibo não prova que a gravação jamais será aplicada.

Por isso, depois de iniciar uma mutação cujo resultado permaneça incerto, a retomada automática será somente de consulta. Se o recibo correspondente aparecer e for íntegro, recuperar a confirmação. Se ele não aparecer, manter o ambiente bloqueado para revisão; não repetir automaticamente a escrita nem liberar novas mutações que dependam daquele estado só por tempo decorrido.

A disponibilidade pode ficar reduzida nesse caso. Essa escolha é intencional: interromper o envio é preferível a duplicar ou sobrescrever silenciosamente. O procedimento de recuperação deve preservar o estado atual e resolver a operação; se não for possível estabelecer o resultado, exige manutenção controlada/migração conferida em vez de reenvio cego.

## 5. Leituras e edições no Sheets

O leitor coordenado deverá obter valores de autoria, valores efetivos e exibição da mesma resposta de células, evitando combinar duas respostas por posição. As leituras relevantes passam pelo mesmo protocolo de coordenação e identificam os registros por ID. A prova de conceito deverá verificar consistência ao ordenar linhas e durante escritas coordenadas.

O script lock não bloqueia uma pessoa editando no Google Sheets nem outro programa que não o utilize. Para o contrato ser válido, **todas as gravações do aplicativo precisam passar pelo mesmo coordenador**.

Edição manual continua possível, mas em modo de manutenção:

1. Pedir a pausa ao coordenador e aguardar que não haja operação ativa/incerta.
2. Alterar os campos permitidos na planilha, preservando IDs e fórmulas.
3. Solicitar validação: verificar vínculos, duplicatas, valores, exclusões e diferenças.
4. Incorporar as mudanças às referências de controle e retomar somente após resolver conflitos.

Edição manual concorrente, bypass das proteções pelo proprietário ou outro escritor externo ativo ficam fora da garantia de serialização. Conferência por impressão digital ajuda a detectar diferenças já presentes, mas não deve ser apresentada como bloqueio de uma edição humana concorrente. O app deve explicar a pausa e permitir solicitar manutenção; não assumir que o usuário entende esse limite.

Essa condição explicita o escopo da conciliação do contrato v1: alterações remotas são incorporadas mediante protocolo/revisão, sem coexistência irrestrita de escritores diretos.

## 6. Versões, correções e exclusões

Cada registro tem versão remota monotônica por registro e uma referência de conteúdo. Ao receber uma correção, o coordenador confere a versão e o conteúdo observados antes de mudar a mesma identidade. Se outro aparelho já alterou o registro, devolve conflito; não usa horário como vencedor.

Exclusão é lógica, com versão e recibo, preservando possibilidade de recuperação. A ausência de linha ou de ID fora de uma operação reconhecida é divergência, não instrução para recriar ou apagar o registro. Uma sessão e suas séries precisam preservar integridade; grupos grandes podem ser divididos em operações dependentes, sem anunciar conclusão global antes da confirmação de todas.

## 7. Custo adicional alvo: R$0

A decisão dispensa servidor pago próprio e outro banco de dados. A expectativa de custo zero é condicionada ao uso dentro das cotas e à confirmação de que a configuração do projeto não exige contratação/faturamento adicional.

Política de implantação:

- Não contratar plano, vincular faturamento ou aceitar aumento pago de cota como etapa automática.
- Conferir a configuração atual de faturamento do projeto: não assumir que está desligada porque esta sessão não a ativou.
- Consultar os preços/cotas novamente antes de ativar. A documentação de Sheets consultada já menciona cobrança futura planejada por excesso; não prometer gratuidade permanente.
- Limitar tentativas e frequência de consultas, agrupar leituras/escritas e evitar uma consulta por célula ou polling contínuo em segundo plano.
- Ao atingir limite, manter pendências e informar indisponibilidade, sem migrar para uma opção paga.
- Estimar consumo com medições do protótipo. Ainda não existe medição de chamadas por treino desse coordenador, portanto não afirmar capacidade comprovada para uma quantidade de usuários ou sessões.

O limite técnico de execução consultado é de 6 minutos por execução do Apps Script. O app não deve usar esse teto como tempo aceitável de espera na interface. Operações devem ser curtas, ter tratamento de espera e respeitar as cotas específicas confirmadas na implantação. [6]

## 8. Condições antes de implementar na planilha oficial

| Condição | Situação nesta etapa |
|---|---|
| Escolha da arquitetura | Concluída neste documento |
| Ambiente de testes separado | Já preparado no passo 3 |
| Acesso ao projeto Cloud do cliente OAuth atual | Não verificado |
| Projeto Cloud padrão compartilhado e Apps Script API habilitada | Não configurado/verificado |
| Script executável restrito ao usuário | Não criado |
| Escopos OAuth e eventual necessidade de nova autorização | A definir/conferir no protótipo |
| Rota de navegador, identificador da implantação e CSP | A validar antes de ativar |
| Intenções/recibos e recuperação de encerramento inesperado | A implementar e testar |
| Bloqueio de escritores antigos/diretos na transição | A demonstrar antes da ativação |
| Consumo e ausência de cobrança adicional | A confirmar na configuração real |
| Backup local do celular | Continua não verificado nesta sessão |

Sem essas condições, a decisão continua sendo um desenho e não um serviço pronto. Não substituir a chamada autenticada por endpoint público para contornar um problema de configuração.

## 9. Transição sem dois escritores

Primeiro implementar e homologar somente na planilha fictícia. Na passagem para o histórico oficial, conferir backups atualizados, pausar todos os clientes e conferir que não há envios antigos pendentes/incertos.

Criar a referência inicial de IDs/versões com correspondência única e migração reversível. Dados ambíguos exigem revisão; não deduplicar por nome e data apenas.

Desativar o caminho antigo de escrita direta e resolver os clientes em cache antes de habilitar o coordenador. Um aviso de versão mínima só no serviço novo não impede um app antigo que ainda chama a API Sheets diretamente. A transição pode exigir revogação das autorizações antigas/inativação do cliente OAuth antigo e um cliente dedicado para o novo fluxo; a viabilidade e o impacto precisam ser verificados. Não executar revogação ou alteração de acesso nesta etapa de desenho.

Se não for possível impedir a coexistência dos escritores antigos, não declarar a migração concluída nem habilitar edição/exclusão automática com garantia entre aparelhos. O retorno de código também precisa respeitar o protocolo: não republicar uma versão antiga escritora em paralelo com o coordenador ativo.

## 10. Homologação exigida

Aplicar os 25 cenários do contrato v1 e acrescentar:

- Dois aparelhos/contextos diferentes e dois pedidos simultâneos com o mesmo ID de operação.
- Mesmo ID de operação com conteúdo diferente.
- Processo encerrado antes da intenção, depois da intenção, depois do lote e antes da resposta.
- Mutação tardia, leitura inicialmente ausente e impedimento de nova escrita.
- Falha do próprio registro de intenção/recibo: o cliente deve parar com estado explicável.
- Segundo projeto/script ou cliente direto tentando concorrer: comprovar o limite e o procedimento de transição.
- Sessão com séries parcialmente confirmadas, correção e exclusão concorrentes.
- Modo de manutenção, reordenação de linhas, IDs ausentes e alteração de fórmulas.
- OAuth expirado, usuário não autorizado, destino errado e cota esgotada.
- Restauração de backup e retorno de versão sem reativar escritor antigo.

Nenhum desses testes do novo serviço foi executado neste passo. A pesquisa valida a existência dos recursos documentados, não a correção de um serviço que ainda será implementado.

## 11. Próximo passo e apps disponíveis

Passo 6 da Etapa 1: consolidar os critérios de conclusão, dependências e sequência de implementação. Depois, iniciar as correções e o protótipo coordenado no ambiente fictício, antes da migração do histórico real.

App principal, sem alteração funcional nesta etapa: https://devgabrielsl.github.io/treino-evolucao/

App de testes atual: https://devgabrielsl.github.io/treino-evolucao/testes/

## Fontes primárias consultadas em 26/10/2026

[1] LockService: https://developers.google.com/apps-script/reference/lock/lock-service

[2] spreadsheets.batchUpdate: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate

[3] Executar funções com a API Apps Script: https://developers.google.com/apps-script/api/how-tos/execute

[4] Manifesto de executáveis: https://developers.google.com/apps-script/manifest/web-app-api-executable

[5] Cotas e preços da API Sheets: https://developers.google.com/workspace/sheets/api/limits

[6] Cotas e limites do Apps Script: https://developers.google.com/apps-script/guides/services/quotas

[7] Cota gratuita do Firestore: https://firebase.google.com/docs/firestore/quotas

[8] Transações do Firestore: https://firebase.google.com/docs/firestore/manage-data/transactions
