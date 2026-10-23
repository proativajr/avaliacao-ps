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
