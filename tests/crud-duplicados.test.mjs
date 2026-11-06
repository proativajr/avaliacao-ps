// Envio duplicado no CRUD do admin: o mesmo pedido chegando duas vezes (clique duplo, nova tentativa) não pode duplicar registros.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambienteGoogle } from './lib/mock-google.mjs';

function preparar() {
  const amb = ambienteGoogle();
  const { gas } = amb;
  gas.setup();
  const adm = amb.props.get('ADMIN_TOKEN');
  const chamar = (acao, dados) => JSON.parse(gas.doPost({ postData: { contents: JSON.stringify({ token: adm, acao, dados }) } }).getContent());
  const ok = (acao, dados) => { const r = chamar(acao, dados); assert.equal(r.ok, true, acao + ': ' + r.erro); return r.dados; };
  const avs = () => gas.lerObjetos_(gas.ABAS.AVALIADORES);
  const cands = () => gas.lerObjetos_(gas.ABAS.CANDIDATOS);
  return { ...amb, chamar, ok, avs, cands };
}

test('avaliador: o mesmo "Adicionar" duas vezes cria um só e o segundo recebe CONFLITO', () => {
  const { chamar, ok, avs } = preparar();
  const item = { nome: 'Maria Teste', email: 'maria@x.com', area: 'Projetos' };
  ok('admin.salvarAvaliadores', { lista: [item] });
  const r = chamar('admin.salvarAvaliadores', { lista: [item] });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'CONFLITO');
  assert.match(r.erro, /Maria Teste \(a001\)/);
  assert.equal(avs().length, 1);
});

test('avaliador: nome sem acento e caixa diferente, ou email igual, também é repetido; desativado também', () => {
  const { chamar, ok, avs } = preparar();
  ok('admin.salvarAvaliadores', { lista: [{ nome: 'José Antônio', email: 'jose@x.com', area: 'Comercial' }] });
  assert.equal(chamar('admin.salvarAvaliadores', { lista: [{ nome: '  jose   antonio ', area: 'Comercial' }] }).codigo, 'CONFLITO');
  assert.equal(chamar('admin.salvarAvaliadores', { lista: [{ nome: 'Outro Nome', email: 'JOSE@x.com', area: 'Comercial' }] }).codigo, 'CONFLITO');
  ok('admin.salvarAvaliadores', { lista: [{ id: 'a001', ativo: 'NÃO' }] });
  const r = chamar('admin.salvarAvaliadores', { lista: [{ nome: 'José Antônio', area: 'Comercial' }] });
  assert.equal(r.codigo, 'CONFLITO');
  assert.match(r.erro, /Reativar/);
  assert.equal(avs().length, 1);
});

test('avaliador: lista colada duas vezes não duplica; repetidos são pulados e informados', () => {
  const { ok, avs } = preparar();
  const lista = [{ nome: 'Ana', area: 'Projetos' }, { nome: 'Bia', area: 'Projetos' }, { nome: 'ana', area: 'Projetos' }];
  const r1 = ok('admin.salvarAvaliadores', { lista, pularRepetidos: true });
  assert.deepEqual(r1.criados, ['a001', 'a002']);
  assert.equal(r1.repetidos.length, 1, 'o "ana" repetido na mesma lista');
  const r2 = ok('admin.salvarAvaliadores', { lista, pularRepetidos: true });
  assert.deepEqual(r2.criados, []);
  assert.equal(r2.repetidos.length, 3);
  assert.equal(avs().length, 2);
});

test('avaliador: editar sem mudar nome nem email passa, mesmo com duplicado antigo; mudar para um nome usado é recusado', () => {
  const { chamar, ok, avs, gas } = preparar();
  ok('admin.salvarAvaliadores', { lista: [{ nome: 'Caio', area: 'Projetos' }, { nome: 'Davi', area: 'Projetos' }] });
  // Duplicado antigo gravado direto na planilha (como os que já podem existir)
  gas.acrescentar_(gas.ABAS.AVALIADORES, [{ id: 'a003', nome: 'Caio', email: '', area: 'Projetos', token: 'x'.repeat(43), ativo: 'SIM' }]);
  ok('admin.salvarAvaliadores', { lista: [{ id: 'a003', area: 'Comercial' }] });
  ok('admin.salvarAvaliadores', { lista: [{ id: 'a003', ativo: 'NÃO' }] });
  assert.equal(chamar('admin.salvarAvaliadores', { lista: [{ id: 'a002', nome: 'caio' }] }).codigo, 'CONFLITO');
  ok('admin.salvarAvaliadores', { lista: [{ id: 'a002', nome: 'Davi Souza' }] });
  assert.equal(avs().length, 3, 'nada apagado');
});

test('candidato à mão: email repetido recusado, nome repetido permitido', () => {
  const { chamar, ok, cands } = preparar();
  ok('admin.salvarCandidatos', { lista: [{ nome_exibicao: 'Ana Cand', email: 'ana@x.com' }] });
  const r = chamar('admin.salvarCandidatos', { lista: [{ nome_exibicao: 'Ana Cand', email: 'ANA@x.com' }] });
  assert.equal(r.codigo, 'CONFLITO');
  assert.match(r.erro, /Ana Cand \(c001\)/);
  ok('admin.salvarCandidatos', { lista: [{ nome_exibicao: 'Ana Cand' }] });
  ok('admin.salvarCandidatos', { lista: [{ nome_exibicao: 'Bruno', email: 'bruno@x.com' }] });
  assert.equal(chamar('admin.salvarCandidatos', { lista: [{ id: 'c003', email: 'ana@x.com' }] }).codigo, 'CONFLITO');
  ok('admin.salvarCandidatos', { lista: [{ id: 'c001', status: 'FALTOU', email: 'ana@x.com' }] }, 'o próprio email não conflita');
  assert.equal(cands().length, 3);
});

test('importação: o mesmo envio duas vezes (mesmo com "criar mesmo assim") grava uma vez só', () => {
  const { ok, cands, gas } = preparar();
  const pedido = { envio: 'env-123', lote: { origem: 'colagem' }, linhas: [{ acao: 'criar', forcar: true, hash: 'h1', dados: { nome_exibicao: 'Bia Forçada' }, original: {} }] };
  const r1 = ok('admin.importarCandidatos', pedido);
  const r2 = ok('admin.importarCandidatos', pedido);
  assert.equal(r1.criados, 1);
  assert.equal(r2.repetido, true);
  assert.equal(r2.lote_id, r1.lote_id);
  assert.equal(cands().length, 1);
  assert.equal(gas.lerObjetos_(gas.ABAS.IMPORTACOES).length, 1);
  // Envio novo (outra importação de propósito) continua podendo forçar
  ok('admin.importarCandidatos', { ...pedido, envio: 'env-456' });
  assert.equal(cands().length, 2);
});

test('verificar duplicados: lista os existentes e não apaga nada', () => {
  const { ok, gas, avs } = preparar();
  ok('admin.salvarAvaliadores', { lista: [{ nome: 'Eva', email: 'eva@x.com', area: 'Projetos' }] });
  gas.acrescentar_(gas.ABAS.AVALIADORES, [{ id: 'a002', nome: 'eva', email: '', area: 'Projetos', token: 'y'.repeat(43), ativo: 'NÃO' }]);
  ok('admin.salvarCandidatos', { lista: [{ nome_exibicao: 'Cand 1', email: 'c@x.com' }] });
  gas.acrescentar_(gas.ABAS.CANDIDATOS, [{ id: 'c002', nome_exibicao: 'Cand 2', email: 'c@x.com', status: 'ATIVO' }]);
  const r = ok('admin.duplicados');
  assert.deepEqual(r.avaliadores.map((g) => [g.campo, g.ids]), [['nome', ['a001', 'a002']]]);
  assert.match(r.avaliadores[0].nomes[1], /desativado/);
  assert.deepEqual(r.candidatos.map((g) => [g.campo, g.ids]), [['email', ['c001', 'c002']]]);
  assert.equal(avs().length, 2);
  gas.menuVerificarDuplicados(); // roda sem erro pelo menu
});
