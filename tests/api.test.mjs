// Testes da API (Apps Script) no simulador: tokens, permissões, upsert, privacidade e importação.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambienteGoogle } from './lib/mock-google.mjs';

function preparar() {
  const amb = ambienteGoogle();
  const { gas } = amb;
  gas.setup();
  const adm = amb.props.get('ADMIN_TOKEN');
  const chamar = (token, acao, dados) => {
    const resp = JSON.parse(gas.doPost({ postData: { contents: JSON.stringify({ token, acao, dados }) } }).getContent());
    return resp;
  };
  const ok = (token, acao, dados) => { const r = chamar(token, acao, dados); assert.equal(r.ok, true, acao + ': ' + r.erro); return r.dados; };
  // 2 avaliadores e 3 candidatos
  const avs = ok(adm, 'admin.salvarAvaliadores', { lista: [{ nome: 'Avaliadora Um', email: 'um@exemplo.com' }, { nome: 'Avaliador Dois' }] }).avaliadores;
  ok(adm, 'admin.salvarCandidatos', { lista: [
    { nome_exibicao: 'Maria Teste Souza', email: 'maria@exemplo.com', telefone: '85 99999-0000' },
    { nome_exibicao: 'Maria Ficção Lima', email: 'maria2@exemplo.com' },
    { nome_exibicao: 'Pedro Exemplo' },
  ] });
  return { ...amb, adm, avs, tA: avs[0].token, tB: avs[1].token, chamar, ok };
}

test('ping funciona sem token; token inválido é recusado', () => {
  const { chamar } = preparar();
  assert.equal(chamar('', 'ping').ok, true);
  const r = chamar('x'.repeat(43), 'av.iniciar');
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'TOKEN_INVALIDO');
});

test('avaliador não acessa ações de admin; admin não usa rotas de avaliador', () => {
  const { chamar, tA, adm } = preparar();
  for (const acao of ['admin.iniciar', 'admin.backup', 'admin.salvarConfig', 'admin.notas', 'admin.apagarDados']) {
    const r = chamar(tA, acao, { confirmacao: 'APAGAR' });
    assert.equal(r.ok, false, acao);
    assert.equal(r.codigo, 'SEM_PERMISSAO');
  }
  assert.equal(chamar(adm, 'av.iniciar').codigo, 'SEM_PERMISSAO');
});

test('avaliador nunca recebe email ou telefone de candidatos e só vê as próprias notas', () => {
  const { ok, tA, tB } = preparar();
  ok(tB, 'av.salvar', { notas: [{ etapa: 'geral', candidato_id: 'c001', criterio_id: 'valores_dono', nota: 2, cliente_ts: 1 }] });
  const ini = ok(tA, 'av.iniciar');
  const txt = JSON.stringify(ini);
  assert.ok(!txt.includes('maria@exemplo.com') && !txt.includes('99999'), 'sem dados de contato');
  assert.equal(ini.eu.nome, 'Avaliadora Um');
  assert.equal(ini.minhas.notas.length, 0, 'não vê a nota do avaliador B');
  assert.equal(ini.colegas, undefined, 'médias dos colegas desligadas por padrão');
  // Mesmo primeiro nome -> mostra sobrenome
  const nomes = Object.fromEntries(ini.candidatos.map((c) => [c.id, c.nome_curto]));
  assert.equal(nomes.c001, 'Maria Souza');
  assert.equal(nomes.c003, 'Pedro');
});

test('upsert: repetir ou editar nota não duplica; nota mais antiga não sobrescreve a nova', () => {
  const { ok, gas, tA } = preparar();
  const n = (nota, ts) => ({ etapa: 'geral', candidato_id: 'c001', criterio_id: 'valores_proatividade', nota, cliente_ts: ts });
  ok(tA, 'av.salvar', { notas: [n(3, 100)] });
  ok(tA, 'av.salvar', { notas: [n(3, 100)] }); // reenvio (internet ruim)
  ok(tA, 'av.salvar', { notas: [n(5, 200)] }); // edição
  ok(tA, 'av.salvar', { notas: [n(1, 150)] }); // reenvio atrasado de uma versão velha
  const linhas = gas.lerObjetos_('Avaliacoes');
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].nota, 5);
  assert.equal(linhas[0].chave, 'geral|a001|c001|valores_proatividade');
});

test('avaliador A não grava em nome do B', () => {
  const { ok, gas, tA } = preparar();
  ok(tA, 'av.salvar', { notas: [{ etapa: 'geral', avaliador_id: 'a002', candidato_id: 'c002', criterio_id: 'valores_rede', nota: 4, cliente_ts: 1 }] });
  const l = gas.lerObjetos_('Avaliacoes');
  assert.equal(l[0].avaliador_id, 'a001');
});

test('etapa fechada, candidato inativo, critério inválido e nota inválida são recusados', () => {
  const { ok, tA, adm } = preparar();
  ok(adm, 'admin.salvarCandidatos', { lista: [{ id: 'c003', status: 'FALTOU' }] });
  const base = { etapa: 'geral', candidato_id: 'c001', criterio_id: 'valores_rede', cliente_ts: 1 };
  let r = ok(tA, 'av.salvar', { notas: [
    { ...base, nota: 7 }, { ...base, criterio_id: 'nao_existe', nota: 3 }, { ...base, candidato_id: 'c003', nota: 3 }, { ...base, nota: 'NA' },
  ] });
  assert.equal(r.recusados.length, 3);
  assert.equal(r.salvos.length, 1);
  ok(adm, 'admin.salvarEtapas', { lista: [{ id: 'geral', nome: 'Geral', ordem: 1, aberta: 'NÃO' }] });
  r = ok(tA, 'av.salvar', { notas: [{ ...base, nota: 2, cliente_ts: 5 }] });
  assert.match(r.recusados[0].motivo, /fechada/);
});

test('15 avaliadores salvando lotes embaralhados, com reenvios: nenhuma perda e nenhuma duplicata', () => {
  const { ok, adm, gas } = preparar();
  const lista = Array.from({ length: 13 }, (_, i) => ({ nome: 'Fictício ' + i }));
  const todos = ok(adm, 'admin.salvarAvaliadores', { lista }).avaliadores; // 15 no total
  const crits = gas.lerObjetos_('Config_Criterios').map((c) => c.id);
  const esperado = {};
  const lotes = [];
  let ts = 1;
  for (const av of todos) {
    for (const c of ['c001', 'c002', 'c003']) for (const k of crits) {
      for (let v = 0; v < 2; v++) { // cada nota é editada uma vez
        const nota = 1 + ((ts * 7) % 5);
        lotes.push({ token: av.token, item: { etapa: 'geral', candidato_id: c, criterio_id: k, nota, cliente_ts: ts } });
        esperado[['geral', av.id, c, k].join('|')] = nota;
        ts++;
      }
    }
  }
  // embaralha, manda em lotes de 7 e reenvia 20% (simula retry)
  let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  lotes.sort(() => rnd() - 0.5);
  const porToken = {};
  for (const l of lotes) (porToken[l.token] = porToken[l.token] || []).push(l.item);
  const fila = [];
  for (const [token, itens] of Object.entries(porToken)) for (let i = 0; i < itens.length; i += 7) fila.push({ token, notas: itens.slice(i, i + 7) });
  fila.sort(() => rnd() - 0.5);
  for (const f of fila) { ok(f.token, 'av.salvar', { notas: f.notas }); if (rnd() < 0.2) ok(f.token, 'av.salvar', { notas: f.notas }); }
  const linhas = gas.lerObjetos_('Avaliacoes');
  assert.equal(linhas.length, Object.keys(esperado).length, 'uma linha por chave');
  for (const l of linhas) assert.equal(l.nota, esperado[l.chave], l.chave);
});

test('regerar token: link antigo para de funcionar; desativar bloqueia acesso', () => {
  const { ok, chamar, adm, tA, avs } = preparar();
  ok(tA, 'av.iniciar');
  const novo = ok(adm, 'admin.regerarToken', { id: avs[0].id }).avaliador.token;
  assert.notEqual(novo, tA);
  assert.equal(chamar(tA, 'av.iniciar').codigo, 'TOKEN_INVALIDO');
  ok(novo, 'av.iniciar');
  ok(adm, 'admin.salvarAvaliadores', { lista: [{ id: avs[0].id, ativo: 'NÃO' }] });
  assert.equal(chamar(novo, 'av.iniciar').codigo, 'TOKEN_INVALIDO');
});

test('importação: cria, reimportar não duplica, "criar mesmo assim" força, atualizar não troca o nome', () => {
  const { ok, adm, gas } = preparar();
  const linha = (nome, hash, extra = {}) => ({ acao: 'criar', hash, dados: { nome_exibicao: nome, email: nome.split(' ')[0].toLowerCase() + '@ex.com' }, original: { Nome: nome, 'Carimbo': 'x' }, ...extra });
  let r = ok(adm, 'admin.importarCandidatos', { lote: { origem: 'arquivo', nome_arquivo: 'teste.csv' }, linhas: [linha('Ana Nova', 'h1'), linha('Beto Novo', 'h2')] });
  assert.equal(r.criados, 2);
  r = ok(adm, 'admin.importarCandidatos', { lote: { origem: 'arquivo' }, linhas: [linha('Ana Nova', 'h1'), linha('Beto Novo', 'h2'), linha('Caio Novo', 'h3')] });
  assert.equal(r.criados, 1, 'só a inscrição nova entra');
  assert.equal(r.ignorados, 2);
  r = ok(adm, 'admin.importarCandidatos', { lote: {}, linhas: [linha('Ana Nova', 'h1', { forcar: true })] });
  assert.equal(r.criados, 1);
  const cands = gas.lerObjetos_('Candidatos');
  const ana = cands.find((c) => c.nome_exibicao === 'Ana Nova');
  ok(adm, 'admin.salvarCandidatos', { lista: [{ id: ana.id, nome_exibicao: 'Ana N. (editado)' }] });
  r = ok(adm, 'admin.importarCandidatos', { lote: {}, linhas: [{ acao: 'atualizar', candidato_id: ana.id, hash: 'h1', dados: { nome_exibicao: 'Ana Nova', curso: 'Eng. Produção' }, original: {} }] });
  const depois = gas.lerObjetos_('Candidatos').find((c) => c.id === ana.id);
  assert.equal(depois.nome_exibicao, 'Ana N. (editado)');
  assert.equal(depois.curso, 'Eng. Produção');
  assert.equal(gas.lerObjetos_('Importacoes').length, 4);
  const ins = ok(adm, 'admin.inscricao', { id: ana.id }).inscricoes;
  assert.equal(ins[0].dados.Nome, 'Ana Nova', 'linha original guardada');
});

test('configuração: valida valores; critério com nota não pode ser apagado; "em votação"', () => {
  const { ok, chamar, adm, tA } = preparar();
  assert.equal(chamar(adm, 'admin.salvarConfig', { config: { nota_de_corte: 9 } }).ok, false);
  assert.equal(chamar(adm, 'admin.salvarConfig', { config: { invasao: 1 } }).ok, false);
  ok(adm, 'admin.salvarConfig', { config: { nota_de_corte: '3,5', avaliadores_veem_notas_dos_outros: 'SIM' } });
  ok(tA, 'av.salvar', { notas: [{ etapa: 'geral', candidato_id: 'c001', criterio_id: 'valores_rede', nota: 4, cliente_ts: 1 }] });
  assert.equal(chamar(adm, 'admin.removerCriterios', { ids: ['valores_rede'] }).ok, false);
  ok(adm, 'admin.salvarCriterios', { lista: [{ id: 'valores_rede', bloco: 'valores', ordem: 8, sigla: 'R', nome: 'Rede', descricao: 'Texto novo.', peso: 2, ativo: 'SIM' }] });
  const crit = ok(adm, 'admin.iniciar').criterios.find((c) => c.id === 'valores_rede');
  assert.equal(crit.peso, 2);
  assert.equal(crit.descricao, 'Texto novo.');
  ok(adm, 'admin.emVotacao', { ids: ['c002', 'c003'] });
  const sinc = ok(tA, 'av.sincronizar');
  assert.deepEqual([...sinc.em_votacao], ['c002', 'c003']);
  // Com a opção ligada, o avaliador recebe a média dos colegas (não a própria)
  const ini = ok(tA, 'av.iniciar');
  assert.ok(ini.colegas);
});

test('apagar dados exige "APAGAR"', () => {
  const { ok, chamar, adm, gas } = preparar();
  assert.equal(chamar(adm, 'admin.apagarDados', { confirmacao: 'apagar' }).ok, false);
  ok(adm, 'admin.apagarDados', { confirmacao: 'APAGAR' });
  assert.equal(gas.lerObjetos_('Candidatos').length, 0);
  assert.equal(gas.lerObjetos_('Avaliadores').length, 0);
});

test('equipes e momento ao vivo: admin monta equipes, abre uma e o avaliador vê só ela', () => {
  const { ok, chamar, adm, tA } = preparar();
  ok(adm, 'admin.salvarEtapas', { lista: [{ nome: 'Dinâmica 2', ordem: 2, aberta: 'NÃO' }] });
  const r = ok(adm, 'admin.salvarEquipes', { etapa: 'dinamica_2', equipes: [
    { nome: 'Equipe 1', membros: ['c001', 'c002'] },
    { nome: 'Equipe 2', membros: ['c002', 'c003', 'c999'] }, // c002 repetido e c999 inexistente são descartados
  ] });
  assert.deepEqual(r.equipes.map((e) => e.membros), [['c001', 'c002'], ['c003']]);
  // avaliador não pode mexer em equipes nem no momento ao vivo
  assert.equal(chamar(tA, 'admin.aoVivo', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq1' }).codigo, 'SEM_PERMISSAO');
  assert.equal(chamar(adm, 'admin.aoVivo', { etapa: 'geral', equipe: 'dinamica_2_eq1' }).ok, false, 'equipe de outra dinâmica');
  ok(adm, 'admin.aoVivo', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq1' });
  const s = ok(tA, 'av.sincronizar');
  assert.equal(s.dinamica_ativa, 'dinamica_2');
  assert.deepEqual(s.equipe.membros, ['c001', 'c002']);
  assert.deepEqual(s.em_votacao, ['c001', 'c002']);
  assert.ok(s.etapas.find((e) => e.id === 'dinamica_2').aberta, 'abrir a equipe abre a dinâmica');
  // notas separadas por dinâmica: mesma pessoa, mesmo critério, duas notas diferentes
  ok(tA, 'av.salvar', { notas: [
    { etapa: 'geral', candidato_id: 'c001', criterio_id: 'valores_rede', nota: 2, cliente_ts: 1 },
    { etapa: 'dinamica_2', candidato_id: 'c001', criterio_id: 'valores_rede', nota: 5, cliente_ts: 1 },
  ] });
  const minhas = ok(tA, 'av.iniciar').minhas.notas.map((n) => n.etapa + ':' + n.nota).sort();
  assert.deepEqual(minhas, ['dinamica_2:5', 'geral:2']);
  // trocar a equipe ativa atualiza a votação; refazer as equipes sem a ativa encerra
  ok(adm, 'admin.salvarEquipes', { etapa: 'dinamica_2', equipes: [{ nome: 'Equipe 1', membros: ['c003'] }] });
  assert.deepEqual(ok(tA, 'av.sincronizar').em_votacao, ['c003']);
  ok(adm, 'admin.salvarEquipes', { etapa: 'dinamica_2', equipes: [] });
  const fim = ok(tA, 'av.sincronizar');
  assert.equal(fim.equipe, null);
  assert.deepEqual(fim.em_votacao, []);
});
