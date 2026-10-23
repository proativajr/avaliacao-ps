# Avaliação do Processo Seletivo · Proativa Jr.

App para os membros avaliarem os candidatos do PS pelo celular, **só com toques**, e uma planilha Google
que recebe as notas e calcula sozinha médias, ranking, progresso e calibração.

- **App do avaliador:** link pessoal (sem senha), um candidato por tela, notas de 1 a 5 ou "Não posso avaliar",
  salvamento automático que funciona até sem internet.
- **Painel do admin:** importar inscrições do Google Forms, cadastrar avaliadores e mandar o link pelo WhatsApp,
  abrir a votação depois de cada apresentação, ranking ao vivo, configuração dos critérios e exportação.
- **Planilha:** é a fonte da verdade. Todas as estatísticas são fórmulas da própria planilha.

Guias para enviar à equipe: [guia do avaliador](docs/guia-avaliador.md) · [guia do admin](docs/guia-admin.md) ·
[checklist de go-live](docs/checklist-go-live.md).

---

## Instalação passo a passo (uns 15 minutos)

Você vai montar **duas** planilhas iguais: uma de **ENSAIO** (dados fictícios, para treinar) e uma de **PRODUÇÃO**
(o processo real). Comece pela de ensaio. Use a conta Google da Proativa.

### 1. Criar a planilha e colar o script (5 min)

1. No Google Drive, **Novo → Planilhas Google → Planilha em branco**. Dê o nome **PS 2026.2 · ENSAIO**.
2. Menu **Extensões → Apps Script**. Apague o que estiver no arquivo `Código.gs`.
3. Aqui no GitHub, abra [`apps-script/Codigo.gs`](apps-script/Codigo.gs), clique no ícone **Copy raw file** (copiar)
   e cole no editor do Apps Script. Clique em **Salvar** (ícone de disquete).
4. Na lista de funções do topo, escolha **`setup`** e clique em **Executar**.
   Na primeira vez o Google pede autorização: **Revisar permissões → sua conta → Avançado → Acessar (não seguro) → Permitir**.
   O aviso aparece porque o script é seu e não foi publicado na loja do Google.
5. Volte à planilha e recarregue a página. Vai aparecer o menu **PS Proativa** e todas as abas.

### 2. Publicar a API (Web App) (3 min)

1. No editor do Apps Script: **Implantar → Nova implantação → ⚙ (Selecionar tipo) → App da Web**.
2. Preencha: *Descrição* `API PS` · *Executar como* **Eu** · *Quem pode acessar* **Qualquer pessoa**.
3. **Implantar** → copie o **URL do app da Web** (termina em `/exec`).
4. Teste: cole o URL no navegador. Deve aparecer `{"ok":true,...}`.

> Se a opção **"Qualquer pessoa"** não aparecer, o Google Workspace da Proativa está bloqueando.
> Quem administra o Workspace precisa liberar o compartilhamento fora do domínio para apps do Apps Script
> (Admin Console → Apps → Google Workspace → Drive e Documentos → Compartilhamento). Sem isso,
> avaliadores com Gmail pessoal não conseguem usar o app.

### 3. Publicar o site (5 min, uma vez só)

1. Entre em [vercel.com](https://vercel.com) com o GitHub **proativajr** → **Add New… → Project → Import** `avaliacao-ps` → **Deploy**
   (não precisa mudar nada; o `vercel.json` já configura). Anote o endereço, ex.: `https://avaliacao-ps.vercel.app`.
2. Aqui no GitHub, abra [`web/public/config.js`](web/public/config.js) → ✏ **Edit** → cole o URL do passo 2 entre as aspas
   de `ensaio:` → **Commit changes**. A Vercel publica de novo sozinha em ~1 minuto.
3. Na planilha, aba **Config**, preencha `url_app` com o endereço do site.

*(Alternativas: Netlify ou GitHub Pages também funcionam. O comando de build é `npm run build` e a pasta é `web/dist`.)*

### 4. Entrar como admin (1 min)

Na planilha: **PS Proativa → Mostrar link do admin**. Abra o link no computador. **Não compartilhe**: quem tem esse link
tem acesso total. (Para invalidá-lo: **PS Proativa → Regerar token do admin**.)

### 5. Cadastrar os avaliadores

Painel → **Avaliadores → Colar lista**: um membro por linha, com nome e email (o email é opcional). Depois, para cada um,
**WhatsApp** (abre a conversa com a mensagem e o link prontos) ou **Copiar link**.

### 6. Importar os candidatos

1. No Google Forms de inscrição: **Respostas → Vincular ao Planilhas**. Na planilha de respostas: **Arquivo → Fazer download → .csv ou .xlsx**.
   (Ou selecione as linhas com o cabeçalho, copie e cole no painel.)
2. Painel → **Candidatos → Importar inscrições**. Confira as colunas sugeridas, revise os avisos e os duplicados, e confirme.
3. Reimportar o arquivo atualizado depois é seguro: só as inscrições novas entram.

### 7. Ensaiar

- **Ensaio e dados → Gerar dados fictícios** (ou menu **PS Proativa → Ensaio: gerar dados fictícios**).
- Para testar a importação, use os arquivos fictícios de [`exemplos/`](exemplos/).
- Faça o ensaio com a equipe seguindo o [checklist](docs/checklist-go-live.md).
- No fim: **Zerar dados do ensaio**.

### 8. Virar para produção

1. Repita os passos **1 e 2** numa planilha nova chamada **PS 2026.2 · PRODUÇÃO** (planilha em branco, não uma cópia).
2. Na aba **Config** da planilha nova, mude `modo` para **PRODUCAO** e preencha `url_app`.
3. Em `web/public/config.js`, cole o URL da nova API em `producao:` e faça o commit.
4. Pegue o link do admin da planilha nova (**PS Proativa → Mostrar link do admin**).
5. Cadastre os avaliadores de novo nesta planilha e envie os **links novos** (os do ensaio continuam valendo só para o ensaio).
6. Importe os candidatos reais.

O ensaio e a produção ficam separados: links de ensaio terminam em `&amb=ensaio` e mostram a faixa roxa
**"AMBIENTE DE TESTE: dados fictícios"**.

---

## Quando o código mudar

1. Copie o novo `apps-script/Codigo.gs` e cole no editor (substituindo tudo). Salve.
2. Rode `setup` de novo (é seguro: não apaga dados nem configuração).
3. **Implantar → Gerenciar implantações → ✏ → Versão: Nova versão → Implantar**. O URL continua o mesmo.
4. O site atualiza sozinho pela Vercel a cada commit.

---

## Como a planilha funciona

| Aba | O que tem | Quem escreve |
|---|---|---|
| **Tabela Geral** | Ranking com média por critério, por bloco e geral, nº de avaliadores, desvio, alertas e situação. Seletor de etapa em B2. | fórmulas |
| **Tabela Individual** | Escolha o candidato em B2: média × grupo, matriz avaliador × critério, observações. | fórmulas |
| **Progresso** | Completos, parciais e pendentes por avaliador (seletor de etapa em B2). | fórmulas |
| **Calibracao** | Média de cada avaliador × média geral, "não posso avaliar" e distribuição das notas por critério. | fórmulas |
| **Config**, **Config_Etapas**, **Config_Blocos**, **Config_Criterios** | Configuração (edite pelo painel). | painel |
| **Avaliadores**, **Candidatos**, **Avaliacoes**, **Observacoes**, **Inscricoes_Original**, **Importacoes** | Dados. | só o script |
| `_Aux` (oculta) | Cálculos intermediários. | fórmulas |

**Regras de cálculo**

- "Não posso avaliar" (NA) e vazio **não entram nas médias**. NA conta como respondido para o progresso.
- Média do critério = média das notas numéricas de todos os avaliadores na etapa selecionada.
- Média geral = média **ponderada** pelos pesos dos critérios que têm nota. Com todos os pesos 1, é a média simples (igual à planilha antiga).
- Ranking por competição (empate divide a posição: 1, 2, 2, 4), pelo valor **sem arredondar**. Exibição com 2 casas.
- Status diferente de ATIVO aparece na lista, mas fora do ranking.
- **Dados insuficientes:** menos avaliadores que `min_avaliadores_por_candidato`.
- **Divergência:** desvio padrão entre as médias de cada avaliador maior que `limite_divergencia`.
- **Situação:** Classificado (acima do corte e dentro das vagas), Fora das vagas, Abaixo do corte, Sem notas ou Fora do ranking.
  Empate na última vaga classifica todos os empatados.
- Tudo é ligado por **ID** (candidato `c001`, avaliador `a001`, critério `valores_proatividade`), nunca pelo texto do nome.
- **PS Proativa → Conferir cálculos** recalcula tudo por fora e compara com a Tabela Geral.

---

## Segurança e privacidade (LGPD)

- Cada link tem um token aleatório de 256 bits no **fragmento** (`#t=...`), que o navegador não envia a servidores.
  O app guarda o token no aparelho e tira do endereço.
- Toda chamada é validada no servidor: o link do avaliador só lê e grava **as próprias notas**, não acessa nada de admin
  e **nunca recebe email nem telefone** dos candidatos.
- Compartilhe as planilhas só com quem é admin. As abas de dados e de fórmulas são protegidas.
- Nenhum dado real fica no repositório: `referencia/` e arquivos de inscrição estão no `.gitignore`; testes e ensaio usam dados fictícios.
- Ao fim do processo: **Ensaio e dados → Apagar dados do processo** (digitar `APAGAR` + confirmação). Para eliminar também o
  histórico de versões, faça uma cópia da planilha já vazia e exclua a original (e esvazie a lixeira do Drive).

---

## Para quem programa

```
apps-script/src/        código do Apps Script (setup, fórmulas, API, ensaio)
apps-script/Codigo.gs   arquivo único gerado para colar no editor (npm run build:gas)
shared/                 regras de cálculo, texto e importação (usadas pelo app, pelo script e pelos testes)
web/                    site (Vite + Preact + TypeScript), PWA
tests/                  testes Node (node --test) e simulador dos serviços do Google
scripts/                build, servidor local, teste da API, teste de carga, validação da planilha
exemplos/               CSVs fictícios de inscrição para testar a importação
```

```bash
npm install
npm test                    # gera o Codigo.gs e roda 27 testes (cálculo, API, importação, setup)
npm run dev                 # site em http://localhost:5173
node scripts/servidor-local.mjs                      # API local (o mesmo Codigo.gs num simulador, dados fictícios em memória)
node scripts/testar-api.mjs URL TOKEN_ADMIN          # teste rápido da API publicada (não grava nada)
node scripts/teste-carga.mjs URL_ENSAIO TOKEN_ADMIN  # 15 avaliadores salvando ao mesmo tempo (só no ENSAIO)
```

Para rodar o site contra a API local, troque localmente (sem commitar) `ensaio:` em `web/public/config.js` por `'http://localhost:8787'`.

**O que os testes garantem:** a Tabela Geral do app bate com um cálculo independente (5 sorteios, com NA, notas editadas,
pesos, critério desligado, critério só de uma etapa, empate e candidatos fora do ranking); progresso igual; setup idempotente;
token inválido e permissões; avaliador A não lê nem grava como B; upsert sem duplicata e "vale a mais recente";
15 avaliadores com lotes embaralhados e reenvios; importação com duplicados e reimportação. As fórmulas também foram
validadas numa planilha real do Google Sheets (`scripts/planilha-teste.mjs` + `scripts/comparar-planilha.mjs`).

**Limites do Apps Script:** até 30 execuções simultâneas por dono do script. O app junta as notas em lotes e tenta de novo
com espera crescente; rode o `teste-carga.mjs` no ensaio para medir na sua conta.

**Fase 2 (não implementada, modelo pronto):** parecer Passa/Não passa, equipes do desafio, sabatina por grupo e entrevistas
com a diretoria entram como abas novas ligadas aos mesmos IDs de candidato, avaliador e etapa.
