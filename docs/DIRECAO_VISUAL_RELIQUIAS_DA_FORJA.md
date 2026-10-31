# Relíquias da Forja — implantação visual v1.6.9

Referência: Treino & Evolução, versão principal. Direção 3 aprovada.

## Escopo aplicado
- Mantém a cidadela/arena/arquivo originais e a identidade esmeralda, ouro antigo e pedra escura.
- Cards de previsão recebem tratamento de relíquia compacta com símbolos por grupo muscular, sem fotografia genérica repetida para simular exercícios.
- Miniaturas recebem um novo emblema SVG próprio e classe semântica de grupo muscular para permitir artes individuais no futuro.
- Painel de registro e relógio preservados com contraste e foco em leitura no celular.
- Imagens de execução específicas ainda não foram integradas: requerem revisão anatômica e composições por exercício.

## Limites
A intervenção restringe-se à camada de apresentação. Não altera modelos, dados, sincronização, backup, duração, validações nem operação de registro. Não há novos sistemas de pontuação fictícia.

## Arquivos
`testing/principal_relics.css`, `testing/assets/relic-emblem.svg`,
`testing/principal_relics_patch.py`. A montagem principal aplica o patch após v1.6.8.

## Verificações
Requer build de publicação e conferência visual no aplicativo instalado, inclusive cache do service worker.
