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
    return [['Dinâmica', 'Avaliador ID', 'Avaliador', 'Candidato ID', 'Candidato', 'Critério ID', 'Critério', 'Nota'],
      ...d.avaliacoes.filter((a) => etapa === '*' || a.etapa === etapa).map((a) => [a.etapa, a.avaliador_id, nomeAv[a.avaliador_id], a.candidato_id, nomeC[a.candidato_id], a.criterio_id, nomeK[a.criterio_id], a.nota === 'NA' ? 'Não posso avaliar' : a.nota])];
  };
  const sufixo = `${etapa === '*' ? 'todas' : etapa}_${dataArquivo()}`;

  const lembrete = (p: typeof progresso[number]) => {
    const faltam = p.pendentes + p.parciais;
    return `Oi, ${p.av.nome.split(' ')[0]}! Faltam ${faltam} candidato${faltam > 1 ? 's' : ''} para você avaliar no ${cfg.nome_processo || 'PS'}` +
      `${etapa !== '*' ? ` (${nomeEtapa})` : ''}. Leva poucos minutos: é só abrir seu link.\n${linkAvaliador(p.av.token, sessao.amb)}`;
  };

  const situacao = (l: Linha) => {
    if (l.alertas.includes('Divergência')) return ['Divergência', 'alerta'];
    if (l.alertas.includes('Dados insuficientes')) return ['Dados insuficientes', 'vazio'];
    if (l.situacao === 'Classificado') return ['Classificado', 'ok'];
    if (l.situacao) return [l.situacao, 'neutro'];
    if (l.status !== 'ATIVO') return [l.status.toLowerCase(), 'neutro'];
    return l.media == null ? ['Sem notas', 'vazio'] : ['', 'neutro'];
  };
  const pct = totalPossivel ? Math.round((totalCompletos / totalPossivel) * 100) : 0;
  const ativosN = d.candidatos.filter((c) => c.status === 'ATIVO').length;

  return (
    <section class="ranking">
      <div class="cabeca-pagina">
        <div>
          <h1 class="titulo">Ranking</h1>
          <span class="sub">Atualizado {dataRelativa(atualizado.toISOString())} · <button class="link" onClick={() => atualizar(false)}>atualizar agora</button></span>
        </div>
        <div class="segmentado" role="radiogroup" aria-label="Dinâmica">
          {[['*', 'Todas'], ...d.etapas.map((e) => [e.id, e.nome])].map(([id, rot]) => (
            <button role="radio" aria-checked={etapa === id} onClick={() => setEtapa(id)}>{rot}</button>
          ))}
        </div>
      </div>

      <div class="metricas" role="group" aria-label="Resumo">
        <div class="metrica destaque"><b>{pct}%</b><span>de conclusão</span></div>
        <div class="metrica"><b>{ativosN}</b><span>candidatos ativos</span></div>
        <div class="metrica"><b>{cfg.nota_de_corte === '' ? notasNaEtapa.length : acima}</b><span>{cfg.nota_de_corte === '' ? 'notas registradas' : `acima do corte (${num2(Number(cfg.nota_de_corte))})`}</span></div>
        <div class="metrica"><b>{diverg + insuf}</b><span>com alerta</span></div>
      </div>

      <div class="ranking-grade">
        <div class="bloco">
          <div class="bloco-topo">
            <h2>Candidatos</h2>
            <div class="acoes-topo">
              <button class="botao" onClick={() => baixarXlsx(`ranking_${sufixo}.xlsx`, 'Ranking', tabelaRanking())}>Baixar ranking</button>
              <details class="mais">
                <summary class="botao leve">Outros arquivos</summary>
                <div class="mais-menu">
                  <button class="botao leve" onClick={() => baixarCsv(`ranking_${sufixo}.csv`, tabelaRanking())}>Ranking CSV</button>
                  <button class="botao leve" onClick={() => baixarXlsx(`avaliacoes_${sufixo}.xlsx`, 'Avaliações', tabelaAvaliacoes())}>Avaliações XLSX</button>
                  <button class="botao leve" onClick={() => baixarCsv(`avaliacoes_${sufixo}.csv`, tabelaAvaliacoes())}>Avaliações CSV</button>
                  <button class="botao leve" onClick={async () => { const r = await acao('admin.backup', {}, 'Backup gerado'); if (r) baixarJson(`backup_${dataArquivo()}.json`, r); }}>Backup completo</button>
                </div>
              </details>
            </div>
          </div>
          <div class="filtros-linha">
            <input class="entrada" type="search" placeholder="Buscar candidato" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar candidato" />
            <select class="entrada" value={ordem} onChange={(e) => setOrdem((e.target as HTMLSelectElement).value)} aria-label="Ordenar por">
              {ORDENS.map(([v, r]) => <option value={v}>Ordem: {r}</option>)}
            </select>
            <label class="check"><input type="checkbox" checked={porCriterio} onChange={() => setPorCriterio(!porCriterio)} /> Por critério</label>
          </div>

          {!d.candidatos.length ? <div class="vazio"><p>Nenhum candidato ainda. Cadastre em Pessoas.</p></div> : !linhas.length ? <div class="vazio"><p>Ninguém com esse nome.</p></div> : (
            <div class={'tabela-box' + (porCriterio ? '' : ' vira-cartao')}>
              <table class="tabela">
                <thead><tr>
                  <th class="num">#</th><th>Candidato</th>
                  {res.blocos.map((b) => <th class="num">{b.nome_curto}</th>)}
                  {porCriterio && res.criterios.map((k) => <th class="num" title={k.nome}>{k.sigla || k.nome.slice(0, 6)}</th>)}
                  <th class="num">Média</th><th class="num">Avaliadores</th><th>Situação</th>
                </tr></thead>
                <tbody>
                  {linhas.map((l) => {
                    const [rot, cor] = situacao(l);
                    return (
                      <tr class={'clicavel' + (l.status !== 'ATIVO' ? ' inativo' : '')} onClick={() => setDetalhe(l.id)}>
                        <td class="num suave esconde-cartao">{l.ranking ?? '—'}</td>
                        <td class="titulo-cel"><button class="link-linha" onClick={(e) => { e.stopPropagation(); setDetalhe(l.id); }}><span class="pos">{l.ranking ?? '—'}º</span><b>{l.nome}</b></button></td>
                        {res.blocos.map((b) => <td class="num" data-rotulo={b.nome_curto}>{num2(l.porBloco[b.id])}</td>)}
                        {porCriterio && res.criterios.map((k) => <td class="num">{num2(l.porCriterio[k.id])}</td>)}
                        <td class="num media lado-cel">{num2(l.media)}</td>
                        <td class="num suave" data-rotulo="Avaliadores">{l.nAvaliadores}</td>
                        <td data-rotulo={rot ? 'Situação' : undefined} class={rot ? '' : 'esconde-cartao'}>{rot && <span class={'situ ' + cor}><i aria-hidden="true" />{rot}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div class="bloco">
          <div class="bloco-topo"><h2>Avaliadores</h2></div>
          {!progresso.length ? <div class="vazio"><p>Nenhum avaliador ativo.</p></div> : (
            <ul class="progresso-av">
              {progresso.map((p) => (
                <li>
                  <span class="n"><b>{p.av.nome}</b><small>Último acesso: {dataRelativa(p.av.ultimo_acesso)}</small></span>
                  <span class="linha-barra">
                    <span class="barra" aria-hidden="true"><span style={{ width: `${p.pct * 100}%` }} /></span>
                    <span class="pct">{Math.round(p.pct * 100)}%</span>
                  </span>
                  {p.pendentes + p.parciais > 0
                    ? <button class="botao leve pequeno" onClick={() => copiar(lembrete(p), 'Lembrete copiado: cole no WhatsApp')} aria-label={`Copiar lembrete para ${p.av.nome}`}>Lembrete</button>
                    : <span class="em-dia">em dia ✓</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p class="regras">"Não posso avaliar" e vazio não entram nas médias. Média ponderada pelos pesos; empate divide a posição. Dados insuficientes: menos de {cfg.min_avaliadores_por_candidato || '—'} avaliadores. Divergência: desvio acima de {cfg.limite_divergencia || '—'}.</p>

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
      <h3>Média por critério × média do grupo</h3>
      <div role="img" aria-label="Gráfico de barras: candidato contra a média do grupo por critério">
        {crits.map((k) => {
          const v = l.porCriterio[k.id] ?? null, g = grupo(k.id);
          return (
            <div class="barra-crit">
              <div class="rot"><span>{k.sigla ? k.sigla + ' · ' : ''}{k.nome}</span><span><b>{num2(v)}</b> <small class="ajuda">grupo {num2(g)}</small></span></div>
              <div class="trilho">
                {v != null && <div style={{ position: 'absolute', inset: 0, width: `${((v - 1) / 4) * 100}%`, background: 'var(--marca)', borderRadius: 6, minWidth: 4 }} />}
                {g != null && <div title="Média do grupo" style={{ position: 'absolute', top: -3, bottom: -3, left: `calc(${((g - 1) / 4) * 100}% - 1px)`, width: 3, background: 'var(--texto)' }} />}
              </div>
            </div>
          );
        })}
        <p class="ajuda">Escala de 1 a 5. A barra é o candidato; o traço escuro é a média dos candidatos ativos.</p>
      </div>

      <h3>Notas por avaliador</h3>
      {!avIds.length ? <p class="ajuda">Ninguém avaliou ainda.</p> : (
        <div class="matriz-box"><table class="tabela">
          <thead><tr><th>Avaliador</th>{crits.map((k) => <th class="num" title={k.nome}>{k.sigla || k.nome.slice(0, 5)}</th>)}</tr></thead>
          <tbody>{avIds.map((av) => <tr><td>{nomeAv(av)}</td>{crits.map((k) => <td class="num">{celula(av, k.id)}</td>)}</tr>)}</tbody>
        </table></div>
      )}

      <h3>Observações</h3>
      {!obs.length ? <p class="ajuda">Sem observações.</p> : obs.map((o) => (
        <div class="painel" style={{ marginBottom: 8 }}><small class="ajuda" style={{ display: 'block' }}>{nomeAv(o.avaliador_id)} · {nomeEtapa(o.etapa)}</small><p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{o.texto}</p></div>
      ))}
      <div class="acoes"><button class="botao" onClick={aoFechar}>Fechar</button></div>
    </Modal>
  );
}
