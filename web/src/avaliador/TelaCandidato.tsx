// Um candidato por tela: blocos em abas, critérios com 1–5 e N/A, e um rodapé com "Próximo" e "⋯".
// Observação e "Não posso avaliar" abrem em folhas que sobem de baixo.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { toast } from '../ui';
import { chaveNota, chaveObs, Momento } from './fila';
import { PropsTela, Salvamento } from './Lista';

const NOTAS = [1, 2, 3, 4, 5] as const;

export function TelaCandidato({ ctx, estadoFila, semConexao, abrir, candId, momento }: PropsTela & { candId: string; momento?: Momento }) {
  const { pacote, etapa, aberta, criterios, notas } = ctx;
  // Navegação dentro da equipe em avaliação (se o candidato for dela); senão, entre todos.
  // Na Construção, só dentro da equipe designada ao avaliador.
  const eqConstrucao = momento ? ctx.construcao.find((q) => q.ids.includes(candId)) : undefined;
  const equipeDaTela = momento ? eqConstrucao : ctx.equipe;
  const naEquipe = !!equipeDaTela && equipeDaTela.ids.includes(candId);
  const sufixo = momento ? '@construcao' : '';
  const cands = naEquipe ? equipeDaTela!.ids.map((id) => pacote.candidatos.find((c) => c.id === id)!).filter(Boolean) : pacote.candidatos;
  const i = cands.findIndex((c) => c.id === candId);
  const cand = cands[i];
  const blocos = useMemo(() => pacote.blocos.filter((b) => criterios.some((k) => k.bloco === b.id)), [pacote.blocos, criterios]);
  const valor = (critId: string) => notas[chaveNota(etapa, candId, critId, momento)]?.nota ?? '';
  const faltando = (blocoId: string) => criterios.filter((k) => k.bloco === blocoId && valor(k.id) === '').length;

  const [blocoAberto, setBlocoAberto] = useState<string>(() => (blocos.find((b) => faltando(b.id) > 0) || blocos[0])?.id || '');
  const [ativo, setAtivo] = useState<string>('');
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [folha, setFolha] = useState<null | 'menu' | 'obs' | 'naoPosso'>(null);
  const textoObs = ctx.obs[chaveObs(etapa, candId, momento)]?.texto || '';
  const [rascunho, setRascunho] = useState(textoObs);
  const timerObs = useRef<any>(null);

  // Ao trocar de candidato: volta para o primeiro bloco com pendência
  useEffect(() => {
    setBlocoAberto((blocos.find((b) => faltando(b.id) > 0) || blocos[0])?.id || '');
    setAtivo(''); setExpandidos({}); setRascunho(ctx.obs[chaveObs(etapa, candId, momento)]?.texto || ''); setFolha(null);
  }, [candId, etapa, momento]); // eslint-disable-line

  const critsBloco = criterios.filter((k) => k.bloco === blocoAberto);
  const critAtivo = ativo || critsBloco.find((k) => valor(k.id) === '')?.id || '';
  const est = ctx.estado(candId, momento);
  const completo = est.tipo === 'completo' && !est.tudoNA;

  const proximoPendente = () => {
    for (let j = 1; j <= cands.length; j++) {
      const c = cands[(i + j) % cands.length];
      if (c.id !== candId && ctx.estado(c.id, momento).tipo !== 'completo') return c.id;
    }
    return null;
  };
  const irProximo = () => {
    const p = proximoPendente();
    if (p) abrir(p + sufixo);
    else { toast(naEquipe ? `${equipeDaTela!.nome}${momento ? ' (construção)' : ''} avaliada ✓` : 'Você avaliou todos os candidatos.'); abrir(null); }
  };

  const marcar = (critId: string, nota: number | 'NA') => {
    if (!aberta) return;
    ctx.darNota(candId, critId, nota, momento);
    setAtivo(''); // o destaque passa para o próximo critério sem nota
    // Quando o bloco aberto fica completo, passa para o próximo bloco com pendência
    const restantes = criterios.filter((k) => k.bloco === blocoAberto && k.id !== critId && valor(k.id) === '').length;
    if (restantes === 0) {
      const prox = blocos.find((b) => b.id !== blocoAberto && criterios.some((k) => k.bloco === b.id && k.id !== critId && valor(k.id) === ''));
      if (prox) setTimeout(() => { setBlocoAberto(prox.id); setAtivo(''); scrollTo({ top: 0, behavior: 'smooth' }); }, 350);
    }
  };

  const dadas = criterios.filter((k) => typeof valor(k.id) === 'number').length;
  const naoPossoTodos = () => {
    setFolha(null);
    if (!aberta) return;
    ctx.darVarias(candId, 'NA', momento);
    toast('Marcado como "não posso avaliar"');
  };
  // Sem notas dadas, aplica direto; com notas, confirma numa folha antes de substituir.
  const pedirNaoPosso = () => (dadas ? setFolha('naoPosso') : naoPossoTodos());

  const salvarObs = (t: string) => { clearTimeout(timerObs.current); ctx.salvarObs(candId, t.trim(), momento); };
  const abrirObs = () => { setFolha('obs'); setTimeout(() => (document.querySelector('.folha textarea') as HTMLElement | null)?.focus(), 60); };
  const fecharFolha = () => { if (folha === 'obs') salvarObs(rascunho); setFolha(null); };

  // Atalhos no computador: 1–5, N, setas
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (e.key === 'Escape' && folha) { fecharFolha(); return; }
      if (folha || (alvo && (alvo.tagName === 'TEXTAREA' || alvo.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey))) return;
      const idx = critsBloco.findIndex((k) => k.id === critAtivo);
      if (/^[1-5]$/.test(e.key) && critAtivo) { e.preventDefault(); marcar(critAtivo, Number(e.key)); }
      else if ((e.key === 'n' || e.key === 'N') && critAtivo) { e.preventDefault(); marcar(critAtivo, 'NA'); }
      else if (e.key === 'ArrowDown' && idx < critsBloco.length - 1) { e.preventDefault(); setAtivo(critsBloco[idx + 1].id); }
      else if (e.key === 'ArrowUp' && idx > 0) { e.preventDefault(); setAtivo(critsBloco[idx - 1].id); }
      else if (e.key === 'ArrowRight' && i < cands.length - 1) { e.preventDefault(); abrir(cands[i + 1].id + sufixo); }
      else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); abrir(cands[i - 1].id + sufixo); }
      else if (e.key === 'Escape') abrir(null);
    };
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  });

  const contexto = naEquipe ? `${equipeDaTela!.nome}${momento ? ' · Construção' : ''}` : pacote.etapas.find((e) => e.id === etapa)?.nome || '';
  const offline = estadoFila.e === 'offline' || (semConexao && estadoFila.n > 0);

  return (
    <>
      <header class="av-topo cand">
        <div class="av-linha">
          <button class="icone" onClick={() => abrir(null)} aria-label="Voltar para a lista">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span class="av-titulo">{contexto} · {i + 1} de {cands.length}</span>
          <Salvamento curto e={estadoFila.e} n={estadoFila.n} semConexao={semConexao} />
        </div>
      </header>
      {offline && <p class="faixa-offline" role="status">Sem conexão: {estadoFila.n} {estadoFila.n === 1 ? 'nota guardada' : 'notas guardadas'} no celular, enviadas quando a internet voltar.</p>}

      <main class="av-conteudo cand">
        <h1 class="cand-nome">{cand.nome}</h1>
        {!aberta && <p class="aviso alerta">Avaliação fechada: somente leitura.</p>}

        {blocos.length > 1 && (
          <nav class="blocos" role="tablist" aria-label="Blocos de critérios">
            {blocos.map((b) => {
              const ks = criterios.filter((k) => k.bloco === b.id);
              const feitos = ks.length - faltando(b.id);
              return (
                <button role="tab" aria-selected={b.id === blocoAberto} onClick={() => { setBlocoAberto(b.id); setAtivo(''); }}>
                  {b.nome_curto || b.nome} <span class={feitos === ks.length ? 'ok' : ''}>{feitos}/{ks.length}</span>
                </button>
              );
            })}
          </nav>
        )}

        <div class="crits">
          {critsBloco.map((k) => {
            const v = valor(k.id);
            const exp = expandidos[k.id];
            const col = pacote.veem_outros && !momento ? pacote.colegas?.[`${etapa}|${candId}|${k.id}`] : undefined;
            return (
              <div class={'crit' + (k.id === critAtivo ? ' ativo' : '') + (v !== '' ? ' feito' : '')} role="radiogroup" aria-label={`Nota para ${k.nome}`} onFocusCapture={() => setAtivo(k.id)}>
                <div class="crit-topo">
                  <button class="crit-rotulo" aria-expanded={exp} onClick={() => setExpandidos((x) => ({ ...x, [k.id]: !x[k.id] }))}>
                    {k.sigla && <span class="sigla">{k.sigla}</span>}
                    <span class="nome">{k.nome}</span>
                    {col && <span class="colegas">colegas {col.media.toFixed(1).replace('.', ',')}</span>}
                    {k.id === critAtivo && !completo && <i class="ponto" aria-hidden="true" />}
                  </button>
                  <button role="radio" aria-checked={v === 'NA'} aria-label="Não posso avaliar" class={'na' + (v === 'NA' ? ' marcada' : '')} disabled={!aberta && v !== 'NA'} onClick={() => marcar(k.id, 'NA')}>N/A</button>
                </div>
                {exp && k.descricao && <p class="desc-completa">{k.descricao}</p>}
                <div class="notas seg">
                  {NOTAS.map((n) => (
                    <button role="radio" aria-checked={v === n} class={v === n ? 'marcada' : ''} disabled={!aberta && v !== n} onClick={() => marcar(k.id, n)}>{n}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {textoObs && (
          <button class="obs-linha" onClick={abrirObs} disabled={!aberta}>
            <span>Observação</span>
            <p>{textoObs}</p>
          </button>
        )}
      </main>

      <footer class="av-rodape">
        <i class="rod-progresso" style={{ width: `${est.total ? (est.feitos / est.total) * 100 : 0}%` }} aria-hidden="true" />
        <div class="rod-linha">
          <button class={'botao principal' + (completo ? ' pronto' : '')} onClick={irProximo}>
            {completo ? 'Pronto, Próximo' : 'Próximo'}
            {!completo && <span class="so-leitor">, {est.feitos} de {est.total} critérios com nota</span>}
          </button>
          <button class="botao mais" aria-label="Mais opções" aria-expanded={folha === 'menu'} onClick={() => setFolha(folha === 'menu' ? null : 'menu')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </button>
        </div>
      </footer>

      {folha && (
        <div class="folha-fundo" onClick={fecharFolha}>
          {folha === 'menu' && (
            <div class="folha" role="menu" onClick={(e) => e.stopPropagation()}>
              <i class="alca" aria-hidden="true" />
              <button role="menuitem" class="item" disabled={!aberta} onClick={abrirObs}>
                {textoObs ? 'Editar observação' : 'Adicionar observação'}
              </button>
              <button role="menuitem" class="item perigo" disabled={!aberta} onClick={pedirNaoPosso}>Não posso avaliar este candidato</button>
              <button role="menuitem" class="cancelar" onClick={() => setFolha(null)}>Cancelar</button>
            </div>
          )}
          {folha === 'obs' && (
            <div class="folha" role="dialog" aria-modal="true" aria-labelledby="obs-titulo" onClick={(e) => e.stopPropagation()}>
              <i class="alca" aria-hidden="true" />
              <h2 id="obs-titulo">Observação sobre {cand.nome}</h2>
              <p class="texto">Opcional. Fica salva junto com as notas.</p>
              <textarea value={rascunho} disabled={!aberta} maxLength={2000} aria-labelledby="obs-titulo"
                onInput={(e) => { const t = (e.target as HTMLTextAreaElement).value; setRascunho(t); clearTimeout(timerObs.current); timerObs.current = setTimeout(() => salvarObs(t), 1500); }}
                onBlur={(e) => salvarObs((e.target as HTMLTextAreaElement).value)} />
              <button class="botao principal" onClick={fecharFolha}>Salvar observação</button>
            </div>
          )}
          {folha === 'naoPosso' && (
            <div class="folha" role="alertdialog" aria-modal="true" aria-labelledby="np-titulo" onClick={(e) => e.stopPropagation()}>
              <i class="alca" aria-hidden="true" />
              <h2 id="np-titulo">Não posso avaliar {cand.nome}</h2>
              <p class="texto">Todos os critérios ficam como N/A. {dadas === 1 ? 'A nota já dada será substituída.' : `As ${dadas} notas já dadas serão substituídas.`}</p>
              <button class="botao perigo cheio" onClick={naoPossoTodos}>Marcar tudo como N/A</button>
              <button class="cancelar" onClick={() => setFolha(null)}>Cancelar</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
