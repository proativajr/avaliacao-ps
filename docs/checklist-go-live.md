# Checklist de go-live · PS 2026.2

## Até 03/11: ensaio

- [ ] Planilha **ENSAIO** criada, `setup` rodado, menu **PS Proativa** aparece
- [ ] Web App publicado como **Qualquer pessoa**; o URL abre `{"ok":true,...}` no navegador
- [ ] Testado com um celular de conta **Gmail pessoal** (não só @proativaejr.com)
- [ ] Site publicado; `config.js` com o URL de `ensaio`; `url_app` preenchido na Config
- [ ] Link do admin abre o painel
- [ ] Importação testada com `exemplos/inscricoes-ficticias.csv` e reimportação com `inscricoes-ficticias-reimportar.csv` (só 1 nova)
- [ ] Dados fictícios gerados; **Conferir cálculos** = "Cálculos conferidos ✓"
- [ ] Ensaio com a equipe: cada membro abre o próprio link e avalia 3 candidatos
- [ ] Teste sem internet: modo avião → notas → fechar app → internet de volta → notas na aba Avaliacoes
- [ ] Votação: abrir para 2 candidatos e conferir o atalho nos celulares
- [ ] (Opcional) `node scripts/teste-carga.mjs` no ensaio: "OK: nenhuma perda e nenhuma duplicata"
- [ ] Ensaio zerado

## Até 06/11: produção

- [ ] Planilha **PRODUÇÃO** em branco, código colado, `setup` rodado
- [ ] Config: `modo` = **PRODUCAO**, `nome_processo`, datas, `url_app`, nota de corte, vagas, mínimo de avaliadores
- [ ] Etapas criadas; só a primeira etapa **aberta**
- [ ] Critérios revisados (textos, pesos, etapas)
- [ ] Web App de produção publicado como **Qualquer pessoa**; URL em `producao:` no `config.js`
- [ ] Link do admin de produção guardado em local seguro (não no grupo do WhatsApp)
- [ ] Avaliadores cadastrados na produção e **links novos** enviados com o guia do avaliador
- [ ] Cada avaliador confirmou que o link abre (coluna "Último acesso")
- [ ] Inscrições reais importadas; nomes de exibição revisados
- [ ] Planilha compartilhada **só** com admins
- [ ] Planilha de ensaio sem dados reais

## No dia (07/11)

- [ ] Abrir a etapa do dia; fechar as outras
- [ ] Ao fim de cada apresentação: **Votação → Abrir votação**
- [ ] Acompanhar **Progresso** e mandar lembretes
- [ ] Mudar status de quem faltou
- [ ] Fechar a etapa ao terminar

## Depois

- [ ] Exportar ranking e avaliações (CSV/XLSX) e backup
- [ ] Apagar dados do processo (LGPD) quando a seleção terminar
