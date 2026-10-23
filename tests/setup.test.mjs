// Testa o setup() e o modo ensaio no simulador do Google.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambienteGoogle } from './lib/mock-google.mjs';

test('setup cria todas as abas, cabeçalhos e critérios, e é idempotente', () => {
  const { gas, planilha, props } = ambienteGoogle();
  gas.setup();
  const nomes = planilha.getSheets().map((a) => a.getName());
  assert.deepEqual(nomes, [...gas.ORDEM_ABAS], 'abas na ordem certa e sem a "Página1"');
  assert.equal(planilha.getSheetByName('_Aux').oculta, true);
  const crit = gas.lerObjetos_('Config_Criterios');
  assert.equal(crit.length, 14);
  assert.equal(crit.filter((c) => c.sigla === 'D').length, 2, 'duas siglas D no PREDADOR');
  assert.equal(new Set(crit.map((c) => c.id)).size, 14, 'IDs únicos');
  assert.ok(props.get('ADMIN_TOKEN').length >= 40, 'token de admin longo');
  // Rodar de novo não duplica nada
  gas.gravarConfig_('nota_de_corte', 3.5);
  gas.setup();
  assert.equal(gas.lerObjetos_('Config_Criterios').length, 14);
  assert.equal(gas.lerObjetos_('Config').length, gas.CONFIG_PADRAO.length);
  assert.equal(gas.lerConfig_().nota_de_corte, 3.5, 'setup não sobrescreve configuração editada');
  assert.equal(gas.lerObjetos_('Config_Etapas').length, 1);
  // Começa vazio: nenhum candidato, avaliador ou nota
  for (const aba of ['Candidatos', 'Avaliadores', 'Avaliacoes', 'Observacoes', 'Inscricoes_Original']) {
    assert.equal(gas.lerObjetos_(aba).length, 0, aba + ' começa vazia');
  }
  // Fórmulas escritas
  assert.match(planilha.getSheetByName('Tabela Geral').getRange('A5').getFormula(), /MAKEARRAY/);
});

test('dados fictícios só no ENSAIO, com IDs que nunca se repetem; zerar mantém configuração', () => {
  const { gas } = ambienteGoogle();
  gas.setup();
  const r = gas.gerarDadosFicticios_(20, 6);
  assert.equal(r.candidatos, 20);
  assert.equal(r.avaliadores, 6);
  const cands = gas.lerObjetos_('Candidatos');
  assert.equal(cands[0].id, 'c001');
  const av = gas.lerObjetos_('Avaliacoes');
  assert.ok(av.length > 100);
  assert.ok(av.some((a) => a.nota === 'NA'), 'tem NA');
  assert.equal(new Set(av.map((a) => a.chave)).size, av.length, 'nenhuma chave duplicada');
  const tokens = gas.lerObjetos_('Avaliadores').map((a) => a.token);
  assert.equal(new Set(tokens).size, tokens.length, 'tokens únicos');
  gas.gerarDadosFicticios_(5, 1);
  assert.equal(gas.lerObjetos_('Candidatos').at(-1).id, 'c025', 'continua a sequência');

  gas.apagarDados_(true);
  assert.equal(gas.lerObjetos_('Candidatos').length, 0);
  assert.equal(gas.lerObjetos_('Config_Criterios').length, 14);

  gas.gravarConfig_('modo', 'PRODUCAO');
  assert.throws(() => gas.gerarDadosFicticios_(3, 1), /ENSAIO/);
});

test('IDs não são reutilizados mesmo depois de apagar a linha', () => {
  const { gas } = ambienteGoogle();
  gas.setup();
  assert.deepEqual([...gas.proximosIds_('c', 'Candidatos', 2)], ['c001', 'c002']);
  assert.deepEqual([...gas.proximosIds_('c', 'Candidatos', 1)], ['c003']);
});
