// Lógica da importação de candidatos (sem dependências; testada no Node).
// Recebe linhas já lidas (CSV, XLSX ou colagem) como matriz de textos.
import { normalizarNome, normalizarEmail, emailValido, soDigitos, nomeProprio } from './texto.js';

/** Campos que o sistema entende. Só o nome é obrigatório. */
export const CAMPOS = [
  { id: 'nome_exibicao', rotulo: 'Nome', obrigatorio: true },
  { id: 'email', rotulo: 'Email' },
  { id: 'telefone', rotulo: 'Telefone' },
  { id: 'curso', rotulo: 'Curso' },
  { id: 'semestre', rotulo: 'Semestre' },
  { id: 'foto_url', rotulo: 'Foto (link)' },
];

/** Texto de uma célula (datas viram dd/mm/aaaa hh:mm:ss). */
export function textoCelula(v) {
  if (v == null) return '';
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(v.getDate())}/${p(v.getMonth() + 1)}/${v.getFullYear()} ${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  return String(v).replace(/\r\n?/g, '\n').trim();
}

/** Remove linhas totalmente vazias e normaliza as células. */
export function limparMatriz(matriz) {
  return (matriz || []).map((l) => (l || []).map(textoCelula)).filter((l) => l.some((c) => c !== ''));
}

/**
 * Acha a linha de cabeçalho entre as 5 primeiras: a que tem mais células de texto
 * não numéricas (empate: a primeira). Devolve o índice.
 */
export function detectarCabecalho(matriz) {
  let melhor = 0, pontos = -1;
  matriz.slice(0, 5).forEach((l, i) => {
    const p = l.filter((c) => c !== '' && isNaN(Number(c.replace(',', '.'))) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(c)).length;
    if (p > pontos) { pontos = p; melhor = i; }
  });
  return melhor;
}

/** Nomes de coluna únicos e não vazios ("Coluna 3", "Email (2)"). */
export function nomesDeColuna(cab) {
  const vistos = {};
  return cab.map((c, i) => {
    let n = String(c || '').replace(/\s+/g, ' ').trim() || `Coluna ${i + 1}`;
    if (vistos[n]) n = `${n} (${++vistos[n]})`; else vistos[n] = 1;
    return n;
  });
}

const PADROES = {
  nome_exibicao: [[/^nome completo/, 10], [/nome completo/, 9], [/^nome$/, 8], [/\bnome\b/, 5]],
  email: [[/^e-?mail$/, 10], [/endereco de e-?mail/, 9], [/e-?mail/, 7]],
  telefone: [[/whats/, 9], [/celular/, 9], [/telefone/, 8], [/\bfone\b|contato/, 5]],
  curso: [[/^curso/, 10], [/curso/, 7], [/graduacao/, 5]],
  semestre: [[/semestre/, 10], [/periodo/, 6]],
  foto_url: [[/foto/, 10], [/selfie|imagem/, 6]],
};
const EVITAR = { nome_exibicao: /e-?mail|curso|social|mae|pai|responsavel|usuario/ };

/** Sugere {campo: índiceDaColuna} pelo nome das colunas. Cada coluna vai para no máximo um campo. */
export function sugerirMapeamento(colunas) {
  const norm = colunas.map((c) => normalizarNome(c));
  const candidatos = [];
  Object.entries(PADROES).forEach(([campo, regras]) => {
    norm.forEach((n, i) => {
      if (EVITAR[campo] && EVITAR[campo].test(n)) return;
      const r = regras.find(([re]) => re.test(n));
      if (r) candidatos.push({ campo, i, pontos: r[1] });
    });
  });
  candidatos.sort((a, b) => b.pontos - a.pontos || a.i - b.i);
  const mapa = {}, usadas = new Set();
  candidatos.forEach(({ campo, i }) => {
    if (mapa[campo] !== undefined || usadas.has(i)) return;
    mapa[campo] = i; usadas.add(i);
  });
  return mapa;
}

/** Hash curto e estável (cyrb53) para identificar uma inscrição. */
export function hashTexto(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Identidade da inscrição: nome normalizado + email + dígitos do telefone. */
export function chaveInscricao(d) {
  return hashTexto([normalizarNome(d.nome_exibicao), normalizarEmail(d.email), soDigitos(d.telefone)].join('|'));
}

/** Link de arquivo do Google Drive (upload do Forms) -> miniatura. */
export function linkFoto(url) {
  const u = String(url || '').split(/[\s,]+/)[0];
  const m = u.match(/(?:id=|\/d\/)([A-Za-z0-9_-]{10,})/);
  if (m && /drive\.google\.com/.test(u)) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w240`;
  return /^https?:\/\//.test(u) ? u : '';
}

function ajeitarNome(n) {
  const s = String(n || '').replace(/\s+/g, ' ').trim();
  const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letras && (letras === letras.toUpperCase() || letras === letras.toLowerCase())) return nomeProprio(s);
  return s;
}

/**
 * Monta a pré-visualização.
 * @param matriz linhas (já limpas), @param iCab índice do cabeçalho, @param mapa {campo: índice}
 * @param existentes [{id, nome_exibicao, email}] candidatos já cadastrados
 * @param inscricoes [{candidato_id, hash}] hashes já importados
 * Cada linha: {n, dados, original, hash, tipo, alvo_id, problemas, acao, opcoes}
 *   tipo: 'novo' | 'ja_importado' | 'duplicado_cadastro' | 'duplicado_arquivo' | 'erro'
 *   acao: 'criar' | 'atualizar' | 'ignorar'
 */
export function montarPrevia(matriz, iCab, mapa, existentes = [], inscricoes = []) {
  const colunas = nomesDeColuna(matriz[iCab] || []);
  const porHash = {};
  inscricoes.forEach((i) => { porHash[i.hash] = i.candidato_id; });
  const porNome = {}, porEmail = {};
  existentes.forEach((c) => {
    const n = normalizarNome(c.nome_exibicao);
    if (n) porNome[n] = porNome[n] || c.id;
    const e = normalizarEmail(c.email);
    if (e) porEmail[e] = porEmail[e] || c.id;
  });
  const noArqNome = {}, noArqEmail = {};
  const pegar = (l, campo) => (mapa[campo] === undefined || mapa[campo] === null || mapa[campo] === '' ? '' : String(l[mapa[campo]] ?? '').trim());

  return matriz.slice(iCab + 1).map((l, k) => {
    const original = {};
    colunas.forEach((c, i) => { original[c] = l[i] ?? ''; });
    const dados = {
      nome_exibicao: ajeitarNome(pegar(l, 'nome_exibicao')),
      email: normalizarEmail(pegar(l, 'email')),
      telefone: pegar(l, 'telefone').replace(/\s+/g, ' '),
      curso: pegar(l, 'curso').replace(/\s+/g, ' '),
      semestre: pegar(l, 'semestre'),
      foto_url: linkFoto(pegar(l, 'foto_url')),
    };
    const problemas = [];
    const linha = { n: iCab + k + 2, dados, original, problemas, opcoes: ['criar', 'ignorar'] };
    if (!dados.nome_exibicao) {
      problemas.push('Nome vazio: a linha não será importada.');
      return { ...linha, hash: '', tipo: 'erro', acao: 'ignorar', opcoes: ['ignorar'] };
    }
    if (dados.email && !emailValido(dados.email)) {
      problemas.push(`Email inválido ("${dados.email}"): vai ficar em branco.`);
      dados.email = '';
    }
    if (pegar(l, 'foto_url') && !dados.foto_url) problemas.push('Link da foto não reconhecido: ficará sem foto.');
    const hash = chaveInscricao(dados);
    const nn = normalizarNome(dados.nome_exibicao);

    let r;
    if (porHash[hash]) {
      r = { tipo: 'ja_importado', alvo_id: porHash[hash], acao: 'ignorar', opcoes: ['ignorar', 'atualizar', 'criar'] };
      problemas.push(`Já importado antes (${porHash[hash]}).`);
    } else if (porNome[nn] || (dados.email && porEmail[dados.email])) {
      const alvo = porNome[nn] || porEmail[dados.email];
      r = { tipo: 'duplicado_cadastro', alvo_id: alvo, acao: 'ignorar', opcoes: ['ignorar', 'atualizar', 'criar'] };
      problemas.push(`Parece o candidato ${alvo}, já cadastrado (mesmo ${porNome[nn] ? 'nome' : 'email'}).`);
    } else if (noArqNome[nn] || (dados.email && noArqEmail[dados.email])) {
      const outra = noArqNome[nn] || noArqEmail[dados.email];
      r = { tipo: 'duplicado_arquivo', alvo_id: '', acao: 'ignorar', opcoes: ['ignorar', 'criar'] };
      problemas.push(`Repetido no arquivo (igual à linha ${outra}).`);
    } else {
      r = { tipo: 'novo', alvo_id: '', acao: 'criar', opcoes: ['criar', 'ignorar'] };
    }
    noArqNome[nn] = noArqNome[nn] || linha.n;
    if (dados.email) noArqEmail[dados.email] = noArqEmail[dados.email] || linha.n;
    return { ...linha, hash, ...r };
  });
}

/** Converte a pré-visualização no formato que a API recebe. */
export function paraEnvio(previa) {
  return previa.filter((l) => l.acao !== 'ignorar').map((l) => ({
    acao: l.acao,
    candidato_id: l.acao === 'atualizar' ? l.alvo_id : undefined,
    forcar: l.acao === 'criar' && l.tipo !== 'novo',
    dados: l.dados, original: l.original, hash: l.hash,
  }));
}

/** Resumo para mostrar antes de confirmar. */
export function resumoPrevia(previa) {
  const r = { total: previa.length, criar: 0, atualizar: 0, ignorar: 0, erros: 0, avisos: 0 };
  previa.forEach((l) => {
    r[l.acao]++;
    if (l.tipo === 'erro') r.erros++;
    else if (l.problemas.length) r.avisos++;
  });
  return r;
}
