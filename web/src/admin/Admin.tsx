// Painel do admin: carrega tudo da planilha e organiza em abas.
import { useCallback, useEffect, useState } from 'preact/hooks';
import { chamar, ErroApi, Sessao, sair, trocarSessao } from '../api';
import type { AdminDados } from '../tipos';
import { FaixaTeste, toast } from '../ui';
import { Assinatura } from '../marca';
import { Avaliadores } from './Avaliadores';
import { Candidatos } from './Candidatos';
import { Resultados } from './Resultados';
import { Configuracao } from './Configuracao';
import { EnsaioDados } from './EnsaioDados';
import { Votacao } from './Votacao';

export type Acao = <T = any>(nome: string, dados?: unknown, sucesso?: string) => Promise<T | null>;
export interface PropsAba { d: AdminDados; setD: (f: (d: AdminDados) => AdminDados) => void; acao: Acao; sessao: Sessao; recarregar: () => Promise<void>; }

const ABAS = [
  ['resultados', 'Resultados'],
  ['votacao', 'Votação'],
  ['candidatos', 'Candidatos'],
  ['avaliadores', 'Avaliadores'],
  ['configuracao', 'Configuração'],
  ['dados', 'Ensaio e dados'],
] as const;
type Aba = typeof ABAS[number][0];

export function Admin({ sessao, outras }: { sessao: Sessao; outras: Sessao[] }) {
  const [d, setDBruto] = useState<AdminDados | null>(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<Aba>('resultados');
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const dados = await chamar<AdminDados>(sessao, 'admin.iniciar', {}, 60000);
      setDBruto(dados);
      setErro('');
      return;
    } catch (e: any) {
      setErro(e instanceof ErroApi && e.codigo === 'TOKEN_INVALIDO' ? 'Este link de admin não vale mais. Peça o link novo (menu "PS Proativa > Mostrar link do admin" na planilha).' : e.message);
    }
  }, [sessao]);

  useEffect(() => {
    recarregar().then(() => setDBruto((x) => { if (x && !x.candidatos.length) setAba('candidatos'); return x; }));
  }, [recarregar]);

  const setD = useCallback((f: (d: AdminDados) => AdminDados) => setDBruto((x) => (x ? f(x) : x)), []);

  const acao: Acao = useCallback(async (nome, dados = {}, sucesso) => {
    setOcupado(true);
    try {
      const r = await chamar(sessao, nome, dados, 90000);
      if (sucesso) toast(sucesso);
      return r;
    } catch (e: any) {
      toast(e.message || 'Erro');
      return null;
    } finally {
      setOcupado(false);
    }
  }, [sessao]);

  if (erro && !d) return <div class="centro"><div class="cartao-simples"><h1>Não foi possível abrir o painel</h1><p class="aviso erro">{erro}</p><button class="botao" onClick={() => recarregar()}>Tentar de novo</button></div></div>;
  if (!d) return <div class="carregando">Carregando o painel…</div>;

  const ensaio = sessao.amb === 'ensaio' || String(d.config.modo).toUpperCase() === 'ENSAIO';
  const props: PropsAba = { d, setD, acao, sessao, recarregar };
  return (
    <>
      {ensaio && <FaixaTeste />}
      <header class="adm-topo">
        <div class="linha1">
          <Assinatura />
          <h1>{d.config.nome_processo || 'Processo seletivo'} · Painel do admin</h1>
          {ocupado && <span class="selo marca" role="status">Salvando…</span>}
          {d.planilha_url && <a class="botao pequeno" href={d.planilha_url} target="_blank" rel="noopener">Abrir planilha</a>}
          {outras.length > 0 && (
            <select class="entrada" style={{ width: 'auto', minHeight: 36 }} aria-label="Trocar de acesso"
              onChange={(e) => { const s = outras[Number((e.target as HTMLSelectElement).value)]; if (s) trocarSessao(s); }}>
              <option>Trocar acesso…</option>
              {outras.map((s, i) => <option value={i}>{s.perfil === 'admin' ? 'Admin' : 'Avaliador'} · {s.amb === 'ensaio' ? 'ensaio' : 'produção'}</option>)}
            </select>
          )}
          <button class="botao pequeno leve" onClick={() => { if (confirm('Sair deste aparelho? Você vai precisar do link de admin para entrar de novo.')) sair(sessao); }}>Sair</button>
        </div>
        <nav class="adm-abas" aria-label="Seções">
          {ABAS.map(([id, rotulo]) => (
            <button aria-current={aba === id ? 'page' : undefined} onClick={() => setAba(id)}>
              {rotulo}{id === 'candidatos' ? ` (${d.candidatos.length})` : id === 'avaliadores' ? ` (${d.avaliadores.filter((a) => a.ativo === 'SIM').length})` : ''}
            </button>
          ))}
        </nav>
      </header>
      <main class="adm-conteudo">
        {aba === 'resultados' && <Resultados {...props} />}
        {aba === 'votacao' && <Votacao {...props} />}
        {aba === 'candidatos' && <Candidatos {...props} />}
        {aba === 'avaliadores' && <Avaliadores {...props} />}
        {aba === 'configuracao' && <Configuracao {...props} />}
        {aba === 'dados' && <EnsaioDados {...props} />}
      </main>
    </>
  );
}
