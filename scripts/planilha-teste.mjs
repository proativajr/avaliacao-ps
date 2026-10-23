// Gera o "pacote" para montar uma planilha de teste via API (sem Apps Script):
// valores das abas de dados + rótulos + fórmulas exatamente como o setup() escreve.
// Também calcula o resultado esperado (cálculo independente) para comparar depois.
import { writeFileSync } from 'node:fs';
import { carregarGas } from '../tests/lib/gas.mjs';
import { gerarFixture } from '../tests/lib/fixture.mjs';
import { tabelaGeralIndependente, progressoIndependente } from '../tests/lib/independente.mjs';

const gas = carregarGas();
const fx = gerarFixture(gas, 42, { reduzido: true });
const C = gas.CABECALHOS;
const linhas = (aba, objs) => [C[aba], ...objs.map((o) => C[aba].map((c) => (o[c] ?? '')))];
const agora = '2026-10-23T12:00:00';
const dados = {
  Config: [C.Config, ...Object.entries(fx.config).map(([k, v]) => [k, v, ''])],
  Config_Etapas: linhas('Config_Etapas', fx.etapas),
  Config_Blocos: linhas('Config_Blocos', fx.blocos),
  Config_Criterios: linhas('Config_Criterios', fx.criterios),
  Avaliadores: linhas('Avaliadores', fx.avaliadores.map((a) => ({ ...a, token: 'tok-' + a.id, ativo: 'SIM', criado_em: agora }))),
  Candidatos: linhas('Candidatos', fx.candidatos.map((c) => ({ id: c.id, nome_exibicao: c.nome, status: c.status, origem: 'manual' }))),
  Avaliacoes: linhas('Avaliacoes', fx.avaliacoes.map((a) => ({ chave: [a.etapa, a.avaliador_id, a.candidato_id, a.criterio_id].join('|'), ...a, atualizado_em: agora, cliente_ts: 1 }))),
  Observacoes: linhas('Observacoes', fx.observacoes.map((o) => ({ chave: [o.etapa, o.avaliador_id, o.candidato_id].join('|'), ...o, atualizado_em: agora }))),
};
const formulas = gas.formulasDasAbas().map((f) => ({ ...f }));
const rotulos = gas.rotulosDasAbas().map((r) => ({ aba: r.aba, celula: r.celula, valores: r.valores }));
const base = { candidatos: fx.candidatos, criterios: fx.criterios, blocos: fx.blocos, avaliacoes: fx.avaliacoes, config: fx.config };
const esperado = {
  Todas: tabelaGeralIndependente({ ...base, etapa: '*' }),
  Geral: tabelaGeralIndependente({ ...base, etapa: 'geral' }),
  'Dia 2': tabelaGeralIndependente({ ...base, etapa: 'dia2' }),
  progresso_geral: progressoIndependente({ ...base, avaliadores: fx.avaliadores, etapa: 'geral' }),
};
const saida = process.argv[2] || 'pacote-planilha.json';
writeFileSync(saida, JSON.stringify({ abas: gas.ORDEM_ABAS, dados, rotulos, formulas, esperado }, null, 1));
console.log('pacote salvo em', saida, '| avaliações:', fx.avaliacoes.length, '| fórmulas:', formulas.length);
