// Cadastro de avaliadores: um a um ou colando uma lista; link pessoal, WhatsApp, regerar e desativar.
import { useMemo, useState } from 'preact/hooks';
import { linkAvaliador } from '../api';
import type { Avaliador } from '../tipos';
import { copiar, dataRelativa, Modal } from '../ui';
import { normalizarNome, normalizarEmail, emailValido, mapearDiretoria } from '@shared/texto.js';
import { SeletorDiretoria } from './Diretoria';
import type { PropsAba } from './Admin';
import { I, useLargo } from './desktop';
import { ClipboardPaste, Copy, Link2, MessageCircle, Pencil, RefreshCw, TriangleAlert, UserCheck, UserPlus, UserX } from 'lucide-preact';

/** "Nome, email, diretoria" / "Nome<TAB>email<TAB>diretoria" / "Nome email@x.com" -> [{nome, email, area}].
 *  A diretoria só é lida quando vem numa coluna separada e bate com uma das quatro opções. */
export function lerListaAvaliadores(texto: string) {
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    let area = '';
    const partes = l.split(/[\t,;|]+/).map((x) => x.trim()).filter(Boolean);
    if (partes.length > 1) {
      const d = mapearDiretoria(partes[partes.length - 1]);
      if (d) { area = d; l = partes.slice(0, -1).join(', '); }
    }
    const m = l.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/);
    const email = m ? m[0] : '';
    const nome = (m ? l.replace(m[0], '') : l).replace(/[<>]/g, '').replace(/[\t,;|]+/g, ' ').replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim();
    return { nome, email: normalizarEmail(email), area };
  }).filter((a) => a.nome);
}

function mensagemWhats(a: Avaliador, processo: string, link: string) {
  const primeiro = a.nome.split(' ')[0];
  return `Oi, ${primeiro}! Este é o seu link pessoal para avaliar os candidatos do ${processo || 'PS'}:\n${link}\n\nAbra no celular e deixe salvo. Não compartilhe: o link identifica você.`;
}

export function Avaliadores({ d, setD, acao, sessao }: PropsAba) {
  const [busca, setBusca] = useState('');
  const largo = useLargo();
  const ic = (c: any) => largo && <I c={c} />;   // ícones Lucide só no desktop
  const [editando, setEditando] = useState<Partial<Avaliador> | null>(null);
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState('');
  const [dirColadas, setDirColadas] = useState<Record<number, string>>({});
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
  const novos = previa.filter((a) => !existentes.has(normalizarNome(a.nome)) && !(a.email && existentes.has(a.email)))
    .map((a, i) => ({ ...a, area: dirColadas[i] ?? a.area }));
  const novosSemDiretoria = novos.filter((a) => !a.area).length;
  // Avaliadores ativos sem diretoria (texto antigo que não deu para converter, ou cadastro antigo vazio)
  const revisar = d.avaliadores.filter((a) => a.ativo === 'SIM' && !a.area);

  const processo = d.config.nome_processo;
  const todosLinks = () => d.avaliadores.filter((a) => a.ativo === 'SIM').map((a) => `${a.nome}: ${linkAvaliador(a.token, sessao.amb)}`).join('\n');

  return (
    <section>
      <h2>Avaliadores</h2>
      <p class="subtitulo">Os membros atuais da Proativa. Cada um recebe um link pessoal, sem senha.</p>
      <div class="barra-acoes">
        <input class="entrada" type="search" placeholder="Buscar avaliador" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} aria-label="Buscar avaliador" />
        <span class="espaco" />
        <button class="botao" onClick={() => copiar(todosLinks(), 'Links de todos copiados')} disabled={!d.avaliadores.length}>{ic(Copy)}Copiar todos os links</button>
        <button class="botao" onClick={() => { setTexto(''); setDirColadas({}); setColando(true); }}>{ic(ClipboardPaste)}Colar lista</button>
        <button class="botao principal" onClick={() => setEditando({ nome: '', email: '', area: '' })}>{ic(UserPlus)}Adicionar avaliador</button>
      </div>

      {revisar.length > 0 && (
        <div class="aviso alerta aviso-diretoria" role="status">
          {ic(TriangleAlert)}<b>{revisar.length === 1 ? '1 avaliador está' : `${revisar.length} avaliadores estão`} sem diretoria.</b> Toque em Editar e escolha uma das quatro opções.
          <ul>
            {revisar.map((a) => (
              <li>{a.nome}{a.area_revisar ? <> (estava "{a.area_revisar}")</> : ' (sem área no cadastro antigo)'}</li>
            ))}
          </ul>
        </div>
      )}

      {!d.avaliadores.length ? (
        <div class="bloco">
          <h2>Nenhum avaliador cadastrado</h2>
          <p>Cole a lista de membros (nome e email, um por linha) ou adicione um por um.</p>
          <button class="botao principal" onClick={() => { setTexto(''); setDirColadas({}); setColando(true); }}>{ic(ClipboardPaste)}Colar lista de membros</button>
        </div>
      ) : (
        <div class="tabela-box vira-cartao ate-desktop">
          <table class="tabela">
            <thead><tr><th>Nome</th><th>Email</th><th>Diretoria</th><th>Último acesso</th><th class="num">Ações</th></tr></thead>
            <tbody>
              {lista.map((a) => {
                const link = linkAvaliador(a.token, sessao.amb);
                const ativo = a.ativo === 'SIM';
                return (
                  <tr class={ativo ? '' : 'inativo'}>
                    <td class="titulo-cel"><b>{a.nome}</b> {!ativo && <span class="selo">desativado</span>}<span class="sub-cel">{a.id}</span></td>
                    <td data-rotulo="Email" style={{ overflowWrap: 'anywhere' }}>{a.email || '—'}</td>
                    <td data-rotulo="Diretoria">{a.area || <span class="selo alerta">Revisar</span>}</td>
                    <td data-rotulo="Último acesso">{dataRelativa(a.ultimo_acesso)}</td>
                    <td class="acoes-cel">
                      <div class="acoes-linha">
                        {ativo && <button class="botao pequeno" onClick={() => copiar(link, 'Link de ' + a.nome.split(' ')[0] + ' copiado')}>{ic(Link2)}Copiar link</button>}
                        {ativo && <a class="botao pequeno" target="_blank" rel="noopener" href={'https://wa.me/?text=' + encodeURIComponent(mensagemWhats(a, processo, link))}>{ic(MessageCircle)}WhatsApp</a>}
                        <button class="botao pequeno" onClick={() => setEditando(a)}>{ic(Pencil)}Editar</button>
                        {ativo && <button class="botao pequeno" onClick={async () => {
                          if (!confirm(`Gerar um link novo para ${a.nome}? O link antigo para de funcionar na hora.`)) return;
                          const r = await acao<{ avaliador: Avaliador }>('admin.regerarToken', { id: a.id }, 'Link novo gerado. Envie para ' + a.nome.split(' ')[0] + '.');
                          if (r) setD((x) => ({ ...x, avaliadores: x.avaliadores.map((y) => (y.id === a.id ? r.avaliador : y)) }));
                        }}>{ic(RefreshCw)}Regerar link</button>}
                        <button class={'botao pequeno' + (ativo ? ' perigo' : '')} onClick={() => {
                          if (ativo && !confirm(`Desativar ${a.nome}? O link deixa de funcionar, mas as notas já dadas continuam valendo.`)) return;
                          salvar([{ id: a.id, ativo: ativo ? 'NÃO' : 'SIM' }], ativo ? 'Avaliador desativado' : 'Avaliador reativado');
                        }}>{ic(ativo ? UserX : UserCheck)}{ativo ? 'Desativar' : 'Reativar'}</button>
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
            if (!editando.area) { alert('Escolha a diretoria.'); return; }
            const ok = await salvar([{ id: editando.id, nome: editando.nome, email: editando.email, area: editando.area }], editando.id ? 'Avaliador salvo' : 'Avaliador adicionado');
            if (ok) setEditando(null);
          }}>
            <label class="campo"><span>Nome</span><input required value={editando.nome} onInput={(e) => setEditando({ ...editando, nome: (e.target as HTMLInputElement).value })} /></label>
            <label class="campo"><span>Email (opcional)</span><input type="email" value={editando.email} onInput={(e) => setEditando({ ...editando, email: (e.target as HTMLInputElement).value })} /></label>
            <SeletorDiretoria rotulo="Diretoria" valor={editando.area || ''} aoMudar={(v) => setEditando({ ...editando, area: v })} />
            {editando.area_revisar && !editando.area && <p class="ajuda">No cadastro antigo estava "{editando.area_revisar}".</p>}
            <div class="acoes"><button type="button" class="botao" onClick={() => setEditando(null)}>Cancelar</button><button class="botao principal">Salvar</button></div>
          </form>
        </Modal>
      )}

      {colando && (
        <Modal titulo="Colar lista de avaliadores" aoFechar={() => setColando(false)}>
          <p class="ajuda">Um por linha, com nome, email e diretoria (email e diretoria são opcionais aqui). Pode colar direto de uma planilha. Escolha a diretoria de cada um abaixo antes de adicionar.</p>
          <textarea class="entrada" style={{ minHeight: 180 }} value={texto} placeholder={'Maria Exemplo, maria@exemplo.com\nJoão Modelo\tjoao@exemplo.com'}
            onInput={(e) => { setTexto((e.target as HTMLTextAreaElement).value); setDirColadas({}); }} aria-label="Lista de avaliadores" />
          {previa.length > 0 && (
            <p class="ajuda">{novos.length} novo(s){previa.length - novos.length ? `, ${previa.length - novos.length} já cadastrado(s) serão ignorados` : ''}.</p>
          )}
          {novos.length > 0 && (
            <ul class="lista-diretorias">
              {novos.map((a, i) => (
                <li>
                  <span class="n">{a.nome}</span>
                  <SeletorDiretoria valor={a.area} ariaLabel={`Diretoria de ${a.nome}`} aoMudar={(v) => setDirColadas((x) => ({ ...x, [i]: v }))} />
                </li>
              ))}
            </ul>
          )}
          {novosSemDiretoria > 0 && <p class="ajuda">Falta escolher a diretoria de {novosSemDiretoria === 1 ? '1 pessoa' : `${novosSemDiretoria} pessoas`}.</p>}
          <div class="acoes">
            <button class="botao" onClick={() => setColando(false)}>Cancelar</button>
            <button class="botao principal" disabled={!novos.length || novosSemDiretoria > 0} onClick={async () => {
              if (await salvar(novos, `${novos.length} avaliador(es) adicionados`)) setColando(false);
            }}>Adicionar {novos.length || ''}</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
