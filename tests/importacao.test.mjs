// Importação: cabeçalho, mapeamento, validações, duplicados e reimportação (com os CSVs fictícios de exemplos/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { limparMatriz, detectarCabecalho, nomesDeColuna, sugerirMapeamento, montarPrevia, paraEnvio, resumoPrevia, linkFoto } from '../shared/importacao.js';
import { nomesParaAvaliador } from '../shared/texto.js';

const ler = (arq, enc = 'utf-8') => {
  const txt = new TextDecoder(enc).decode(readFileSync(new URL('../exemplos/' + arq, import.meta.url)));
  return limparMatriz(Papa.parse(txt, { delimiter: '', skipEmptyLines: false }).data);
};

test('detecta cabeçalho e sugere o mapeamento pelo nome das colunas', () => {
  const m = ler('inscricoes-ficticias.csv');
  const i = detectarCabecalho(m);
  assert.equal(i, 0);
  const cols = nomesDeColuna(m[i]);
  const mapa = sugerirMapeamento(cols);
  assert.equal(cols[mapa.nome_exibicao], 'Nome completo');
  assert.equal(cols[mapa.email], 'Endereço de e-mail');
  assert.equal(cols[mapa.telefone], 'Telefone (WhatsApp)');
  assert.equal(cols[mapa.curso], 'Curso');
  assert.equal(cols[mapa.semestre], 'Semestre atual');
  assert.equal(cols[mapa.foto_url], 'Foto de rosto');
});

test('colunas em outra ordem e com outros nomes também funcionam', () => {
  const mapa = sugerirMapeamento(nomesDeColuna(['Qual seu curso?', 'E-mail', 'Período', 'Nome', 'Celular', 'Nome da mãe']));
  assert.deepEqual({ ...mapa }, { curso: 0, email: 1, semestre: 2, nome_exibicao: 3, telefone: 4 });
});

test('pré-visualização: nome vazio, email inválido, espaços, maiúsculas, repetidos e link de foto', () => {
  const m = ler('inscricoes-ficticias.csv');
  const mapa = sugerirMapeamento(nomesDeColuna(m[0]));
  const p = montarPrevia(m, 0, mapa, [], []);
  assert.equal(p.length, 9, 'linha em branco descartada');
  const por = (nome) => p.find((l) => l.dados.nome_exibicao === nome);
  assert.ok(por('Raul Exemplo Teste'), 'tira espaços extras e ajeita CAIXA ALTA');
  assert.equal(por('Raul Exemplo Teste').dados.email, 'raul.exemplo@exemplo.com');
  assert.equal(por('João Modelo').dados.email, '', 'email inválido fica em branco');
  assert.match(por('João Modelo').problemas[0], /Email inválido/);
  const vazio = p.find((l) => l.tipo === 'erro');
  assert.equal(vazio.acao, 'ignorar');
  const repetidos = p.filter((l) => l.tipo === 'duplicado_arquivo');
  assert.equal(repetidos.length, 1, 'Beatriz Ficção / Ficcao com mesmo email');
  assert.equal(repetidos[0].acao, 'ignorar');
  assert.equal(por('Caio Simulado da Silva').tipo, 'novo');
  assert.match(por('Lia Cardoso Fictícia').dados.foto_url, /thumbnail\?id=1AbCd/);
  assert.match(p.find((l) => l.dados.nome_exibicao.startsWith('Beatriz')).problemas.join(), /foto/);
  const r = resumoPrevia(p);
  assert.equal(r.criar, 7);
  assert.equal(r.erros, 1);
});

test('reimportar o arquivo com uma inscrição nova: só a nova fica como "criar"', () => {
  const m1 = ler('inscricoes-ficticias.csv');
  const mapa = sugerirMapeamento(nomesDeColuna(m1[0]));
  const p1 = montarPrevia(m1, 0, mapa, [], []);
  // simula o que o servidor gravou
  let n = 0;
  const existentes = [], inscricoes = [];
  for (const e of paraEnvio(p1)) { const id = 'c00' + (++n); existentes.push({ id, ...e.dados }); inscricoes.push({ candidato_id: id, hash: e.hash }); }
  const m2 = ler('inscricoes-ficticias-reimportar.csv');
  const p2 = montarPrevia(m2, 0, mapa, existentes, inscricoes);
  const criar = p2.filter((l) => l.acao === 'criar');
  assert.equal(criar.length, 1);
  assert.equal(criar[0].dados.nome_exibicao, 'Duda Nova Inscrita');
  assert.ok(p2.filter((l) => l.tipo === 'ja_importado').length >= 6);
  // escolher "atualizar" num duplicado manda o id do alvo
  const dup = p2.find((l) => l.tipo === 'ja_importado');
  dup.acao = 'atualizar';
  const env = paraEnvio(p2).find((e) => e.acao === 'atualizar');
  assert.equal(env.candidato_id, dup.alvo_id);
  // "criar mesmo assim" vai com forcar
  dup.acao = 'criar';
  assert.equal(paraEnvio(p2).find((e) => e.hash === dup.hash).forcar, true);
});

test('CSV do Excel com ponto e vírgula e acentos em Windows-1252', () => {
  const m = ler('inscricoes-ficticias-excel-ponto-e-virgula.csv', 'windows-1252');
  const mapa = sugerirMapeamento(nomesDeColuna(m[0]));
  const p = montarPrevia(m, 0, mapa);
  assert.equal(p.length, 3);
  assert.equal(p[2].dados.nome_exibicao, 'João Modelo');
});

test('colagem do Google Sheets (separada por tab) sem cabeçalho na primeira linha', () => {
  const txt = 'Respostas do formulário\t\t\nCarimbo\tNome\tE-mail\n01/11/2026 10:00:00\tDavi Simulado\tdavi@exemplo.com\n';
  const m = limparMatriz(Papa.parse(txt, { delimiter: '' }).data);
  const i = detectarCabecalho(m);
  assert.equal(i, 1);
  const p = montarPrevia(m, i, sugerirMapeamento(nomesDeColuna(m[i])));
  assert.equal(p[0].dados.nome_exibicao, 'Davi Simulado');
});

test('nomes para avaliadores: mostra sobrenome quando o primeiro nome se repete', () => {
  const r = nomesParaAvaliador([{ id: 'c1', nome: 'Ana Teste Albuquerque' }, { id: 'c2', nome: 'Ana Teste Barros' }, { id: 'c3', nome: 'Caio Simulado' }]);
  assert.deepEqual({ ...r }, { c1: 'Ana Albuquerque', c2: 'Ana Barros', c3: 'Caio' });
  assert.equal(linkFoto('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp'), 'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w240');
});
