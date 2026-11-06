// Painel do admin: carrega tudo da planilha e organiza em 4 seções.
// No celular a navegação fica numa barra fixa embaixo; no tablet, no topo.
// No desktop (≥ 1024 px) o topo vira o campo azul da direção B, com abas e o título da seção.
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { chamar, ErroApi, ErroRede, Sessao, sair, trocarSessao } from '../api';
import type { AdminDados } from '../tipos';
import { FaixaTeste, toast } from '../ui';
import { Assinatura } from '../marca';
import { Avaliadores } from './Avaliadores';
import { Candidatos } from './Candidatos';
import { Resultados } from './Resultados';
import { Configuracao } from './Configuracao';
import { EnsaioDados } from './EnsaioDados';
import { AoVivo } from './AoVivo';
import { AlvoCampo, I, useLargo } from './desktop';
import './admin-desktop.css';
import { FlaskConical, LoaderCircle, LogOut, Radio, Settings2, Sheet, Trophy, Users } from 'lucide-preact';

/** Opções de uma ação: aoErro recebe a mensagem (para mostrar dentro da janela, em vez do aviso no rodapé);
 *  semIndicador não acende o "Salvando…" do topo (consultas periódicas). */
export interface OpcoesAcao { aoErro?: (mensagem: string, codigo: string) => void; semIndicador?: boolean; }
export type Acao = <T = any>(nome: string, dados?: unknown, sucesso?: string, opcoes?: OpcoesAcao) => Promise<T | null>;

/** Texto do erro para o admin: conflito vem pronto do servidor; rede ganha a orientação de tentar de novo. */
export function mensagemErro(e: any) {
  if (e instanceof ErroRede) return e.message + ' Tente de novo: se já tiver sido gravado, o app avisa e não duplica.';
  return e?.message || 'Erro no servidor.';
}
export interface PropsAba { d: AdminDados; setD: (f: (d: AdminDados) => AdminDados) => void; acao: Acao; sessao: Sessao; recarregar: () => Promise<void>; }

const ICONES: Record<string, string> = {
  aovivo: 'M12 9a3 3 0 100 6 3 3 0 000-6zM6.3 6.3a8 8 0 000 11.4M17.7 6.3a8 8 0 010 11.4',
  ranking: 'M5 20V11M12 20V5M19 20v-6',
  pessoas: 'M9 4.8a3.2 3.2 0 110 6.4 3.2 3.2 0 010-6.4zM3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M16 5.2a3 3 0 010 5.6M17.5 14.7c1.6.5 2.6 1.9 3 4.3',
  ajustes: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5a2 2 0 110 4 2 2 0 010-4zM10 15a2 2 0 110 4 2 2 0 010-4z',
};
const SECOES = [['aovivo', 'Ao vivo'], ['ranking', 'Ranking'], ['pessoas', 'Pessoas'], ['ajustes', 'Ajustes']] as const;
type Secao = typeof SECOES[number][0];
// Ícones Lucide das seções no desktop (no celular a barra de baixo mantém os ícones atuais)
const ICONES_DESK = { aovivo: Radio, ranking: Trophy, pessoas: Users, ajustes: Settings2 };

function Icone({ d }: { d: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

/** Abas internas (Pessoas e Ajustes): controle segmentado discreto. */
function Sub<T extends string>({ opcoes, valor, aoMudar }: { opcoes: [T, string][]; valor: T; aoMudar: (v: T) => void }) {
  return (
    <div class="segmentado" role="tablist">
      {opcoes.map(([id, rot]) => <button role="tab" aria-selected={valor === id} onClick={() => aoMudar(id)}>{rot}</button>)}
    </div>
  );
}

export function Admin({ sessao, outras }: { sessao: Sessao; outras: Sessao[] }) {
  const [d, setDBruto] = useState<AdminDados | null>(null);
  const [erro, setErro] = useState('');
  const [secao, setSecao] = useState<Secao>('aovivo');
  const [pessoas, setPessoas] = useState<'candidatos' | 'avaliadores'>('candidatos');
  const [ajustes, setAjustes] = useState<'configuracao' | 'dados'>('configuracao');
  const [ocupado, setOcupado] = useState(false);
  const largo = useLargo();
  // Onde cada seção põe o próprio título, dentro do campo azul do topo (só no desktop)
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const dados = await chamar<AdminDados>(sessao, 'admin.iniciar', {}, 60000);
      setDBruto({ ...dados, equipes: dados.equipes || [] });
      setErro('');
      return;
    } catch (e: any) {
      setErro(e instanceof ErroApi && e.codigo === 'TOKEN_INVALIDO' ? 'Este link de admin não vale mais. Peça o link novo (menu "PS Proativa > Mostrar link do admin" na planilha).' : e.message);
    }
  }, [sessao]);

  useEffect(() => {
    recarregar().then(() => setDBruto((x) => { if (x && !x.candidatos.length) setSecao('pessoas'); return x; }));
  }, [recarregar]);

  const setD = useCallback((f: (d: AdminDados) => AdminDados) => setDBruto((x) => (x ? f(x) : x)), []);

  // Quantas ações estão em andamento: o "Salvando…" só apaga quando a última termina
  const emAndamento = useRef(0);
  const acao: Acao = useCallback(async (nome, dados = {}, sucesso, opcoes = {}) => {
    const conta = !opcoes.semIndicador;
    if (conta) { emAndamento.current++; setOcupado(true); }
    try {
      const r = await chamar(sessao, nome, dados, 90000);
      if (sucesso) toast(sucesso);
      return r;
    } catch (e: any) {
      const msg = mensagemErro(e);
      if (opcoes.aoErro) opcoes.aoErro(msg, e instanceof ErroApi ? e.codigo : 'REDE');
      else toast(msg, 6000);
      return null;
    } finally {
      if (conta && --emAndamento.current <= 0) { emAndamento.current = 0; setOcupado(false); }
    }
  }, [sessao]);

  if (erro && !d) return <div class="centro"><div class="cartao-simples"><h1>Não foi possível abrir o painel</h1><p class="aviso erro">{erro}</p><button class="botao" onClick={() => recarregar()}>Tentar de novo</button></div></div>;
  if (!d) return <div class="carregando" role="status">Carregando o painel…</div>;

  const ensaio = sessao.amb === 'ensaio' || String(d.config.modo).toUpperCase() === 'ENSAIO';
  const props: PropsAba = { d, setD, acao, sessao, recarregar };
  const ir = (s: Secao) => { setSecao(s); scrollTo(0, 0); };
  const subPessoas = <Sub opcoes={[['candidatos', `Candidatos · ${d.candidatos.length}`], ['avaliadores', `Avaliadores · ${d.avaliadores.filter((a) => a.ativo === 'SIM').length}`]]} valor={pessoas} aoMudar={setPessoas} />;
  const subAjustes = <Sub opcoes={[['configuracao', 'Configuração'], ['dados', 'Ensaio e dados']]} valor={ajustes} aoMudar={setAjustes} />;
  return (
    <div class={'adm' + (largo ? ' adm-desk' : '')}>
      {ensaio && (largo
        ? <div key="faixa" class="faixa-ensaio" role="note"><I c={FlaskConical} t={18} />Ambiente de ensaio. Os dados são fictícios.</div>
        : <FaixaTeste />)}
      {/* key: ao trocar celular/desktop, a faixa de ensaio muda de tipo e o Preact não pode confundir as duas divs */}
      <div key="corpo" class="adm-corpo">
      {largo ? (
        /* Desktop: campo azul com recorte diagonal ascendente (um por tela), abas e o título da seção */
        <header class="campo-azul">
          <div class="barra">
            <img class="marca-campo" src="./marca/kit-assinatura-negativa.png" alt="Proativa Jr." width={160} height={35} />
            <nav class="abas" aria-label="Seções">
              {SECOES.map(([id, rot]) => <button class="aba" aria-current={secao === id ? 'page' : undefined} onClick={() => ir(id)}><I c={ICONES_DESK[id]} />{rot}</button>)}
            </nav>
            <span class="espaco" />
            <span class={'status-campo' + (ocupado ? ' salvando' : '')} role="status">{ocupado ? <><I c={LoaderCircle} t={18} />Salvando…</> : d.config.nome_processo || 'PS'}</span>
          </div>
          <div class="titulo-campo">
            {secao === 'pessoas' && <><h1>Pessoas</h1>{subPessoas}</>}
            {secao === 'ajustes' && <><h1>Ajustes</h1>{subAjustes}</>}
            <div class="slot-campo" ref={setAlvo} />
          </div>
        </header>
      ) : (
      <header class="adm-topo">
        <div class="linha1">
          <Assinatura />
          <nav class="adm-nav" aria-label="Seções">
            {SECOES.map(([id, rot]) => <button aria-current={secao === id ? 'page' : undefined} onClick={() => ir(id)}><Icone d={ICONES[id]} />{rot}</button>)}
          </nav>
          <span class="espaco" />
          <span class={'adm-status' + (ocupado ? ' salvando' : '')} role="status">{ocupado ? 'Salvando…' : d.config.nome_processo || 'PS'}</span>
        </div>
      </header>
      )}

      <AlvoCampo.Provider value={largo ? alvo : null}>
      <main class="adm-conteudo">
        {secao === 'aovivo' && <AoVivo {...props} />}
        {secao === 'ranking' && <Resultados {...props} />}
        {secao === 'pessoas' && (
          <>
            {!largo && subPessoas}
            {pessoas === 'candidatos' ? <Candidatos {...props} /> : <Avaliadores {...props} />}
          </>
        )}
        {secao === 'ajustes' && (
          <>
            {!largo && subAjustes}
            {ajustes === 'configuracao' ? <Configuracao {...props} /> : <EnsaioDados {...props} />}
            <div class="adm-conta">
              {d.planilha_url && <a class="botao" href={d.planilha_url} target="_blank" rel="noopener">{largo && <I c={Sheet} />}Abrir planilha</a>}
              {outras.length > 0 && (
                <select class="entrada" aria-label="Trocar de acesso"
                  onChange={(e) => { const s = outras[Number((e.target as HTMLSelectElement).value)]; if (s) trocarSessao(s); }}>
                  <option>Trocar acesso…</option>
                  {outras.map((s, i) => <option value={i}>{s.perfil === 'admin' ? 'Admin' : 'Avaliador'} · {s.amb === 'ensaio' ? 'ensaio' : 'produção'}</option>)}
                </select>
              )}
              <button class="botao leve" onClick={() => { if (confirm('Sair deste aparelho? Você vai precisar do link de admin para entrar de novo.')) sair(sessao); }}>{largo && <I c={LogOut} />}Sair deste aparelho</button>
            </div>
          </>
        )}
      </main>
      </AlvoCampo.Provider>
      </div>

      <nav class="adm-barra" aria-label="Seções">
        {SECOES.map(([id, rot]) => (
          <button aria-current={secao === id ? 'page' : undefined} onClick={() => ir(id)}><Icone d={ICONES[id]} />{rot}</button>
        ))}
      </nav>
    </div>
  );
}
