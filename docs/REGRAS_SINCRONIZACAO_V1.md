# Regras de registro e sincronização — versão 1

Data: 26/10/2026. Projeto: Treino & Evolução / App fitness.

**Estado: contrato definido para orientar as próximas correções. Não é uma declaração de que as regras abaixo já foram implementadas.** Referência examinada: commit `ae21367ecb2afa0da11889f234ed7151b327d434`, app principal v1.1.2 e app de testes v1.1.2-test.1.

## 1. Objetivo e alcance

Priorizar o uso conectado no celular, com custo adicional zero. O Google Sheets continua como histórico central. O armazenamento local protege rascunhos e alterações ainda sem confirmação; salvar localmente não significa salvar no Google Sheets.

Este contrato cobre sessões, séries e pesagens, além da importação e recuperação desses registros. Modelos de treino, preferências e regras do Plano mantêm seus escopos próprios: excluir um modelo não exclui treinos realizados. Este passo não escolhe o mecanismo de coordenação das escritas, não muda colunas da planilha e não migra dados. Essas decisões pertencem ao passo 5 e à implementação posterior.

## 2. Identidade e referência dos dados

**REG-01 — Identificador permanente.** Cada sessão, série e pesagem tem um ID que não muda ao editar, reenviar, reorganizar linhas ou recuperar uma exclusão lógica. Cada tentativa da mesma operação conserva seu identificador de operação. Repetir uma tentativa não cria um novo registro.

**REG-02 — Escopo do destino.** As referências de confirmação e as operações pendentes pertencem ao ambiente e à planilha exatos. Confirmação obtida na planilha de testes não habilita o envio automático para a oficial. Trocar de destino não reaproveita automaticamente confirmações anteriores. A conta autorizada e o destino devem ficar identificáveis antes de um envio.

**REG-03 — Linhas não são identidade.** A posição da linha é um localizador provisório. Ordenar ou inserir linhas não pode associar um registro a outro. Usar ID quando disponível. Dados antigos sem ID exigem correspondência única e verificável; ambiguidades ficam para revisão, sem fundir ou remover registros automaticamente. Não preencher IDs antigos em massa sem migração planejada e backup.

**REG-04 — Sessões e referências.** Uma série pertence a uma sessão e a uma variação de exercício válidas, preservando equipamento e unidade. Renomear o treino não troca IDs. Alterar a data deve preservar a coerência com suas séries; enquanto a atualização conjunta não for suportada, bloquear essa operação em vez de produzir datas divergentes.

## 3. Criar e salvar

**REG-05 — Validação antes da gravação.** Validar o valor inteiro informado, seus sinais, unidade, data e referências. Campos ausentes continuam ausentes; zero não vira vazio. Informação explícita inválida gera erro e preserva o texto para correção. Não descartar sinais, capturar apenas parte de um número ou assumir outra unidade.

**REG-06 — Uma regra para todos os caminhos.** Formulário, assistente, importação e restauração devem usar um contrato comum, distinguindo os campos novos dos dados históricos que precisam ser preservados. Novas repetições registradas são inteiras e positivas nos tipos que exigem repetições; carga deve ser finita e não negativa; duração informada deve ser finita e não negativa; RPE informado deve estar entre 0 e 10. Para novos comandos de RIR, adotar 0 a 10 e validar os dois extremos de uma faixa. Registros legados compatíveis com o formato anterior, que admite RIR até 30, não serão apagados ou alterados por essa mudança: preservar valor e origem, sinalizar revisão quando necessário e planejar a compatibilidade antes de mudar o validador. Esses limites são regras do software, não orientação de treino.

**REG-07 — Salvar localmente com confirmação própria.** Só mostrar “salvo no dispositivo” após a conclusão da gravação local. Se o armazenamento falhar, mostrar erro e manter os campos preenchidos. Uma revisão antiga de outra aba não pode sobrescrever uma gravação local mais recente.

**REG-08 — Rascunho e conclusão do treino.** Manter o fluxo atual como referência nesta fase: treino em andamento e suas séries ficam como rascunho local; concluir o treino torna a sessão e as séries elegíveis ao envio. A interface deve dizer explicitamente que o rascunho ainda não está confirmado na planilha, mesmo com internet. Pesagens válidas são elegíveis ao salvar. Envio contínuo de séries de um treino aberto exigiria decisão posterior explícita; não está incluído neste contrato.

**REG-09 — Integridade da sessão.** Enviar a identificação da sessão antes das séries dependentes. Uma resposta parcial não autoriza declarar a sessão inteira sincronizada. Guardar o resultado por registro e manter os restantes pendentes. Não inventar séries nem preencher dados ausentes para concluir o envio.

## 4. Confirmar e repetir operações

**REG-10 — Confirmação pelo conteúdo.** Considerar uma inclusão ou edição confirmada somente depois de uma leitura coerente encontrar um único registro com o ID e os valores esperados, associados à versão/operação enviada. HTTP 200, um ID isolado, um contador global ou o horário da última sincronização não bastam.

**REG-11 — Campos estáveis e calculados.** Conferir os campos escritos pelo app. Na aba Peso, preservar D/E e suas fórmulas; validar a saúde dessas fórmulas separadamente dos campos de autoria do app. Uma fórmula com erro não pode ser ocultada por um recibo aparentemente correto.

**REG-12 — Resultado desconhecido.** Se a resposta se perder ou a leitura de confirmação falhar, mostrar “envio sem confirmação” e conservar a operação. Não afirmar fracasso definitivo nem repetir cegamente. Uma leitura sem o ID, sozinha, pode ser anterior à conclusão tardia da operação: só repetir escrita quando o mecanismo escolhido garantir identificação e deduplicação da mesma operação. Enquanto isso não for possível, exigir revisão e impedir repetição automática incerta.

**REG-13 — Erros transitórios e autorização.** Consultas podem ser repetidas de forma limitada. Escritas só podem ser repetidas com a garantia de REG-12. Adotar como padrão inicial até 3 tentativas totais, com intervalos de 2 e 5 segundos, respeitando um Retry-After maior quando fornecido. Ao esgotar, manter pendente e oferecer nova tentativa. Falhas de autenticação, permissão, validação ou conflito exigem ação específica; não repetir em ciclo. O sucesso deve ser comunicado explicitamente ao agendador, separado de uma tentativa terminada com erro.

**REG-14 — Novas mudanças durante o envio.** Capturar a versão e o conteúdo enviados. Se o usuário editar durante a operação, conservar a nova revisão na fila. A confirmação da revisão anterior não confirma a revisão nova. Uma alteração de metadados feita pela própria sincronização não deve causar um ciclo de envios.

## 5. Editar e conciliar

**REG-15 — Edição antes do envio.** Alterar o registro existente, mantendo seu ID. Se nenhuma operação anterior tiver sido enviada, a fila pode consolidar as alterações. Se houver envio em andamento ou resultado desconhecido, preservar a referência daquela operação e manter a alteração posterior separada.

**REG-16 — Edição após confirmação.** Criar uma atualização do mesmo ID, com referência à última versão confirmada. Não anexar uma segunda linha para representar uma correção. Até essa atualização segura existir, o app deve bloquear o envio da edição e informar que ela está pendente, sem dizer “sincronizado”.

**REG-17 — Comparação entre três estados.** Comparar a referência confirmada, a alteração local e a versão remota. Mudança apenas remota pode ser importada após validação. Mudança apenas local só pode ser enviada se a referência remota continuar compatível. Mudanças em campos diferentes podem ser conciliadas se o registro final passar na validação. Para o mesmo campo, valores iguais convergem; valores diferentes geram conflito.

**REG-18 — Resolução visível.** Nunca escolher o último horário como vencedor automático. Apresentar os valores local e remoto e permitir manter um deles ou informar outro. Preservar a evidência do conflito até a nova operação ser confirmada. Relógios do celular não definem precedência de gravação.

## 6. Excluir e recuperar

**REG-19 — Rascunho ainda não enviado.** Permitir descartar com confirmação contextual. Se houver operação em andamento ou incerta, não tratar o registro como “nunca enviado”: resolver ou cancelar sua operação antes de concluir o descarte.

**REG-20 — Exclusão de registro confirmado.** Usar uma exclusão lógica com ID, versão e marca explícita, mantendo os dados necessários à recuperação. Não remover fisicamente a linha nessa primeira implementação. Só mostrar “exclusão confirmada” quando a marca remota correspondente for verificada. Até existir suporte seguro, bloquear a exclusão sincronizada e explicar a limitação.

**REG-21 — Ausência não é ordem de exclusão.** Uma linha que desapareceu ou perdeu o ID na planilha exige conciliação. Não recriar automaticamente o registro e não apagar a cópia local por causa dessa ausência. Exclusão e edição simultâneas entram em conflito. Restaurar um registro excluído é uma nova atualização do mesmo ID, não uma nova inclusão.

**REG-22 — Dependências e histórico.** Excluir uma sessão exige tratar suas séries e impedir referências órfãs. O grupo só pode ser apresentado como totalmente excluído quando as operações necessárias estiverem confirmadas. Se o mecanismo não puder preservar essa integridade, bloquear a exclusão da sessão. A implementação deve oferecer recuperação da exclusão lógica; prazo de retenção e remoção definitiva ficam fora desta fase.

## 7. Estados visíveis

O status do treino (em andamento, concluído ou cancelado) e o status da sincronização são dimensões distintas. Um treino concluído pode continuar pendente de envio.

| Estado | Mensagem ao usuário | Condição de saída |
|---|---|---|
| Rascunho local | Salvo neste dispositivo; treino ainda não enviado | Concluir ou descartar |
| Pendente | Salvo no dispositivo, aguardando envio | Iniciar operação elegível |
| Enviando | Enviando para a planilha | Obter resultado ou detectar incerteza |
| Sem confirmação | O envio pode ter ocorrido; falta confirmar | Consultar operação/registro sem repetir cegamente |
| Confirmado | Esta versão está confirmada no Google Sheets | Usuário ou destino alterar o registro |
| Conflito | Os dados precisam de revisão | Resolver e confirmar a atualização |
| Ação necessária | Autorize novamente, confira permissão ou corrija o campo indicado | Resolver a causa e tentar novamente |
| Exclusão pendente | Exclusão solicitada, ainda sem confirmação | Confirmar marca remota ou resolver conflito |
| Excluído | Exclusão confirmada; recuperação disponível | Restaurar explicitamente |

A tela geral só pode dizer “tudo sincronizado” se não houver rascunhos/pendências relevantes, operações incertas ou conflitos naquele escopo. Se o resumo excluir rascunhos, deve dizer “registros concluídos sincronizados” e informar separadamente os rascunhos locais.

## 8. Metadados mínimos do mecanismo a escolher

O desenho do passo 5 deverá representar, de forma equivalente, os seguintes conceitos. Esta lista não prescreve novas colunas na planilha:

- Identidade do ambiente, destino, registro, tipo de registro e vínculos.
- Identificador de operação, ação solicitada e versão de conteúdo capturada.
- Referência/versão remota esperada e conteúdo ou impressão digital da referência confirmada.
- Resultado por operação: pendente, em execução, desconhecido, confirmado, bloqueado ou em conflito.
- Data da solicitação/confirmação para auditoria, sem usá-la como garantia de unicidade ou precedência.
- Marca de exclusão e evidência necessária à recuperação.

IDs, controle de concorrência e confirmação devem funcionar entre clientes; só um Set em memória, Web Locks ou uma leitura anterior à escrita não demonstram proteção entre aparelhos. O passo 5 precisa escolher uma forma de cumprir a garantia ou explicitar e bloquear os casos que não puder cumprir.

## 9. Importação, backup e isolamento

**REG-23 — Leitura coerente.** Não combinar data/nome de uma linha com carga/repetições de outra. Detectar alteração de identidade ou fotografia inconsistente entre leituras. Rejeitar a importação inteira antes de gravar o documento se não houver interpretação segura. Reimportar o mesmo conjunto não duplica registros.

**REG-24 — Restauração e automação.** Validar arquivo, estrutura, referências e revisões antes de substituir o estado local; preservar a cópia anterior e pedir confirmação de substituição. Não reaproveitar tokens nem disparar envios porque o backup tinha automação habilitada. Depois de restaurar, pausar a automação e conferir destino, operações antigas e estado remoto antes de reabilitá-la. O backup do Sheets não cobre automaticamente rascunhos existentes só no celular.

**REG-25 — Ambientes e dados calculados.** Testes usam dados fictícios, banco próprio e destino permitido. Não alterar o histórico real nem usar a cópia de recuperação como massa de testes. Fórmulas e campos derivados têm autoria identificada e não são sobrescritos para fazer um teste passar.

## 10. O que existe hoje e o que falta

A análise abaixo descreve o código de referência, não uma nova bateria de testes:

| Área | Evidência existente | Trabalho pendente para este contrato |
|---|---|---|
| Gravação local | IndexedDB com comparação de geração | Cobertura final dos caminhos de interface e das validações |
| IDs e recibos | IDs estáveis e comparação de conteúdo após releitura | Histórico durável de operações/versões para edições e exclusões |
| Repetição de inclusão | Releitura, recibos e bloqueios locais | Garantia entre aparelhos e tratamento de conclusão tardia |
| Abas simultâneas | Web Locks quando disponível | Não equivale a coordenação entre dispositivos |
| Conciliação | Referência anterior e comparação por campo | Reordenação por ID, resolução na interface e escrita segura de edições |
| Agendamento | Consentimento e primeira escrita confirmada | Não consumir novas revisões nem bloquear retomada após erro |
| Exclusão | Algumas remoções locais | Marca remota, recuperação, conflitos e dependências |
| Backup | Criptografia e conferência de arquivo | Pausa automática e conciliação segura após restauração |
| Uso conectado | Integração Sheets disponível | Mensagens por estado e confirmação por versão |
| Testes | Ambiente separado publicado | Aplicar a matriz de aceitação às correções futuras |

## 11. Critérios de aceitação e próximo passo

A matriz em `CENARIOS_SINCRONIZACAO_V1.json` especifica 25 cenários de aceitação. Ela é uma especificação, não uma suíte executável nem evidência de aprovação. Cada implementação futura deverá demonstrar os cenários afetados e manter os demais protegidos.

O passo 4 termina com este contrato e a matriz versionados no projeto. O próximo passo é escolher a estratégia de concorrência e o suporte a operações/versionamento com custo adicional zero. As alterações funcionais e a migração de dados exigirão implementação e validação posteriores.

App principal: https://devgabrielsl.github.io/treino-evolucao/

App de testes: https://devgabrielsl.github.io/treino-evolucao/testes/
