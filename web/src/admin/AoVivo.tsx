// Ao vivo: o admin escolhe a dinâmica, monta as equipes com quem está presente e abre a equipe que vai ser avaliada.
// Pensado para o celular: um toque no número da equipe aloca o candidato.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { criteriosAtivos, criteriosDaEtapa } from '@shared/calc.js';
import { normalizarNome } from '@shared/texto.js';
import type { Equipe, Etapa } from '../tipos';
import type { PropsAba } from './Admin';

const idEquipe = (etapa: string, i: number) => `${etapa}_eq${i + 1}`;

export function AoVivo({ d, setD, acao }: PropsAba) {
  const etapas = [...d.etapas].sort((a, b) => Number(a.ordem) - Number(b.ordem));
  const ativaEtapa = String(d.config.dinamica_ativa || '');
  const ativaEquipe = String(d.config.equipe_ativa || '');
  const [etapa, setEtapa] = useState(etapas.find((e) => e.id === ativaEtapa)?.id || etapas[0]?.id || '');
  const [busca, setBusca] = useState('');
  const [montar, setMontar] = useState(false);
  // No desktop (≥ 1024 px) "Montar equipes" fica numa coluna ao lado, em vez de outra tela.
  const [largo, setLargo] = useState(() => matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const m = matchMedia('(min-width: 1024px)');
    const f = () => setLargo(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);

  // Equipes da dinâmica escolhida, editadas aqui e salvas sozinhas
  const doServidor = (et: string) => (d.equipes || []).filter((q) => q.etapa === et).sort((a, b) => a.ordem - b.ordem).map((q) => q.membros);
  const [grupos, setGrupos] = useState<string[][]>(() => doServidor(etapa));
  useEffect(() => { setGrupos(doServidor(etapa)); }, [etapa]); // eslint-disable-line
  const timer = useRef<any>(null);
  const pendente = useRef<string[][] | null>(null);

  const salvarAgora = async () => {
    clearTimeout(timer.current);
    const g = pendente.current;
    if (!g) return true;
    pendente.current = null;
    const r = await acao<{ equipes: Equipe[]; config: Record<string, any> }>('admin.salvarEquipes', {
      etapa, equipes: g.map((membros, i) => ({ nome: `Equipe ${i + 1}`, membros })),
    });
    if (r) setD((x) => ({ ...x, equipes: r.equipes, config: r.config }));
    return !!r;
  };
  const mudar = (g: string[][]) => {
    setGrupos(g);
    pendente.current = g;
    clearTimeout(timer.current);
    timer.current = setTimeout(salvarAgora, 800);
  };
  useEffect(() => () => { if (pendente.current) salvarAgora(); }, [etapa]); // eslint-disable-line

  // Notas ao vivo a cada 10 s (para o progresso da equipe em avaliação)
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const r = await acao<any>('admin.notas');
      if (r) setD((x) => ({ ...x, avaliacoes: r.avaliacoes, observacoes: r.observacoes }));
    }, 10000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  const presentes = d.candidatos.filter((c) => c.status === 'ATIVO').sort((a, b) => a.nome_exibicao.localeCompare(b.nome_exibicao, 'pt-BR'));
  const nome = (id: string) => d.candidatos.find((c) => c.id === id)?.nome_exibicao || id;
  const equipeDe = (id: string) => grupos.findIndex((g) => g.includes(id));
  const semEquipe = presentes.filter((c) => equipeDe(c.id) < 0);

  const atribuir = (cid: string, i: number) => {
    const atual = equipeDe(cid);
    const g = grupos.map((m) => m.filter((x) => x !== cid));
    if (atual !== i) g[i] = [...g[i], cid];
    mudar(g);
  };
  const qtd = (n: number) => {
    if (n < 1 || n > 12) return;
    const g = grupos.slice(0, n).map((m) => [...m]);
    while (g.length < n) g.push([]);
    mudar(g);
  };
  const sortear = () => {
    const g = grupos.map((m) => [...m]);
    const resto = semEquipe.map((c) => c.id).sort(() => Math.random() - 0.5);
    resto.forEach((cid) => { const menor = g.reduce((iMin, m, i) => (m.length < g[iMin].length ? i : iMin), 0); g[menor].push(cid); });
    mudar(g);
  };
  const limpar = () => { if (confirm('Tirar todos das equipes desta dinâmica?')) mudar(grupos.map(() => [])); };

  const aoVivo = async (equipe: string, aviso: string) => {
    if (!(await salvarAgora())) return;
    const r = await acao<{ config: Record<string, any>; etapas: Etapa[] }>('admin.aoVivo', { etapa, equipe }, aviso);
    if (r) setD((x) => ({ ...x, config: r.config, etapas: r.etapas }));
  };
  const novaDinamica = async () => {
    const n = etapas.length + 1;
    const r = await acao<{ etapas: Etapa[] }>('admin.salvarEtapas', { lista: [{ nome: `Dinâmica ${n}`, ordem: n, aberta: 'SIM' }] }, `Dinâmica ${n} criada`);
    if (r) { setD((x) => ({ ...x, etapas: r.etapas })); const nova = r.etapas.find((e) => !d.etapas.some((x) => x.id === e.id)); if (nova) setEtapa(nova.id); }
  };

  // Quantos avaliadores já completaram cada candidato nesta dinâmica
  const crits = useMemo(() => criteriosDaEtapa(criteriosAtivos(d.criterios, d.blocos), etapa), [d.criterios, d.blocos, etapa]);
  const totalAv = d.avaliadores.filter((a) => a.ativo === 'SIM').length;
  const completos = useMemo(() => {
    const ids = new Set(crits.map((k) => k.id));
    const m: Record<string, Record<string, number>> = {};
    d.avaliacoes.forEach((a) => {
      if (a.etapa !== etapa || !ids.has(a.criterio_id) || a.nota === '') return;
      const c = (m[a.candidato_id] = m[a.candidato_id] || {});
      c[a.avaliador_id] = (c[a.avaliador_id] || 0) + 1;
    });
    const r: Record<string, number> = {};
    Object.entries(m).forEach(([cand, avs]) => { r[cand] = Object.values(avs).filter((n) => n >= crits.length).length; });
    return r;
  }, [d.avaliacoes, crits, etapa]);

  const ativaAqui = ativaEtapa === etapa && ativaEquipe.startsWith(etapa + '_eq') ? Number(ativaEquipe.slice(etapa.length + 3)) - 1 : -1;
  const visiveis = presentes.filter((c) => !busca || normalizarNome(c.nome_exibicao).includes(normalizarNome(busca)));
  const curto = (id: string) => nome(id).split(' ')[0];
  const nomeEtapa = etapas.find((e) => e.id === etapa)?.nome || '';

  // Bloco "Montar equipes": tela própria no celular/tablet, coluna ao lado no desktop.
  const blocoMontar = (
    <div class="bloco" aria-label="Montar equipes">
      {!largo && (
        <div class="volta">
          <button class="icone" onClick={() => { salvarAgora(); setMontar(false); }} aria-label="Voltar para Ao vivo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span>{nomeEtapa}</span>
        </div>
      )}
      <div class="bloco-topo"><h2>Montar equipes</h2><span class="ajuda" style={{ margin: 0 }}>{semEquipe.length} sem equipe</span></div>
      <div class="montar">
        <button class="passo" onClick={() => qtd(grupos.length - 1)} disabled={grupos.length < 1} aria-label="Menos uma equipe">−</button>
        <b class="qtd" aria-live="polite">{grupos.length} equipe{grupos.length === 1 ? '' : 's'}</b>
        <button class="passo" onClick={() => qtd(grupos.length + 1)} aria-label="Mais uma equipe">+</button>
        <span class="espaco" />
        {grupos.length > 0 && semEquipe.length > 0 && <button class="botao destaque" onClick={sortear}>Sortear {semEquipe.length}</button>}
      </div>
      {grupos.length === 0 ? <div class="vazio"><p>Toque em + para criar a primeira equipe.</p></div> : !presentes.length ? <div class="vazio"><p>Nenhum candidato ativo. Cadastre em Pessoas.</p></div> : (
        <>
          {presentes.length > 10 && (
            <label class="busca-campo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
              <input type="search" placeholder="Buscar candidato" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar candidato" />
            </label>
          )}
          <ul class="alocar">
            {visiveis.map((c) => {
              const eq = equipeDe(c.id);
              return (
                <li class={eq < 0 ? 'sem' : ''}>
                  <span class="nome">{c.nome_exibicao}</span>
                  <span class="nums" role="radiogroup" aria-label={`Equipe de ${c.nome_exibicao}`}>
                    {grupos.map((_, i) => (
                      <button role="radio" aria-checked={eq === i} aria-label={`Equipe ${i + 1}`} onClick={() => atribuir(c.id, i)}>{i + 1}</button>
                    ))}
                  </span>
                </li>
              );
            })}
            {!visiveis.length && <li class="vazio">Ninguém com esse nome.</li>}
          </ul>
          <p class="nota-rodape">Toque no número de novo para tirar da equipe.{grupos.some((g) => g.length) && <> <button class="link" onClick={limpar}>Limpar tudo</button></>}</p>
        </>
      )}
    </div>
  );

  if (montar && !largo) return <section class="aovivo">{blocoMontar}</section>;

  const membrosAtivos = ativaAqui >= 0 ? grupos[ativaAqui] || [] : [];
  const feitos = membrosAtivos.reduce((s, cid) => s + (completos[cid] || 0), 0);
  return (
    <section class="aovivo">
      <div class="cabeca-pagina">
        <div>
          <span class="sobrelinha">Ao vivo</span>
          <select class="titulo-select" value={etapa} aria-label="Dinâmica"
            onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v === '__nova') { (e.target as HTMLSelectElement).value = etapa; novaDinamica(); } else setEtapa(v); }}>
            {etapas.map((e) => <option value={e.id}>{e.nome}</option>)}
            <option value="__nova">+ Nova dinâmica</option>
          </select>
        </div>
      </div>

      <div class={'aovivo-grade' + (largo ? ' com-montar' : '')}>
        <div class="coluna">
          {ativaAqui >= 0 ? (
            <div class="agora" role="status" aria-label={`Avaliando agora: Equipe ${ativaAqui + 1}`}>
              <div class="agora-topo">
                <div><small>Avaliando agora</small><b>Equipe {ativaAqui + 1}</b></div>
                <span>{feitos} de {membrosAtivos.length * totalAv} avaliações</span>
              </div>
              <ul>{membrosAtivos.map((cid) => (
                <li>
                  <span class="n">{nome(cid)}</span>
                  <span class="barra" aria-hidden="true"><span style={{ width: `${totalAv ? ((completos[cid] || 0) / totalAv) * 100 : 0}%` }} /></span>
                  <span class="cont">{completos[cid] || 0}/{totalAv}</span>
                </li>
              ))}</ul>
              <button class="botao" onClick={() => aoVivo('', 'Avaliação encerrada')}>Encerrar</button>
            </div>
          ) : grupos.length > 0 && (
            <div class="bloco"><div class="vazio" style={{ padding: 0 }}><p>Nenhuma equipe em avaliação. Toque em <b>Avaliar</b> quando uma equipe apresentar.</p></div></div>
          )}

          <div class="bloco">
            <div class="bloco-topo">
              <h2>Equipes</h2>
              {!largo && grupos.length > 0 && <button class="botao leve" onClick={() => setMontar(true)}>Montar</button>}
            </div>
            {grupos.length === 0 ? (
              <div class="vazio">
                <p>Nenhuma equipe nesta dinâmica.</p>
                {!largo && <button class="botao principal" onClick={() => { setMontar(true); qtd(3); }}>Montar equipes</button>}
                {largo && <button class="botao principal" onClick={() => qtd(3)}>Criar 3 equipes</button>}
              </div>
            ) : (
              <ul class="equipes">
                {grupos.map((g, i) => (
                  <li>
                    <div class="eq-txt"><b>Equipe {i + 1}</b><small>{g.length ? `${g.length} · ${g.map(curto).join(', ')}` : 'Ninguém ainda'}</small></div>
                    {i === ativaAqui
                      ? <span class="ao-vivo">Ao vivo</span>
                      : <button class="botao" disabled={!g.length} onClick={() => aoVivo(idEquipe(etapa, i), `Equipe ${i + 1} aberta`)}>Avaliar</button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {largo && <div class="coluna">{blocoMontar}</div>}
      </div>
    </section>
  );
}
