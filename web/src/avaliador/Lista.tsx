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
  if (curto && (e === 'offline' || (semConexao && n > 0))) return <span class="salv offline" role="status">Sem conexão</span>;
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

function Linha({ c, s, abrir }: { c: Pacote['candidatos'][number]; s: ReturnType<Contexto['estado']>; abrir: (id: string) => void }) {
  return (
    <li>
      <button onClick={() => abrir(c.id)}>
        <Iniciais nome={c.nome} foto={c.foto_url} />
        <span class="nome"><b>{c.nome_curto}</b></span>
        <span class={'estado ' + s.tipo}>
          {s.tipo === 'completo' ? (s.tudoNA ? 'Não avaliei' : '✓') : s.tipo === 'parcial' ? `${s.feitos}/${s.total}` : ''}
        </span>
      </button>
    </li>
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
      <header class="av-topo lista">
        <div class="av-linha">
          <Simbolo />
          <div class="av-titulo"><b>{nomeEtapa || pacote.processo.nome || 'Avaliação'}</b></div>
          <Salvamento e={estadoFila.e} n={estadoFila.n} semConexao={semConexao} />
        </div>
        {abertas.length > 1 && (
          <div class="etapas" role="tablist" aria-label="Dinâmica">
            {abertas.map((e) => <button role="tab" aria-selected={e.id === ctx.etapa} onClick={() => trocarEtapa(e.id)}>{e.nome}</button>)}
          </div>
        )}
      </header>

      <main class="av-conteudo">
        {erro && <p class="aviso erro">{erro}</p>}
        {!ctx.aberta && <p class="aviso alerta">Avaliação fechada. Você só pode ver suas notas.</p>}
        {!total && <p class="aviso">Ainda não há candidatos.</p>}

        {equipe && (
          <section class="equipe-agora" aria-label={`${equipe.nome}, avalie agora`}>
            <h2><span>Avalie agora</span><b>{equipe.nome}</b><small>{feitosEquipe}/{daEquipe.length}</small></h2>
            <ul class="cands">{daEquipe.map((c) => <Linha c={c} s={estados[c.id]} abrir={abrir} />)}</ul>
          </section>
        )}
        {!equipe && total > 0 && <p class="esperando">Aguardando a próxima equipe. Você também pode avaliar qualquer candidato abaixo.</p>}

        {equipe && outros.length > 0 && (
          <button class="ver-todos" aria-expanded={verTodos} onClick={() => setVerTodos(!verTodos)}>
            {verTodos ? 'Esconder outros candidatos' : `Outros candidatos (${outros.length})`}
          </button>
        )}
        {mostrarOutros && outros.length > 0 && (
          <>
            {outros.length > 8 && <input class="entrada busca" type="search" placeholder="Buscar candidato" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar candidato" />}
            <ul class="cands">
              {visiveis.map((c) => <Linha c={c} s={estados[c.id]} abrir={abrir} />)}
              {!visiveis.length && <li class="vazio">Ninguém com esse nome.</li>}
            </ul>
          </>
        )}
      </main>
    </>
  );
}
