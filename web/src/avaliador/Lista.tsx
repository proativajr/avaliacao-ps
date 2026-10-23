// Lista de candidatos do avaliador: busca fixa, filtros, progresso e "em votação agora".
import { useMemo, useState } from 'preact/hooks';
import { normalizarNome } from '@shared/texto.js';
import { gravar, ler } from '../api';
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

const FILTROS = [['todos', 'Todos'], ['pendente', 'Pendentes'], ['parcial', 'Parciais'], ['completo', 'Completos']] as const;

export function Lista({ ctx, estadoFila, semConexao, abertas, trocarEtapa, abrir, erro }: PropsTela) {
  const { pacote } = ctx;
  const [busca, setBusca] = useState('');
  const [filtro, setFiltroBruto] = useState<string>(ler('filtro') || 'todos');
  const setFiltro = (f: string) => { setFiltroBruto(f); gravar('filtro', f); };

  const estados = useMemo(() => Object.fromEntries(pacote.candidatos.map((c) => [c.id, ctx.estado(c.id)])), [pacote.candidatos, ctx]);
  const completos = pacote.candidatos.filter((c) => estados[c.id].tipo === 'completo').length;
  const total = pacote.candidatos.length;
  const visiveis = pacote.candidatos.filter((c) => (filtro === 'todos' || estados[c.id].tipo === filtro) &&
    (!busca || normalizarNome(c.nome + ' ' + c.nome_curto).includes(normalizarNome(busca))));
  const votacao = pacote.em_votacao.map((id) => pacote.candidatos.find((c) => c.id === id)).filter(Boolean) as Pacote['candidatos'];
  const nomeEtapa = pacote.etapas.find((e) => e.id === ctx.etapa)?.nome || '';
  const contagem = (f: string) => (f === 'todos' ? total : pacote.candidatos.filter((c) => estados[c.id].tipo === f).length);

  return (
    <>
      <header class="av-topo lista">
        <div class="av-linha">
          <Simbolo />
          <div class="av-titulo">
            <b>{pacote.processo.nome || 'Processo seletivo'}</b>
            <small>Olá, {pacote.eu.nome.split(' ')[0]}</small>
          </div>
          <Salvamento e={estadoFila.e} n={estadoFila.n} semConexao={semConexao} />
        </div>
        {abertas.length > 1 ? (
          <div class="etapas" role="tablist" aria-label="Etapa">
            {abertas.map((e) => <button role="tab" aria-selected={e.id === ctx.etapa} onClick={() => trocarEtapa(e.id)}>{e.nome}</button>)}
          </div>
        ) : <p class="etapa-unica">Etapa: <b>{nomeEtapa}</b>{!ctx.aberta && ' · avaliação fechada'}</p>}
        <div class="progresso" aria-label={`Você avaliou ${completos} de ${total}`}>
          <div class="barra"><span style={{ width: total ? `${(completos / total) * 100}%` : 0 }} /></div>
          <span>Você avaliou <b>{completos}</b> de {total}</span>
        </div>
        <input class="entrada busca" type="search" placeholder="Buscar candidato" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar candidato" />
        <div class="filtros" role="radiogroup" aria-label="Filtro">
          {FILTROS.map(([id, rot]) => <button role="radio" aria-checked={filtro === id} onClick={() => setFiltro(id)}>{rot} <small>{contagem(id)}</small></button>)}
        </div>
      </header>

      <main class="av-conteudo">
        {erro && <p class="aviso erro">{erro}</p>}
        {!ctx.aberta && <p class="aviso alerta">A avaliação desta etapa está fechada. Você pode ver suas notas, mas não alterar.</p>}
        {votacao.length > 0 && ctx.aberta && (
          <section class="votacao" aria-label="Em votação agora">
            <b>Em votação agora</b>
            <div>{votacao.map((c) => (
              <button class="botao principal" onClick={() => abrir(c.id)}>{c.nome_curto} {estados[c.id].tipo === 'completo' ? '✓' : ''}</button>
            ))}</div>
          </section>
        )}
        {!total && <p class="aviso">Ainda não há candidatos cadastrados. Volte quando o admin avisar.</p>}
        <ul class="cands">
          {visiveis.map((c) => {
            const s = estados[c.id];
            return (
              <li>
                <button onClick={() => abrir(c.id)}>
                  <Iniciais nome={c.nome} foto={c.foto_url} />
                  <span class="nome"><b>{c.nome_curto}</b>{c.nome !== c.nome_curto && <small>{c.nome}</small>}</span>
                  <span class={'estado ' + s.tipo}>
                    {s.tipo === 'completo' ? (s.tudoNA ? 'Não avaliei' : 'Completo ✓') : s.tipo === 'parcial' ? `${s.feitos}/${s.total}` : 'Pendente'}
                  </span>
                </button>
              </li>
            );
          })}
          {total > 0 && !visiveis.length && <li class="vazio">Nenhum candidato neste filtro.</li>}
        </ul>
      </main>
    </>
  );
}
