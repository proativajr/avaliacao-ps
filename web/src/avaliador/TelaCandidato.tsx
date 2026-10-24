// Um candidato por tela: blocos recolhíveis, critérios com botões 1–5 e "Não posso avaliar".
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { toast } from '../ui';
import { chaveNota, chaveObs } from './fila';
import { Iniciais, PropsTela, Salvamento } from './Lista';

const NOTAS = [1, 2, 3, 4, 5] as const;

/** Primeira frase da descrição (o resto fica no "ver mais"). */
export function primeiraFrase(t: string) {
  const m = String(t || '').match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : String(t || '');
}

export function TelaCandidato({ ctx, estadoFila, semConexao, abrir, candId }: PropsTela & { candId: string }) {
  const { pacote, etapa, aberta, criterios, notas } = ctx;
  // Navegação dentro da equipe em avaliação (se o candidato for dela); senão, entre todos.
  const naEquipe = !!ctx.equipe && ctx.equipe.ids.includes(candId);
  const cands = naEquipe ? ctx.equipe!.ids.map((id) => pacote.candidatos.find((c) => c.id === id)!).filter(Boolean) : pacote.candidatos;
  const i = cands.findIndex((c) => c.id === candId);
  const cand = cands[i];
  const blocos = useMemo(() => pacote.blocos.filter((b) => criterios.some((k) => k.bloco === b.id)), [pacote.blocos, criterios]);
  const valor = (critId: string) => notas[chaveNota(etapa, candId, critId)]?.nota ?? '';
  const faltando = (blocoId: string) => criterios.filter((k) => k.bloco === blocoId && valor(k.id) === '').length;

  const [blocoAberto, setBlocoAberto] = useState<string>(() => (blocos.find((b) => faltando(b.id) > 0) || blocos[0])?.id || '');
  const [ativo, setAtivo] = useState<string>('');
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [obsAberta, setObsAberta] = useState(false);
  const textoObs = ctx.obs[chaveObs(etapa, candId)]?.texto || '';
  const [rascunho, setRascunho] = useState(textoObs);
  const timerObs = useRef<any>(null);

  // Ao trocar de candidato: volta para o primeiro bloco com pendência
  useEffect(() => {
    setBlocoAberto((blocos.find((b) => faltando(b.id) > 0) || blocos[0])?.id || '');
    setAtivo(''); setExpandidos({}); setRascunho(ctx.obs[chaveObs(etapa, candId)]?.texto || ''); setObsAberta(false);
  }, [candId, etapa]); // eslint-disable-line

  const critsBloco = criterios.filter((k) => k.bloco === blocoAberto);
  const critAtivo = ativo || critsBloco.find((k) => valor(k.id) === '')?.id || critsBloco[0]?.id || '';
  const est = ctx.estado(candId);
  // Quando o candidato fica completo NESTA visita, mostra por alguns segundos a barra "Pronto ✓"
  const [mostrarPronto, setMostrarPronto] = useState(false);
  const tipoAnterior = useRef(est.tipo);
  useEffect(() => {
    if (tipoAnterior.current !== 'completo' && est.tipo === 'completo') {
      setMostrarPronto(true);
      const t = setTimeout(() => setMostrarPronto(false), 6000);
      tipoAnterior.current = est.tipo;
      return () => clearTimeout(t);
    }
    tipoAnterior.current = est.tipo;
    if (est.tipo !== 'completo') setMostrarPronto(false);
  }, [est.tipo]);
  useEffect(() => { tipoAnterior.current = ctx.estado(candId).tipo; setMostrarPronto(false); }, [candId]); // eslint-disable-line

  const proximoPendente = () => {
    for (let j = 1; j <= cands.length; j++) {
      const c = cands[(i + j) % cands.length];
      if (c.id !== candId && ctx.estado(c.id).tipo !== 'completo') return c.id;
    }
    return null;
  };
  const irProximoPendente = () => {
    const p = proximoPendente();
    if (p) abrir(p);
    else { toast(naEquipe ? `${ctx.equipe!.nome} avaliada ✓` : 'Você avaliou todos os candidatos.'); abrir(null); }
  };

  const marcar = (critId: string, nota: number | 'NA') => {
    if (!aberta) return;
    ctx.darNota(candId, critId, nota);
    setAtivo(''); // o destaque passa para o próximo critério sem nota
    // Quando o bloco aberto fica completo, abre o próximo bloco com pendência
    const restantes = criterios.filter((k) => k.bloco === blocoAberto && k.id !== critId && valor(k.id) === '').length;
    if (restantes === 0) {
      const prox = blocos.find((b) => b.id !== blocoAberto && criterios.some((k) => k.bloco === b.id && k.id !== critId && valor(k.id) === ''));
      if (prox) setTimeout(() => { setBlocoAberto(prox.id); setAtivo(''); }, 350);
    }
  };

  const naoPossoTodos = () => {
    if (!aberta) return;
    const dadas = criterios.filter((k) => typeof valor(k.id) === 'number').length;
    if (dadas && !confirm(`Marcar todos os critérios como "não posso avaliar"? As ${dadas} nota(s) já dadas serão substituídas.`)) return;
    ctx.darVarias(candId, 'NA');
    toast('Marcado como "não posso avaliar"');
  };

  const salvarObs = (t: string) => { clearTimeout(timerObs.current); ctx.salvarObs(candId, t.trim()); };

  // Atalhos no computador: 1–5, N, setas
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo && (alvo.tagName === 'TEXTAREA' || alvo.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey)) return;
      const idx = critsBloco.findIndex((k) => k.id === critAtivo);
      if (/^[1-5]$/.test(e.key) && critAtivo) { e.preventDefault(); marcar(critAtivo, Number(e.key)); if (idx < critsBloco.length - 1) setAtivo(critsBloco[idx + 1].id); }
      else if ((e.key === 'n' || e.key === 'N') && critAtivo) { e.preventDefault(); marcar(critAtivo, 'NA'); if (idx < critsBloco.length - 1) setAtivo(critsBloco[idx + 1].id); }
      else if (e.key === 'ArrowDown' && idx < critsBloco.length - 1) { e.preventDefault(); setAtivo(critsBloco[idx + 1].id); }
      else if (e.key === 'ArrowUp' && idx > 0) { e.preventDefault(); setAtivo(critsBloco[idx - 1].id); }
      else if (e.key === 'ArrowRight' && i < cands.length - 1) { e.preventDefault(); abrir(cands[i + 1].id); }
      else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); abrir(cands[i - 1].id); }
      else if (e.key === 'Escape') abrir(null);
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  const contexto = naEquipe ? ctx.equipe!.nome : pacote.etapas.find((e) => e.id === etapa)?.nome || '';

  return (
    <>
      <header class="av-topo cand">
        <div class="av-linha">
          <button class="icone" onClick={() => abrir(null)} aria-label="Voltar para a lista">‹</button>
          <Iniciais nome={cand.nome} foto={cand.foto_url} tam={34} />
          <div class="av-titulo">
            <b>{cand.nome_curto}</b>
            <small>{contexto} · {i + 1}/{cands.length} · <Salvamento curto e={estadoFila.e} n={estadoFila.n} semConexao={semConexao} /></small>
          </div>
          <button class="icone" disabled={i === 0} onClick={() => abrir(cands[i - 1].id)} aria-label="Candidato anterior">‹‹</button>
          <button class="icone" disabled={i === cands.length - 1} onClick={() => abrir(cands[i + 1].id)} aria-label="Próximo candidato">››</button>
        </div>
      </header>

      {(estadoFila.e === 'offline' || (semConexao && estadoFila.n > 0)) && (
        <p class="faixa-offline" role="status">Sem conexão. {estadoFila.n} {estadoFila.n === 1 ? 'item guardado' : 'itens guardados'} neste aparelho, {estadoFila.n === 1 ? 'será enviado' : 'serão enviados'} quando a internet voltar.</p>
      )}
      <main class="av-conteudo cand">
        {!aberta && <p class="aviso alerta">Avaliação fechada: somente leitura.</p>}
        {blocos.map((b) => {
          const aberto = b.id === blocoAberto;
          const ks = criterios.filter((k) => k.bloco === b.id);
          const feitos = ks.length - faltando(b.id);
          return (
            <section class={'bloco' + (aberto ? ' aberto' : '')}>
              <h2>
                <button aria-expanded={aberto} onClick={() => { setBlocoAberto(aberto ? '' : b.id); setAtivo(''); }}>
                  <span>{b.nome}</span><span class={'cont' + (feitos === ks.length ? ' ok' : '')}>{feitos}/{ks.length}</span><span class="seta" aria-hidden="true">{aberto ? '▾' : '▸'}</span>
                </button>
              </h2>
              {aberto && ks.map((k) => {
                const v = valor(k.id);
                const exp = expandidos[k.id];
                const col = pacote.veem_outros ? pacote.colegas?.[`${etapa}|${candId}|${k.id}`] : undefined;
                return (
                  <div class={'crit' + (k.id === critAtivo ? ' ativo' : '')} onFocusCapture={() => setAtivo(k.id)}>
                    <button class="crit-rotulo" aria-expanded={exp} onClick={() => setExpandidos((x) => ({ ...x, [k.id]: !x[k.id] }))}>
                      {k.sigla && <span class="sigla">{k.sigla}</span>}
                      <b>{k.nome}</b>
                      {col && <span class="colegas"> · colegas {col.media.toFixed(1).replace('.', ',')}</span>}
                      {k.descricao && <span class="mais" aria-hidden="true">{exp ? '−' : 'ⓘ'}</span>}
                    </button>
                    {exp && <p class="desc-completa">{k.descricao}</p>}
                    <div class="notas" role="radiogroup" aria-label={`Nota para ${k.nome}`}>
                      {NOTAS.map((n) => (
                        <button role="radio" aria-checked={v === n} class={v === n ? 'marcada' : ''} disabled={!aberta && v !== n} onClick={() => marcar(k.id, n)}>{n}</button>
                      ))}
                      <button role="radio" aria-checked={v === 'NA'} class={'na' + (v === 'NA' ? ' marcada' : '')} disabled={!aberta && v !== 'NA'} onClick={() => marcar(k.id, 'NA')}>Não posso avaliar</button>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}

        <div class="extras">
          <button class="botao principal" onClick={irProximoPendente}>{naEquipe ? 'Próximo da equipe' : 'Próximo pendente'}</button>
          {obsAberta || textoObs ? (
            <label class="campo">
              <span>Observação</span>
              <textarea value={rascunho} disabled={!aberta} maxLength={2000} placeholder="Opcional"
                onInput={(e) => { const t = (e.target as HTMLTextAreaElement).value; setRascunho(t); clearTimeout(timerObs.current); timerObs.current = setTimeout(() => salvarObs(t), 1500); }}
                onBlur={(e) => salvarObs((e.target as HTMLTextAreaElement).value)} />
            </label>
          ) : (
            <button class="botao leve" disabled={!aberta} onClick={() => setObsAberta(true)}>+ Observação</button>
          )}
          <button class="botao leve suave" disabled={!aberta} onClick={naoPossoTodos}>Não posso avaliar este candidato</button>
        </div>
      </main>

      {mostrarPronto && (
        <div class="av-rodape" role="status" onClick={() => setMostrarPronto(false)}>
          <span>{est.tudoNA ? 'Marcado: não posso avaliar' : 'Pronto ✓'}</span>
          <button class="botao principal" onClick={irProximoPendente}>{naEquipe ? 'Próximo da equipe' : 'Próximo pendente'}</button>
        </div>
      )}
    </>
  );
}
