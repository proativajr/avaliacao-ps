// Funções de texto compartilhadas entre o app (navegador), o Apps Script e os testes.
// Este arquivo não pode ter "import": o build do Apps Script só remove a palavra "export".

/** Normaliza um nome para comparar duplicados: sem acento, minúsculas, sem espaços extras. */
export function normalizarNome(texto) {
  return String(texto == null ? '' : texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normaliza email: minúsculas e sem espaços. */
export function normalizarEmail(texto) {
  return String(texto == null ? '' : texto).trim().toLowerCase();
}

/** Email simples: algo@algo.algo, sem espaços. */
export function emailValido(texto) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(texto || '').trim());
}

/** Deixa só dígitos do telefone (mantém o texto original para exibição em outro campo). */
export function soDigitos(texto) {
  return String(texto == null ? '' : texto).replace(/\D+/g, '');
}

/** "maria  da silva " -> "Maria da Silva" (preposições minúsculas). */
export function nomeProprio(texto) {
  const minusculas = ['da', 'de', 'do', 'das', 'dos', 'e'];
  return String(texto == null ? '' : texto)
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((p, i) => {
      const baixo = p.toLowerCase();
      if (i > 0 && minusculas.indexOf(baixo) >= 0) return baixo;
      return baixo.charAt(0).toUpperCase() + baixo.slice(1);
    })
    .join(' ');
}

/**
 * Nomes curtos para os avaliadores: primeiro nome, e o último sobrenome
 * quando dois candidatos têm o mesmo primeiro nome (se ainda empatar, usa o nome completo).
 * Recebe [{id, nome}] e devolve {id: nomeCurto}.
 */
export function nomesParaAvaliador(candidatos) {
  const partes = candidatos.map((c) => {
    const p = String(c.nome || '').replace(/\s+/g, ' ').trim().split(' ');
    return { id: c.id, completo: p.join(' '), primeiro: p[0] || '', ultimo: p.length > 1 ? p[p.length - 1] : '' };
  });
  const contar = (lista, chave) => {
    const m = {};
    lista.forEach((x) => { const k = normalizarNome(x[chave]); m[k] = (m[k] || 0) + 1; });
    return m;
  };
  const porPrimeiro = contar(partes, 'primeiro');
  partes.forEach((x) => { x.curto = porPrimeiro[normalizarNome(x.primeiro)] > 1 ? (x.primeiro + ' ' + x.ultimo).trim() : x.primeiro; });
  const porCurto = contar(partes, 'curto');
  const saida = {};
  partes.forEach((x) => { saida[x.id] = porCurto[normalizarNome(x.curto)] > 1 ? x.completo : x.curto; });
  return saida;
}

/** Diretorias da Proativa: as únicas opções aceitas no cadastro de avaliador. */
export const DIRETORIAS = ['Projetos', 'Vice-presidência', 'Comercial', 'Presidência Executiva'];

/**
 * Converte um texto livre antigo de "área" numa das DIRETORIAS. Devolve '' quando não dá para saber.
 * Aceita variações comuns: "projeto", "Diretoria de Projetos", "VP", "vice presidência", "PE", "presidência"…
 */
export function mapearDiretoria(texto) {
  const n = normalizarNome(texto).replace(/[-_./]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(diretoria|dir)( de| da| do)? /, '');
  if (!n) return '';
  for (const d of DIRETORIAS) if (normalizarNome(d).replace(/-/g, ' ') === n) return d;
  if (/^projetos?$|^proj$/.test(n)) return 'Projetos';
  if (/^vice( presidencia| presidente)?$|^vp$|^vpres$/.test(n)) return 'Vice-presidência';
  if (/^comercial$|^com$/.test(n)) return 'Comercial';
  if (/^presidencia( executiva)?$|^presidente( executivo| executiva)?$|^pe$|^executiva$/.test(n)) return 'Presidência Executiva';
  return '';
}

/** Valor exatamente igual a uma das DIRETORIAS (ignorando maiúsculas e acentos) -> forma oficial; senão ''. */
export function diretoriaValida(texto) {
  const n = normalizarNome(texto);
  for (const d of DIRETORIAS) if (normalizarNome(d) === n) return d;
  return '';
}

/**
 * Grupos de registros repetidos por nome (sem acento e caixa) e/ou email.
 * campos: lista de [rótulo, função que devolve a chave]. Chave vazia não conta.
 * Devolve [{campo, valor, ids: [...]}] só para chaves com 2 ou mais registros. Não altera nada.
 */
export function gruposDuplicados(lista, campos) {
  const grupos = [];
  campos.forEach(function (c) {
    const porChave = {};
    lista.forEach(function (o) {
      const k = c[1](o);
      if (!k) return;
      (porChave[k] = porChave[k] || []).push(String(o.id));
    });
    Object.keys(porChave).forEach(function (k) {
      if (porChave[k].length > 1) grupos.push({ campo: c[0], valor: k, ids: porChave[k] });
    });
  });
  return grupos;
}

/** Duplicados de avaliadores (mesmo nome ou mesmo email) e de candidatos (mesmo email). */
export function duplicadosCadastro(avaliadores, candidatos) {
  return {
    avaliadores: gruposDuplicados(avaliadores || [], [
      ['nome', function (a) { return normalizarNome(a.nome); }],
      ['email', function (a) { return normalizarEmail(a.email); }],
    ]),
    candidatos: gruposDuplicados(candidatos || [], [['email', function (c) { return normalizarEmail(c.email); }]]),
  };
}

/** Personas da Dinâmica 3 (Material de apoio). */
export const PERSONAS_D3 = {
  cancelar: { nome: 'O Cliente que Ameaça Cancelar', resumo: 'Gestor irritado com a última entrega, pensa em encerrar o contrato e quer respostas concretas, não desculpas.' },
  nao_sabe: { nome: 'O Cliente que Não Sabe o que Quer', resumo: 'Empresário ansioso que fala muito, pula de assunto, se contradiz e pressiona por soluções rápidas.' },
  testa: { nome: 'O Cliente que Testa o Consultor', resumo: 'Diretor calmo que fala pouco e faz perguntas cirúrgicas. Aperta, com educação, quando a resposta é vaga.' },
  culpa: { nome: 'O Cliente que Culpa a Equipe', resumo: 'Sócio na defensiva que atribui os problemas à consultoria e toma qualquer pergunta como ataque.' },
  comparativo: { nome: 'O Cliente Comparativo', resumo: 'Compara o tempo todo com a consultoria anterior e com concorrentes mais baratos para desestabilizar.' },
  sabe_tudo: { nome: 'O Cliente que Sabe Tudo', resumo: 'Leu alguns artigos e questiona cada metodologia, interrompendo com sugestões equivocadas.' },
};

