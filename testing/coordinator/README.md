# Coordenador de sincronização — candidato não implantado

Estado em 26/10/2026: código e simulações preparados. **O cliente está integrado ao código do app, mas o serviço não foi implantado nem homologado na conta Google. Não habilitar como serviço de produção.** O app de testes test.7 bloqueia o envio direto e oferece importação somente de leitura. O app principal permanece no fluxo anterior.

## O que está implementado neste candidato

`Code.gs` oferece um único ponto de API, `coordinateSync`, com validação de proprietário e destino fixo de testes. Usa ScriptLock, versão global do ambiente, ID estável de operação, recibo persistente e marcador de resultado incerto. Dados e recibo são escritos no mesmo lote Sheets. Peso escreve A:C e F:G, preservando D/E. Alteração externa, identidade divergente, resultado desconhecido ou controle cheio interrompem novas mutações.

O arquivo `_SyncEstado!A1` guarda versão, impressão digital e recibos. Há limite preventivo de 45.000 caracteres: quando alcançado, o coordenador para; não apaga recibos antigos para liberar espaço. A intenção fica em Script Properties. Uma intenção sem recibo correspondente mantém o ambiente bloqueado mesmo depois de esperar: não é permissão para repetir a escrita.

Escopo limitado: inserções de treinos concluídos, séries e pesagens. Não implementa edição, exclusão lógica, interface de resolução, manutenção completa ou compactação de recibos. Usa versão global, portanto um cliente desatualizado precisa reler e tratar conflito, mantendo o conteúdo/ID de sua operação original. O cliente para scripts.run foi integrado no test.7, com fila persistente e conferência dos recibos. Continua desativado: não há implantação configurada, nem homologação na conta Google.

## Pré-requisitos que não foram configurados

- Um projeto Apps Script independente exclusivo do ambiente de testes, compartilhado por todos os seus clientes.
- Vincular esse script ao mesmo projeto Google Cloud padrão do OAuth Web Client atual; confirmar acesso administrativo a esse projeto.
- Habilitar Apps Script API e Sheets API, além do serviço avançado Sheets no script.
- Implantação como **Executável de API**, acesso **somente eu**, conforme `appsscript.json`. Não criar webhook anônimo executado como proprietário.
- OAuth compatível com os escopos do manifesto. O candidato acrescenta `userinfo.email`; esse acesso precisa ser autorizado na conta Google, não foi concedido nesta entrega.
- Planilha de testes e cabeçalhos `ID do aplicativo` nas colunas J/O/G de Treinos/Series/Peso. Fazer backup e conferir esses campos antes da inicialização. Nenhuma aba foi criada por esta entrega.

## Preparação concreta para a implantação

1. Criar o projeto de testes e copiar `Code.gs` e `appsscript.json`.
2. Nas propriedades do script, configurar `SYNC_OWNER_EMAIL` com o e-mail do implantador, `SYNC_SPREADSHEET_ID` com o ID de testes já fixado no código e `SYNC_ENABLED=false`.
3. Com backup e esquema conferidos, executar `initializeCoordinator` no editor do proprietário. Essa ação cria `_SyncEstado`, guarda a referência inicial e mantém o serviço desabilitado. Nunca reinicializa controle existente.
4. Vincular o projeto Cloud e criar a implantação de API restrita ao implantador. Guardar o identificador retornado pelo Google; não inventar esse identificador nem confundi-lo com o ID da planilha.
5. Depois de implantar e conferir os escopos, configurar o identificador real da implantação e habilitar o caminho coordenado em uma entrega de validação. O cliente integrado conserva a operação antes de enviar, repete o mesmo ID/conteúdo e exige hash, revisão, ambiente e valores conferidos. Nenhuma configuração de implantação foi preenchida nesta entrega.
6. Em sessão de validação controlada somente na planilha de testes, habilitar o serviço (`SYNC_ENABLED=true`) e a configuração do cliente para exercitar o caminho de API. Homologar no Google real dois clientes, repetições, recibos, falhas, cotas, versão e preservação de fórmulas. Só declarar a ativação validada depois desses resultados. Não habilitar o app principal nesta etapa.

Se aparecer `UNCERTAIN`, `EXTERNAL_CHANGE`, `CONTROL_CAPACITY_REACHED` ou divergência de identidade, conservar controles e dados para revisão. Não apagar intenção/recibos para forçar uma nova tentativa. O procedimento de manutenção e recuperação precisa ser concluído antes da ativação.

## Limites das evidências

`node testing/coordinator_tests.mjs`: 24 verificações em dois contextos VM com serviços Google simulados. Exercita chamadas concorrentes por injeção de uma segunda execução durante a seção crítica. Não executa Apps Script real, não mede espera real do ScriptLock, nem testa OAuth, permissões, implantação, cotas ou consistência real dos serviços Google.

`node testing/concurrency_gate_tests.mjs`: 14 verificações da versão final bloqueada, incluindo dois módulos de transporte independentes, ausência de requisições de escrita, preferência automática antiga, importação, preservação local e falha de armazenamento.

O pipeline executa as 228 verificações anteriores no motor de sincronização antes do bloqueio; depois reconstrói a versão final sem o modo de testes interno e verifica o bloqueio. O motor sem bloqueio não é o artefato publicado.

As duas falhas de concorrência da auditoria anterior **não foram declaradas resolvidas por uma implantação ativa**. O test.7 impede o acesso ao caminho inseguro; a alternativa coordenada é um candidato para a próxima etapa.

## Fontes oficiais consultadas

- Executar Apps Script: https://developers.google.com/apps-script/api/how-tos/execute
- ScriptLock: https://developers.google.com/apps-script/reference/lock/lock-service
- Sheets batchUpdate: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate

A garantia pretendida só se aplica a clientes do mesmo coordenador. Edição manual concorrente ou programas que escrevem diretamente na planilha ficam fora do ScriptLock. Essas operações exigem manutenção coordenada. Nenhum preço ou capacidade ilimitada é garantido; confirmar cotas e configuração antes de ativar.

## Atualização: cliente integrado, ativação externa bloqueada

O test.7 inclui `coordinator_client.js` no cache e na distribuição. Com configuração válida, leituras de sincronização e inserções passam exclusivamente por scripts.run; não há retorno à gravação direta no Sheets. O token continua somente em memória. O escopo de identificação de e-mail só passa a ser solicitado quando esse caminho estiver habilitado.

A fila `settings.sheet_sync.coordinator_v1` registra o payload e o ID da operação antes da chamada. Uma resposta válida exige vínculo ao ambiente de testes, ID de planilha esperado, hash do payload capturado, revisão e conferência posterior dos registros. Os IDs conhecidos são persistidos antes de limpar a fila. Mudanças locais posteriores não são substituídas pelos checkpoints.

`COORDINATOR_DEPLOYMENT_ID` permanece vazio e `COORDINATOR_ENABLED` permanece falso. Em uma entrega de validação, o valor deve ser o identificador de implantação de API retornado pelo Google. Não é o ID da planilha. A ativação não foi feita e não se deve declarar a sincronização homologada.

28 testes adicionais integram o cliente ao serviço Apps Script simulado em duas instâncias VM, com testes de disputa, repetição, perda de resposta, falha local, versões, ambiente, hash e preservação de alterações durante o envio. Os serviços Google, o OAuth e o navegador não foram homologados por esses testes.

Tentativa de configuração real em 26/10/2026: o navegador recebeu uma página Google de tráfego incomum com CAPTCHA antes de acessar o painel Apps Script. Não foi contornado. Nenhum projeto, vínculo Cloud, autorização adicional, aba de controle ou implantação foi criado por esta etapa. Essa parte depende de acesso interativo válido à conta/projeto do proprietário.

A configuração real e a homologação continuam sendo pendências. Após limpar o bloqueio, é necessário confirmar acesso ao projeto Cloud do OAuth, implantar o candidato com acesso MYSELF, inicializar o controle somente na planilha de testes, integrar o identificador real e exercitar os cenários no serviço real. Resultados incertos ou conflito de versão permanecem para revisão; a interface de resolução ainda não foi implementada.
