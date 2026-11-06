// Modo ensaio (dados fictícios), conferência dos cálculos, backup e "apagar dados do processo".
import { useState } from 'preact/hooks';
import { baixarJson, dataArquivo } from './exportar';
import type { PropsAba } from './Admin';
import { Modal } from '../ui';
import { I, useLargo } from './desktop';
import { Download, Eraser, ListChecks, Lock, RotateCcw, Sparkles, Trash2, TriangleAlert, X } from 'lucide-preact';

interface ResumoReset {
  apaga: { candidatos: number; inscricoes: number; importacoes: number; notas: number; observacoes: number };
  mantem: { avaliadores: number; equipes: number; designacoes: number; dinamicas: number; criterios: number };
}

/** Reset do processo seletivo: dois passos (abrir a janela com o resumo e digitar RESETAR) para não disparar por engano. */
function ResetProcesso({ acao, recarregar }: Pick<PropsAba, 'acao' | 'recarregar'>) {
  const [resumo, setResumo] = useState<ResumoReset | null>(null);
  const [texto, setTexto] = useState('');
  const [rodando, setRodando] = useState(false);
  const largo = useLargo();
  const ic = (c: any) => largo && <I c={c} />;   // ícones Lucide só no desktop
  const abrir = async () => { setTexto(''); const r = await acao<ResumoReset>('admin.resumoReset'); if (r) setResumo(r); };
  const executar = async () => {
    if (texto.trim() !== 'RESETAR' || rodando) return;
    setRodando(true);
    const r = await acao('admin.resetarProcesso', { confirmacao: 'RESETAR' }, 'Processo resetado. Pronto para importar a planilha.');
    setRodando(false);
    if (r) { setResumo(null); recarregar(); }
  };
  const n = (v: number, um: string, varios: string) => `${v} ${v === 1 ? um : varios}`;
  return (
    <div class="bloco perigo" style={{ marginTop: 16 }}>
      <h2>Resetar processo seletivo</h2>
      <p>Volta o app ao estado de processo recém-criado, pronto para importar a planilha de inscrições de novo.</p>
      <ul class="ajuda">
        <li><b>Apaga:</b> candidatos, inscrições importadas, histórico de importações, notas e observações. As equipes ficam vazias e o Ao vivo volta ao início.</li>
        <li><b>Mantém:</b> avaliadores (os links continuam valendo), equipes e os avaliadores designados a cada uma, dinâmicas, configuração e critérios, inclusive os valores PREDADOR.</li>
      </ul>
      <button class="botao perigo" onClick={abrir}>{ic(RotateCcw)}Resetar processo…</button>
      {resumo && (
        <Modal titulo="Resetar processo seletivo" aoFechar={() => !rodando && setResumo(null)}>
          {largo ? (
            /* Desktop: o que apaga e o que fica lado a lado, e o alerta com faixa lateral, ícone e texto */
            <>
              <p>O app volta ao começo, pronto para importar a planilha de inscrições de novo.</p>
              <div class="troca">
                <div class="apaga">
                  <h3><I c={Trash2} />Apaga</h3>
                  <ul>
                    <li>{n(resumo.apaga.candidatos, 'candidato', 'candidatos')}</li>
                    <li>{n(resumo.apaga.inscricoes, 'inscrição importada', 'inscrições importadas')} e {n(resumo.apaga.importacoes, 'importação', 'importações')} no histórico</li>
                    <li>{n(resumo.apaga.notas, 'nota', 'notas')} e {n(resumo.apaga.observacoes, 'observação', 'observações')}</li>
                  </ul>
                </div>
                <div class="mantem">
                  <h3><I c={Lock} />Mantém</h3>
                  <ul>
                    <li>{n(resumo.mantem.avaliadores, 'avaliador', 'avaliadores')} e os links</li>
                    <li>{n(resumo.mantem.equipes, 'equipe', 'equipes')} com {n(resumo.mantem.designacoes, 'designação', 'designações')}</li>
                    <li>{n(resumo.mantem.dinamicas, 'dinâmica', 'dinâmicas')} e {n(resumo.mantem.criterios, 'critério', 'critérios')}</li>
                  </ul>
                </div>
              </div>
              <p class="alerta-desk erro"><I c={TriangleAlert} /><span><b>Não dá para desfazer.</b> Baixe o backup antes se quiser guardar uma cópia.</span></p>
            </>
          ) : (
            <>
            <p class="aviso erro" style={{ marginTop: 0 }}>
              Vai apagar {n(resumo.apaga.candidatos, 'candidato', 'candidatos')}, {n(resumo.apaga.notas, 'nota', 'notas')}, {n(resumo.apaga.observacoes, 'observação', 'observações')} e {n(resumo.apaga.importacoes, 'importação', 'importações')}. Não dá para desfazer.
            </p>
            <p class="ajuda">Ficam {n(resumo.mantem.avaliadores, 'avaliador', 'avaliadores')}, {n(resumo.mantem.equipes, 'equipe', 'equipes')} com {n(resumo.mantem.designacoes, 'designação', 'designações')}, {n(resumo.mantem.dinamicas, 'dinâmica', 'dinâmicas')} e {n(resumo.mantem.criterios, 'critério', 'critérios')}. Se quiser guardar uma cópia, baixe o backup antes.</p>
            </>
          )}
          <label class="campo"><span>Digite RESETAR para confirmar</span>
            <input value={texto} autoComplete="off" onInput={(e) => setTexto((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') executar(); }} /></label>
          <div class="acoes">
            <button class="botao leve" disabled={rodando} onClick={() => setResumo(null)}>{ic(X)}Cancelar</button>
            <button class="botao perigo cheio" disabled={texto.trim() !== 'RESETAR' || rodando} onClick={executar}>{ic(RotateCcw)}{rodando ? 'Resetando…' : 'Resetar agora'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function EnsaioDados({ d, acao, recarregar, sessao }: PropsAba) {
  const ensaio = String(d.config.modo).toUpperCase() === 'ENSAIO';
  const [nCand, setNCand] = useState(30);
  const [nAval, setNAval] = useState(12);
  const [conferencia, setConferencia] = useState<any>(null);
  const [confirmacao, setConfirmacao] = useState('');
  const largo = useLargo();
  const ic = (c: any) => largo && <I c={c} />;

  return (
    <section>
      <h2>Ensaio e dados</h2>
      <p class="subtitulo">Esta planilha está no modo <b>{ensaio ? 'ENSAIO' : 'PRODUCAO'}</b>{sessao.amb === 'ensaio' ? ' e você abriu pelo link de ensaio' : ''}.</p>

      <div class="grade-blocos tres">
        <div class="bloco">
          <h2>Dados fictícios</h2>
          {!ensaio ? <p class="ajuda">Só disponível no modo ENSAIO, para não misturar dados de teste com o processo real.</p> : (
            <>
              <p class="ajuda">Cria candidatos e avaliadores fictícios com notas aleatórias, alguns "não posso avaliar" e alguns candidatos parciais.</p>
              <div class="form-grade" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 12 }}>
                <label class="campo"><span>Candidatos</span><input type="number" min="1" max="200" value={nCand} onInput={(e) => setNCand(Number((e.target as HTMLInputElement).value))} /></label>
                <label class="campo"><span>Avaliadores</span><input type="number" min="1" max="50" value={nAval} onInput={(e) => setNAval(Number((e.target as HTMLInputElement).value))} /></label>
              </div>
              <div class="barra-acoes">
                <button class="botao principal" onClick={async () => { if (await acao('admin.gerarFicticios', { candidatos: nCand, avaliadores: nAval }, 'Dados fictícios gerados')) recarregar(); }}>{ic(Sparkles)}Gerar dados fictícios</button>
                <button class="botao perigo" onClick={async () => {
                  if (!confirm('Apagar candidatos, avaliadores e notas desta planilha de ENSAIO? A configuração e os critérios ficam.')) return;
                  if (await acao('admin.zerarEnsaio', {}, 'Ensaio zerado')) recarregar();
                }}>{ic(Eraser)}Zerar dados do ensaio</button>
              </div>
              <p class="ajuda">Para testar a importação, use os arquivos da pasta <code>exemplos/</code> do repositório.</p>
            </>
          )}
        </div>

        <div class="bloco">
          <h2>Conferir cálculos</h2>
          <p class="ajuda">Recalcula a Tabela Geral por fora (mesmo código do app) e compara com as fórmulas da planilha, na dinâmica escolhida na célula B2 da Tabela Geral.</p>
          <button class="botao" style={{ marginTop: 12 }} onClick={async () => setConferencia(await acao('admin.conferir'))}>{ic(ListChecks)}Conferir agora</button>
          {conferencia && (conferencia.ok
            ? <p class="aviso ok" style={{ marginTop: 12 }}>Tudo certo: {conferencia.candidatos} candidatos conferidos (dinâmica {conferencia.etapa}).</p>
            : <div class="aviso erro" style={{ marginTop: 12 }}><b>Diferenças encontradas:</b><ul>{conferencia.diferencas.slice(0, 20).map((x: string) => <li>{x}</li>)}</ul></div>)}
        </div>

        <div class="bloco">
          <h2>Backup completo</h2>
          <p class="ajuda">Baixa todas as abas de dados (inclui tokens e contatos). Guarde em local seguro.</p>
          <button class="botao" style={{ marginTop: 12 }} onClick={async () => { const r = await acao('admin.backup', {}, 'Backup gerado'); if (r) baixarJson(`backup_${dataArquivo()}.json`, r); }}>{ic(Download)}Baixar backup</button>
        </div>
      </div>

      <ResetProcesso acao={acao} recarregar={recarregar} />

      <div class="bloco perigo" style={{ marginTop: 16 }}>
        <h2>Apagar dados do processo</h2>
        <p>Ao fim do processo (LGPD), apaga <b>todos</b> os candidatos, avaliadores, inscrições, notas e observações desta planilha. A configuração e os critérios ficam. Não dá para desfazer.</p>
        <p class="ajuda">Depois, para apagar também o histórico de versões, faça uma cópia da planilha vazia e exclua a original (e esvazie a lixeira do Drive).</p>
        <label class="campo" style={{ maxWidth: 320 }}><span>Digite APAGAR para confirmar</span><input value={confirmacao} onInput={(e) => setConfirmacao((e.target as HTMLInputElement).value)} /></label>
        <button class="botao perigo cheio" disabled={confirmacao !== 'APAGAR'} onClick={async () => {
          if (!confirm('Última confirmação: apagar todos os dados do processo agora?')) return;
          if (await acao('admin.apagarDados', { confirmacao }, 'Dados do processo apagados')) { setConfirmacao(''); recarregar(); }
        }}>{ic(Trash2)}Apagar dados do processo</button>
      </div>
    </section>
  );
}
