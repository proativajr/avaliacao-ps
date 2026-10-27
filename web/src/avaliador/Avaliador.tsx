// App do avaliador: carrega os dados, guarda no aparelho, mantém a fila de envio e alterna lista/candidato.
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { chamar, ErroApi, gravar, ler, sair, Sessao } from '../api';
import { criteriosDaEtapa, estadoCandidato } from '@shared/calc.js';
import { FaixaTeste, toast } from '../ui';
import { agoraTs, chaveNota, chaveObs, EstadoFila, Fila, Item, Momento } from './fila';
import { Lista } from './Lista';
import { TelaCandidato } from './TelaCandidato';
import './avaliador.css';

export interface Pacote {
  versao: string;
  processo: { nome: string; modo: string };
  avaliacao_aberta: boolean;
  veem_outros: boolean;
  em_votacao: string[];
  dinamica_ativa?: string;
  equipe?: { id: string; nome: string; etapa: string; membros: string[] } | null;
  /** Equipes em Construção em que este avaliador foi designado. */
  construcao?: { id: string; nome: string; etapa: string; membros: string[] }[];
  etapas: { id: string; nome: string; ordem: number; aberta: boolean }[];
  blocos: { id: string; nome: string; nome_curto: string; ordem: number }[];
  criterios: { id: string; bloco: string; ordem: number; sigla: string; nome: string; descricao: string; etapas: string }[];
  candidatos: { id: string; nome: string; nome_curto: string; foto_url: string }[];
  eu: { id: string; nome: string };
  minhas: { notas: { etapa: string; candidato_id: string; criterio_id: string; nota: number | 'NA' | ''; cliente_ts: number; momento?: string }[]; observacoes: { etapa: string; candidato_id: string; texto: string; cliente_ts: number; momento?: string }[] };
  colegas?: Record<string, { media: number; n: number }>;
}
export type Valor = { nota: number | 'NA' | ''; ts: number };
export interface Contexto {
  pacote: Pacote; etapa: string; aberta: boolean;
  /** Membros da equipe em avaliação agora nesta dinâmica (vazio = nenhuma). */
  equipe: { nome: string; ids: string[] } | null;
  /** Equipes em Construção designadas a este avaliador nesta dinâmica. */
  construcao: { id: string; nome: string; ids: string[] }[];
  criterios: Pacote['criterios'];
  notas: Record<string, Valor>;
  obs: Record<string, { texto: string; ts: number }>;
  estado: (candId: string, momento?: Momento) => { feitos: number; total: number; tipo: 'pendente' | 'parcial' | 'completo'; tudoNA: boolean };
  darNota: (candId: string, critId: string, nota: number | 'NA', momento?: Momento) => void;
  darVarias: (candId: string, nota: 'NA', momento?: Momento) => void;
  salvarObs: (candId: string, texto: string, momento?: Momento) => void;
}

/** Junta as notas do servidor com as que ainda estão na fila (a fila é mais nova). */
function montarNotas(p: Pacote, fila: Item[]) {
  const notas: Record<string, Valor> = {}, obs: Record<string, { texto: string; ts: number }> = {};
  p.minhas.notas.forEach((n) => { notas[chaveNota(n.etapa, n.candidato_id, n.criterio_id, n.momento)] = { nota: n.nota, ts: n.cliente_ts }; });
  p.minhas.observacoes.forEach((o) => { obs[chaveObs(o.etapa, o.candidato_id, o.momento)] = { texto: o.texto, ts: o.cliente_ts }; });
  fila.forEach((i) => {
    if (i.tipo === 'nota') {
      const k = chaveNota(i.etapa, i.candidato_id, i.criterio_id, i.momento);
      if (!notas[k] || notas[k].ts <= i.cliente_ts) notas[k] = { nota: i.nota, ts: i.cliente_ts };
    } else {
      const k = chaveObs(i.etapa, i.candidato_id, i.momento);
      if (!obs[k] || obs[k].ts <= i.cliente_ts) obs[k] = { texto: i.texto, ts: i.cliente_ts };
    }
  });
  return { notas, obs };
}

export function Avaliador({ sessao }: { sessao: Sessao; outras: Sessao[] }) {
  const chavePacote = `${sessao.amb}:pacote`;
  const [pacote, setPacote] = useState<Pacote | null>(() => { try { return JSON.parse(ler(chavePacote) || 'null'); } catch { return null; } });
  const [erro, setErro] = useState('');
  const [semConexaoInicio, setSemConexaoInicio] = useState(false);
  const [notas, setNotas] = useState<Record<string, Valor>>({});
  const [obs, setObs] = useState<Record<string, { texto: string; ts: number }>>({});
  const [estadoFila, setEstadoFila] = useState<{ e: EstadoFila; n: number }>({ e: 'salvo', n: 0 });
  const [etapaEscolhida, setEtapaEscolhida] = useState(ler(`${sessao.amb}:etapa`) || '');
  // "c001" = Apresentação (ou dinâmica sem equipe); "c001@construcao" = Construção.
  const [aberto, setAberto] = useState<string | null>(() => (history.state && history.state.cand) || null);
  const filaRef = useRef<Fila | null>(null);

  const aplicarPacote = useCallback((p: Pacote) => {
    p.candidatos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    setPacote(p);
    gravar(chavePacote, JSON.stringify(p));
    if (!filaRef.current || (filaRef.current as any)._av !== p.eu.id) {
      const f = new Fila(sessao, p.eu.id);
      (f as any)._av = p.eu.id;
      f.aoMudar = (e, n) => setEstadoFila({ e, n });
      f.aoRecusar = (motivo) => toast('Não salvou: ' + motivo);
      f.aoTokenInvalido = () => setErro('Seu link deixou de valer. Peça um link novo ao admin.');
      filaRef.current = f;
      setEstadoFila({ e: f.pendentes() ? 'pendente' : 'salvo', n: f.pendentes() });
    }
    const m = montarNotas(p, filaRef.current.todos());
    setNotas(m.notas); setObs(m.obs);
  }, [sessao, chavePacote]);

  const carregar = useCallback(async () => {
    try {
      const p = await chamar<Pacote>(sessao, 'av.iniciar', {}, 30000);
      aplicarPacote(p);
      setSemConexaoInicio(false);
    } catch (e: any) {
      if (e instanceof ErroApi && e.codigo === 'TOKEN_INVALIDO') { gravar(chavePacote, null); setErro(e.message); return; }
      if (pacote) { aplicarPacote(pacote); setSemConexaoInicio(true); } else setErro(e.message || 'Sem conexão.');
    }
  }, [sessao, aplicarPacote]); // eslint-disable-line

  useEffect(() => { carregar(); }, []); // eslint-disable-line

  // Consulta leve a cada 20 s: quem está em votação, etapas abertas e se a configuração mudou.
  useEffect(() => {
    if (!pacote) return;
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const s = await chamar<Pick<Pacote, 'versao' | 'em_votacao' | 'avaliacao_aberta' | 'etapas' | 'dinamica_ativa' | 'equipe' | 'construcao'>>(sessao, 'av.sincronizar', {}, 15000);
        setSemConexaoInicio(false);
        // Só baixa tudo de novo quando candidatos ou critérios mudam; equipe e dinâmica vêm na consulta leve.
        setPacote((p) => (p ? { ...p, em_votacao: s.em_votacao, avaliacao_aberta: s.avaliacao_aberta, etapas: s.etapas, dinamica_ativa: s.dinamica_ativa, equipe: s.equipe, construcao: s.construcao } : p));
        if (s.versao !== pacote.versao) carregar();
      } catch { /* sem internet: tenta na próxima */ }
    }, 10000);
    return () => clearInterval(id);
  }, [pacote?.versao, sessao]); // eslint-disable-line

  // Botão "voltar" do celular volta para a lista
  useEffect(() => {
    const f = () => setAberto((history.state && history.state.cand) || null);
    addEventListener('popstate', f);
    return () => removeEventListener('popstate', f);
  }, []);
  const abrir = useCallback((cand: string | null) => {
    if (cand && aberto) history.replaceState({ cand }, '');
    else if (cand) history.pushState({ cand }, '');
    else if (history.state && history.state.cand) { history.back(); return; }
    setAberto(cand);
    scrollTo(0, 0);
  }, [aberto]);

  const etapas = pacote?.etapas || [];
  const abertas = pacote?.avaliacao_aberta ? etapas.filter((e) => e.aberta) : [];
  // A dinâmica ao vivo (escolhida pelo admin) manda; sem ela, vale a escolha do avaliador.
  const aoVivo = abertas.find((e) => e.id === pacote?.dinamica_ativa);
  const etapa = (aoVivo || abertas.find((e) => e.id === etapaEscolhida) || abertas[0] || etapas.find((e) => e.id === etapaEscolhida) || etapas[0])?.id || '';
  const aberta = !!abertas.find((e) => e.id === etapa);
  const criterios = useMemo(() => (pacote ? criteriosDaEtapa(pacote.criterios, etapa) : []), [pacote, etapa]);

  const ctx: Contexto | null = useMemo(() => {
    if (!pacote) return null;
    const estado = (candId: string, momento?: Momento) => {
      let feitos = 0, na = 0;
      criterios.forEach((k) => {
        const v = notas[chaveNota(etapa, candId, k.id, momento)];
        if (v && v.nota !== '') { feitos++; if (v.nota === 'NA') na++; }
      });
      return { feitos, total: criterios.length, tipo: estadoCandidato(feitos, criterios.length) as any, tudoNA: feitos > 0 && na === feitos };
    };
    const registrar = (candId: string, critId: string, nota: number | 'NA', ts: number, momento?: Momento) => {
      filaRef.current!.adicionar({ tipo: 'nota', etapa, candidato_id: candId, criterio_id: critId, nota, cliente_ts: ts, ...(momento ? { momento } : {}) });
    };
    const noPacote = (id: string) => pacote.candidatos.some((c) => c.id === id);
    const construcao = (pacote.construcao || []).filter((q) => q.etapa === etapa)
      .map((q) => ({ id: q.id, nome: q.nome, ids: q.membros.filter(noPacote) })).filter((q) => q.ids.length);
    const eq = pacote.equipe && pacote.equipe.etapa === etapa
      ? { nome: pacote.equipe.nome, ids: pacote.equipe.membros.filter((id) => pacote.candidatos.some((c) => c.id === id)) } : null;
    return {
      pacote, etapa, aberta, criterios, notas, obs, estado, construcao, equipe: eq && eq.ids.length ? eq : null,
      darNota: (candId, critId, nota, momento) => {
        if (!aberta) return;
        const ts = agoraTs();
        setNotas((m) => ({ ...m, [chaveNota(etapa, candId, critId, momento)]: { nota, ts } }));
        registrar(candId, critId, nota, ts, momento);
      },
      darVarias: (candId, nota, momento) => {
        if (!aberta) return;
        const novos: Record<string, Valor> = {};
        criterios.forEach((k) => { const ts = agoraTs(); novos[chaveNota(etapa, candId, k.id, momento)] = { nota, ts }; registrar(candId, k.id, nota, ts, momento); });
        setNotas((m) => ({ ...m, ...novos }));
      },
      salvarObs: (candId, texto, momento) => {
        if (!aberta) return;
        const k = chaveObs(etapa, candId, momento);
        if ((obs[k]?.texto || '') === texto) return;
        const ts = agoraTs();
        setObs((m) => ({ ...m, [k]: { texto, ts } }));
        filaRef.current!.adicionar({ tipo: 'obs', etapa, candidato_id: candId, texto, cliente_ts: ts, ...(momento ? { momento } : {}) });
      },
    };
  }, [pacote, etapa, aberta, criterios, notas, obs]);

  if (erro && !ctx) return (
    <div class="centro"><div class="cartao-simples">
      <h1>Não foi possível abrir</h1><p class="aviso erro">{erro}</p>
      <div class="barra-acoes"><button class="botao" onClick={() => { setErro(''); carregar(); }}>Tentar de novo</button>
        <button class="botao leve" onClick={() => sair(sessao)}>Esquecer este link</button></div>
    </div></div>
  );
  if (!ctx) return <div class="carregando">Carregando…</div>;

  const ensaio = sessao.amb === 'ensaio' || ctx.pacote.processo.modo === 'ENSAIO';
  const trocarEtapa = (id: string) => { setEtapaEscolhida(id); gravar(`${sessao.amb}:etapa`, id); };
  const props = { ctx, estadoFila, semConexao: semConexaoInicio, abertas: aoVivo ? [] : abertas, trocarEtapa, abrir, erro };
  return (
    <div class="av">
      {ensaio && <FaixaTeste />}
      {aberto && ctx.pacote.candidatos.find((c) => c.id === aberto.split('@')[0])
        ? <TelaCandidato {...props} candId={aberto.split('@')[0]} momento={aberto.endsWith('@construcao') ? 'construcao' : undefined} />
        : <Lista {...props} />}
    </div>
  );
}
