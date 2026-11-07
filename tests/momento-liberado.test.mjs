// Trava por momento liberado (avaliar_so_no_momento, padrão SIM): o avaliador vê todos os participantes,
// mas só grava nota da equipe cuja Construção ou Apresentação o admin já liberou.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambienteGoogle } from './lib/mock-google.mjs';

function preparar() {
  const amb = ambienteGoogle();
  const { gas } = amb;
  gas.setup();
  const adm = amb.props.get('ADMIN_TOKEN');
  const chamar = (token, acao, dados) => JSON.parse(gas.doPost({ postData: { contents: JSON.stringify({ token, acao, dados }) } }).getContent());
  const ok = (token, acao, dados) => { const r = chamar(token, acao, dados); assert.equal(r.ok, true, acao + ': ' + r.erro); return r.dados; };
  const avs = ok(adm, 'admin.salvarAvaliadores', { lista: [{ nome: 'Avaliadora Um', area: 'Projetos' }, { nome: 'Avaliador Dois', area: 'Comercial' }] }).avaliadores;
  ok(adm, 'admin.salvarCandidatos', { lista: ['Ana Um', 'Bruno Dois', 'Carla Três', 'Davi Quatro', 'Eva Cinco'].map((n) => ({ nome_exibicao: n })) });
  // c005 fica sem equipe
  ok(adm, 'admin.salvarEquipes', { etapa: 'geral', equipes: [
    { nome: 'Equipe 1', membros: ['c001', 'c002'], avaliadores: [avs[0].id] },
    { nome: 'Equipe 2', membros: ['c003', 'c004'], avaliadores: [avs[1].id] },
  ] });
  return { ...amb, adm, avs, tA: avs[0].token, tB: avs[1].token, chamar, ok };
}
const nota = (cand, momento, ts = Date.now()) => ({ etapa: 'geral', candidato_id: cand, criterio_id: 'valores_rede', nota: 4, cliente_ts: ts, ...(momento ? { momento } : {}) });
const salvar = (ok, t, ...notas) => ok(t, 'av.salvar', { notas });

test('padrão SIM: sem nenhum momento liberado, ninguém grava nota, mas a lista de participantes continua completa', () => {
  const { ok, adm, tA } = preparar();
  assert.equal(ok(adm, 'admin.iniciar').config.avaliar_so_no_momento, 'SIM');
  const ini = ok(tA, 'av.iniciar');
  assert.equal(ini.avaliar_so_no_momento, true);
  assert.equal(ini.candidatos.length, 5, 'todos os participantes aparecem');
  assert.equal(ok(tA, 'av.sincronizar').avaliar_so_no_momento, true);
  const r = salvar(ok, tA, nota('c001'), nota('c001', 'construcao'), nota('c005'));
  assert.equal(r.salvos.length, 0);
  assert.equal(r.recusados.length, 3);
  assert.match(r.recusados[0].motivo, /não foi liberada/);
  // observação também é recusada
  const o = ok(tA, 'av.salvar', { observacoes: [{ etapa: 'geral', candidato_id: 'c001', texto: 'x', cliente_ts: 1 }] });
  assert.equal(o.recusados.length, 1);
});

test('Apresentação liberada: só a equipe da vez (e as já concluídas, para a fila offline) recebe nota', () => {
  const { ok, adm, tA, tB } = preparar();
  ok(adm, 'admin.aoVivo', { etapa: 'geral', equipe: 'geral_eq1' });
  let r = salvar(ok, tB, nota('c001'), nota('c003'), nota('c005'));
  assert.deepEqual(r.salvos, ['geral|a002|c001|valores_rede'], 'na Apresentação todos avaliam, mas só a equipe liberada');
  assert.equal(r.recusados.length, 2);
  // Construção da equipe 1 não foi aberta: a nota de construção é recusada mesmo com a apresentação liberada
  assert.equal(salvar(ok, tA, nota('c001', 'construcao')).recusados.length, 1);
  // passa para a equipe 2: a 1 fica concluída e a nota dela, guardada offline, ainda entra
  ok(adm, 'admin.aoVivo', { etapa: 'geral', equipe: 'geral_eq2' });
  r = salvar(ok, tA, nota('c002'), nota('c003'));
  assert.equal(r.salvos.length, 2);
  // encerra tudo: a equipe 2 fica concluída, o candidato sem equipe continua bloqueado
  ok(adm, 'admin.aoVivo', { etapa: 'geral', equipe: '' });
  r = salvar(ok, tA, nota('c004'), nota('c005'));
  assert.equal(r.salvos.length, 1);
  assert.equal(r.recusados[0].chave, 'geral|a001|c005|valores_rede');
});

test('Construção liberada: só a equipe em construção, e só para os designados', () => {
  const { ok, adm, tA, tB } = preparar();
  ok(adm, 'admin.construcao', { etapa: 'geral', equipe: 'geral_eq1', estado: 'ANDAMENTO' });
  let r = salvar(ok, tA, nota('c001', 'construcao'), nota('c003', 'construcao'), nota('c001'));
  assert.deepEqual(r.salvos, ['geral|a001|c001|valores_rede|construcao'], 'apresentação da equipe 1 ainda não foi liberada');
  assert.equal(salvar(ok, tB, nota('c001', 'construcao')).recusados.length, 1, 'B não é designado à equipe 1');
  ok(adm, 'admin.construcao', { etapa: 'geral', equipe: 'geral_eq1', estado: 'CONCLUIDO' });
  assert.equal(salvar(ok, tA, nota('c002', 'construcao')).salvos.length, 1, 'concluída ainda aceita o envio atrasado');
});

test('com NÃO na Config, volta a valer avaliar qualquer candidato a qualquer hora', () => {
  const { ok, adm, tA } = preparar();
  ok(adm, 'admin.salvarConfig', { config: { avaliar_so_no_momento: 'NÃO' } });
  assert.equal(ok(tA, 'av.sincronizar').avaliar_so_no_momento, false);
  const r = salvar(ok, tA, nota('c001'), nota('c005'));
  assert.equal(r.salvos.length, 2);
});

test('setup cria a chave na Config com SIM e ela vale na hora', () => {
  const { ok, gas, tA } = preparar();
  const sh = 'Config';
  const linha = gas.lerObjetos_(sh).find((o) => o.chave === 'avaliar_so_no_momento');
  assert.ok(linha);
  assert.equal(linha.valor, 'SIM');
  assert.equal(salvar(ok, tA, nota('c001')).recusados.length, 1);
});
