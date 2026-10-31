# Treino & Evolução — Relíquias ilustradas v1.6.10
Correção da publicação anterior: a v1.6.9 usava apenas o emblema e o CSS, sem incluir as ilustrações aprovadas.

Esta revisão integra imagens WebP **no pacote publicado**:
- `relic-group-scenes.webp`: faixa com sete ilustrações RPG por grupo muscular (peito, costas, ombros, bíceps, tríceps, pernas e core), recortadas da direção artística 3 aprovada.
- `relic-supino-card.webp`: ilustração específica somente para supino reto **com barra**.
- `principal_relics_art.css`: aplica os quadros por posição vertical do spritesheet em miniaturas e cartas. Não estica cada quadro nem insere textos de execução na imagem.
- A composição anterior de `rpg-citadel.webp`, `rpg-arena.webp`, `rpg-archive.webp` e a identidade do aplicativo foram preservadas.

As ilustrações são decorativas; não devem ser interpretadas como instrução técnica de movimento. Não houve mudança em dados, persistência, cronômetro, validação de séries ou sincronização.

Compilação: `testing/production_candidate.py` aplica `testing/principal_relics_art_patch.py` após a camada v1.6.9. Os arquivos novos entram no cache e na integridade do PWA; URLs dos módulos alterados recebem `v=170`.
