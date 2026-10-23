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
