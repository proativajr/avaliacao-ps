// Cadastro de avaliadores: um a um ou colando uma lista; link pessoal, WhatsApp, regerar e desativar.
import { useMemo, useState } from 'preact/hooks';
import { linkAvaliador } from '../api';
import type { Avaliador } from '../tipos';
import { copiar, dataRelativa, Modal } from '../ui';
import { normalizarNome, normalizarEmail, emailValido } from '@shared/texto.js';
import type { PropsAba } from './Admin';

/** "Nome, email" / "Nome<TAB>email" / "Nome email@x.com" -> [{nome, email}] */
export function lerListaAvaliadores(texto: string) {
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/);
    const email = m ? m[0] : '';
    const nome = (m ? l.replace(m[0], '') : l).replace(/[<>]/g, '').replace(/[\t,;|]+/g, ' ').replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim();
    return { nome, email: normalizarEmail(email) };
  }).filter((a) => a.nome);
}

function mensagemWhats(a: Avaliador, processo: string, link: string) {
  const primeiro = a.nome.split(' ')[0];
  return `Oi, ${primeiro}! Este é o seu link pessoal para avaliar os candidatos do ${processo || 'PS'}:\n${link}\n\nAbra no celular e deixe salvo. Não compartilhe: o link identifica você.`;
}

export function Avaliadores({ d, setD, acao, sessao }: PropsAba) {
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Partial<Avaliador> | null>(null);
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState('');
  const lista = useMemo(() => {
    const b = normalizarNome(busca);
    return d.avaliadores.filter((a) => !b || normalizarNome(a.nome + ' ' + a.email + ' ' + a.area).includes(b))
      .sort((x, y) => (x.ativo === y.ativo ? x.nome.localeCompare(y.nome, 'pt-BR') : x.ativo === 'SIM' ? -1 : 1));
  }, [d.avaliadores, busca]);

  const salvar = async (itens: Partial<Avaliador>[], msg: string) => {
    const r = await acao<{ avaliadores: Avaliador[] }>('admin.salvarAvaliadores', { lista: itens }, msg);
    if (r) setD((x) => ({ ...x, avaliadores: r.avaliadores }));
    return !!r;
  };

  const previa = lerListaAvaliadores(texto);
  const existentes = new Set(d.avaliadores.flatMap((a) => [normalizarNome(a.nome), a.email].filter(Boolean)));
  const novos = previa.filter((a) => !existentes.has(normalizarNome(a.nome)) && !(a.email && existentes.has(a.email)));

  const processo = d.config.nome_processo;
  const todosLinks = () => d.avaliadores.filter((a) => a.ativo === 'SIM').map((a) => `${a.nome}: ${linkAvaliador(a.token, sessao.amb)}`).join('\n');

  return (
    <section>
      <h2>Avaliadores</h2>
      <p class="subtitulo">Os membros atuais da Proativa. Cada um recebe um link pessoal, sem senha.</p>
      <div class="barra-acoes">
        <input class="entrada" type="search" placeholder="Buscar avaliador" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar avaliador" />
        <span class="espaco" />
        <button class="botao" onClick={() => copiar(todosLinks(), 'Links de todos copiados')} disabled={!d.avaliadores.length}>Copiar todos os links</button>
        <button class="botao" onClick={() => { setTexto(''); setColando(true); }}>Colar lista</button>
        <button class="botao principal" onClick={() => setEditando({ nome: '', email: '', area: '' })}>Adicionar avaliador</button>
      </div>

      {!d.avaliadores.length ? (
        <div class="painel">
          <h3>Nenhum avaliador cadastrado</h3>
          <p>Cole a lista de membros (nome e email, um por linha) ou adicione um por um.</p>
          <button class="botao principal" onClick={() => { setTexto(''); setColando(true); }}>Colar lista de membros</button>
        </div>
      ) : (
        <div class="tabela-box">
          <table class="tabela">
            <thead><tr><th>Nome</th><th>Email</th><th>Área</th><th>Último acesso</th><th class="num">Ações</th></tr></thead>
            <tbody>
              {lista.map((a) => {
                const link = linkAvaliador(a.token, sessao.amb);
                const ativo = a.ativo === 'SIM';
                return (
                  <tr class={ativo ? '' : 'inativo'}>
                    <td><b>{a.nome}</b> {!ativo && <span class="selo">desativado</span>}<br /><small class="ajuda">{a.id}</small></td>
                    <td>{a.email || '—'}</td>
                    <td>{a.area || '—'}</td>
                    <td>{dataRelativa(a.ultimo_acesso)}</td>
                    <td>
                      <div class="acoes-linha">
                        {ativo && <button class="botao pequeno" onClick={() => copiar(link, 'Link de ' + a.nome.split(' ')[0] + ' copiado')}>Copiar link</button>}
                        {ativo && <a class="botao pequeno" target="_blank" rel="noopener" href={'https://wa.me/?text=' + encodeURIComponent(mensagemWhats(a, processo, link))}>WhatsApp</a>}
                        <button class="botao pequeno" onClick={() => setEditando(a)}>Editar</button>
                        {ativo && <button class="botao pequeno" onClick={async () => {
                          if (!confirm(`Gerar um link novo para ${a.nome}? O link antigo para de funcionar na hora.`)) return;
                          const r = await acao<{ avaliador: Avaliador }>('admin.regerarToken', { id: a.id }, 'Link novo gerado. Envie para ' + a.nome.split(' ')[0] + '.');
                          if (r) setD((x) => ({ ...x, avaliadores: x.avaliadores.map((y) => (y.id === a.id ? r.avaliador : y)) }));
                        }}>Regerar link</button>}
                        <button class={'botao pequeno' + (ativo ? ' perigo' : '')} onClick={() => {
                          if (ativo && !confirm(`Desativar ${a.nome}? O link deixa de funcionar, mas as notas já dadas continuam valendo.`)) return;
                          salvar([{ id: a.id, ativo: ativo ? 'NÃO' : 'SIM' }], ativo ? 'Avaliador desativado' : 'Avaliador reativado');
                        }}>{ativo ? 'Desativar' : 'Reativar'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <Modal titulo={editando.id ? 'Editar avaliador' : 'Adicionar avaliador'} aoFechar={() => setEditando(null)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!editando.nome?.trim()) return;
            if (editando.email && !emailValido(editando.email)) { alert('Email inválido.'); return; }
            const ok = await salvar([{ id: editando.id, nome: editando.nome, email: editando.email, area: editando.area }], editando.id ? 'Avaliador salvo' : 'Avaliador adicionado');
            if (ok) setEditando(null);
          }}>
            <label class="campo"><span>Nome</span><input required value={editando.nome} onInput={(e) => setEditando({ ...editando, nome: (e.target as HTMLInputElement).value })} /></label>
            <label class="campo"><span>Email (opcional)</span><input type="email" value={editando.email} onInput={(e) => setEditando({ ...editando, email: (e.target as HTMLInputElement).value })} /></label>
            <label class="campo"><span>Área (opcional)</span><input value={editando.area} placeholder="Projetos, Comercial, Gente…" onInput={(e) => setEditando({ ...editando, area: (e.target as HTMLInputElement).value })} /></label>
            <div class="acoes"><button type="button" class="botao" onClick={() => setEditando(null)}>Cancelar</button><button class="botao principal">Salvar</button></div>
          </form>
        </Modal>
      )}

      {colando && (
        <Modal titulo="Colar lista de avaliadores" aoFechar={() => setColando(false)}>
          <p class="ajuda">Um por linha, com nome e email (o email é opcional). Pode colar direto de uma planilha.</p>
          <textarea class="entrada" style={{ minHeight: 180 }} value={texto} placeholder={'Maria Exemplo, maria@exemplo.com\nJoão Modelo\tjoao@exemplo.com'}
            onInput={(e) => setTexto((e.target as HTMLTextAreaElement).value)} aria-label="Lista de avaliadores" />
          {previa.length > 0 && (
            <p class="ajuda">{novos.length} novo(s){previa.length - novos.length ? `, ${previa.length - novos.length} já cadastrado(s) serão ignorados` : ''}.</p>
          )}
          <div class="acoes">
            <button class="botao" onClick={() => setColando(false)}>Cancelar</button>
            <button class="botao principal" disabled={!novos.length} onClick={async () => {
              if (await salvar(novos, `${novos.length} avaliador(es) adicionados`)) setColando(false);
            }}>Adicionar {novos.length || ''}</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
