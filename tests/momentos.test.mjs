// Avaliadores por equipe e dois momentos (Construção e Apresentação) nas dinâmicas em equipe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambienteGoogle } from './lib/mock-google.mjs';
import { calcularResultados, calcularProgresso } from '../shared/calc.js';

function preparar() {
  const amb = ambienteGoogle();
  const { gas } = amb;
  gas.setup();
  const adm = amb.props.get('ADMIN_TOKEN');
  const chamar = (token, acao, dados) => JSON.parse(gas.doPost({ postData: { contents: JSON.stringify({ token, acao, dados }) } }).getContent());
  const ok = (token, acao, dados) => { const r = chamar(token, acao, dados); assert.equal(r.ok, true, acao + ': ' + r.erro); return r.dados; };
  const avs = ok(adm, 'admin.salvarAvaliadores', { lista: [{ nome: 'Avaliadora Um' }, { nome: 'Avaliador Dois' }, { nome: 'Avaliador Três' }] }).avaliadores;
  ok(adm, 'admin.salvarCandidatos', { lista: ['Ana Um', 'Bruno Dois', 'Carla Três', 'Davi Quatro'].map((n) => ({ nome_exibicao: n })) });
  ok(adm, 'admin.salvarEtapas', { lista: [{ nome: 'Dinâmica 2', ordem: 2, aberta: 'SIM' }] });
  ok(adm, 'admin.salvarEquipes', { etapa: 'dinamica_2', equipes: [
    { nome: 'Equipe 1', membros: ['c001', 'c002'], avaliadores: [avs[0].id, avs[1].id] },
    { nome: 'Equipe 2', membros: ['c003', 'c004'], avaliadores: [avs[2].id] },
  ] });
  return { ...amb, adm, avs, tA: avs[0].token, tB: avs[1].token, tC: avs[2].token, chamar, ok };
}
const nota = (cand, crit, n, momento, ts = 1) => ({ etapa: 'dinamica_2', candidato_id: cand, criterio_id: crit, nota: n, cliente_ts: ts, ...(momento ? { momento } : {}) });

test('designação: admin escolhe avaliadores da equipe; ids inválidos somem e editar mantém o estado dos momentos', () => {
  const { ok, adm, avs } = preparar();
  let eq = ok(adm, 'admin.iniciar').equipes;
  assert.deepEqual(eq.map((q) => q.avaliadores), [[avs[0].id, avs[1].id], [avs[2].id]]);
  ok(adm, 'admin.construcao', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq1', estado: 'ANDAMENTO' });
  eq = ok(adm, 'admin.salvarEquipes', { etapa: 'dinamica_2', equipes: [
    { nome: 'Equipe 1', membros: ['c001', 'c002'], avaliadores: [avs[0].id, 'a999', avs[0].id] },
    { nome: 'Equipe 2', membros: ['c003', 'c004'] }, // sem "avaliadores": mantém os atuais
  ] }).equipes;
  assert.deepEqual(eq[0].avaliadores, [avs[0].id], 'duplicado e inexistente descartados');
  assert.deepEqual(eq[1].avaliadores, [avs[2].id]);
  assert.equal(eq[0].construcao, 'ANDAMENTO', 'estado preservado');
});

test('construção exige ao menos um avaliador e só o admin controla', () => {
  const { ok, chamar, adm, tA } = preparar();
  ok(adm, 'admin.salvarEquipes', { etapa: 'dinamica_2', equipes: [{ nome: 'Equipe 1', membros: ['c001'], avaliadores: [] }] });
  assert.equal(chamar(adm, 'admin.construcao', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq1', estado: 'ANDAMENTO' }).ok, false);
  assert.equal(chamar(tA, 'admin.construcao', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq1', estado: 'ANDAMENTO' }).codigo, 'SEM_PERMISSAO');
  assert.equal(chamar(adm, 'admin.construcao', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq9', estado: 'ANDAMENTO' }).ok, false);
});

test('visibilidade: na construção cada avaliador vê só as equipes designadas; na apresentação todos veem a da vez', () => {
  const { ok, adm, tA, tB, tC } = preparar();
  ok(adm, 'admin.construcao', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq1', estado: 'ANDAMENTO' });
  ok(adm, 'admin.construcao', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq2', estado: 'ANDAMENTO' });
  const ids = (t) => ok(t, 'av.sincronizar').construcao.map((q) => q.id);
  assert.deepEqual(ids(tA), ['dinamica_2_eq1']);
  assert.deepEqual(ids(tB), ['dinamica_2_eq1']);
  assert.deepEqual(ids(tC), ['dinamica_2_eq2']);
  assert.equal(ok(tC, 'av.sincronizar').dinamica_ativa, 'dinamica_2');
  // nada vaza: nem a lista de designados nem a de outras equipes
  for (const t of [tA, tC]) {
    const txt = JSON.stringify(ok(t, 'av.iniciar'));
    assert.ok(!txt.includes('equipes_construcao') && !txt.includes('"avaliadores"'));
  }
  assert.deepEqual(ok(tC, 'av.iniciar').construcao.map((q) => q.membros), [['c003', 'c004']]);
  // concluir a construção tira a equipe do celular
  ok(adm, 'admin.construcao', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq1', estado: 'CONCLUIDO' });
  assert.deepEqual(ids(tA), []);
  // apresentação: todos veem a mesma equipe
  ok(adm, 'admin.aoVivo', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq1' });
  for (const t of [tA, tB, tC]) assert.deepEqual(ok(t, 'av.sincronizar').equipe.membros, ['c001', 'c002']);
  // ao trocar de equipe, a anterior fica concluída na apresentação
  ok(adm, 'admin.aoVivo', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq2' });
  const eq = ok(adm, 'admin.iniciar').equipes;
  assert.deepEqual(eq.map((q) => q.apresentacao), ['CONCLUIDO', 'ANDAMENTO']);
});

test('gravação separada: construção e apresentação não se sobrescrevem; só designado grava construção', () => {
  const { ok, gas, adm, tA, tC } = preparar();
  const r = ok(tA, 'av.salvar', { notas: [nota('c001', 'valores_rede', 2, 'construcao'), nota('c001', 'valores_rede', 5, '', 5)],
    observacoes: [{ etapa: 'dinamica_2', candidato_id: 'c001', texto: 'construindo', cliente_ts: 1, momento: 'construcao' }, { etapa: 'dinamica_2', candidato_id: 'c001', texto: 'apresentando', cliente_ts: 1 }] });
  assert.deepEqual(r.recusados, []);
  assert.deepEqual(r.salvos.sort(), ['dinamica_2|a001|c001|valores_rede', 'dinamica_2|a001|c001|valores_rede|construcao', 'obs:dinamica_2|a001|c001', 'obs:dinamica_2|a001|c001|construcao'].sort());
  const linhas = gas.lerObjetos_('Avaliacoes');
  assert.equal(linhas.length, 2);
  assert.deepEqual([...linhas.map((l) => l.momento)].sort(), ['', 'construcao']);
  assert.equal(gas.lerObjetos_('Observacoes').length, 2);
  // reenviar não duplica e a mais nova de cada momento vence separadamente
  ok(tA, 'av.salvar', { notas: [nota('c001', 'valores_rede', 3, 'construcao', 9), nota('c001', 'valores_rede', 1, '', 2)] });
  const minhas = ok(tA, 'av.iniciar').minhas.notas.map((n) => `${n.momento}:${n.nota}`).sort();
  assert.deepEqual(minhas, ['apresentacao:5', 'construcao:3']);
  // avaliador C não é da equipe 1: construção recusada, apresentação normal; e ele grava a construção da equipe 2
  const rc = ok(tC, 'av.salvar', { notas: [nota('c001', 'valores_rede', 4, 'construcao'), nota('c001', 'valores_rede', 4), nota('c003', 'valores_rede', 4, 'construcao')] });
  assert.equal(rc.recusados.length, 1);
  assert.match(rc.recusados[0].motivo, /não é avaliador/);
  assert.equal(rc.salvos.length, 2);
  // construção não exige o momento aberto (a fila offline pode enviar depois) e o designado também avalia a apresentação
  ok(adm, 'admin.construcao', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq1', estado: 'CONCLUIDO' });
  assert.equal(ok(tA, 'av.salvar', { notas: [nota('c002', 'valores_rede', 4, 'construcao')] }).recusados.length, 0);
});

test('compatibilidade: linhas antigas sem a coluna momento valem como apresentação e a chave antiga continua a mesma', () => {
  const { ok, gas, tA } = preparar();
  const sh = gas.aba_('Avaliacoes');
  sh.getRange(2, 1, 1, 8).setValues([['geral|a001|c001|valores_rede', 'geral', 'a001', 'c001', 'valores_rede', 4, new Date(), 5]]);
  const ini = ok(tA, 'av.iniciar');
  assert.deepEqual(ini.minhas.notas.map((n) => [n.etapa, n.nota, n.momento]), [['geral', 4, 'apresentacao']]);
  // salvar a mesma chave antiga atualiza a linha antiga em vez de criar outra
  ok(tA, 'av.salvar', { notas: [{ etapa: 'geral', candidato_id: 'c001', criterio_id: 'valores_rede', nota: 2, cliente_ts: 10 }] });
  const l = gas.lerObjetos_('Avaliacoes');
  assert.equal(l.length, 1);
  assert.equal(l[0].nota, 2);
});

test('compatibilidade: planilha com o esquema antigo é completada sozinha na primeira chamada', () => {
  const amb = ambienteGoogle();
  const { gas, props } = amb;
  gas.setup();
  const adm = props.get('ADMIN_TOKEN');
  props.set('versao', '1.0.0'); // como se o Codigo.gs novo tivesse acabado de ser colado
  const antigo = gas.CABECALHOS.Equipes.slice(0, 5);
  gas.aba_('Equipes').getRange(1, 1, 1, 8).clearContent();
  gas.aba_('Equipes').getRange(1, 1, 1, 5).setValues([antigo]);
  const r = JSON.parse(gas.doPost({ postData: { contents: JSON.stringify({ token: adm, acao: 'admin.iniciar', dados: {} }) } }).getContent());
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual([...gas.aba_('Equipes').getRange(1, 1, 1, 8).getValues()[0]], [...gas.CABECALHOS.Equipes]);
  assert.equal(props.get('versao'), gas.VERSAO_SISTEMA);
});

test('config: pesos dos momentos são validados', () => {
  const { ok, chamar, adm } = preparar();
  ok(adm, 'admin.salvarConfig', { config: { peso_construcao: '2', peso_apresentacao: '1,5' } });
  assert.equal(chamar(adm, 'admin.salvarConfig', { config: { peso_construcao: -1 } }).ok, false);
});

// ---- cálculo (shared/calc.js) ----
const bl = [{ id: 'b', nome: 'B', nome_curto: 'B', ordem: 1, ativo: 'SIM' }];
const cr = [{ id: 'k1', bloco: 'b', ordem: 1, nome: 'K1', peso: 1, ativo: 'SIM', etapas: '' }, { id: 'k2', bloco: 'b', ordem: 2, nome: 'K2', peso: 1, ativo: 'SIM', etapas: '' }];
const cands = [{ id: 'c1', nome: 'A', status: 'ATIVO' }, { id: 'c2', nome: 'B', status: 'ATIVO' }];
const av = (avaliador_id, candidato_id, criterio_id, nota, momento) => ({ etapa: 'e', avaliador_id, candidato_id, criterio_id, nota, ...(momento ? { momento } : {}) });
const calc = (avaliacoes, config = {}) => calcularResultados({ candidatos: cands, criterios: cr, blocos: bl, avaliacoes, etapa: '*', config });
const linha = (res, id) => res.linhas.find((l) => l.id === id);

test('cálculo: sem notas de construção, o resultado é idêntico ao de antes', () => {
  const base = [av('a1', 'c1', 'k1', 4), av('a2', 'c1', 'k1', 3), av('a1', 'c1', 'k2', 5), av('a1', 'c2', 'k1', 'NA')];
  const comMomento = base.map((a) => ({ ...a, momento: 'apresentacao' }));
  assert.deepEqual(calc(base), calc(comMomento));
  const c1 = linha(calc(base), 'c1');
  assert.equal(c1.media, (3.5 + 5) / 2);
  assert.equal(c1.mediaConstrucao, null);
  assert.equal(c1.mediaApresentacao, c1.media);
  // pesos estranhos não mudam nada quando só existe Apresentação
  assert.equal(linha(calc(base, { peso_construcao: 0.3, peso_apresentacao: 0.7 }), 'c1').media, c1.media);
});

test('cálculo: média por momento e ponderada pelos pesos (padrão 50/50)', () => {
  const notas = [av('a1', 'c1', 'k1', 2, 'construcao'), av('a2', 'c1', 'k1', 4, 'construcao'), av('a1', 'c1', 'k1', 5), av('a2', 'c1', 'k1', 5), av('a3', 'c1', 'k1', 5)];
  const l = linha(calc(notas), 'c1');
  assert.equal(l.mediaConstrucao, 3);
  assert.equal(l.mediaApresentacao, 5);
  assert.equal(l.media, 4, 'não é a média simples das 5 notas (4,2)');
  assert.equal(l.porCriterio.k1, 4);
  assert.equal(l.nAvaliadores, 3);
  assert.equal(linha(calc(notas, { peso_construcao: 1, peso_apresentacao: 3 }), 'c1').media, 4.5);
  assert.equal(linha(calc(notas, { peso_construcao: 0, peso_apresentacao: 1 }), 'c1').media, 5);
  // candidato só com construção usa a média dela
  assert.equal(linha(calc([av('a1', 'c2', 'k1', 2, 'construcao')]), 'c2').media, 2);
});

test('cálculo: o progresso conta só a apresentação', () => {
  const p = calcularProgresso({ avaliadores: [{ id: 'a1', nome: 'X' }], candidatos: cands, criterios: cr, blocos: bl, etapa: 'e',
    avaliacoes: [av('a1', 'c1', 'k1', 4, 'construcao'), av('a1', 'c1', 'k2', 4, 'construcao'), av('a1', 'c2', 'k1', 4)] });
  assert.equal(p[0].completos, 0);
  assert.equal(p[0].parciais, 1);
});

test('conferir cálculos: planilha e cálculo independente entendem o momento', () => {
  const { gas } = preparar();
  assert.equal(typeof gas.conferirCalculos_, 'function');
  assert.match(gas.formulasDasAbas().find((f) => f.aba === 'Tabela Geral' && f.celula === 'A5').formula, /construcao/);
  assert.equal(gas.momentoDe_('Construcao'), 'construcao');
  assert.equal(gas.momentoDe_(''), 'apresentacao');
});
