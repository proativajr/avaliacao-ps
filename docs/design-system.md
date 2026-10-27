# Sistema de design · Avaliação do PS

Identidade Proativa Jr. (Brandbook v1.0). Tudo vive em `web/src/estilo.css` (tokens e componentes) e
`web/src/avaliador/avaliador.css` (telas do avaliador). Mobile-first.

## Breakpoints

| Nome | Largura | O que muda |
|---|---|---|
| mobile | 320–639 px | Uma coluna. Admin com barra de navegação embaixo. Tabelas viram cartões. |
| tablet | 640–1023 px | Admin com menu no topo. Formulários em 2 colunas. Tabelas largas em 2 colunas de cartões. |
| desktop | 1024–1439 px | Menu lateral fixo. Tabelas normais. Ao vivo em 2 colunas (equipes + montar). |
| wide | 1440 px + | Menu lateral mais largo, mais respiro. Ranking com avaliadores ao lado. |

## Tokens

| Grupo | Tokens |
|---|---|
| Cor da marca | `--cor-marca-azul` #2A3756 · `--cor-marca-amarelo` #FAD20A (um destaque por tela, nunca texto sobre branco) |
| Neutros | `--texto` #0F1626 · `--suave` #5B6577 · `--linha` #D8DCE4 · `--linha-suave` #EEF0F4 · `--fundo` #F7F8FA · `--superficie` #FFF |
| Status | `--ok` #1B7A55 · `--alerta` #8A5F00 · `--erro` #B3261E (+ versões `-suave` para fundos) |
| Tipografia | Poppins. `--fs-legenda` 14 · `--fs-corpo` 16 · `--fs-forte` 17 · `--fs-h3` 17–20 · `--fs-h2` 20–24 · `--fs-h1` 26–34 · `--fs-numero` 28–36 (`clamp`) |
| Espaço | `--e1`…`--e8` = 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · `--margem` 16–32 (fluida) |
| Forma | `--raio` 4 px (marca) · `--raio-folha` 12 px (folhas que sobem no celular) |
| Sombra | `--sombra-1` (blocos) · `--sombra-2` (menus, modais, avisos) |
| Toque | `--toque` 44 px (altura mínima de tudo que é clicável) |

Decisões não óbvias:
- **Legendas em 14 px, corpo em 16 px.** Rótulos auxiliares (cabeçalho de tabela, "último acesso",
  contadores) ficam em 14 px para não competir com o conteúdo. Nada no app fica abaixo de 14 px.
- **`--alerta` escurecido** de #9A6B00 para #8A5F00 para passar 4,5:1 sobre o fundo de alerta.
- **#8C94A3 só em bordas e ícones**: ele dá 3:1 sobre branco e não serve para texto.
- **Avaliador com tokens próprios** (`--av-*` em `avaliador.css`): fundo off-white quente #F7F5F0, grupos brancos
  com contorno fino e sem sombra, separadores recuados depois do avatar. No tema escuro voltam para os neutros azuis.
- **Nota 1–5 é um controle segmentado** (`.seg`, 52 px de altura) e o **N/A fica na linha do nome do critério**, discreto,
  para as cinco notas ocuparem a largura toda (≥ 50 px cada já em 320 px).
- **Um amarelo por tela no avaliador:** o ponto do critério da vez; quando o candidato fica completo, o ponto some e o
  botão vira **Pronto, Próximo** em amarelo.
- **Folhas (bottom sheet)** para Mais opções, Observação e a confirmação de "Não posso avaliar" (sem `confirm()` do navegador).
  Sobem em 220 ms; com `prefers-reduced-motion`, aparecem sem movimento.

## Componentes (classes)

| Componente | Classe | Notas |
|---|---|---|
| Botão | `.botao` + `.principal` / `.destaque` / `.leve` / `.perigo` | Sempre 44 px de altura. `.pequeno` só reduz a largura. |
| Campo | `.campo` (rótulo + input) · `.entrada` · `.check` | Input com 16 px (evita zoom no iPhone). `.form-grade`: 1 coluna no celular, 2 a partir do tablet. |
| Bloco | `.bloco` + `.bloco-topo` (título + ações) | Fronteira visível: borda sutil, sombra leve, fundo branco sobre `--fundo`. |
| Grade de blocos | `.grade-blocos.duas` / `.tres` | Empilha no celular. |
| Cabeçalho de página | `.cabeca-pagina` + `.titulo` + `.sub` | |
| Abas | `.segmentado` | Rola dentro de si se não couber (nunca a página). |
| Tabela | `.tabela-box` + `.tabela` | `.vira-cartao`: cartões até 639 px. `.vira-cartao.ate-desktop`: cartões até 1023 px. Células: `.titulo-cel`, `.lado-cel`, `data-rotulo`, `.acoes-cel`, `.esconde-cartao`. |
| Matriz | `.matriz-box` | Rolagem contida com a 1ª coluna fixa (notas por avaliador, cabeçalho da importação). |
| Métricas | `.metricas` + `.metrica` (`.destaque` = o amarelo da tela) | 2 colunas no celular, 4 a partir do tablet. |
| Selo | `.selo` + `.ok` / `.alerta` / `.erro` / `.marca` | |
| Alerta | `.aviso` + `.ok` / `.alerta` / `.erro` | Faixa lateral + fundo suave + texto (nunca só cor). |
| Situação | `.situ` + `.ok` / `.alerta` / `.vazio` | Ponto + texto. |
| Modal | `Modal` (`.modal`) | Folha que sobe no celular; janela centralizada a partir do tablet. |
| Navegação | `.adm-barra` (celular) · `.adm-nav` (topo no tablet, lateral no desktop) | |
| Estados | `.vazio` · `.carregando` (com indicador) · `.aviso.erro` · toast | |

## Blocos por tela

**Avaliador (celular primeiro, mesma coluna em telas maiores, até 560 px):**
1. Topo: símbolo, dinâmica e estado de salvamento.
2. Bloco **Equipe da vez**: título, progresso e membros. Ou bloco **Aguardando**.
3. Busca + lista de **outros candidatos**.

Na tela do candidato:
1. Nome.
2. Abas dos blocos de critérios.
3. Bloco de critérios, com as notas.
4. Observação já escrita (linha tocável; editar abre a folha).
5. Barra fixa com **Próximo** / **Pronto, Próximo** e **⋯**, e uma linha de progresso de 2 px na borda de cima.

**Ao vivo:**
- Cabeçalho com a dinâmica.
- No celular:
  1. Bloco **Avaliando agora**.
  2. Bloco **Equipes**.
  3. **Montar equipes**, em uma tela própria.
- No desktop (≥ 1024 px), em duas colunas:
  - à esquerda: **Avaliando agora** e **Equipes**;
  - à direita: **Montar equipes**.

**Ranking:**
1. Cabeçalho com o filtro de dinâmica.
2. Métricas.
3. Bloco **Candidatos**: busca, ordem, tabela e downloads.
4. Bloco **Avaliadores**, com progresso e lembrete.
5. Regras.

A partir de 1440 px, Candidatos e Avaliadores ficam lado a lado.

**Pessoas:**
- Abas Candidatos e Avaliadores.
- Barra de ações e tabela, que vira cartões até 1023 px.

**Ajustes:**
- Abas Configuração e Ensaio e dados.
- Blocos de **Configuração**:
  1. Processo.
  2. Dinâmicas e Blocos, lado a lado a partir do tablet.
  3. Critérios.
- Blocos de **Ensaio e dados**:
  1. Fictícios, Conferir e Backup, em 3 colunas no desktop.
  2. Apagar dados, com borda vermelha.

## Validação

`scripts/auditoria-responsiva.mjs` (Playwright) abre as 12 telas em 320, 375, 768, 1024, 1440 e 1920 px. Para cada uma, mede:
- rolagem horizontal da página e elementos vazando;
- texto abaixo de 14 px;
- alvos de toque menores que 44 px;
- contraste WCAG AA.
