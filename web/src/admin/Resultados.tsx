// Resultados ao vivo: ranking, detalhe do candidato, progresso dos avaliadores e exportação.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { calcularProgresso, calcularResultados, criteriosAtivos, criteriosDaEtapa } from '@shared/calc.js';
import { normalizarNome } from '@shared/texto.js';
import { linkAvaliador } from '../api';
import { copiar, dataRelativa, Modal, num2 } from '../ui';
import { baixarCsv, baixarJson, baixarXlsx, dataArquivo, type Celula } from './exportar';
import type { PropsAba } from './Admin';

type Linha = ReturnType<typeof calcularResultados>['linhas'][number];
const ORDENS = [['ranking', 'Ranking'], ['nome', 'Nome'], ['media', 'Média'], ['nAvaliadores', 'Nº de avaliadores'], ['desvio', 'Desvio']] as const;

export function Resultados({ d, setD, acao, sessao }: PropsAba) {
  const [etapa, setEtapa] = useState('*');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<string>('ranking');
  const [porCriterio, setPorCriterio] = useState(false);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [atualizado, setAtualizado] = useState(new Date());

  // Atualiza as notas a cada 30 s
  const atualizar = async (silencioso = true) => {
    const r = await acao<any>('admin.notas', {}, silencioso ? undefined : 'Atualizado');
    if (r) {
      const acessos = Object.fromEntries(r.acessos.map((a: any) => [a.id, a.ultimo_acesso]));
      setD((x) => ({ ...x, avaliacoes: r.avaliacoes, observacoes: r.observacoes,
        avaliadores: x.avaliadores.map((a) => ({ ...a, ultimo_acesso: acessos[a.id] ?? a.ultimo_acesso })) }));
      setAtualizado(new Date());
    }
  };
  useEffect(() => { const id = setInterval(() => { if (document.visibilityState === 'visible') atualizar(); }, 30000); return () => clearInterval(id); }, []); // eslint-disable-line

  const cfg = d.config;
  const res = useMemo(() => calcularResultados({
    candidatos: d.candidatos.map((c) => ({ id: c.id, nome: c.nome_exibicao, status: c.status })),
    criterios: d.criterios, blocos: d.blocos, avaliacoes: d.avaliacoes, etapa, config: cfg,
  }), [d.candidatos, d.criterios, d.blocos, d.avaliacoes, etapa, cfg]);

  const etapasProgresso = etapa === '*' ? d.etapas.filter((e) => e.aberta === 'SIM').map((e) => e.id) : [etapa];
  const progresso = useMemo(() => {
    const avs = d.avaliadores.filter((a) => a.ativo === 'SIM');
    const porEtapa = etapasProgresso.map((et) => calcularProgresso({ avaliadores: avs, candidatos: d.candidatos, criterios: d.criterios, blocos: d.blocos, avaliacoes: d.avaliacoes, etapa: et }));
    return avs.map((a, i) => {
      const s = porEtapa.reduce((acc, p) => ({ completos: acc.completos + p[i].completos, parciais: acc.parciais + p[i].parciais, pendentes: acc.pendentes + p[i].pendentes, total: acc.total + p[i].total }), { completos: 0, parciais: 0, pendentes: 0, total: 0 });
      return { av: a, ...s, pct: s.total ? s.completos / s.total : 0 };
    }).sort((x, y) => x.pct - y.pct || x.av.nome.localeCompare(y.av.nome, 'pt-BR'));
  }, [d.avaliadores, d.candidatos, d.criterios, d.blocos, d.avaliacoes, etapa]); // eslint-disable-line

  const linhas = useMemo(() => {
    const b = normalizarNome(busca);
    const l = res.linhas.filter((x) => !b || normalizarNome(x.nome + ' ' + x.id).includes(b));
    const num = (v: number | null) => (v == null ? -Infinity : v);
    if (ordem === 'nome') l.sort((x, y) => String(x.nome).localeCompare(String(y.nome), 'pt-BR'));
    if (ordem === 'media') l.sort((x, y) => num(y.media) - num(x.media));
    if (ordem === 'nAvaliadores') l.sort((x, y) => y.nAvaliadores - x.nAvaliadores);
    if (ordem === 'desvio') l.sort((x, y) => num(y.desvio) - num(x.desvio));
    return l;
  }, [res, busca, ordem]);

  const notasNaEtapa = d.avaliacoes.filter((a) => a.nota !== '' && (etapa === '*' || a.etapa === etapa));
  const totalPossivel = progresso.reduce((s, p) => s + p.total, 0);
  const totalCompletos = progresso.reduce((s, p) => s + p.completos, 0);
  const acima = res.linhas.filter((l) => l.status === 'ATIVO' && l.media != null && cfg.nota_de_corte !== '' && l.media >= Number(cfg.nota_de_corte)).length;
  const insuf = res.linhas.filter((l) => l.status === 'ATIVO' && l.alertas.includes('Dados insuficientes')).length;
  const diverg = res.linhas.filter((l) => l.alertas.includes('Divergência')).length;
  const nomeEtapa = etapa === '*' ? 'Todas' : d.etapas.find((e) => e.id === etapa)?.nome || etapa;

  const tabelaRanking = (): Celula[][] => [
    ['Ranking', 'ID', 'Candidato', 'Status', 'Média geral', 'Situação', 'Nº avaliadores', 'Desvio padrão', 'Alertas',
      ...res.blocos.map((b) => 'Média ' + b.nome_curto), ...res.criterios.map((k) => `${k.sigla ? k.sigla + ' ' : ''}${k.nome} (${k.bloco})`)],
    ...res.linhas.map((l) => [l.ranking ?? '', l.id, l.nome, l.status, l.media, l.situacao, l.nAvaliadores, l.desvio, l.alertas.join(' · '),
      ...res.blocos.map((b) => l.porBloco[b.id]), ...res.criterios.map((k) => l.porCriterio[k.id])]),
  ];
  const tabelaAvaliacoes = (): Celula[][] => {
    const nomeAv = Object.fromEntries(d.avaliadores.map((a) => [a.id, a.nome]));
    const nomeC = Object.fromEntries(d.candidatos.map((c) => [c.id, c.nome_exibicao]));
    const nomeK = Object.fromEntries(d.criterios.map((k) => [k.id, k.nome]));
    return [['Etapa', 'Avaliador ID', 'Avaliador', 'Candidato ID', 'Candidato', 'Critério ID', 'Critério', 'Nota'],
      ...d.avaliacoes.filter((a) => etapa === '*' || a.etapa === etapa).map((a) => [a.etapa, a.avaliador_id, nomeAv[a.avaliador_id], a.candidato_id, nomeC[a.candidato_id], a.criterio_id, nomeK[a.criterio_id], a.nota === 'NA' ? 'Não posso avaliar' : a.nota])];
  };
  const sufixo = `${etapa === '*' ? 'todas' : etapa}_${dataArquivo()}`;

  const lembrete = (p: typeof progresso[number]) => {
    const faltam = p.pendentes + p.parciais;
    return `Oi, ${p.av.nome.split(' ')[0]}! Faltam ${faltam} candidato${faltam > 1 ? 's' : ''} para você avaliar no ${cfg.nome_processo || 'PS'}` +
      `${etapa !== '*' ? ` (${nomeEtapa})` : ''}. Leva poucos minutos: abra seu link e use o filtro "Pendentes".\n${linkAvaliador(p.av.token, sessao.amb)}`;
  };

  return (
    <section>
      <h2>Resultados</h2>
      <p class="subtitulo">Ranking ao vivo, calculado com as mesmas regras da planilha. Atualizado {dataRelativa(atualizado.toISOString())}.</p>
      <div class="barra-acoes">
        <select class="entrada" style={{ width: 'auto' }} value={etapa} onChange={(e) => setEtapa((e.target as HTMLSelectElement).value)} aria-label="Etapa">
          <option value="*">Todas as etapas</option>
          {d.etapas.map((e) => <option value={e.id}>{e.nome}</option>)}
        </select>
        <input class="entrada" type="search" placeholder="Buscar candidato" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar candidato" />
        <select class="entrada" style={{ width: 'auto' }} value={ordem} onChange={(e) => setOrdem((e.target as HTMLSelectElement).value)} aria-label="Ordenar por">
          {ORDENS.map(([v, r]) => <option value={v}>Ordenar: {r}</option>)}
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={porCriterio} onChange={() => setPorCriterio(!porCriterio)} /> Por critério</label>
        <span class="espaco" />
        <button class="botao" onClick={() => atualizar(false)}>Atualizar</button>
      </div>

      <div class="indicadores">
        <div class="indicador"><b>{notasNaEtapa.length}</b><span>notas registradas</span></div>
        <div class="indicador"><b>{totalPossivel ? Math.round((totalCompletos / totalPossivel) * 100) : 0}%</b><span>de conclusão ({totalCompletos}/{totalPossivel})</span></div>
        <div class="indicador"><b>{cfg.nota_de_corte === '' ? '—' : acima}</b><span>acima do corte{cfg.nota_de_corte !== '' ? ` (${num2(Number(cfg.nota_de_corte))})` : ''}</span></div>
        <div class="indicador"><b>{insuf}</b><span>com dados insuficientes</span></div>
        <div class="indicador"><b>{diverg}</b><span>com divergência</span></div>
      </div>

      {!d.candidatos.length ? <p class="aviso">Nenhum candidato ainda. Comece pela aba Candidatos.</p> : (
        <div class="tabela-box" style={{ marginBottom: 24 }}>
          <table class="tabela">
            <thead><tr>
              <th class="num">#</th><th>Candidato</th><th class="num">Média</th><th>Situação</th><th class="num">Avaliadores</th><th class="num">Desvio</th><th>Alertas</th>
              {res.blocos.map((b) => <th class="num">{b.nome_curto}</th>)}
              {porCriterio && res.criterios.map((k) => <th class="num" title={k.nome}>{k.sigla || k.nome.slice(0, 6)}</th>)}
            </tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr class={l.status !== 'ATIVO' ? 'inativo' : ''} style={{ cursor: 'pointer', background: l.situacao === 'Classificado' ? 'var(--ok-suave)' : undefined }} onClick={() => setDetalhe(l.id)}>
                  <td class="num"><b>{l.ranking ?? '—'}</b></td>
                  <td><b>{l.nome}</b>{l.status !== 'ATIVO' && <> <span class="selo">{l.status.toLowerCase()}</span></>}</td>
                  <td class="num"><b>{num2(l.media)}</b></td>
                  <td>{l.situacao || '—'}</td>
                  <td class="num">{l.nAvaliadores}</td>
                  <td class="num">{num2(l.desvio)}</td>
                  <td>{l.alertas.map((a) => <span class={'selo ' + (a === 'Divergência' ? 'erro' : 'alerta')} style={{ marginRight: 4 }}>{a}</span>)}</td>
                  {res.blocos.map((b) => <td class="num">{num2(l.porBloco[b.id])}</td>)}
                  {porCriterio && res.criterios.map((k) => <td class="num">{num2(l.porCriterio[k.id])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div class="grade-2" style={{ marginBottom: 24 }}>
        <div class="painel">
          <h3>Exportar</h3>
          <p class="ajuda">Etapa: {nomeEtapa}. O CSV abre direto no Excel em português.</p>
          <div class="barra-acoes" style={{ marginTop: 8 }}>
            <button class="botao pequeno" onClick={() => baixarCsv(`ranking_${sufixo}.csv`, tabelaRanking())}>Ranking CSV</button>
            <button class="botao pequeno" onClick={() => baixarXlsx(`ranking_${sufixo}.xlsx`, 'Ranking', tabelaRanking())}>Ranking XLSX</button>
            <button class="botao pequeno" onClick={() => baixarCsv(`avaliacoes_${sufixo}.csv`, tabelaAvaliacoes())}>Avaliações CSV</button>
            <button class="botao pequeno" onClick={() => baixarXlsx(`avaliacoes_${sufixo}.xlsx`, 'Avaliações', tabelaAvaliacoes())}>Avaliações XLSX</button>
            <button class="botao pequeno" onClick={async () => { const r = await acao('admin.backup', {}, 'Backup gerado'); if (r) baixarJson(`backup_${dataArquivo()}.json`, r); }}>Backup completo</button>
          </div>
        </div>
        <div class="painel">
          <h3>Regras</h3>
          <p class="ajuda">"Não posso avaliar" e vazio não entram nas médias. Média geral ponderada pelos pesos; empate divide a posição; status diferente de ATIVO fica fora do ranking. Dados insuficientes: menos de {cfg.min_avaliadores_por_candidato || '—'} avaliadores. Divergência: desvio entre avaliadores acima de {cfg.limite_divergencia || '—'}.</p>
        </div>
      </div>

      <h2 style={{ fontSize: 19 }}>Progresso dos avaliadores</h2>
      <p class="subtitulo">{etapa === '*' ? 'Somando as etapas abertas.' : `Etapa ${nomeEtapa}.`} "Não posso avaliar" conta como respondido.</p>
      <div class="tabela-box">
        <table class="tabela">
          <thead><tr><th>Avaliador</th><th class="num">Completos</th><th class="num">Parciais</th><th class="num">Pendentes</th><th>Progresso</th><th>Último acesso</th><th class="num">Lembrete</th></tr></thead>
          <tbody>
            {progresso.map((p) => (
              <tr>
                <td><b>{p.av.nome}</b></td>
                <td class="num">{p.completos}</td><td class="num">{p.parciais}</td><td class="num">{p.pendentes}</td>
                <td style={{ minWidth: 120 }}><div class="progresso" style={{ margin: 0 }}><div class="barra" style={{ height: 8, flex: 1, background: 'var(--superficie-2)', borderRadius: 99, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${p.pct * 100}%`, background: 'var(--ok)' }} /></div><small>{Math.round(p.pct * 100)}%</small></div></td>
                <td>{dataRelativa(p.av.ultimo_acesso)}</td>
                <td class="num">{p.pendentes + p.parciais > 0 ? <button class="botao pequeno" onClick={() => copiar(lembrete(p), 'Lembrete copiado: cole no WhatsApp')}>Copiar lembrete</button> : <span class="selo ok">em dia</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalhe && <Detalhe id={detalhe} res={res} props={{ d, etapa }} aoFechar={() => setDetalhe(null)} />}
    </section>
  );
}

function Detalhe({ id, res, props, aoFechar }: { id: string; res: ReturnType<typeof calcularResultados>; props: { d: PropsAba['d']; etapa: string }; aoFechar: () => void }) {
  const { d, etapa } = props;
  const l = res.linhas.find((x) => x.id === id) as Linha;
  const ativos = res.linhas.filter((x) => x.status === 'ATIVO');
  const grupo = (k: string) => { const v = ativos.map((x) => x.porCriterio[k]).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const crits = etapa === '*' ? res.criterios : criteriosDaEtapa(criteriosAtivos(d.criterios, d.blocos), etapa);
  const notas = d.avaliacoes.filter((a) => a.candidato_id === id && (etapa === '*' || a.etapa === etapa));
  const avIds = [...new Set(notas.map((a) => a.avaliador_id))];
  const nomeAv = (x: string) => d.avaliadores.find((a) => a.id === x)?.nome || x;
  const celula = (av: string, k: string) => {
    const ns = notas.filter((a) => a.avaliador_id === av && a.criterio_id === k);
    const num = ns.filter((a) => typeof a.nota === 'number').map((a) => a.nota as number);
    if (num.length) return num2(num.reduce((a, b) => a + b, 0) / num.length).replace(',00', '');
    return ns.some((a) => a.nota === 'NA') ? 'NA' : '';
  };
  const obs = d.observacoes.filter((o) => o.candidato_id === id && o.texto && (etapa === '*' || o.etapa === etapa));
  const nomeEtapa = (e: string) => d.etapas.find((x) => x.id === e)?.nome || e;

  return (
    <Modal titulo={`${l.nome}`} aoFechar={aoFechar}>
      <p class="ajuda">{l.id} · {l.status} · ranking {l.ranking ?? '—'} · média {num2(l.media)} · {l.nAvaliadores} avaliador(es) · desvio {num2(l.desvio)}{l.situacao ? ' · ' + l.situacao : ''}</p>
      <h3 style={{ fontSize: 16, margin: '16px 0 6px' }}>Média por critério × média do grupo</h3>
      <div role="img" aria-label="Gráfico de barras: candidato contra a média do grupo por critério">
        {crits.map((k) => {
          const v = l.porCriterio[k.id] ?? null, g = grupo(k.id);
          return (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 14, display: 'flex', justifyContent: 'space-between' }}><span>{k.sigla ? k.sigla + ' · ' : ''}{k.nome}</span><span><b>{num2(v)}</b> <small class="ajuda">grupo {num2(g)}</small></span></div>
              <div style={{ position: 'relative', height: 12, background: 'var(--superficie-2)', borderRadius: 6 }}>
                {v != null && <div style={{ position: 'absolute', inset: 0, width: `${((v - 1) / 4) * 100}%`, background: 'var(--marca)', borderRadius: 6, minWidth: 4 }} />}
                {g != null && <div title="Média do grupo" style={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${((g - 1) / 4) * 100}% - 1px)`, width: 3, background: 'var(--texto)' }} />}
              </div>
            </div>
          );
        })}
        <p class="ajuda">Escala de 1 a 5. A barra é o candidato; o traço escuro é a média dos candidatos ativos.</p>
      </div>

      <h3 style={{ fontSize: 16, margin: '16px 0 6px' }}>Notas por avaliador</h3>
      {!avIds.length ? <p class="ajuda">Ninguém avaliou ainda.</p> : (
        <div class="tabela-box"><table class="tabela" style={{ fontSize: 13 }}>
          <thead><tr><th>Avaliador</th>{crits.map((k) => <th class="num" title={k.nome}>{k.sigla || k.nome.slice(0, 5)}</th>)}</tr></thead>
          <tbody>{avIds.map((av) => <tr><td>{nomeAv(av)}</td>{crits.map((k) => <td class="num">{celula(av, k.id)}</td>)}</tr>)}</tbody>
        </table></div>
      )}

      <h3 style={{ fontSize: 16, margin: '16px 0 6px' }}>Observações</h3>
      {!obs.length ? <p class="ajuda">Sem observações.</p> : obs.map((o) => (
        <div class="painel" style={{ marginBottom: 8 }}><small class="ajuda">{nomeAv(o.avaliador_id)} · {nomeEtapa(o.etapa)}</small><p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{o.texto}</p></div>
      ))}
      <div class="acoes"><button class="botao" onClick={aoFechar}>Fechar</button></div>
    </Modal>
  );
}
