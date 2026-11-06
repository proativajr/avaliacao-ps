// Ao vivo: o admin escolhe a dinâmica, monta as equipes com quem está presente, designa os avaliadores de cada equipe
// e conduz os dois momentos: Construção (só os avaliadores designados) e Apresentação (todos, uma equipe por vez).
// Pensado para o celular: um toque no número da equipe aloca o candidato.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { criteriosAtivos, criteriosDaEtapa } from '@shared/calc.js';
import { normalizarNome } from '@shared/texto.js';
import type { Equipe, EstadoMomento, Etapa } from '../tipos';
import { BotaoAcao, Modal, useTrava } from '../ui';
import { Foto, iniciais } from '../avaliador/Foto';
import type { PropsAba } from './Admin';
import { I, NoCampo, useLargo } from './desktop';
import {
  Check, CircleCheck, Clock, Hammer, Info, ListTodo, Minus, Pencil, Play, Plus, Presentation, Radio, RotateCcw,
  Shuffle, Square, TrendingUp, TriangleAlert, UserCheck, UserMinus, UserPlus, Users, UsersRound,
} from 'lucide-preact';

const idEquipe = (etapa: string, i: number) => `${etapa}_eq${i + 1}`;

export function AoVivo({ d, setD, acao }: PropsAba) {
  const etapas = [...d.etapas].sort((a, b) => Number(a.ordem) - Number(b.ordem));
  const ativaEtapa = String(d.config.dinamica_ativa || '');
  const ativaEquipe = String(d.config.equipe_ativa || '');
  const [etapa, setEtapa] = useState(etapas.find((e) => e.id === ativaEtapa)?.id || etapas[0]?.id || '');
  const [busca, setBusca] = useState('');
  const [montar, setMontar] = useState(false);
  // Janela de criar/renomear dinâmica: null = fechada; id vazio = nova
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  // No desktop (≥ 1024 px) a tela muda de forma (direção B): equipes em degraus e o painel da equipe escolhida.
  // "Montar equipes" abre numa janela, em vez de outra tela.
  const largo = useLargo();
  // Equipe aberta no painel do desktop (-1 = a que está apresentando, ou a primeira)
  const [escolhida, setEscolhida] = useState(-1);
  useEffect(() => setEscolhida(-1), [etapa]);

  // Equipes da dinâmica escolhida, editadas aqui e salvas sozinhas
  const doServidor = (et: string) => (d.equipes || []).filter((q) => q.etapa === et).sort((a, b) => a.ordem - b.ordem);
  const [grupos, setGrupos] = useState<string[][]>(() => doServidor(etapa).map((q) => q.membros));
  useEffect(() => { setGrupos(doServidor(etapa).map((q) => q.membros)); }, [etapa]); // eslint-disable-line
  // Avaliadores designados de cada equipe (mesma posição de "grupos"). Vêm sempre do servidor: a designação
  // é gravada à parte (admin.designarAvaliadores), então montar ou mexer nos membros nunca apaga quem foi designado.
  const designados = doServidor(etapa).map((q) => q.avaliadores || []);
  // Janela "Avaliadores da Equipe N": índice da equipe e a seleção em edição
  const [designando, setDesignando] = useState<{ i: number; sel: string[] } | null>(null);
  const timer = useRef<any>(null);
  const travaDin = useTrava(); // Enter e o botão "Criar dinâmica" dividem a mesma trava
  const pendente = useRef<{ g: string[][] } | null>(null);

  const salvarAgora = async () => {
    clearTimeout(timer.current);
    const p = pendente.current;
    if (!p) return true;
    pendente.current = null;
    const r = await acao<{ equipes: Equipe[]; config: Record<string, any> }>('admin.salvarEquipes', {
      etapa, equipes: p.g.map((membros, i) => ({ nome: `Equipe ${i + 1}`, membros })), // sem "avaliadores": o servidor mantém os designados
    });
    if (r) setD((x) => ({ ...x, equipes: r.equipes, config: r.config }));
    return !!r;
  };
  const mudar = (g: string[][]) => {
    setGrupos(g);
    pendente.current = { g };
    clearTimeout(timer.current);
    timer.current = setTimeout(salvarAgora, 800);
  };
  // Abre a janela de designação (antes grava as equipes pendentes, para a equipe já existir no servidor)
  const abrirDesignacao = async (i: number) => {
    if (!(await salvarAgora())) return;
    setDesignando({ i, sel: [...(designados[i] || [])] });
  };
  const salvarDesignacao = async () => {
    if (!designando) return;
    const { i, sel } = designando;
    const r = await acao<{ equipes: Equipe[] }>('admin.designarAvaliadores', { etapa, equipe: idEquipe(etapa, i), avaliadores: sel },
      sel.length ? `Equipe ${i + 1}: ${sel.length} avaliador${sel.length === 1 ? '' : 'es'}` : `Equipe ${i + 1} ficou sem avaliadores`);
    if (r) { setD((x) => ({ ...x, equipes: r.equipes })); setDesignando(null); }
  };
  // Desktop: tira um avaliador da equipe direto na lista (mesma gravação da janela de designação)
  const tirar = async (i: number, av: string) => {
    if (!(await salvarAgora())) return;
    const sel = (designados[i] || []).filter((x) => x !== av);
    const r = await acao<{ equipes: Equipe[] }>('admin.designarAvaliadores', { etapa, equipe: idEquipe(etapa, i), avaliadores: sel },
      `${nomeAv(av)} saiu da Equipe ${i + 1}`);
    if (r) setD((x) => ({ ...x, equipes: r.equipes }));
  };
  useEffect(() => () => { if (pendente.current) salvarAgora(); }, [etapa]); // eslint-disable-line

  // Notas ao vivo a cada 10 s (para o progresso da equipe em avaliação)
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const r = await acao<any>('admin.notas', {}, undefined, { semIndicador: true });
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
    const r = await acao<{ config: Record<string, any>; etapas: Etapa[]; equipes: Equipe[] }>('admin.aoVivo', { etapa, equipe }, aviso);
    if (r) setD((x) => ({ ...x, config: r.config, etapas: r.etapas, equipes: r.equipes }));
  };
  const construcao = async (i: number, estado: EstadoMomento, aviso: string) => {
    if (!(await salvarAgora())) return;
    const r = await acao<{ config: Record<string, any>; etapas: Etapa[]; equipes: Equipe[] }>('admin.construcao', { etapa, equipe: idEquipe(etapa, i), estado }, aviso);
    if (r) setD((x) => ({ ...x, config: r.config, etapas: r.etapas, equipes: r.equipes }));
  };
  // Cria (sem id) ou renomeia (com id) uma dinâmica
  const salvarDinamica = async () => {
    if (!editando) return;
    const nome = editando.nome.trim();
    if (!nome) return;
    if (editando.id) {
      const atual = etapas.find((e) => e.id === editando.id);
      const r = await acao<{ etapas: Etapa[] }>('admin.salvarEtapas', { lista: [{ id: editando.id, nome, ordem: atual?.ordem, aberta: atual?.aberta }] }, 'Nome atualizado');
      if (r) { setD((x) => ({ ...x, etapas: r.etapas })); setEditando(null); }
      return;
    }
    const n = etapas.length + 1;
    const r = await acao<{ etapas: Etapa[] }>('admin.salvarEtapas', { lista: [{ nome, ordem: n, aberta: 'SIM' }] }, `${nome} criada`);
    if (r) { setD((x) => ({ ...x, etapas: r.etapas })); const nova = r.etapas.find((e) => !d.etapas.some((x) => x.id === e.id)); if (nova) setEtapa(nova.id); setEditando(null); }
  };

  // Quantos avaliadores já completaram cada candidato nesta dinâmica
  const crits = useMemo(() => criteriosDaEtapa(criteriosAtivos(d.criterios, d.blocos), etapa), [d.criterios, d.blocos, etapa]);
  const soDesignados = String(d.config.apresentacao_so_designados || '').toUpperCase() === 'SIM';
  const totalAv = d.avaliadores.filter((a) => a.ativo === 'SIM').length;
  const completos = useMemo(() => {
    const ids = new Set(crits.map((k) => k.id));
    const m: Record<string, Record<string, number>> = {};
    d.avaliacoes.forEach((a) => {
      if (a.etapa !== etapa || !ids.has(a.criterio_id) || a.nota === '' || a.momento === 'construcao') return;
      const c = (m[a.candidato_id] = m[a.candidato_id] || {});
      c[a.avaliador_id] = (c[a.avaliador_id] || 0) + 1;
    });
    const r: Record<string, number> = {};
    Object.entries(m).forEach(([cand, avs]) => { r[cand] = Object.values(avs).filter((n) => n >= crits.length).length; });
    return r;
  }, [d.avaliacoes, crits, etapa]);

  // Quantos avaliadores já lançaram todas as notas de uma equipe em cada momento (Construção: só os designados)
  const lancaram = (i: number, momento: 'construcao' | 'apresentacao') => {
    const ids = new Set(crits.map((k) => k.id));
    const cont: Record<string, number> = {};
    d.avaliacoes.forEach((a) => {
      if (a.etapa !== etapa || !ids.has(a.criterio_id) || a.nota === '' || (a.momento === 'construcao') !== (momento === 'construcao')) return;
      const k = a.avaliador_id + '|' + a.candidato_id;
      cont[k] = (cont[k] || 0) + 1;
    });
    const avs = momento === 'construcao' || soDesignados ? (designados[i] || []) : d.avaliadores.filter((a) => a.ativo === 'SIM').map((a) => a.id);
    const membros = grupos[i] || [];
    const feitos = membros.length ? avs.filter((av) => membros.every((c) => (cont[av + '|' + c] || 0) >= crits.length)).length : 0;
    return { feitos, total: avs.length };
  };
  const nomeAv = (id: string) => d.avaliadores.find((a) => a.id === id)?.nome || id;
  const avaliadoresAtivos = d.avaliadores.filter((a) => a.ativo === 'SIM');
  // Na janela de designação: ativos e também quem já está designado mas foi desativado (para poder tirar)
  const paraDesignar = d.avaliadores.filter((a) => a.ativo === 'SIM' || (designando && designando.sel.includes(a.id)));
  const semAvaliadores = grupos.map((_, i) => i).filter((i) => !(designados[i] || []).length);

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
      <div class="bloco-topo">{!largo && <h2>Montar equipes</h2>}<span class="ajuda" style={{ margin: 0 }}>{semEquipe.length} sem equipe</span></div>
      <div class="montar">
        <button class="passo" onClick={() => qtd(grupos.length - 1)} disabled={grupos.length < 1} aria-label="Menos uma equipe">{largo ? <I c={Minus} /> : '−'}</button>
        <b class="qtd" aria-live="polite">{grupos.length} equipe{grupos.length === 1 ? '' : 's'}</b>
        <button class="passo" onClick={() => qtd(grupos.length + 1)} aria-label="Mais uma equipe">{largo ? <I c={Plus} /> : '+'}</button>
        <span class="espaco" />
        {grupos.length > 0 && semEquipe.length > 0 && <button class={largo ? 'botao' : 'botao destaque'} onClick={sortear}>{largo && <I c={Shuffle} />}Sortear {semEquipe.length}</button>}
      </div>
      {grupos.length === 0 ? <div class="vazio"><p>{largo ? 'Use + para criar a primeira equipe.' : 'Toque em + para criar a primeira equipe.'}</p></div> : !presentes.length ? <div class="vazio"><p>Nenhum candidato ativo. Cadastre em Pessoas.</p></div> : (
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
          <p class="nota-rodape">{largo ? 'Clique no número de novo para tirar da equipe.' : 'Toque no número de novo para tirar da equipe.'}{grupos.some((g) => g.length) && <> <button class="link" onClick={limpar}>Limpar tudo</button></>}</p>
        </>
      )}
    </div>
  );

  if (montar && !largo) return <section class="aovivo">{blocoMontar}</section>;

  // Janelas de criar/renomear dinâmica e de designar avaliadores (iguais no celular e no desktop)
  const modais = (
    <>
      {editando && (
        <Modal titulo={editando.id ? 'Renomear dinâmica' : 'Nova dinâmica'} aoFechar={() => setEditando(null)}>
          <label class="campo"><span>Nome da dinâmica</span>
            <input type="text" value={editando.nome} maxLength={60} placeholder="Ex.: Dinâmica de cases"
              onInput={(e) => setEditando({ ...editando, nome: (e.target as HTMLInputElement).value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && editando.nome.trim()) travaDin.rodar(salvarDinamica); }} ref={(el) => { if (el) setTimeout(() => el.focus(), 30); }} /></label>
          <div class="acoes">
            <button class="botao leve" onClick={() => setEditando(null)}>Cancelar</button>
            <BotaoAcao class="botao principal" disabled={!editando.nome.trim()} trava={travaDin} aoClicar={salvarDinamica}>{editando.id ? 'Salvar nome' : 'Criar dinâmica'}</BotaoAcao>
          </div>
        </Modal>
      )}

      {designando && (
        <Modal titulo={`Avaliadores da Equipe ${designando.i + 1}`} aoFechar={() => setDesignando(null)}>
          <p class="ajuda">Toque para incluir ou tirar. {soDesignados ? 'Só os escolhidos avaliam esta equipe, na Construção e na Apresentação.' : 'Os escolhidos acompanham a Construção. Na Apresentação, todos avaliam.'}</p>
          {!paraDesignar.length ? <p class="aviso">Nenhum avaliador cadastrado. Cadastre em Pessoas.</p> : (
            <div class="chips" role="group" aria-label={`Avaliadores da Equipe ${designando.i + 1}`}>
              {paraDesignar.map((a) => {
                const marcado = designando.sel.includes(a.id);
                return (
                  <button aria-pressed={marcado} onClick={() => setDesignando({ ...designando, sel: marcado ? designando.sel.filter((x) => x !== a.id) : [...designando.sel, a.id] })}>
                    {a.nome}{a.ativo !== 'SIM' ? ' (inativo)' : ''}
                  </button>
                );
              })}
            </div>
          )}
          <p class="ajuda" aria-live="polite">{designando.sel.length ? `${designando.sel.length} selecionado${designando.sel.length === 1 ? '' : 's'}: ${designando.sel.map(nomeAv).join(', ')}` : 'Nenhum selecionado: a equipe fica sem avaliadores.'}</p>
          <div class="acoes">
            <button class="botao leve" onClick={() => setDesignando(null)}>Cancelar</button>
            <BotaoAcao class="botao principal" aoClicar={salvarDesignacao}>Salvar</BotaoAcao>
          </div>
        </Modal>
      )}
    </>
  );

  const membrosAtivos = ativaAqui >= 0 ? grupos[ativaAqui] || [] : [];
  const feitos = membrosAtivos.reduce((s, cid) => s + (completos[cid] || 0), 0);
  // Quantos avaliam a equipe da vez na Apresentação: todos, ou só os designados com a regra ligada
  const totalAgora = soDesignados && ativaAqui >= 0 ? (designados[ativaAqui] || []).length : totalAv;

  if (largo) {
    // ---------- Desktop: direção B "Linha ascendente" ----------
    const servidor = doServidor(etapa);
    const sel = escolhida >= 0 && escolhida < grupos.length ? escolhida : ativaAqui >= 0 ? ativaAqui : 0;
    const membrosSel = grupos[sel] || [];
    const avsSel = designados[sel] || [];
    const qSel = servidor[sel];
    const eC: EstadoMomento = qSel?.construcao || '';
    const eA: EstadoMomento = sel === ativaAqui ? 'ANDAMENTO' : (qSel?.apresentacao || '');
    const lc = lancaram(sel, 'construcao'), la = lancaram(sel, 'apresentacao');
    const textoMomento = (e: EstadoMomento, l: { feitos: number; total: number }, ninguem: string) =>
      e === 'ANDAMENTO' ? `Em andamento. ${l.feitos} de ${l.total} avaliadores completaram.`
        : e === 'CONCLUIDO' ? `Concluída. ${l.feitos} de ${l.total} avaliadores completaram.` : `Pendente. ${ninguem}`;
    const classeEstado = (e: EstadoMomento) => (e === 'CONCLUIDO' ? ' ok' : e === 'ANDAMENTO' ? ' andamento' : '');
    const iconeEstado = (e: EstadoMomento) => (e === 'CONCLUIDO' ? CircleCheck : e === 'ANDAMENTO' ? Radio : Clock);
    const fecharMontar = () => { salvarAgora(); setMontar(false); };
    const totalAgoraDesk = membrosAtivos.length * totalAgora;
    return (
      <section class="aovivo aovivo-desk">
        <NoCampo>
          <div class="titulo-linha">
            <h1>{nomeEtapa || 'Dinâmicas'}</h1>
            {etapa && <button class="botao inverso pequeno" onClick={() => setEditando({ id: etapa, nome: nomeEtapa })}><I c={Pencil} />Renomear</button>}
            <button class="botao inverso pequeno" onClick={() => setEditando({ id: '', nome: `Dinâmica ${etapas.length + 1}` })}><I c={Plus} />Nova dinâmica</button>
            {ativaAqui >= 0 && <BotaoAcao class="botao inverso pequeno" aoClicar={() => aoVivo('', 'Avaliação encerrada')}><I c={Square} />Encerrar a Equipe {ativaAqui + 1}</BotaoAcao>}
          </div>
          {etapas.length > 0 && (
            <div class="dinamicas-campo" role="radiogroup" aria-label="Escolher dinâmica">
              {etapas.map((e) => {
                const nEq = (d.equipes || []).filter((q) => q.etapa === e.id).length;
                const noAr = ativaEtapa === e.id;
                return (
                  <button role="radio" aria-checked={e.id === etapa} onClick={() => setEtapa(e.id)}>
                    {noAr && <I c={Radio} t={18} />}{e.nome}<small>{noAr ? 'ao vivo, ' : ''}{nEq} equipe{nEq === 1 ? '' : 's'}</small>
                  </button>
                );
              })}
            </div>
          )}
          <p class="linha-status" aria-live="polite">
            {ativaAqui >= 0 ? `A Equipe ${ativaAqui + 1} está apresentando. ${feitos} de ${totalAgoraDesk} avaliações recebidas.`
              : grupos.length ? 'Nenhuma equipe apresentando agora.' : 'Crie as equipes desta dinâmica para começar.'}
          </p>
        </NoCampo>

        {modais}
        {montar && (
          <Modal titulo={`Montar equipes da ${nomeEtapa}`} aoFechar={fecharMontar}>
            {blocoMontar}
            <div class="acoes"><button class="botao principal" onClick={fecharMontar}><I c={Check} />Pronto</button></div>
          </Modal>
        )}

        {grupos.length === 0 ? (
          <div class="vazio-desk">
            <h2>Nenhuma equipe nesta dinâmica</h2>
            <p class="ajuda"><I c={Info} t={18} />{presentes.length ? 'Crie as equipes e depois distribua os candidatos.' : 'Dá para criar as equipes e designar os avaliadores antes de importar os candidatos.'}</p>
            <button class="botao principal" onClick={() => qtd(3)}><I c={Plus} />Criar 3 equipes</button>
          </div>
        ) : (
          <>
            <div class="degraus-topo">
              <h2><I c={TrendingUp} t={22} />Ordem de apresentação</h2>
              <span class="espaco" />
              {semEquipe.length > 0 && <button class="botao pequeno" onClick={sortear}><I c={Shuffle} />Sortear {semEquipe.length} sem equipe</button>}
              <button class="botao pequeno" onClick={() => setMontar(true)}><I c={Users} />Montar equipes</button>
              <button class="botao pequeno" disabled={grupos.length >= 12} onClick={() => qtd(grupos.length + 1)}><I c={Plus} />Nova equipe</button>
            </div>

            {semAvaliadores.length > 0 && (
              <p class="alerta-desk" role="status">
                <I c={TriangleAlert} />
                <span>
                  <b>{semAvaliadores.length === 1 ? `A Equipe ${semAvaliadores[0] + 1} está` : `As Equipes ${semAvaliadores.map((i) => i + 1).join(', ')} estão`} sem avaliadores designados.</b>
                  {soDesignados ? (semAvaliadores.length === 1 ? ' Ninguém consegue avaliá-la.' : ' Ninguém consegue avaliá-las.')
                    : (semAvaliadores.length === 1 ? ' A Construção dela não pode começar' : ' A Construção delas não pode começar') + ', mas a Apresentação funciona normalmente.'} Escolha a equipe e use <b>Adicionar avaliador</b>.
                </span>
              </p>
            )}

            <ol class="degraus">
              {grupos.map((g, i) => {
                const c: EstadoMomento = servidor[i]?.construcao || '';
                const [ic, txt, cls] = i === ativaAqui ? [Radio, 'Apresentando agora', ' andamento']
                  : !(designados[i] || []).length ? [TriangleAlert, 'Sem avaliadores', ' falta']
                    : c === 'ANDAMENTO' ? [Hammer, 'Construção em andamento', ' andamento']
                      : c === 'CONCLUIDO' ? [CircleCheck, 'Construção concluída', ' ok'] : [Clock, 'Construção pendente', ''];
                return (
                  <li>
                    <button class={'degrau' + (i === ativaAqui ? ' no-ar' : '')} aria-pressed={i === sel} onClick={() => setEscolhida(i)}>
                      <span class="ordem">Apresenta em {i + 1}º</span>
                      <b>Equipe {i + 1}</b>
                      <span class="quem">{g.length ? g.map(curto).join(', ') : 'Ninguém ainda'}</span>
                      <span class={'estado' + cls}><I c={ic as any} t={18} />{txt}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <section class="detalhe" aria-labelledby="equipe-aberta">
              <h2 id="equipe-aberta">Equipe {sel + 1}
                <span class="acoes"><button class="botao pequeno" onClick={() => setMontar(true)}><I c={Users} />Mudar candidatos</button></span>
              </h2>
              <div class="det-col">
                <h3><I c={ListTodo} />Momentos</h3>
                <ul class="momentos">
                  <li>
                    <b><I c={Hammer} />Construção</b>
                    <span class={'estado' + classeEstado(eC)}><I c={iconeEstado(eC)} t={18} />{textoMomento(eC, lc, avsSel.length ? 'Só os avaliadores da equipe avaliam.' : 'Precisa de pelo menos um avaliador.')}</span>
                    {eC === 'ANDAMENTO'
                      ? <BotaoAcao class="botao pequeno" aoClicar={() => construcao(sel, 'CONCLUIDO', `Construção da Equipe ${sel + 1} concluída`)}><I c={CircleCheck} />Concluir</BotaoAcao>
                      : <BotaoAcao class={'botao pequeno' + (eC === 'CONCLUIDO' ? '' : ' principal')} disabled={!membrosSel.length || !avsSel.length} aoClicar={() => construcao(sel, 'ANDAMENTO', `Construção da Equipe ${sel + 1} aberta`)}>
                        {eC === 'CONCLUIDO' ? <><I c={RotateCcw} />Reabrir</> : <><I c={Play} />Iniciar</>}
                      </BotaoAcao>}
                  </li>
                  <li>
                    <b><I c={Presentation} />Apresentação</b>
                    <span class={'estado' + classeEstado(eA)}><I c={iconeEstado(eA)} t={18} />{textoMomento(eA, la, soDesignados ? 'Só os avaliadores da equipe avaliam.' : 'Todos os avaliadores avaliam.')}</span>
                    {sel === ativaAqui
                      ? <BotaoAcao class="botao pequeno" aoClicar={() => aoVivo('', 'Avaliação encerrada')}><I c={Square} />Encerrar</BotaoAcao>
                      : <BotaoAcao class="botao pequeno principal" disabled={!membrosSel.length} aoClicar={() => aoVivo(idEquipe(etapa, sel), `Equipe ${sel + 1} aberta`)}><I c={Play} />Pôr no ar</BotaoAcao>}
                  </li>
                </ul>
                <h3><I c={UsersRound} />Candidatos <small>{membrosSel.length}</small></h3>
                {membrosSel.length ? (
                  <ul class="fotos">
                    {membrosSel.map((cid) => {
                      const cand = d.candidatos.find((c) => c.id === cid);
                      return (
                        <li>
                          <Foto nome={nome(cid)} foto={cand?.foto_url} tam={48} forma="quadrada" />
                          <span class="n">{nome(cid)}{sel === ativaAqui && <small>{completos[cid] || 0} de {totalAgora} avaliaram</small>}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p class="ajuda"><I c={Info} t={18} />Ninguém nesta equipe ainda. Use Mudar candidatos.</p>}
              </div>
              <div class="det-col">
                <h3><I c={UserCheck} />{soDesignados ? 'Avaliadores da equipe' : 'Avaliadores da Construção'} <small>{avsSel.length}</small></h3>
                {avsSel.length ? (
                  <ul class="pessoas">
                    {avsSel.map((id) => {
                      const a = d.avaliadores.find((x) => x.id === id);
                      return (
                        <li>
                          <span class="avatar-av" aria-hidden="true">{iniciais(nomeAv(id))}</span>
                          <span class="n"><b>{nomeAv(id)}</b><small>{a && a.ativo !== 'SIM' ? 'Inativo' : a?.area || 'Avaliador'}</small></span>
                          <BotaoAcao class="botao pequeno perigo" aoClicar={() => tirar(sel, id)} aria-label={`Tirar ${nomeAv(id)} da Equipe ${sel + 1}`}><I c={UserMinus} />Tirar</BotaoAcao>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p class="ajuda"><I c={Info} t={18} />Nenhum avaliador designado.</p>}
                <button class="botao vaga" onClick={() => abrirDesignacao(sel)}><I c={UserPlus} />Adicionar avaliador</button>
                <p class="ajuda"><I c={Info} t={18} />Sem limite de avaliadores. {soDesignados ? 'Só quem está aqui avalia esta equipe, na Construção e na Apresentação.' : 'Só quem está aqui avalia a Construção desta equipe. Na Apresentação, todos avaliam.'}</p>
              </div>
            </section>
          </>
        )}
      </section>
    );
  }

  return (
    <section class="aovivo">
      <div class="cabeca-pagina">
        <div>
          <span class="sobrelinha">Ao vivo</span>
          <h1 class="titulo">{nomeEtapa || 'Dinâmicas'}</h1>
        </div>
        <button class="botao principal" onClick={() => setEditando({ id: '', nome: `Dinâmica ${etapas.length + 1}` })}>+ Nova dinâmica</button>
      </div>

      <div class="dinamicas" role="radiogroup" aria-label="Escolher dinâmica">
        {etapas.map((e) => {
          const nEq = (d.equipes || []).filter((q) => q.etapa === e.id).length;
          const noAr = ativaEtapa === e.id;
          return (
            <button role="radio" aria-checked={e.id === etapa} class={'dinamica' + (noAr ? ' no-ar' : '')} onClick={() => setEtapa(e.id)}>
              <b>{e.nome}</b>
              <small>{noAr ? 'Ao vivo · ' : ''}{nEq} equipe{nEq === 1 ? '' : 's'}</small>
            </button>
          );
        })}
      </div>
      {etapa && <button class="link renomear" onClick={() => setEditando({ id: etapa, nome: nomeEtapa })}>Renomear “{nomeEtapa}”</button>}

      {modais}

      <div class="aovivo-grade">
        <div class="coluna">
          {ativaAqui >= 0 ? (
            <div class="agora" role="status" aria-label={`Avaliando agora: Equipe ${ativaAqui + 1}`}>
              <div class="agora-topo">
                <div><small>Avaliando agora</small><b>Equipe {ativaAqui + 1}</b></div>
                <span>{feitos} de {membrosAtivos.length * totalAgora} avaliações</span>
              </div>
              <ul>{membrosAtivos.map((cid) => (
                <li>
                  <span class="n">{nome(cid)}</span>
                  <span class="barra" aria-hidden="true"><span style={{ width: `${totalAgora ? ((completos[cid] || 0) / totalAgora) * 100 : 0}%` }} /></span>
                  <span class="cont">{completos[cid] || 0}/{totalAgora}</span>
                </li>
              ))}</ul>
              <BotaoAcao class="botao" aoClicar={() => aoVivo('', 'Avaliação encerrada')}>Encerrar</BotaoAcao>
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
                {!largo && presentes.length > 0 && <button class="botao principal" onClick={() => { setMontar(true); qtd(3); }}>Montar equipes</button>}
                {(largo || !presentes.length) && <button class="botao principal" onClick={() => qtd(3)}>Criar 3 equipes</button>}
                {!presentes.length && <p class="ajuda">Dá para criar as equipes e designar os avaliadores antes de importar os candidatos.</p>}
              </div>
            ) : (
              <>
              {semAvaliadores.length > 0 && (
                <p class="aviso alerta" role="status">
                  {semAvaliadores.length === 1 ? `A Equipe ${semAvaliadores[0] + 1} está` : `As Equipes ${semAvaliadores.map((i) => i + 1).join(', ')} estão`} sem avaliadores designados.
                  {soDesignados ? (semAvaliadores.length === 1 ? ' Ninguém consegue avaliá-la.' : ' Ninguém consegue avaliá-las.')
                    : (semAvaliadores.length === 1 ? ' A Construção dela não pode começar' : ' A Construção delas não pode começar') + ', mas a Apresentação funciona normalmente.'} Toque em <b>Avaliadores</b> na equipe para designar.
                </p>
              )}
              <ul class="equipes">
                {grupos.map((g, i) => {
                  const q = doServidor(etapa)[i];
                  const eC: EstadoMomento = q?.construcao || '';
                  const eA: EstadoMomento = i === ativaAqui ? 'ANDAMENTO' : (q?.apresentacao || '');
                  const lc = lancaram(i, 'construcao'), la = lancaram(i, 'apresentacao');
                  const nomes = (designados[i] || []).map((id) => nomeAv(id).split(' ')[0]).join(', ');
                  const status = (e: EstadoMomento, l: { feitos: number; total: number }) =>
                    e === 'ANDAMENTO' ? `Em andamento · ${l.feitos} de ${l.total} avaliadores completaram` : e === 'CONCLUIDO' ? `Concluído · ${l.feitos} de ${l.total} completaram` : 'Pendente';
                  return (
                    <li class="equipe-item">
                      <div class="eq-txt"><b>Equipe {i + 1}</b><small>{g.length ? `${g.length} · ${g.map(curto).join(', ')}` : 'Ninguém ainda'}</small></div>
                      <div class="eq-avs">
                        <p><span>Avaliadores</span> {nomes || <i class="falta">nenhum designado</i>}</p>
                        <button class="botao leve" onClick={() => abrirDesignacao(i)} aria-label={`Avaliadores da Equipe ${i + 1}`}>Avaliadores</button>
                      </div>
                      <div class="momento">
                        <div class="mom-txt"><b>Construção</b><small class={'est ' + eC.toLowerCase()}>{status(eC, lc)}</small></div>
                        {eC === 'ANDAMENTO'
                          ? <BotaoAcao class="botao" aoClicar={() => construcao(i, 'CONCLUIDO', `Construção da Equipe ${i + 1} concluída`)}>Concluir</BotaoAcao>
                          : <BotaoAcao class="botao" disabled={!g.length || !(designados[i] || []).length} aoClicar={() => construcao(i, 'ANDAMENTO', `Construção da Equipe ${i + 1} aberta`)}>{eC === 'CONCLUIDO' ? 'Reabrir' : 'Iniciar'}</BotaoAcao>}
                      </div>
                      <div class="momento">
                        <div class="mom-txt"><b>Apresentação</b><small class={'est ' + eA.toLowerCase()}>{status(eA, la)}</small></div>
                        {i === ativaAqui
                          ? <span class="ao-vivo">Ao vivo</span>
                          : <BotaoAcao class="botao" disabled={!g.length} aoClicar={() => aoVivo(idEquipe(etapa, i), `Equipe ${i + 1} aberta`)}>Avaliar</BotaoAcao>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
