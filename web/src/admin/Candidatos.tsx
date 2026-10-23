// Cadastro de candidatos: lista, busca, status, edição, inscrição original e importação.
import { useMemo, useState } from 'preact/hooks';
import { STATUS, type Candidato } from '../tipos';
import { dataCurta, Modal } from '../ui';
import { normalizarNome, emailValido, nomesParaAvaliador } from '@shared/texto.js';
import { Importar } from './Importar';
import type { PropsAba } from './Admin';

const COR_STATUS: Record<string, string> = { ATIVO: 'ok', FALTOU: 'alerta', ELIMINADO: 'erro', DESISTIU: '' };

export function Candidatos(props: PropsAba) {
  const { d, setD, acao } = props;
  const [modo, setModo] = useState<'lista' | 'importar'>(d.candidatos.length ? 'lista' : 'importar');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [editando, setEditando] = useState<Partial<Candidato> | null>(null);
  const [inscricao, setInscricao] = useState<{ c: Candidato; itens: any[] | null } | null>(null);

  const notasPorCand = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    d.avaliacoes.forEach((a) => { (m[a.candidato_id] = m[a.candidato_id] || new Set()).add(a.avaliador_id); });
    return m;
  }, [d.avaliacoes]);
  const curtos = useMemo(() => nomesParaAvaliador(d.candidatos.filter((c) => c.status === 'ATIVO').map((c) => ({ id: c.id, nome: c.nome_exibicao }))), [d.candidatos]);

  const lista = useMemo(() => {
    const b = normalizarNome(busca);
    return d.candidatos.filter((c) => (!status || c.status === status) &&
      (!b || normalizarNome(`${c.id} ${c.nome_exibicao} ${c.email} ${c.curso}`).includes(b)));
  }, [d.candidatos, busca, status]);

  if (modo === 'importar') return (
    <>
      {d.candidatos.length > 0 && <button class="botao leve" onClick={() => setModo('lista')} style={{ marginBottom: 8 }}>‹ Voltar para a lista</button>}
      <Importar {...props} aoTerminar={() => setModo('lista')} />
    </>
  );

  const salvar = async (itens: Partial<Candidato>[], msg: string) => {
    const r = await acao<{ candidatos: Candidato[] }>('admin.salvarCandidatos', { lista: itens }, msg);
    if (r) setD((x) => ({ ...x, candidatos: r.candidatos }));
    return !!r;
  };

  const abrirInscricao = async (c: Candidato) => {
    setInscricao({ c, itens: null });
    const r = await acao<{ inscricoes: any[] }>('admin.inscricao', { id: c.id });
    setInscricao({ c, itens: r ? r.inscricoes : [] });
  };

  const contagem = STATUS.map((s) => [s, d.candidatos.filter((c) => c.status === s).length] as const);

  return (
    <section>
      <h2>Candidatos</h2>
      <p class="subtitulo">{contagem.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(', ')}. Candidatos nunca são apagados: mude o status.</p>
      <div class="barra-acoes">
        <input class="entrada" type="search" placeholder="Buscar por nome, email, curso ou ID" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar candidato" />
        <select class="entrada" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)} aria-label="Filtrar status">
          <option value="">Todos os status</option>
          {STATUS.map((s) => <option value={s}>{s}</option>)}
        </select>
        <span class="espaco" />
        <button class="botao" onClick={() => setEditando({ nome_exibicao: '', email: '', telefone: '', curso: '', semestre: '', foto_url: '' })}>Adicionar à mão</button>
        <button class="botao principal" onClick={() => setModo('importar')}>Importar inscrições</button>
      </div>
      <div class="tabela-box">
        <table class="tabela">
          <thead><tr><th>ID</th><th>Nome de exibição</th><th>Os avaliadores veem</th><th>Curso</th><th>Status</th><th class="num">Avaliadores</th><th class="num">Ações</th></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr class={c.status === 'ATIVO' ? '' : 'inativo'}>
                <td>{c.id}</td>
                <td><b>{c.nome_exibicao}</b><br /><small class="ajuda">{c.email || 'sem email'}{c.origem === 'importado' ? ' · importado ' + dataCurta(c.importado_em) : ' · manual'}</small></td>
                <td>{curtos[c.id] || '—'}</td>
                <td>{c.curso || '—'}{c.semestre ? ` (${c.semestre}º)` : ''}</td>
                <td>
                  <select class={'entrada selo ' + (COR_STATUS[c.status] || '')} style={{ width: 'auto', minHeight: 36 }} value={c.status} aria-label={'Status de ' + c.nome_exibicao}
                    onChange={(e) => salvar([{ id: c.id, status: (e.target as HTMLSelectElement).value }], 'Status atualizado')}>
                    {STATUS.map((s) => <option value={s}>{s}</option>)}
                  </select>
                </td>
                <td class="num">{notasPorCand[c.id]?.size || 0}</td>
                <td><div class="acoes-linha">
                  <button class="botao pequeno" onClick={() => setEditando(c)}>Editar</button>
                  {c.origem === 'importado' && <button class="botao pequeno" onClick={() => abrirInscricao(c)}>Inscrição</button>}
                </div></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={7} class="ajuda">Nenhum candidato encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal titulo={editando.id ? `Editar ${editando.id}` : 'Adicionar candidato'} aoFechar={() => setEditando(null)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!editando.nome_exibicao?.trim()) return;
            if (editando.email && !emailValido(editando.email)) { alert('Email inválido.'); return; }
            const { id, nome_exibicao, email, telefone, curso, semestre, foto_url } = editando;
            if (await salvar([{ id, nome_exibicao, email, telefone, curso, semestre: semestre as any, foto_url }], id ? 'Candidato salvo' : 'Candidato adicionado')) setEditando(null);
          }}>
            {([['nome_exibicao', 'Nome de exibição (o que os avaliadores veem)'], ['email', 'Email'], ['telefone', 'Telefone'], ['curso', 'Curso'], ['semestre', 'Semestre'], ['foto_url', 'Link da foto (opcional)']] as const).map(([k, r]) => (
              <label class="campo"><span>{r}</span>
                <input required={k === 'nome_exibicao'} type={k === 'email' ? 'email' : 'text'} value={String((editando as any)[k] ?? '')}
                  onInput={(e) => setEditando({ ...editando, [k]: (e.target as HTMLInputElement).value })} />
              </label>
            ))}
            <p class="ajuda">Email e telefone só aparecem para admins.</p>
            <div class="acoes"><button type="button" class="botao" onClick={() => setEditando(null)}>Cancelar</button><button class="botao principal">Salvar</button></div>
          </form>
        </Modal>
      )}

      {inscricao && (
        <Modal titulo={`Inscrição original · ${inscricao.c.nome_exibicao}`} aoFechar={() => setInscricao(null)}>
          {!inscricao.itens ? <p class="carregando">Carregando…</p> : !inscricao.itens.length ? <p>Nenhuma inscrição guardada.</p> :
            inscricao.itens.map((i) => (
              <div class="painel" style={{ marginBottom: 12 }}>
                <p class="ajuda">Lote {i.lote_id} · {dataCurta(i.importado_em)}</p>
                <dl style={{ margin: 0 }}>
                  {Object.entries(i.dados).map(([k, v]) => (<><dt style={{ fontWeight: 700, fontSize: 14, color: 'var(--suave)' }}>{k}</dt><dd style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{String(v) || '—'}</dd></>))}
                </dl>
              </div>
            ))}
          <div class="acoes"><button class="botao" onClick={() => setInscricao(null)}>Fechar</button></div>
        </Modal>
      )}
    </section>
  );
}
