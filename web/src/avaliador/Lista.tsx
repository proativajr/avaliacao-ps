// Lista de candidatos do avaliador: busca fixa, filtros, progresso e "em votação agora".
import { useMemo, useState } from 'preact/hooks';
import { normalizarNome } from '@shared/texto.js';
import type { Contexto, Pacote, Papel } from './Avaliador';
import type { EstadoFila } from './fila';
import { Simbolo } from '../marca';
import { Foto } from './Foto';

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

const CHECK = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Avaliado"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const SETA = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>;

function Linha({ c, s, abrir, sufixo = '', so_ver = false }: { c: Pacote['candidatos'][number]; s: ReturnType<Contexto['estado']>; abrir: (id: string) => void; sufixo?: string; so_ver?: boolean }) {
  const feito = s.tipo === 'completo';
  const miolo = (
    <>
      <span class={'av-ini' + (feito ? ' feito' : '')}><Foto nome={c.nome} foto={c.foto_url} tam={44} /></span>
      <span class="nome">{c.nome_curto}</span>
      <span class={'estado ' + s.tipo}>
        {feito ? (s.tudoNA ? 'Não avaliei' : CHECK) : s.tipo === 'parcial' ? `${s.feitos} de ${s.total}` : so_ver ? null : SETA}
      </span>
    </>
  );
  // Fora do momento liberado: o participante aparece na lista, mas não abre para avaliar.
  if (so_ver) return <li><div class="so-ver">{miolo}</div></li>;
  return <li><button onClick={() => abrir(c.id + sufixo)}>{miolo}</button></li>;
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
  const { pacote, equipe, construcao, salasAp, papeis } = ctx;
  const [busca, setBusca] = useState('');
  const [verTodos, setVerTodos] = useState(false);

  const estados = useMemo(() => Object.fromEntries(pacote.candidatos.map((c) => [c.id, ctx.estado(c.id)])), [pacote.candidatos, ctx]);
  const total = pacote.candidatos.length;
  const daEquipe = equipe ? equipe.ids.map((id) => pacote.candidatos.find((c) => c.id === id)!).filter(Boolean) : [];
  const emEquipe = new Set([...(equipe ? equipe.ids : []), ...construcao.flatMap((q) => q.ids), ...salasAp.flatMap((q) => q.ids)]);
  const destaque = !!equipe || construcao.length > 0 || salasAp.length > 0;
  const narrando = papeis.filter((p) => p.papel === 'narrador');
  const avaliando = papeis.filter((p) => p.papel === 'avaliador');
  // Com a regra "só designados na Apresentação", some quem é de equipe de outros avaliadores.
  const outros = pacote.candidatos.filter((c) => (!destaque || !emEquipe.has(c.id)) && !ctx.fora.has(c.id));
  const visiveis = outros.filter((c) => !busca || normalizarNome(c.nome + ' ' + c.nome_curto).includes(normalizarNome(busca)));
  const nomeEtapa = pacote.etapas.find((e) => e.id === ctx.etapa)?.nome || '';
  const feitosEquipe = daEquipe.filter((c) => estados[c.id].tipo === 'completo').length;
  const mostrarOutros = !destaque || verTodos;

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
        {!ctx.aberta && <p class="aviso alerta">{ctx.soNoMomento ? 'Avaliação fechada.' : 'Avaliação fechada. Você só pode ver suas notas.'}</p>}
        {!total && <p class="aviso">Ainda não há candidatos.</p>}

        {equipe ? (
          <section class="equipe-agora" aria-label={`${equipe.nome}, avalie agora`}>
            <span class="sobrelinha">Avalie agora</span>
            <div class="eq-titulo"><h1>{equipe.nome}</h1><span>{feitosEquipe} de {daEquipe.length}</span></div>
            <div class="segmentos" aria-hidden="true">{daEquipe.map((c) => <span class={estados[c.id].tipo === 'completo' ? 'ok' : ''} />)}</div>
            <ul class="cands grande">{daEquipe.map((c) => <Linha c={c} s={estados[c.id]} abrir={abrir} />)}</ul>
          </section>
        ) : total > 0 && !construcao.length && !salasAp.length && (
          <section class="espera">
            <span class="sobrelinha"><i />Aguardando</span>
            {ctx.salas && !avaliando.length
              ? narrando.length
                ? <><h1>Nesta dinâmica você é o narrador.</h1><p>Você conduz o grupo e não avalia. Faça a visão geral e depois só responda ao que for perguntado.</p></>
                : <><h1>Você não está em nenhum grupo desta dinâmica.</h1><p>Se isso estiver errado, fale com o admin.</p></>
            : ctx.salas
              ? <><h1>{avaliando.map((p) => p.nome).join(' e ')} aparece aqui sozinho.</h1><p>A avaliação abre quando o admin iniciar a {ctx.nomeC.toLowerCase()} ou a {ctx.nomeA.toLowerCase()}.</p></>
            : ctx.equipeDeOutros
              ? <><h1>{ctx.equipeDeOutros} está apresentando.</h1><p>Ela é avaliada pelos avaliadores designados a ela. Quando for a vez de uma equipe sua, ela aparece aqui sozinha.</p></>
              : ctx.soNoMomento
                ? <><h1>A próxima equipe aparece aqui sozinha.</h1><p>A avaliação abre quando o admin liberar a construção ou a apresentação de uma equipe. Enquanto isso, você vê os participantes.</p></>
                : <><h1>A próxima equipe aparece aqui sozinha.</h1><p>Enquanto isso, você pode revisar qualquer candidato.</p></>}
          </section>
        )}

        {papeis.length > 0 && <Papeis papeis={papeis} />}

        {salasAp.map((q) => {
          const cs = q.ids.map((id) => pacote.candidatos.find((c) => c.id === id)!).filter(Boolean);
          const feitos = cs.filter((c) => estados[c.id].tipo === 'completo').length;
          return (
            <section class="equipe-agora" aria-label={`${q.nome}, ${ctx.nomeA}, avalie agora`}>
              <span class="sobrelinha">{ctx.nomeA} · você avalia</span>
              <div class="eq-titulo"><h1>{q.nome}</h1><span>{feitos} de {cs.length}</span></div>
              <div class="segmentos" aria-hidden="true">{cs.map((c) => <span class={estados[c.id].tipo === 'completo' ? 'ok' : ''} />)}</div>
              <ul class="cands grande">{cs.map((c) => <Linha c={c} s={estados[c.id]} abrir={abrir} />)}</ul>
            </section>
          );
        })}

        {construcao.map((q) => {
          const cs = q.ids.map((id) => pacote.candidatos.find((c) => c.id === id)!).filter(Boolean);
          const feitos = cs.filter((c) => ctx.estado(c.id, 'construcao').tipo === 'completo').length;
          return (
            <section class="equipe-agora construcao" aria-label={`${q.nome}, ${ctx.nomeC}, avalie agora`}>
              <span class="sobrelinha">{ctx.nomeC} · você avalia</span>
              <div class="eq-titulo"><h1>{q.nome}</h1><span>{feitos} de {cs.length}</span></div>
              <div class="segmentos" aria-hidden="true">{cs.map((c) => <span class={ctx.estado(c.id, 'construcao').tipo === 'completo' ? 'ok' : ''} />)}</div>
              <ul class="cands grande">{cs.map((c) => <Linha c={c} s={ctx.estado(c.id, 'construcao')} abrir={abrir} sufixo="@construcao" />)}</ul>
            </section>
          );
        })}

        {mostrarOutros && outros.length > 0 && (
          <>
            {outros.length > 8 && (
              <label class="busca">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
                <input type="search" placeholder="Buscar candidato" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar candidato" />
              </label>
            )}
            <ul class="cands">
              {visiveis.map((c) => <Linha c={c} s={estados[c.id]} abrir={abrir} so_ver={!ctx.pode(c.id)} />)}
              {!visiveis.length && <li class="vazio">Ninguém com esse nome.</li>}
            </ul>
          </>
        )}
        {destaque && outros.length > 0 && (
          <button class="ver-todos" aria-expanded={verTodos} onClick={() => setVerTodos(!verTodos)}>
            {verTodos ? 'Esconder outros candidatos' : `Outros candidatos · ${outros.length}`}
          </button>
        )}
      </main>
    </>
  );
}

/** Meu papel nesta dinâmica: grupo, quem avalia junto, narrador e a persona que interpreto. */
function Papeis({ papeis }: { papeis: Papel[] }) {
  return (
    <>
      {papeis.map((p) => (
        <div class="papel" role="note">
          {p.papel === 'narrador'
            ? <><b>{p.nome} · você é o narrador</b><span>Você não avalia este grupo.{p.colegas.length ? ` Quem avalia: ${juntar(p.colegas)}.` : ''}</span></>
            : <>
              <b>{p.persona ? `Sua persona: ${p.persona.nome}` : `Seu grupo: ${p.nome}`}</b>
              {p.persona && <span>{p.persona.resumo}</span>}
              {(p.narrador || p.colegas.length > 0) && <span>
                {p.persona ? `${p.nome}. ` : ''}{p.narrador ? `Narrador: ${p.narrador}. ` : ''}{p.colegas.length ? `Avaliam com você: ${juntar(p.colegas)}.` : ''}
              </span>}
            </>}
        </div>
      ))}
    </>
  );
}

function juntar(l: string[]) {
  return l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1];
}
