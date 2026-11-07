// Dinâmicas em SALAS (cada equipe com os seus avaliadores nos dois momentos), comandos em massa
// e o roteiro do Manual do Avaliador 2026.2 (5 dinâmicas, grupos, narradores e personas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambienteGoogle } from './lib/mock-google.mjs';

const NOMES = ['Lyara Campos', 'Gabriella Souza', 'Samuel Rocha', 'João Pedro Lima', 'Lucca Nilo', 'Gisele Matos', 'Luiza Prado',
  'Cibele Torres', 'Samira Alves', 'José Carlos Brito', 'Mário Dias', 'Maria Alice Reis', 'Nilo Barros', 'Levi Costa',
  'Eduarda Pinto', 'João Gabriel Melo', 'Matheus Sales', 'Matheus Silva'];

function preparar() {
  const amb = ambienteGoogle();
  const { gas } = amb;
  gas.setup();
  const adm = amb.props.get('ADMIN_TOKEN');
  const chamar = (token, acao, dados) => JSON.parse(gas.doPost({ postData: { contents: JSON.stringify({ token, acao, dados }) } }).getContent());
  const ok = (token, acao, dados) => { const r = chamar(token, acao, dados); assert.equal(r.ok, true, acao + ': ' + r.erro); return r.dados; };
  const avs = ok(adm, 'admin.salvarAvaliadores', { lista: NOMES.map((nome) => ({ nome, area: 'Projetos' })) }).avaliadores;
  const por = (n) => avs.find((a) => a.nome === n);
  ok(adm, 'admin.salvarCandidatos', { lista: Array.from({ length: 9 }, (_, i) => ({ nome_exibicao: 'Candidato ' + (i + 1) })) });
  return { ...amb, gas, adm, avs, por, chamar, ok };
}

test('roteiro: prévia casa os nomes do manual pelo primeiro nome e não grava nada', () => {
  const { ok, adm, por, gas } = preparar();
  const r = ok(adm, 'admin.roteiroManual', {});
  const c = Object.fromEntries(r.casamento.map((x) => [x.nome, x]));
  assert.equal(r.dinamicas.length, 5);
  assert.equal(c['Nilo'].id, por('Nilo Barros').id, '"Nilo" não casa com "Lucca Nilo"');
  assert.equal(c['Lucca'].id, por('Lucca Nilo').id);
  assert.equal(c['João Pedro'].id, por('João Pedro Lima').id);
  assert.equal(c['Matheus S.'].achados.length, 2, 'dois Matheus S.: fica para o admin escolher');
  assert.equal(c['Matheus S.'].id, '');
  assert.equal(c['Ana Tereza'].achados.length, 0);
  assert.equal(gas.lerObjetos_('Config_Etapas').length, 1, 'prévia não grava');
});

test('roteiro: grava 5 dinâmicas em salas, 33 equipes, narradores e personas, e mantém candidatos já distribuídos', () => {
  const { ok, adm, por } = preparar();
  ok(adm, 'admin.salvarEquipes', { etapa: 'geral', equipes: [{ nome: 'Equipe 1', membros: ['c001', 'c002'] }, { nome: 'Equipe 2', membros: ['c003'] }] });
  const r = ok(adm, 'admin.roteiroManual', { gravar: true, escolhas: { 'Matheus S.': por('Matheus Sales').id } });
  assert.equal(r.etapas.length, 5);
  const d1 = r.etapas.find((e) => e.id === 'geral');
  assert.equal(d1.nome, 'Mapeamento às cegas');
  assert.equal(d1.formato, 'SALAS');
  assert.equal(d1.nome_construcao, 'Mapeamento');
  assert.equal(r.equipes.length, 4 + 6 + 9 + 5 + 9);
  const g1 = r.equipes.find((q) => q.id === 'geral_eq1');
  assert.equal(g1.nome, 'Grupo 1');
  assert.deepEqual(g1.membros, ['c001', 'c002'], 'candidatos da posição 1 continuam');
  assert.deepEqual(g1.avaliadores, ['Lyara Campos', 'Gabriella Souza', 'Samuel Rocha'].map((n) => por(n).id));
  assert.equal(g1.narrador, por('Nilo Barros').id);
  const t7 = r.equipes.find((q) => q.id === 'd3_eq7');
  assert.equal(t7.nome, 'Trio 7');
  assert.deepEqual(t7.personas, { [por('Lucca Nilo').id]: 'nao_sabe' });
  const d2g1 = r.equipes.find((q) => q.id === 'd2_eq1');
  assert.ok(d2g1.avaliadores.includes(por('Matheus Sales').id), 'escolha manual vale');
  const d2g6 = r.equipes.find((q) => q.id === 'd2_eq6');
  assert.equal(d2g6.avaliadores.length, 2, 'Ana Tereza não cadastrada fica de fora');
  // gravar de novo não duplica
  assert.equal(ok(adm, 'admin.roteiroManual', { gravar: true }).equipes.length, 33);
});

test('salas: Apresentação por equipe, várias ao mesmo tempo, só os designados avaliam', () => {
  const { ok, adm, por } = preparar();
  ok(adm, 'admin.roteiroManual', { gravar: true });
  ok(adm, 'admin.salvarEquipes', { etapa: 'd3', equipes: [
    { nome: 'Trio 1', membros: ['c001', 'c002', 'c003'] }, { nome: 'Trio 2', membros: ['c004', 'c005', 'c006'] },
    { nome: 'Trio 3', membros: ['c007', 'c008', 'c009'] },
  ] });
  const gab = por('Gabriella Souza'), ma = por('Maria Alice Reis');
  ok(adm, 'admin.apresentacao', { etapa: 'd3', equipe: 'd3_eq1', estado: 'ANDAMENTO' });
  ok(adm, 'admin.apresentacao', { etapa: 'd3', equipe: 'd3_eq2', estado: 'ANDAMENTO' });
  const ini = ok(gab.token, 'av.iniciar');
  assert.deepEqual(ini.apresentacao.map((q) => q.id), ['d3_eq1']);
  assert.deepEqual(ini.fora_da_equipe.d3.sort(), ['c004', 'c005', 'c006', 'c007', 'c008', 'c009']);
  const papel = ini.papeis.find((p) => p.etapa === 'd3');
  assert.equal(papel.persona.nome, 'O Cliente que Sabe Tudo');
  const n = (cand) => ({ etapa: 'd3', candidato_id: cand, criterio_id: 'valores_rede', nota: 4, cliente_ts: Date.now() });
  let r = ok(gab.token, 'av.salvar', { notas: [n('c001'), n('c004')] });
  assert.equal(r.salvos.length, 1);
  assert.match(r.recusados[0].motivo, /designados/);
  r = ok(ma.token, 'av.salvar', { notas: [n('c004')] });
  assert.equal(r.salvos.length, 1);
  assert.equal(ok(ma.token, 'av.sincronizar').apresentacao[0].id, 'd3_eq2');
});

test('salas: comandos em massa pulam equipe sem avaliador e concluem a construção ao passar para a apresentação', () => {
  const { ok, adm, por } = preparar();
  ok(adm, 'admin.roteiroManual', { gravar: true });
  ok(adm, 'admin.salvarEquipes', { etapa: 'd5', equipes: [
    { nome: 'Trio 1', membros: ['c001'] }, { nome: 'Trio 2', membros: ['c002'] }, { nome: 'Trio 3', membros: [] },
  ] });
  ok(adm, 'admin.designarAvaliadores', { etapa: 'd5', equipe: 'd5_eq2', avaliadores: [] });
  let r = ok(adm, 'admin.momentoTodas', { etapa: 'd5', momento: 'construcao', estado: 'ANDAMENTO' });
  assert.equal(r.mudadas, 1);
  assert.deepEqual(r.puladas, ['Trio 2']);
  r = ok(adm, 'admin.momentoTodas', { etapa: 'd5', momento: 'apresentacao', estado: 'ANDAMENTO' });
  const t1 = r.equipes.find((q) => q.id === 'd5_eq1');
  assert.equal(t1.construcao, 'CONCLUIDO');
  assert.equal(t1.apresentacao, 'ANDAMENTO');
  r = ok(adm, 'admin.momentoTodas', { etapa: 'd5', momento: 'apresentacao', estado: 'CONCLUIDO' });
  assert.equal(r.equipes.find((q) => q.id === 'd5_eq1').apresentacao, 'CONCLUIDO');
  assert.equal(r.config.dinamica_ativa, 'd5');
  assert.ok(por('Lucca Nilo'));
});

test('narrador vê o papel dele e não avalia o grupo que narra', () => {
  const { ok, adm, por } = preparar();
  ok(adm, 'admin.roteiroManual', { gravar: true });
  ok(adm, 'admin.salvarEquipes', { etapa: 'geral', equipes: [{ nome: 'Grupo 1', membros: ['c001'] }] });
  ok(adm, 'admin.construcao', { etapa: 'geral', equipe: 'geral_eq1', estado: 'ANDAMENTO' });
  const nilo = por('Nilo Barros');
  const ini = ok(nilo.token, 'av.iniciar');
  const p = ini.papeis.find((x) => x.etapa === 'geral');
  assert.equal(p.papel, 'narrador');
  assert.deepEqual(p.colegas.sort(), ['Gabriella', 'Lyara', 'Samuel'].sort());
  assert.equal(ini.construcao.length, 0);
  const r = ok(nilo.token, 'av.salvar', { notas: [{ etapa: 'geral', candidato_id: 'c001', criterio_id: 'valores_rede', nota: 3, cliente_ts: 1, momento: 'construcao' }] });
  assert.equal(r.recusados.length, 1);
  // quem avalia vê o narrador
  const ly = ok(por('Lyara Campos').token, 'av.iniciar').papeis.find((x) => x.etapa === 'geral');
  assert.equal(ly.narrador, 'Nilo');
});

test('salvarEtapas sem os campos novos mantém formato e nomes dos momentos', () => {
  const { ok, adm } = preparar();
  ok(adm, 'admin.roteiroManual', { gravar: true });
  const r = ok(adm, 'admin.salvarEtapas', { lista: [{ id: 'd4', nome: 'Laranjas Ugli', ordem: 4, aberta: 'SIM' }] }).etapas;
  const d4 = r.find((e) => e.id === 'd4');
  assert.equal(d4.formato, 'SALAS');
  assert.equal(d4.nome_apresentacao, 'Negociações');
  const r2 = ok(adm, 'admin.salvarEtapas', { lista: [{ id: 'd4', nome: 'Laranjas Ugli', ordem: 4, formato: 'PALCO' }] }).etapas;
  assert.equal(r2.find((e) => e.id === 'd4').formato, 'PALCO');
});
