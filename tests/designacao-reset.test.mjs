// Designação de avaliadores por equipe (admin.designarAvaliadores, regra da Apresentação) e reset do processo seletivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambienteGoogle } from './lib/mock-google.mjs';

function preparar({ candidatos = true } = {}) {
  const amb = ambienteGoogle();
  const { gas } = amb;
  gas.setup();
  const adm = amb.props.get('ADMIN_TOKEN');
  const chamar = (token, acao, dados) => JSON.parse(gas.doPost({ postData: { contents: JSON.stringify({ token, acao, dados }) } }).getContent());
  const ok = (token, acao, dados) => { const r = chamar(token, acao, dados); assert.equal(r.ok, true, acao + ': ' + r.erro); return r.dados; };
  const avs = ok(adm, 'admin.salvarAvaliadores', { lista: ['Um', 'Dois', 'Três', 'Quatro'].map((n) => ({ nome: 'Avaliador ' + n, area: 'Presidência Executiva' })) }).avaliadores;
  if (candidatos) ok(adm, 'admin.salvarCandidatos', { lista: ['Ana Um', 'Bruno Dois', 'Carla Três', 'Davi Quatro'].map((n) => ({ nome_exibicao: n })) });
  // Três equipes na Dinâmica 1 (etapa "geral")
  ok(adm, 'admin.salvarEquipes', { etapa: 'geral', equipes: [
    { nome: 'Equipe 1', membros: candidatos ? ['c001', 'c002'] : [] },
    { nome: 'Equipe 2', membros: candidatos ? ['c003'] : [] },
    { nome: 'Equipe 3', membros: candidatos ? ['c004'] : [] },
  ] });
  return { ...amb, adm, avs, chamar, ok };
}
const ids = (avs, ...i) => i.map((k) => avs[k].id);
const nota = (cand, crit, momento) => ({ etapa: 'geral', candidato_id: cand, criterio_id: crit, nota: 4, cliente_ts: Date.now(), ...(momento ? { momento } : {}) });

test('designar: 0, 1 e 3 avaliadores por equipe, sem candidatos cadastrados e sem mínimo nem máximo', () => {
  const { ok, adm, avs } = preparar({ candidatos: false });
  ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq2', avaliadores: ids(avs, 0) });
  const eq = ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq3', avaliadores: ids(avs, 0, 1, 2) }).equipes;
  assert.deepEqual(eq.map((q) => q.avaliadores), [[], ids(avs, 0), ids(avs, 0, 1, 2)]);
  // Os quatro avaliadores numa equipe só (sem teto) e o mesmo avaliador em várias equipes
  const todos = ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq1', avaliadores: ids(avs, 0, 1, 2, 3) }).equipes;
  assert.equal(todos[0].avaliadores.length, 4);
  assert.equal(todos.filter((q) => q.avaliadores.includes(avs[0].id)).length, 3);
  // Remover todos volta a zero
  const zero = ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq1', avaliadores: [] }).equipes;
  assert.deepEqual(zero[0].avaliadores, []);
});

test('designar: mexe só na equipe pedida; repetido conta uma vez; inexistente recusa tudo', () => {
  const { ok, chamar, adm, avs } = preparar();
  ok(adm, 'admin.construcao', { etapa: 'geral', equipe: 'geral_eq2', estado: '' });
  const antes = ok(adm, 'admin.iniciar').equipes;
  const eq = ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq1', avaliadores: [avs[1].id, avs[1].id] }).equipes;
  assert.deepEqual(eq[0].avaliadores, [avs[1].id]);
  assert.deepEqual(eq[0].membros, antes[0].membros, 'membros intactos');
  assert.deepEqual(eq.slice(1), antes.slice(1), 'outras equipes intactas');
  const r = chamar(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq1', avaliadores: [avs[2].id, 'a999'] });
  assert.equal(r.ok, false);
  assert.deepEqual(ok(adm, 'admin.iniciar').equipes[0].avaliadores, [avs[1].id], 'nada gravado pela metade');
  assert.equal(chamar(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq9', avaliadores: [] }).ok, false);
  assert.equal(chamar(avs[0].token, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq1', avaliadores: [] }).codigo, 'SEM_PERMISSAO');
});

test('designação sobrevive a mudanças de membros feitas em "Montar equipes"', () => {
  const { ok, adm, avs } = preparar();
  ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq1', avaliadores: ids(avs, 0, 1) });
  const eq = ok(adm, 'admin.salvarEquipes', { etapa: 'geral', equipes: [
    { nome: 'Equipe 1', membros: ['c001'] }, { nome: 'Equipe 2', membros: ['c002', 'c003'] }, { nome: 'Equipe 3', membros: ['c004'] },
  ] }).equipes;
  assert.deepEqual(eq[0].avaliadores, ids(avs, 0, 1));
});

test('quem pode avaliar: Construção só designados; Apresentação todos, ou só designados com a regra ligada', () => {
  const { ok, adm, avs } = preparar();
  ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq1', avaliadores: ids(avs, 0) });
  ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq2', avaliadores: ids(avs, 1, 2) });
  const crit = ok(adm, 'admin.iniciar').criterios[0].id;
  const salvar = (k, n) => ok(avs[k].token, 'av.salvar', { notas: [n] });

  // Construção: só os designados
  assert.equal(salvar(0, nota('c001', crit, 'construcao')).salvos.length, 1);
  assert.equal(salvar(1, nota('c001', crit, 'construcao')).recusados.length, 1);
  // Apresentação com a regra desligada (padrão): todos
  assert.equal(ok(adm, 'admin.iniciar').config.apresentacao_so_designados, 'NÃO');
  assert.equal(salvar(1, nota('c001', crit)).salvos.length, 1);

  ok(adm, 'admin.salvarConfig', { config: { apresentacao_so_designados: 'SIM' } });
  assert.equal(salvar(0, nota('c001', crit)).salvos.length, 1, 'designado avalia');
  const rec = salvar(3, nota('c001', crit)).recusados;
  assert.equal(rec.length, 1, 'não designado é recusado');
  assert.match(rec[0].motivo, /designados/);
  assert.equal(salvar(3, nota('c003', crit)).recusados.length, 1);
  assert.equal(salvar(2, nota('c003', crit)).salvos.length, 1, 'avaliador em outra equipe também avalia a dele');
  // Equipe 3 sem avaliadores: ninguém avalia (o admin vê o aviso), mas o resto do app segue
  assert.equal(salvar(0, nota('c004', crit)).recusados.length, 1);
  // O celular recebe só o recorte: quem ele NÃO pode avaliar, sem a lista de designados
  const s = ok(avs[3].token, 'av.sincronizar');
  assert.equal(s.apresentacao_so_designados, true);
  assert.deepEqual(s.fora_da_equipe.geral.sort(), ['c001', 'c002', 'c003', 'c004']);
  assert.deepEqual(ok(avs[0].token, 'av.sincronizar').fora_da_equipe.geral.sort(), ['c003', 'c004']);
  const txt = JSON.stringify(ok(avs[0].token, 'av.iniciar'));
  assert.ok(!txt.includes('"avaliadores"') && !txt.includes('equipes_designacao'));
  // Candidato sem equipe nesta dinâmica continua livre
  ok(adm, 'admin.salvarEquipes', { etapa: 'geral', equipes: [{ nome: 'Equipe 1', membros: ['c001'] }, { nome: 'Equipe 2', membros: ['c003'] }, { nome: 'Equipe 3', membros: ['c004'] }] });
  assert.equal(salvar(3, nota('c002', crit)).salvos.length, 1);
});

test('reset: apaga candidatos e o que deriva deles; mantém avaliadores, equipes, designações, config e critérios', () => {
  const { ok, chamar, adm, avs } = preparar();
  ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq1', avaliadores: [] });
  ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq2', avaliadores: ids(avs, 0) });
  ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq3', avaliadores: ids(avs, 0, 1, 2) });
  ok(adm, 'admin.salvarConfig', { config: { nome_processo: 'PS teste', nota_de_corte: 3 } });
  const crit = ok(adm, 'admin.iniciar').criterios[0].id;
  ok(adm, 'admin.construcao', { etapa: 'geral', equipe: 'geral_eq3', estado: 'ANDAMENTO' });
  ok(avs[0].token, 'av.salvar', { notas: [nota('c004', crit, 'construcao'), nota('c004', crit)], observacoes: [{ etapa: 'geral', candidato_id: 'c004', texto: 'ok', cliente_ts: 1 }] });
  ok(adm, 'admin.aoVivo', { etapa: 'geral', equipe: 'geral_eq3' });
  ok(adm, 'admin.importarCandidatos', { lote: { origem: 'arquivo', nome_arquivo: 'x.csv' }, linhas: [{ acao: 'criar', hash: 'h1', dados: { nome_exibicao: 'Eva Cinco', foto_url: 'https://drive.google.com/open?id=abc' }, original: { Nome: 'Eva Cinco' } }] });
  const antes = ok(adm, 'admin.iniciar');

  const resumo = ok(adm, 'admin.resumoReset');
  assert.equal(resumo.apaga.candidatos, 5);
  assert.equal(resumo.mantem.designacoes, 4);

  // Sem a palavra de confirmação, nada acontece
  assert.equal(chamar(adm, 'admin.resetarProcesso', {}).ok, false);
  assert.equal(chamar(adm, 'admin.resetarProcesso', { confirmacao: 'resetar' }).ok, false);
  assert.equal(ok(adm, 'admin.iniciar').candidatos.length, 5);

  ok(adm, 'admin.resetarProcesso', { confirmacao: 'RESETAR' });
  const d = ok(adm, 'admin.iniciar');
  assert.equal(d.candidatos.length, 0);
  assert.equal(d.avaliacoes.length, 0);
  assert.equal(d.observacoes.length, 0);
  assert.equal(d.inscricoes.length, 0);
  assert.equal(d.importacoes.length, 0);
  assert.deepEqual(d.avaliadores.map((a) => [a.id, a.token]), antes.avaliadores.map((a) => [a.id, a.token]), 'avaliadores e links mantidos');
  assert.deepEqual(d.equipes.map((q) => [q.id, q.nome, q.avaliadores]), antes.equipes.map((q) => [q.id, q.nome, q.avaliadores]), 'equipes e designações mantidas');
  assert.ok(d.equipes.every((q) => !q.membros.length && q.construcao === '' && q.apresentacao === ''), 'equipes vazias e momentos zerados');
  assert.deepEqual(d.criterios, antes.criterios, 'critérios (inclusive PREDADOR) mantidos');
  assert.deepEqual(d.blocos, antes.blocos);
  assert.deepEqual(d.etapas, antes.etapas);
  assert.equal(d.config.nome_processo, 'PS teste');
  assert.equal(d.config.nota_de_corte, 3);
  assert.equal(d.config.equipe_ativa, '');
  assert.equal(d.config.em_votacao, '');
  assert.equal(d.config.dinamica_ativa, '');

  // O link do avaliador continua valendo; a fila antiga do celular é recusada (candidato não existe mais)
  const s = ok(avs[0].token, 'av.iniciar');
  assert.equal(s.candidatos.length, 0);
  assert.equal(ok(avs[0].token, 'av.salvar', { notas: [nota('c004', crit)] }).recusados.length, 1);

  // Reimportar a mesma planilha cria os candidatos de novo (o hash antigo não bloqueia) e com IDs novos
  const imp = ok(adm, 'admin.importarCandidatos', { lote: { origem: 'arquivo', nome_arquivo: 'x.csv' }, linhas: [{ acao: 'criar', hash: 'h1', dados: { nome_exibicao: 'Eva Cinco', foto_url: 'https://drive.google.com/open?id=abc' }, original: { Nome: 'Eva Cinco' } }] });
  assert.equal(imp.criados, 1);
  assert.equal(imp.candidatos[0].foto_url, 'https://drive.google.com/open?id=abc', 'foto continua vindo da importação');
  assert.ok(!antes.candidatos.some((c) => c.id === imp.candidatos[0].id), 'ID não reaproveitado');
});

test('reset é tudo ou nada: se uma etapa falhar, as abas voltam ao que eram', () => {
  const { ok, chamar, adm, avs, gas } = preparar();
  ok(adm, 'admin.designarAvaliadores', { etapa: 'geral', equipe: 'geral_eq1', avaliadores: ids(avs, 0, 1) });
  ok(adm, 'admin.aoVivo', { etapa: 'geral', equipe: 'geral_eq1' });
  const antes = ok(adm, 'admin.iniciar');
  // Falha simulada no meio: depois de apagar as abas, a gravação das equipes quebra
  const original = gas.reescrever_;
  gas.reescrever_ = (aba, objs) => { if (aba === 'Equipes') throw new Error('falha simulada'); return original(aba, objs); };
  let erro = null;
  try { gas.resetarProcesso_(); } catch (e) { erro = e; }
  gas.reescrever_ = original;
  assert.ok(erro, 'o erro chega a quem chamou');
  const depois = ok(adm, 'admin.iniciar');
  assert.deepEqual(depois.candidatos.map((c) => c.id), antes.candidatos.map((c) => c.id));
  assert.deepEqual(depois.equipes, antes.equipes);
  assert.equal(depois.config.equipe_ativa, 'geral_eq1');
  assert.equal(chamar(adm, 'admin.iniciar').ok, true);
});
