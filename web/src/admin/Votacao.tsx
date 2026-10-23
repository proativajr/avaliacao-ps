// "Em votação agora": o admin marca quem acabou de apresentar e o app dos avaliadores mostra um atalho.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { criteriosAtivos, criteriosDaEtapa } from '@shared/calc.js';
import { normalizarNome } from '@shared/texto.js';
import type { PropsAba } from './Admin';

export function Votacao({ d, setD, acao }: PropsAba) {
  const atual = String(d.config.em_votacao || '').split(',').map((s) => s.trim()).filter(Boolean);
  const [sel, setSel] = useState<Set<string>>(new Set(atual));
  const [busca, setBusca] = useState('');
  const abertas = d.etapas.filter((e) => e.aberta === 'SIM');
  const [etapa, setEtapa] = useState((abertas[0] || d.etapas[0])?.id || '');

  // Atualiza as notas a cada 10 s enquanto esta aba está aberta
  useEffect(() => {
    const id = setInterval(async () => {
      const r = await acao<any>('admin.notas');
      if (r) setD((x) => ({ ...x, avaliacoes: r.avaliacoes, observacoes: r.observacoes }));
    }, 10000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  const crits = useMemo(() => criteriosDaEtapa(criteriosAtivos(d.criterios, d.blocos), etapa), [d.criterios, d.blocos, etapa]);
  const avaliadoresAtivos = d.avaliadores.filter((a) => a.ativo === 'SIM');
  const completosPor = useMemo(() => {
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

  const ativos = d.candidatos.filter((c) => c.status === 'ATIVO' && (!busca || normalizarNome(c.nome_exibicao).includes(normalizarNome(busca))));
  const gravar = async (ids: string[]) => {
    const r = await acao<{ em_votacao: string[] }>('admin.emVotacao', { ids }, ids.length ? 'Votação aberta: os avaliadores veem o atalho em até 20 segundos' : 'Votação encerrada');
    if (r) { setD((x) => ({ ...x, config: { ...x.config, em_votacao: r.em_votacao.join(',') } })); setSel(new Set(r.em_votacao)); }
  };
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const nome = (id: string) => d.candidatos.find((c) => c.id === id)?.nome_exibicao || id;

  return (
    <section>
      <h2>Votação</h2>
      <p class="subtitulo">Ao fim da apresentação de uma equipe ou candidato, marque quem apresentou. O app dos avaliadores mostra um atalho para eles no topo da lista.</p>

      <div class="painel" style={{ marginBottom: 16 }}>
        <h3>Em votação agora</h3>
        {!atual.length ? <p class="ajuda">Ninguém em votação.</p> : (
          <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
            {atual.map((id) => <li><b>{nome(id)}</b>: {completosPor[id] || 0} de {avaliadoresAtivos.length} avaliadores já completaram</li>)}
          </ul>
        )}
        <div class="barra-acoes">
          {d.etapas.length > 1 && (
            <select class="entrada" style={{ width: 'auto' }} value={etapa} onChange={(e) => setEtapa((e.target as HTMLSelectElement).value)} aria-label="Etapa">
              {d.etapas.map((e) => <option value={e.id}>{e.nome}{e.aberta === 'SIM' ? '' : ' (fechada)'}</option>)}
            </select>
          )}
          <span class="espaco" />
          {atual.length > 0 && <button class="botao" onClick={() => gravar([])}>Encerrar votação</button>}
          <button class="botao principal" disabled={!sel.size} onClick={() => gravar([...sel])}>Abrir votação para {sel.size || ''} selecionado(s)</button>
        </div>
      </div>

      <div class="barra-acoes">
        <input class="entrada" type="search" placeholder="Buscar candidato" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar candidato" />
        {sel.size > 0 && <button class="botao leve" onClick={() => setSel(new Set())}>Limpar seleção</button>}
      </div>
      <div class="tabela-box">
        <table class="tabela">
          <thead><tr><th></th><th>Candidato</th><th class="num">Avaliadores que completaram</th></tr></thead>
          <tbody>
            {ativos.map((c) => (
              <tr onClick={() => alternar(c.id)} style={{ cursor: 'pointer' }}>
                <td style={{ width: 44 }}><input type="checkbox" checked={sel.has(c.id)} aria-label={'Selecionar ' + c.nome_exibicao} onClick={(e) => e.stopPropagation()} onChange={() => alternar(c.id)} /></td>
                <td><b>{c.nome_exibicao}</b> {atual.includes(c.id) && <span class="selo marca">em votação</span>}</td>
                <td class="num">{completosPor[c.id] || 0} / {avaliadoresAtivos.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
