// Lista de candidatos do avaliador: busca fixa, filtros, progresso e "em votação agora".
import { useMemo, useState } from 'preact/hooks';
import { normalizarNome } from '@shared/texto.js';
import type { Contexto, Pacote } from './Avaliador';
import type { EstadoFila } from './fila';
import { Simbolo } from '../marca';

export interface PropsTela {
  ctx: Contexto; estadoFila: { e: EstadoFila; n: number }; semConexao: boolean; erro: string;
  abertas: Pacote['etapas']; trocarEtapa: (id: string) => void; abrir: (cand: string | null) => void;
}

export function Salvamento({ e, n, semConexao, curto }: { e: EstadoFila; n: number; semConexao?: boolean; curto?: boolean }) {
  if (curto && (e === 'offline' || (semConexao && n > 0))) return <span class="salv offline" role="status"><i />Sem conexão</span>;
  if (curto && e === 'erro') return <span class="salv erro" role="status"><i />Erro, tentando</span>;
  if (curto && (e === 'salvando' || e === 'pendente')) return <span class="salv" role="status"><i />Salvando</span>;
  if (curto) return <span class="salv ok" role="status"><i />{semConexao ? 'Sem conexão' : 'Salvo'}</span>;
  if (e === 'offline' || (semConexao && n > 0)) return <span class="salv offline" role="status">Sem conexão: {n > 1 ? `${n} itens serão enviados` : 'será enviado'}</span>;
  if (e === 'erro') return <span class="salv erro" role="status">Erro ao salvar: tentando de novo</span>;
  if (e === 'salvando' || e === 'pendente') return <span class="salv" role="status">Salvando…</span>;
  return <span class="salv ok" role="status">{semConexao ? 'Sem conexão' : 'Salvo ✓'}</span>;
}

export function Iniciais({ nome, foto, tam = 40 }: { nome: string; foto?: string; tam?: number }) {
  const [falhou, setFalhou] = useState(false);
  const ini = nome.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  if (foto && !falhou) return <img class="avatar" src={foto} alt="" width={tam} height={tam} referrerPolicy="no-referrer" onError={() => setFalhou(true)} />;
  return <span class="avatar" style={{ width: tam, height: tam }} aria-hidden="true">{ini}</span>;
}

const CHECK = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Avaliado"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const SETA = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>;

function Linha({ c, s, abrir }: { c: Pacote['candidatos'][number]; s: ReturnType<Contexto['estado']>; abrir: (id: string) => void }) {
  const feito = s.tipo === 'completo';
  return (
    <li>
      <button onClick={() => abrir(c.id)}>
        <span class={'av-ini' + (feito ? ' feito' : '')}><Iniciais nome={c.nome} foto={c.foto_url} tam={44} /></span>
        <span class="nome">{c.nome_curto}</span>
        <span class={'estado ' + s.tipo}>
          {feito ? (s.tudoNA ? 'Não avaliei' : CHECK) : s.tipo === 'parcial' ? `${s.feitos} de ${s.total}` : SETA}
        </span>
      </button>
    </li>
  );
}

/** Topo comum: símbolo, nome da dinâmica e o estado de salvamento. */
export function Topo({ titulo, estadoFila, semConexao }: { titulo: string; estadoFila: PropsTela['estadoFila']; semConexao: boolean }) {
  return (
    <header class="av-topo">
      <div class="av-linha">
        <Simbolo />
        <span class="av-titulo">{titulo}</span>
        <Salvamento e={estadoFila.e} n={estadoFila.n} semConexao={semConexao} curto />
      </div>
    </header>
  );
}

export function Lista({ ctx, estadoFila, semConexao, abertas, trocarEtapa, abrir, erro }: PropsTela) {
  const { pacote, equipe } = ctx;
  const [busca, setBusca] = useState('');
  const [verTodos, setVerTodos] = useState(false);

  const estados = useMemo(() => Object.fromEntries(pacote.candidatos.map((c) => [c.id, ctx.estado(c.id)])), [pacote.candidatos, ctx]);
  const total = pacote.candidatos.length;
  const daEquipe = equipe ? equipe.ids.map((id) => pacote.candidatos.find((c) => c.id === id)!).filter(Boolean) : [];
  const outros = pacote.candidatos.filter((c) => !equipe || !equipe.ids.includes(c.id));
  const visiveis = outros.filter((c) => !busca || normalizarNome(c.nome + ' ' + c.nome_curto).includes(normalizarNome(busca)));
  const nomeEtapa = pacote.etapas.find((e) => e.id === ctx.etapa)?.nome || '';
  const feitosEquipe = daEquipe.filter((c) => estados[c.id].tipo === 'completo').length;
  const mostrarOutros = !equipe || verTodos;

  return (
    <>
      <Topo titulo={nomeEtapa || pacote.processo.nome || 'Avaliação'} estadoFila={estadoFila} semConexao={semConexao} />
      {abertas.length > 1 && (
        <div class="etapas" role="tablist" aria-label="Dinâmica">
          {abertas.map((e) => <button role="tab" aria-selected={e.id === ctx.etapa} onClick={() => trocarEtapa(e.id)}>{e.nome}</button>)}
        </div>
      )}

      <main class="av-conteudo">
        {erro && <p class="aviso erro">{erro}</p>}
        {!ctx.aberta && <p class="aviso alerta">Avaliação fechada. Você só pode ver suas notas.</p>}
        {!total && <p class="aviso">Ainda não há candidatos.</p>}

        {equipe ? (
          <section class="equipe-agora" aria-label={`${equipe.nome}, avalie agora`}>
            <span class="sobrelinha">Avalie agora</span>
            <div class="eq-titulo"><h1>{equipe.nome}</h1><span>{feitosEquipe} de {daEquipe.length}</span></div>
            <div class="segmentos" aria-hidden="true">{daEquipe.map((c) => <span class={estados[c.id].tipo === 'completo' ? 'ok' : ''} />)}</div>
            <ul class="cands grande">{daEquipe.map((c) => <Linha c={c} s={estados[c.id]} abrir={abrir} />)}</ul>
          </section>
        ) : total > 0 && (
          <section class="espera">
            <span class="sobrelinha"><i />Aguardando</span>
            <h1>A próxima equipe aparece aqui sozinha.</h1>
            <p>Enquanto isso, você pode revisar qualquer candidato.</p>
          </section>
        )}

        {mostrarOutros && outros.length > 0 && (
          <>
            {outros.length > 8 && (
              <label class="busca">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
                <input type="search" placeholder="Buscar candidato" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar candidato" />
              </label>
            )}
            <ul class="cands">
              {visiveis.map((c) => <Linha c={c} s={estados[c.id]} abrir={abrir} />)}
              {!visiveis.length && <li class="vazio">Ninguém com esse nome.</li>}
            </ul>
          </>
        )}
        {equipe && outros.length > 0 && (
          <button class="ver-todos" aria-expanded={verTodos} onClick={() => setVerTodos(!verTodos)}>
            {verTodos ? 'Esconder outros candidatos' : `Outros candidatos · ${outros.length}`}
          </button>
        )}
      </main>
    </>
  );
}
