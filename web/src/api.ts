// Comunicação com o Apps Script e identificação de quem está usando o app.
// O token vem no fragmento do link (#t=... ou #adm=...), que não é enviado a servidores
// nem fica nos logs; o app guarda no aparelho e tira do endereço.

export type Ambiente = 'producao' | 'ensaio';
export type Perfil = 'avaliador' | 'admin';

declare global {
  interface Window { PS_CONFIG?: { api?: Partial<Record<Ambiente, string>> }; }
}

const PREFIXO = 'ps:';

export function ler(chave: string): string | null {
  try { return localStorage.getItem(PREFIXO + chave); } catch { return null; }
}
export function gravar(chave: string, valor: string | null) {
  try { valor === null ? localStorage.removeItem(PREFIXO + chave) : localStorage.setItem(PREFIXO + chave, valor); } catch { /* sem armazenamento */ }
}

export interface Sessao { perfil: Perfil; token: string; amb: Ambiente; }

/** Lê o link (#t=, #adm=, &amb=ensaio) ou a última sessão guardada no aparelho. */
export function lerSessao(): { atual: Sessao | null; outras: Sessao[] } {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const amb: Ambiente = hash.get('amb') === 'ensaio' ? 'ensaio' : 'producao';
  const t = hash.get('t'), adm = hash.get('adm');
  if (t || adm) {
    const perfil: Perfil = adm ? 'admin' : 'avaliador';
    gravar(`${amb}:${perfil}`, (adm || t) as string);
    gravar('ultima', `${amb}:${perfil}`);
    history.replaceState(null, '', location.pathname + location.search);
  }
  const todas: Sessao[] = [];
  (['producao', 'ensaio'] as Ambiente[]).forEach((a) => (['admin', 'avaliador'] as Perfil[]).forEach((p) => {
    const tk = ler(`${a}:${p}`);
    if (tk) todas.push({ perfil: p, token: tk, amb: a });
  }));
  const ultima = ler('ultima');
  const atual = todas.find((s) => `${s.amb}:${s.perfil}` === ultima) || todas[0] || null;
  return { atual, outras: todas.filter((s) => s !== atual) };
}

export function trocarSessao(s: Sessao) {
  gravar('ultima', `${s.amb}:${s.perfil}`);
  location.reload();
}

export function sair(s: Sessao) {
  gravar(`${s.amb}:${s.perfil}`, null);
  gravar('ultima', null);
  location.reload();
}

export function urlApi(amb: Ambiente): string {
  return (window.PS_CONFIG?.api?.[amb] || '').trim();
}

/** Endereço base do site (para montar os links dos avaliadores). */
export function urlSite(): string {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

export function linkAvaliador(token: string, amb: Ambiente) {
  return `${urlSite()}#t=${token}${amb === 'ensaio' ? '&amb=ensaio' : ''}`;
}

export class ErroApi extends Error {
  codigo: string;
  constructor(codigo: string, mensagem: string) { super(mensagem); this.codigo = codigo; }
}
export class ErroRede extends Error {}

/**
 * Chama uma ação da API. Usa POST com Content-Type text/plain para o navegador
 * não fazer a checagem prévia de CORS (o Apps Script não responde a ela).
 */
export async function chamar<T = any>(sessao: Sessao, acao: string, dados: unknown = {}, tempoMs = 30000): Promise<T> {
  const url = urlApi(sessao.amb);
  if (!url) throw new ErroApi('CONFIG', `O endereço da API (${sessao.amb}) não está configurado no arquivo config.js.`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), tempoMs);
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao, token: sessao.token, dados }),
      redirect: 'follow',
      signal: ctrl.signal,
      credentials: 'omit',
    });
  } catch {
    throw new ErroRede('Sem conexão com o servidor.');
  } finally {
    clearTimeout(timer);
  }
  let json: any;
  try { json = await resp.json(); } catch { throw new ErroRede('Resposta inesperada do servidor (' + resp.status + ').'); }
  if (!json.ok) throw new ErroApi(json.codigo || 'ERRO', json.erro || 'Erro no servidor.');
  return json.dados as T;
}
