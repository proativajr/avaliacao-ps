# Avaliação do Processo Seletivo · Proativa Jr.

Sistema para os membros avaliarem os candidatos do PS pelo celular, com as notas
gravadas numa planilha Google que calcula médias, ranking e progresso sozinha.

> **Status:** em construção por marcos. Este README será completado no M5 com o
> passo a passo inteiro (publicar o app, cadastrar avaliadores, importar candidatos,
> ensaiar e virar para produção).

## Estrutura

| Pasta | O que tem |
|---|---|
| `apps-script/Codigo.gs` | **O arquivo que você cola no Apps Script.** Gerado automaticamente; não edite à mão. |
| `apps-script/src/` | Código-fonte do Apps Script, separado por assunto. |
| `shared/` | Regras de cálculo e de texto usadas pelo app, pelo script e pelos testes. |
| `tests/` | Testes automáticos (Node). |
| `scripts/` | Ferramentas de build e de validação da planilha. |

## Marco 1: planilha com setup(), fórmulas e dados fictícios

### Como testar (uns 10 minutos)

1. Crie uma planilha nova e vazia no Google Drive da conta da Proativa. Nome sugerido: **PS 2026.2 · ENSAIO**.
2. Menu **Extensões → Apps Script**. Apague o conteúdo do arquivo `Código.gs`.
3. Abra [`apps-script/Codigo.gs`](apps-script/Codigo.gs) aqui no GitHub, clique no botão **Copiar arquivo** (ícone de copiar, no canto do arquivo) e cole no editor. Clique em **Salvar** (ícone de disquete).
4. No editor, escolha a função **`setup`** na lista do topo e clique em **Executar**.
   Na primeira vez o Google pede autorização: *Revisar permissões → escolher a conta → Avançado → Acessar (não seguro) → Permitir*.
   (O aviso "não seguro" aparece porque o script é seu e não passou por verificação do Google.)
5. Volte para a planilha e recarregue a página. Vai aparecer o menu **PS Proativa**.
6. Menu **PS Proativa → Ensaio: gerar dados fictícios** → digite `30,12` (30 candidatos e 12 avaliadores).
7. Confira:
   - **Tabela Geral**: ranking com médias por critério e por bloco, nº de avaliadores, desvio e alertas.
     Troque a **Etapa** na célula B2.
   - **Tabela Individual**: escolha um candidato na célula B2 e veja a média dele contra o grupo, a matriz avaliador × critério e as observações.
   - **Progresso**: completos, parciais e pendentes de cada avaliador.
   - **Calibracao**: média de cada avaliador contra a média geral e a distribuição das notas.
8. Menu **PS Proativa → Conferir cálculos**: recalcula tudo por fora e compara com a Tabela Geral. Tem que dar **"Cálculos conferidos ✓"**.
9. Teste a configuração: na aba **Config**, mude `nota_de_corte` para `3` e `vagas` para `10`, e veja a coluna Situação e as cores.
   Na aba **Config_Criterios**, mude o `peso` de um critério ou o `ativo` para `NÃO` e veja a Tabela Geral se ajustar.
10. Para limpar: **PS Proativa → Ensaio: zerar dados**.

Rodar o `setup()` de novo é seguro: ele não apaga dados nem a configuração, só refaz fórmulas, formatos e proteções.

## Para quem for mexer no código

```bash
npm test            # gera o Codigo.gs e roda todos os testes
npm run build:gas   # só gera o apps-script/Codigo.gs
```

Nenhum dado real entra no repositório: a pasta `referencia/` e os arquivos de inscrição
estão no `.gitignore`. Os testes e o modo ensaio usam apenas dados fictícios.

## Marco 2: backend (Apps Script como API)

O mesmo `Codigo.gs` agora também responde ao site. Toda chamada valida o token no servidor:
link de avaliador só lê e grava as próprias notas, nunca vê email/telefone de candidatos
e não acessa nada de admin.

### Como testar

1. Atualize o código: cole o novo `apps-script/Codigo.gs` no editor (substituindo tudo), salve e rode `setup` de novo.
2. Publique como Web App: **Implantar → Nova implantação → ⚙ Selecionar tipo → App da Web**.
   - *Descrição:* `API PS`
   - *Executar como:* **Eu**
   - *Quem pode acessar:* **Qualquer pessoa**
   - Clique em **Implantar** e copie o **URL do app da Web** (termina em `/exec`).
   - Se a opção "Qualquer pessoa" não aparecer, o administrador do Google Workspace da Proativa precisa liberar
     o compartilhamento externo de apps do Apps Script (Admin Console → Apps → Google Workspace → Drive e Documentos).
3. Abra o URL no navegador: deve aparecer algo como `{"ok":true,"dados":{"sistema":"avaliacao-ps",...}}`.
4. (Opcional, para quem tem Node) `node scripts/testar-api.mjs "URL" "TOKEN_DO_ADMIN"`.
   O token do admin aparece em **PS Proativa → Mostrar link do admin**.

**Quando o código mudar:** cole o novo `Codigo.gs`, salve, e vá em **Implantar → Gerenciar implantações → ✏ → Versão: Nova versão → Implantar**.
O URL continua o mesmo.

### O que os testes automáticos cobrem (`npm test`)

- token inválido, avaliador tentando ações de admin, admin tentando rotas de avaliador;
- avaliador A não grava em nome do B e não vê as notas do B; sem email/telefone para avaliadores;
- editar ou reenviar nota não duplica linha; reenvio atrasado de nota antiga não sobrescreve a nova;
- 15 avaliadores salvando lotes embaralhados com reenvios: uma linha por nota, valor final correto;
- etapa fechada, candidato inativo, critério e nota inválidos são recusados;
- regerar token derruba o link antigo; desativar avaliador bloqueia o acesso;
- importação: reimportar não duplica, "criar mesmo assim", atualizar sem trocar o nome editado.

## Marco 3: site (admin) com cadastro de avaliadores e importação de candidatos

O site fica em `web/` (Vite + Preact + TypeScript) e é publicado como página estática.

### Publicar o site na Vercel (uns 5 minutos, uma vez só)

1. Entre em [vercel.com](https://vercel.com) com a conta do GitHub **proativajr**.
2. **Add New… → Project → Import** o repositório `avaliacao-ps`. Não mude nada (o `vercel.json` já diz como montar). **Deploy**.
3. Anote o endereço gerado (ex.: `https://avaliacao-ps.vercel.app`).
4. No GitHub, abra `web/public/config.js` → ✏ (editar) → cole o URL do Web App do Apps Script em `ensaio:` (e depois em `producao:`) → **Commit changes**. A Vercel publica de novo sozinha.
5. Na planilha, aba **Config**, preencha `url_app` com o endereço do site. Depois use **PS Proativa → Mostrar link do admin**.

### Como testar

1. Cole o novo `Codigo.gs` no Apps Script, salve e **Gerenciar implantações → ✏ → Nova versão → Implantar**.
2. Abra o link do admin. Com a lista vazia, o painel já abre em **Importar candidatos**.
3. Importe `exemplos/inscricoes-ficticias.csv` (baixe do GitHub). Confira:
   - colunas sugeridas automaticamente (dá para trocar);
   - avisos de nome vazio, email inválido, nome em CAIXA ALTA corrigido, espaços extras e linha repetida;
   - para cada duplicado: ignorar, atualizar ou criar mesmo assim.
4. Importe depois `exemplos/inscricoes-ficticias-reimportar.csv`: só **1** inscrição nova deve entrar.
5. Teste também a colagem: copie algumas linhas de uma planilha (com o cabeçalho) e cole na caixa da direita.
6. Em **Candidatos**: edite o nome de exibição, mude o status, veja a **Inscrição** original. A coluna "Os avaliadores veem"
   mostra o sobrenome quando dois candidatos têm o mesmo primeiro nome.
7. Em **Avaliadores**: **Colar lista** (nome e email por linha), **Copiar link**, **WhatsApp**, **Regerar link** e **Desativar**.

### Testar no computador, sem Google (para quem programa)

```bash
npm install
npm run build && node scripts/servidor-local.mjs   # API local com dados fictícios (memória)
# em outro terminal: crie web/dist/config.js apontando para http://localhost:8787 e rode: npx vite preview
```

## Marco 4: tela do avaliador

Pensada para celular 360×640 e só com toques: um candidato por tela, critérios agrupados por bloco
(um bloco aberto por vez, e ele cabe inteiro na tela), botões grandes de 1 a 5 e "Não posso avaliar".

- **Salvamento automático a cada toque.** A nota vai primeiro para o aparelho e depois para o servidor, em lotes.
  Indicador no topo: *Salvando… / Salvo ✓ / Sem conexão*. Sem internet, as notas ficam guardadas (mesmo fechando
  o app) e são enviadas quando a conexão volta. O servidor nunca duplica.
- **Não posso avaliar este candidato:** marca todos os critérios como "não posso avaliar" de uma vez
  (conta como concluído, e não entra nas médias).
- **Em votação agora:** na aba **Votação** do admin, marque quem acabou de apresentar. Em até 20 segundos aparece
  um atalho para esses candidatos no topo da lista dos avaliadores, e o admin acompanha quantos já completaram.
- Lista com busca, filtros (Todos, Pendentes, Parciais, Completos) e "Você avaliou X de Y".
- Anterior/próximo, "Ir para o próximo pendente", observação opcional por candidato, descrições curtas ou completas.
- No computador: teclas **1–5** e **N**, **↑ ↓** trocam o critério, **← →** trocam o candidato.
- Etapa fechada (ou avaliação fechada na Configuração): aviso e somente leitura.
- Tema claro e escuro conforme o celular.

### Como testar

1. Atualize o `Codigo.gs` (cole, salve, **Gerenciar implantações → Nova versão**) e aguarde a Vercel publicar.
2. No modo ensaio, gere dados fictícios (**PS Proativa → Ensaio: gerar dados fictícios**, ou pela aba **Ensaio e dados**).
3. Na aba **Avaliadores**, copie o link de um avaliador e abra no celular.
4. Avalie alguns candidatos. Ligue o modo avião, dê mais notas (aparece "Sem conexão"), feche o app, desligue
   o modo avião e abra de novo: as notas são enviadas e aparecem na planilha (aba **Avaliacoes**) sem duplicar.
5. No computador, abra a aba **Votação**, selecione dois candidatos e clique em **Abrir votação**. No celular,
   o atalho aparece no topo da lista.
