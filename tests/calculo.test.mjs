// O cálculo do app (shared/calc.js) tem que bater com o cálculo independente, em vários sorteios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularResultados, calcularProgresso } from '../shared/calc.js';
import { carregarGas } from './lib/gas.mjs';
import { gerarFixture } from './lib/fixture.mjs';
import { tabelaGeralIndependente, progressoIndependente } from './lib/independente.mjs';

const gas = carregarGas();
const perto = (a, b) => (a == null || b == null ? a == b : Math.abs(a - b) < 1e-9);

for (const semente of [1, 7, 42, 99, 2026]) {
  test(`Tabela Geral = cálculo independente (semente ${semente})`, () => {
    const fx = gerarFixture(gas, semente);
    for (const etapa of ['*', 'geral', 'dia2']) {
      const base = { candidatos: fx.candidatos, criterios: fx.criterios, blocos: fx.blocos, avaliacoes: fx.avaliacoes, config: fx.config, etapa };
      const app = calcularResultados(base).linhas;
      const ind = tabelaGeralIndependente(base);
      assert.equal(app.length, ind.length);
      for (const e of ind) {
        const a = app.find((x) => x.id === e.id);
        assert.ok(perto(a.media, e.media), `${e.id} média`);
        assert.equal(a.ranking, e.ranking, `${e.id} ranking`);
        assert.equal(a.nAvaliadores, e.nAvaliadores, `${e.id} nº avaliadores`);
        assert.ok(perto(a.desvio, e.desvio), `${e.id} desvio`);
        assert.equal(a.situacao, e.situacao, `${e.id} situação`);
        assert.equal(a.alertas.join(' · '), e.alertas, `${e.id} alertas`);
        for (const k of Object.keys(e.porCriterio)) assert.ok(perto(a.porCriterio[k], e.porCriterio[k]), `${e.id} ${k}`);
      }
    }
    const prog = calcularProgresso({ avaliadores: fx.avaliadores, candidatos: fx.candidatos, criterios: fx.criterios, blocos: fx.blocos, avaliacoes: fx.avaliacoes, etapa: 'geral' });
    const progInd = progressoIndependente({ avaliadores: fx.avaliadores, candidatos: fx.candidatos, criterios: fx.criterios, blocos: fx.blocos, avaliacoes: fx.avaliacoes, etapa: 'geral' });
    for (const p of progInd) {
      const a = prog.find((x) => x.id === p.id);
      assert.deepEqual([a.completos, a.parciais, a.pendentes], [p.completos, p.parciais, p.pendentes]);
    }
  });
}

test('casos conhecidos: NA ignorado, peso, empate e fora do ranking', () => {
  const criterios = [
    { id: 'k1', bloco: 'b', ordem: 1, ativo: 'SIM', peso: 1 },
    { id: 'k2', bloco: 'b', ordem: 2, ativo: 'SIM', peso: 3 },
  ];
  const blocos = [{ id: 'b', ordem: 1, ativo: 'SIM' }];
  const candidatos = [{ id: 'c1', nome: 'A', status: 'ATIVO' }, { id: 'c2', nome: 'B', status: 'ATIVO' }, { id: 'c3', nome: 'C', status: 'FALTOU' }, { id: 'c4', nome: 'D', status: 'ATIVO' }];
  const n = (av, c, k, nota) => ({ etapa: 'geral', avaliador_id: av, candidato_id: c, criterio_id: k, nota });
  const avaliacoes = [
    n('a1', 'c1', 'k1', 5), n('a2', 'c1', 'k1', 'NA'), n('a1', 'c1', 'k2', 3), // c1: k1=5, k2=3 -> (5+9)/4 = 3.5
    n('a1', 'c2', 'k1', 2), n('a1', 'c2', 'k2', 4),                           // c2: (2+12)/4 = 3.5 (empate com c1)
    n('a1', 'c3', 'k1', 5), n('a1', 'c3', 'k2', 5),                           // c3: 5, mas FALTOU
    n('a1', 'c4', 'k1', 'NA'), n('a1', 'c4', 'k2', 'NA'),                     // c4: só NA
  ];
  const r = calcularResultados({ candidatos, criterios, blocos, avaliacoes, etapa: '*', config: { nota_de_corte: 3, vagas: 1 } }).linhas;
  const por = Object.fromEntries(r.map((l) => [l.id, l]));
  assert.equal(por.c1.media, 3.5);
  assert.equal(por.c2.media, 3.5);
  assert.equal(por.c1.ranking, 1);
  assert.equal(por.c2.ranking, 1, 'empate divide a posição');
  assert.equal(por.c3.ranking, null, 'FALTOU fica fora do ranking');
  assert.equal(por.c3.situacao, 'Fora do ranking');
  assert.equal(por.c4.media, null);
  assert.equal(por.c4.situacao, 'Sem notas');
  assert.equal(por.c1.situacao, 'Classificado');
});
