// Importação de candidatos em 4 passos: fonte -> colunas -> revisão -> resultado.
import { useMemo, useState } from 'preact/hooks';
import { CAMPOS, detectarCabecalho, montarPrevia, nomesDeColuna, paraEnvio, resumoPrevia, sugerirMapeamento } from '@shared/importacao.js';
import { lerArquivo, lerTexto } from './lerArquivo';
import type { PropsAba } from './Admin';

type Linha = ReturnType<typeof montarPrevia>[number];
const PASSOS = ['Arquivo ou colagem', 'Colunas', 'Revisão', 'Pronto'];
const ROTULO_ACAO: Record<string, string> = { criar: 'Criar novo', atualizar: 'Atualizar cadastro', ignorar: 'Ignorar' };
const ROTULO_TIPO: Record<string, [string, string]> = {
  novo: ['Novo', 'ok'], ja_importado: ['Já importado', ''], duplicado_cadastro: ['Possível duplicado', 'alerta'],
  duplicado_arquivo: ['Repetido no arquivo', 'alerta'], erro: ['Erro', 'erro'],
};

export function Importar({ d, setD, acao, aoTerminar }: PropsAba & { aoTerminar: () => void }) {
  const [passo, setPasso] = useState(0);
  const [matriz, setMatriz] = useState<string[][]>([]);
  const [origem, setOrigem] = useState<{ origem: string; nome_arquivo: string }>({ origem: '', nome_arquivo: '' });
  const [iCab, setICab] = useState(0);
  const [mapa, setMapa] = useState<Record<string, number>>({});
  const [previa, setPrevia] = useState<Linha[]>([]);
  const [filtro, setFiltro] = useState<'todas' | 'problemas'>('todas');
  const [colado, setColado] = useState('');
  const [erro, setErro] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const colunas = useMemo(() => nomesDeColuna(matriz[iCab] || []), [matriz, iCab]);

  const carregar = (m: string[][], o: { origem: string; nome_arquivo: string }) => {
    if (m.length < 2) { setErro('Não encontrei linhas suficientes. Confira se o arquivo tem o cabeçalho e pelo menos uma inscrição.'); return; }
    const i = detectarCabecalho(m);
    setMatriz(m); setOrigem(o); setICab(i); setMapa(sugerirMapeamento(nomesDeColuna(m[i])) as Record<string, number>); setErro(''); setPasso(1);
  };
  const escolherArquivo = async (arq?: File | null) => {
    if (!arq) return;
    try { carregar(await lerArquivo(arq), { origem: 'arquivo', nome_arquivo: arq.name }); } catch (e: any) { setErro(e.message || 'Não consegui ler o arquivo.'); }
  };

  const irParaRevisao = () => {
    if (mapa.nome_exibicao === undefined) { setErro('Escolha qual coluna tem o nome do candidato.'); return; }
    setErro('');
    setPrevia(montarPrevia(matriz, iCab, mapa, d.candidatos, d.inscricoes));
    setPasso(2);
  };

  const resumo = resumoPrevia(previa);
  const visiveis = filtro === 'todas' ? previa : previa.filter((l) => l.problemas.length);
  const mudarAcao = (n: number, a: string) => setPrevia((p) => p.map((l) => (l.n === n ? { ...l, acao: a } : l)));
  const nomeAlvo = (id: string) => d.candidatos.find((c) => c.id === id)?.nome_exibicao || id;

  const confirmar = async () => {
    const r = await acao('admin.importarCandidatos', { lote: { ...origem, ignorados_no_app: resumo.ignorar }, linhas: paraEnvio(previa) });
    if (r) {
      setD((x) => ({ ...x, candidatos: r.candidatos, inscricoes: r.inscricoes }));
      setResultado(r); setPasso(3);
    }
  };

  return (
    <section>
      <h2>Importar candidatos</h2>
      <p class="subtitulo">Use a planilha de respostas do formulário de inscrição. Reimportar é seguro: quem já entrou não é duplicado.</p>
      <ol class="passos">{PASSOS.map((p, i) => <li aria-current={i === passo ? 'step' : undefined}>{p}</li>)}</ol>
      {erro && <p class="aviso erro" role="alert">{erro}</p>}

      {passo === 0 && (
        <div class="grade-2">
          <label class={'zona-arquivo' + (arrastando ? ' ativa' : '')}
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); escolherArquivo(e.dataTransfer?.files?.[0]); }}>
            <b>Escolher arquivo CSV ou XLSX</b>
            <p class="ajuda">No Google Forms: Respostas → Vincular ao Planilhas → Arquivo → Fazer download (.csv ou .xlsx). Ou arraste o arquivo para cá.</p>
            <input type="file" accept=".csv,.xlsx,.txt,text/csv" style={{ display: 'none' }} onChange={(e) => escolherArquivo((e.target as HTMLInputElement).files?.[0])} />
            <span class="botao principal">Escolher arquivo</span>
          </label>
          <div class="painel">
            <h3>Ou cole as linhas</h3>
            <p class="ajuda">Selecione as células na planilha de respostas (com o cabeçalho), copie e cole aqui.</p>
            <textarea class="entrada" style={{ minHeight: 140 }} value={colado} onInput={(e) => setColado((e.target as HTMLTextAreaElement).value)} aria-label="Linhas coladas" />
            <button class="botao" style={{ marginTop: 8 }} disabled={!colado.trim()} onClick={() => carregar(lerTexto(colado), { origem: 'colagem', nome_arquivo: '' })}>Ler linhas coladas</button>
          </div>
        </div>
      )}

      {passo === 1 && (
        <>
          <div class="painel" style={{ marginBottom: 16 }}>
            <h3>Qual linha é o cabeçalho?</h3>
            <div class="tabela-box"><table class="tabela"><tbody>
              {matriz.slice(0, 5).map((l, i) => (
                <tr style={{ background: i === iCab ? 'var(--marca-suave)' : undefined, cursor: 'pointer' }} onClick={() => { setICab(i); setMapa(sugerirMapeamento(nomesDeColuna(matriz[i])) as Record<string, number>); }}>
                  <td><input type="radio" checked={i === iCab} aria-label={'Linha ' + (i + 1)} /></td>
                  {l.slice(0, 6).map((c) => <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</td>)}
                </tr>
              ))}
            </tbody></table></div>
          </div>
          <div class="painel">
            <h3>Ligue cada informação a uma coluna</h3>
            <p class="ajuda">Sugeri pelo nome das colunas. Só o nome é obrigatório. {matriz.length - iCab - 1} inscrição(ões) encontradas.</p>
            <div class="grade-2" style={{ marginTop: 12 }}>
              {CAMPOS.map((c) => {
                const exemplo = mapa[c.id] !== undefined ? (matriz[iCab + 1] || [])[mapa[c.id]] : '';
                return (
                  <label class="campo">
                    <span>{c.rotulo}{c.obrigatorio ? ' (obrigatório)' : ''}</span>
                    <select value={mapa[c.id] ?? ''} onChange={(e) => {
                      const v = (e.target as HTMLSelectElement).value;
                      setMapa((m) => { const n = { ...m }; if (v === '') delete n[c.id]; else n[c.id] = Number(v); return n; });
                    }}>
                      <option value="">— não usar —</option>
                      {colunas.map((col, i) => <option value={i}>{col}</option>)}
                    </select>
                    <small class="ajuda">{exemplo ? 'Ex.: ' + String(exemplo).slice(0, 60) : ' '}</small>
                  </label>
                );
              })}
            </div>
            <div class="barra-acoes" style={{ marginTop: 8 }}>
              <button class="botao" onClick={() => setPasso(0)}>Voltar</button>
              <button class="botao principal" onClick={irParaRevisao}>Revisar inscrições</button>
            </div>
          </div>
        </>
      )}

      {passo === 2 && (
        <>
          <div class="indicadores">
            <div class="indicador"><b>{resumo.criar}</b><span>novos</span></div>
            <div class="indicador"><b>{resumo.atualizar}</b><span>atualizar cadastro</span></div>
            <div class="indicador"><b>{resumo.ignorar}</b><span>ignorar</span></div>
            <div class="indicador"><b>{resumo.avisos + resumo.erros}</b><span>com aviso</span></div>
          </div>
          <div class="barra-acoes">
            <select class="entrada" style={{ width: 'auto' }} value={filtro} onChange={(e) => setFiltro((e.target as HTMLSelectElement).value as any)} aria-label="Filtrar">
              <option value="todas">Todas as linhas ({previa.length})</option>
              <option value="problemas">Só com aviso ({previa.filter((l) => l.problemas.length).length})</option>
            </select>
            <span class="espaco" />
            <button class="botao" onClick={() => setPasso(1)}>Voltar</button>
            <button class="botao principal" disabled={!resumo.criar && !resumo.atualizar} onClick={confirmar}>
              Importar {resumo.criar ? `${resumo.criar} novo(s)` : ''}{resumo.criar && resumo.atualizar ? ' e ' : ''}{resumo.atualizar ? `atualizar ${resumo.atualizar}` : ''}
            </button>
          </div>
          <div class="tabela-box">
            <table class="tabela">
              <thead><tr><th class="num">Linha</th><th>Nome</th><th>Email</th><th>Curso</th><th>Situação</th><th>O que fazer</th></tr></thead>
              <tbody>
                {visiveis.map((l) => {
                  const [rot, cor] = ROTULO_TIPO[l.tipo];
                  return (
                    <tr class={l.acao === 'ignorar' ? 'inativo' : ''}>
                      <td class="num">{l.n}</td>
                      <td><b>{l.dados.nome_exibicao || '—'}</b></td>
                      <td>{l.dados.email || '—'}</td>
                      <td>{l.dados.curso || '—'}</td>
                      <td><span class={'selo ' + cor}>{rot}</span>
                        {l.problemas.map((p) => <div class="ajuda">{p}{l.alvo_id && p.includes(l.alvo_id) ? ` (${nomeAlvo(l.alvo_id)})` : ''}</div>)}
                      </td>
                      <td>
                        <select class="entrada" style={{ minWidth: 170 }} value={l.acao} disabled={l.opcoes.length < 2} onChange={(e) => mudarAcao(l.n, (e.target as HTMLSelectElement).value)} aria-label={'Ação para a linha ' + l.n}>
                          {l.opcoes.map((o) => <option value={o}>{o === 'criar' && l.tipo !== 'novo' ? 'Criar mesmo assim' : ROTULO_ACAO[o]}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {passo === 3 && resultado && (
        <div class="painel">
          <h3>Importação concluída</h3>
          <p>{resultado.criados} candidato(s) criados, {resultado.atualizados} atualizados e {resultado.ignorados} ignorados.</p>
          <p class="ajuda">A linha original de cada inscrição ficou guardada na aba Inscricoes_Original e pode ser vista no cadastro do candidato.</p>
          <div class="barra-acoes">
            <button class="botao" onClick={() => { setPasso(0); setColado(''); setResultado(null); }}>Importar outro arquivo</button>
            <button class="botao principal" onClick={aoTerminar}>Ver candidatos</button>
          </div>
        </div>
      )}
    </section>
  );
}
