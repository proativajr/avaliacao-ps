# Guia do admin

O painel do admin abre pelo link de admin (planilha → **PS Proativa → Mostrar link do admin**). Use no computador.

## Antes do processo

1. **Configuração → Processo:** nome, datas, nota de corte, vagas, mínimo de avaliadores por candidato e limite de divergência.
2. **Dinâmicas:** crie uma para cada momento avaliado (botão **+ Dinâmica** na aba **Ao vivo**, ou em **Configuração**).
   Cada dinâmica tem suas próprias notas.
3. **Configuração → Critérios:** textos, peso (padrão 1), ativo e em quais dinâmicas cada critério vale.
   O avaliador vê a primeira frase da descrição; o resto fica em "ver mais".
   Critério que já tem nota não pode ser apagado: desative.
4. **Avaliadores → Colar lista**, depois envie os links (**WhatsApp** ou **Copiar todos os links**).
   Junto com o link, mande o [guia do avaliador](guia-avaliador.md).
5. **Candidatos → Importar inscrições** com a planilha de respostas do Forms. Revise:
   - **Já importado / Possível duplicado:** escolha *Ignorar*, *Atualizar cadastro* ou *Criar mesmo assim*;
   - **Repetido no arquivo:** alguém se inscreveu duas vezes;
   - **Erro:** linha sem nome (não entra).
   O **nome de exibição** pode ser editado: é o que os avaliadores veem. Se dois candidatos têm o mesmo primeiro nome,
   o app mostra o sobrenome.

## Durante o processo

- **Ao vivo** (funciona no celular):
  1. Escolha a dinâmica no topo.
  2. Use **+** para criar as equipes (3, 4…).
  3. Toque no número da equipe ao lado de cada candidato presente, ou em **Sortear** para distribuir quem falta.
  4. Quando uma equipe apresentar, toque em **Avaliar agora**. Em até 10 segundos os celulares mostram só essa equipe.
     O cartão azul mostra quantos avaliadores já completaram cada membro. Depois, **Encerrar**.
- **Resultados:** ranking ao vivo (atualiza a cada 30 s), com filtro por dinâmica. Clique num candidato para ver
  a média por critério contra o grupo, as notas de cada avaliador e as observações.
- **Progresso dos avaliadores** (fim da página de Resultados): **Copiar lembrete** gera uma mensagem pronta para
  o WhatsApp de quem ainda tem pendências.
- **Faltou, desistiu, foi eliminado?** Em **Candidatos**, mude o status. Ele sai do ranking e da lista dos avaliadores,
  mas as notas já dadas ficam guardadas.
- **Avaliador perdeu o celular ou o link vazou?** **Avaliadores → Regerar link** (o antigo para de funcionar na hora).
- **Fechar a avaliação:** desmarque a dinâmica em **Configuração → Dinâmicas** (ou "Avaliação aberta" em Processo).
  O app fica somente leitura.

## Sinais para olhar

- **Dados insuficientes:** poucos avaliadores deram nota. Peça a mais gente para avaliar esse candidato.
- **Divergência:** os avaliadores discordam muito. Vale discutir na deliberação.
- **Calibracao** (na planilha): mostra quem dá notas muito acima ou abaixo da média e quem usa muito "não posso avaliar".

## Depois do processo

1. **Resultados → Exportar:** ranking e avaliações em CSV/XLSX, e **Backup completo**.
2. **Ensaio e dados → Apagar dados do processo** (digite `APAGAR`). Para apagar também o histórico de versões,
   faça uma cópia da planilha vazia, exclua a original e esvazie a lixeira do Drive.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| App mostra "Falta configurar o app" | O URL da API não está em `web/public/config.js`. |
| "Link inválido" | Token regerado ou avaliador desativado: envie o link novo. |
| Avaliador com Gmail não entra | No Apps Script, a implantação precisa estar como **Qualquer pessoa** (ver README). |
| Mudei critérios e o app não atualizou | O app atualiza em até 5 minutos, ou ao reabrir. |
| "Conferir cálculos" acusa diferença | Rode `setup` de novo pelo menu e confira de novo; se continuar, mande a mensagem ao responsável técnico. |
| Foto do candidato não aparece | O arquivo do Drive precisa estar compartilhado como "Qualquer pessoa com o link". A foto é opcional. |
