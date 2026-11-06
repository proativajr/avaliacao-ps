// Critério Respeito, descrição nova da Proatividade e diretoria do avaliador (lista fechada + migração do texto livre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambienteGoogle } from './lib/mock-google.mjs';
import { mapearDiretoria, diretoriaValida, DIRETORIAS } from '../shared/texto.js';

function preparar() {
  const amb = ambienteGoogle();
  amb.gas.setup();
  const adm = amb.props.get('ADMIN_TOKEN');
  const chamar = (token, acao, dados) => JSON.parse(amb.gas.doPost({ postData: { contents: JSON.stringify({ token, acao, dados }) } }).getContent());
  const ok = (token, acao, dados) => { const r = chamar(token, acao, dados); assert.equal(r.ok, true, acao + ': ' + r.erro); return r.dados; };
  return { ...amb, adm, chamar, ok };
}

test('planilha nova: bloco comportamental com os 6 critérios de antes + Respeito, e Proatividade com a descrição nova', () => {
  const { gas } = preparar();
  const comp = gas.lerObjetos_('Config_Criterios').filter((c) => c.bloco === 'comport').sort((a, b) => a.ordem - b.ordem);
  assert.deepEqual([...comp.map((c) => c.nome)], ['Proatividade', 'Criatividade', 'Comunicação', 'Capacidade Analítica', 'Trabalho em Equipe', 'Desafio Individual', 'Respeito']);
  assert.ok(comp.every((c) => Number(c.peso) === 1 && c.ativo === 'SIM'));
  assert.equal(comp[0].descricao, gas.DESCRICAO_PROATIVIDADE);
  assert.match(comp[6].descricao, /discorda de forma educada/);
});

test('planilha antiga (1.2.0): a migração acrescenta Respeito uma vez e troca só a descrição antiga da Proatividade', () => {
  const { gas, props, ok, adm } = preparar();
  const sh = 'Config_Criterios';
  const resp = gas.lerObjetos_(sh).find((c) => c.id === 'comport_respeito');
  gas.aba_(sh).deleteRow(resp._linha);
  const prot = gas.lerObjetos_(sh).find((c) => c.id === 'comport_proatividade');
  prot.descricao = gas.DESCRICAO_PROATIVIDADE_ANTIGA;
  gas.reescrever_(sh, [prot]);
  props.set('versao', '1.2.0');
  const d = ok(adm, 'admin.iniciar', {});
  const lista = d.criterios.filter((c) => c.id === 'comport_respeito');
  assert.equal(lista.length, 1);
  assert.equal(Number(lista[0].ordem), 7);
  assert.equal(d.criterios.find((c) => c.id === 'comport_proatividade').descricao, gas.DESCRICAO_PROATIVIDADE);
  // Descrição editada pelo admin não é sobrescrita, e rodar de novo não duplica
  const atual = gas.lerObjetos_(sh).find((c) => c.id === 'comport_proatividade');
  atual.descricao = 'Texto meu';
  gas.reescrever_(sh, [atual]);
  gas.aplicarMigracoes_();
  const depois = gas.lerObjetos_(sh);
  assert.equal(depois.filter((c) => c.id === 'comport_respeito').length, 1);
  assert.equal(depois.find((c) => c.id === 'comport_proatividade').descricao, 'Texto meu');
});

test('Respeito entra na média com o mesmo cálculo dos outros critérios', () => {
  const { ok, adm } = preparar();
  const [a] = ok(adm, 'admin.salvarAvaliadores', { lista: [{ nome: 'Ava', area: 'Projetos' }] }).avaliadores;
  ok(adm, 'admin.salvarCandidatos', { lista: [{ nome_exibicao: 'Ana Um' }] });
  const n = (k, v) => ({ etapa: 'geral', candidato_id: 'c001', criterio_id: k, nota: v, cliente_ts: Date.now() });
  const r = ok(a.token, 'av.salvar', { notas: [n('comport_proatividade', 5), n('comport_respeito', 2), n('valores_rede', 'NA')] });
  assert.equal(r.salvos.length, 3);
  const d = ok(adm, 'admin.iniciar', {});
  const salvas = d.avaliacoes.filter((x) => x.criterio_id === 'comport_respeito');
  assert.equal(salvas.length, 1);
});

test('diretoria: obrigatória e só da lista para avaliador novo e na edição', () => {
  const { chamar, ok, adm } = preparar();
  let r = chamar(adm, 'admin.salvarAvaliadores', { lista: [{ nome: 'Sem Diretoria' }] });
  assert.equal(r.ok, false); assert.match(r.erro, /Escolha a diretoria/);
  r = chamar(adm, 'admin.salvarAvaliadores', { lista: [{ nome: 'Fora', area: 'Gente' }] });
  assert.equal(r.ok, false); assert.match(r.erro, /Diretoria inválida/);
  const avs = ok(adm, 'admin.salvarAvaliadores', { lista: DIRETORIAS.map((d, i) => ({ nome: 'Pessoa ' + i, area: d })) }).avaliadores;
  assert.deepEqual(avs.map((a) => a.area), DIRETORIAS);
  // aceita a grafia sem acento e grava a forma oficial
  assert.equal(ok(adm, 'admin.salvarAvaliadores', { lista: [{ id: avs[0].id, area: 'vice-presidencia' }] }).avaliadores[0].area, 'Vice-presidência');
  r = chamar(adm, 'admin.salvarAvaliadores', { lista: [{ id: avs[0].id, area: '' }] });
  assert.equal(r.ok, false);
  // desativar sem mandar diretoria continua funcionando
  ok(adm, 'admin.salvarAvaliadores', { lista: [{ id: avs[1].id, ativo: 'NÃO' }] });
});

test('migração: texto livre antigo vira uma das quatro diretorias; o que não bate fica vazio e vai para revisão', () => {
  const { gas, props, ok, adm } = preparar();
  const textos = ['projetos', 'Diretoria de Projetos', 'VP', 'vice presidência', 'Comercial ', 'PE', 'Presidência', 'Gente', 'Financeiro', ''];
  gas.acrescentar_('Avaliadores', textos.map((t, i) => ({ id: 'a' + String(i + 1).padStart(3, '0'), nome: 'Antigo ' + i, area: t, token: 'tok' + i + 'x'.repeat(30), ativo: 'SIM' })));
  props.set('versao', '1.2.0');
  const avs = ok(adm, 'admin.iniciar', {}).avaliadores;
  assert.deepEqual(avs.map((a) => a.area), ['Projetos', 'Projetos', 'Vice-presidência', 'Vice-presidência', 'Comercial', 'Presidência Executiva', 'Presidência Executiva', '', '', '']);
  assert.deepEqual(avs.map((a) => a.area_revisar), ['', '', '', '', '', '', '', 'Gente', 'Financeiro', '']);
  // Corrigir pela edição limpa o aviso
  const r = ok(adm, 'admin.salvarAvaliadores', { lista: [{ id: avs[7].id, area: 'Comercial' }] }).avaliadores;
  assert.equal(r[7].area, 'Comercial'); assert.equal(r[7].area_revisar, '');
});

test('mapearDiretoria e diretoriaValida', () => {
  assert.equal(mapearDiretoria('Presidência Executiva'), 'Presidência Executiva');
  assert.equal(mapearDiretoria('vice-presidente'), 'Vice-presidência');
  assert.equal(mapearDiretoria('Dir. Comercial'), 'Comercial');
  assert.equal(mapearDiretoria('Marketing'), '');
  assert.equal(diretoriaValida('PROJETOS'), 'Projetos');
  assert.equal(diretoriaValida('proj'), '');
});
