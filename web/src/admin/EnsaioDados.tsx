// Modo ensaio (dados fictícios), conferência dos cálculos, backup e "apagar dados do processo".
import { useState } from 'preact/hooks';
import { baixarJson, dataArquivo } from './exportar';
import type { PropsAba } from './Admin';

export function EnsaioDados({ d, acao, recarregar, sessao }: PropsAba) {
  const ensaio = String(d.config.modo).toUpperCase() === 'ENSAIO';
  const [nCand, setNCand] = useState(30);
  const [nAval, setNAval] = useState(12);
  const [conferencia, setConferencia] = useState<any>(null);
  const [confirmacao, setConfirmacao] = useState('');

  return (
    <section>
      <h2>Ensaio e dados</h2>
      <p class="subtitulo">Esta planilha está no modo <b>{ensaio ? 'ENSAIO' : 'PRODUCAO'}</b>{sessao.amb === 'ensaio' ? ' e você abriu pelo link de ensaio' : ''}.</p>

      <div class="grade-2" style={{ marginBottom: 16 }}>
        <div class="painel">
          <h3>Dados fictícios</h3>
          {!ensaio ? <p class="ajuda">Só disponível no modo ENSAIO, para não misturar dados de teste com o processo real.</p> : (
            <>
              <p class="ajuda">Cria candidatos e avaliadores fictícios com notas aleatórias, alguns "não posso avaliar" e alguns candidatos parciais.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <label class="campo"><span>Candidatos</span><input type="number" min="1" max="200" value={nCand} onInput={(e) => setNCand(Number((e.target as HTMLInputElement).value))} /></label>
                <label class="campo"><span>Avaliadores</span><input type="number" min="1" max="50" value={nAval} onInput={(e) => setNAval(Number((e.target as HTMLInputElement).value))} /></label>
              </div>
              <div class="barra-acoes">
                <button class="botao principal" onClick={async () => { if (await acao('admin.gerarFicticios', { candidatos: nCand, avaliadores: nAval }, 'Dados fictícios gerados')) recarregar(); }}>Gerar dados fictícios</button>
                <button class="botao perigo" onClick={async () => {
                  if (!confirm('Apagar candidatos, avaliadores e notas desta planilha de ENSAIO? A configuração e os critérios ficam.')) return;
                  if (await acao('admin.zerarEnsaio', {}, 'Ensaio zerado')) recarregar();
                }}>Zerar dados do ensaio</button>
              </div>
              <p class="ajuda">Para testar a importação, use os arquivos da pasta <code>exemplos/</code> do repositório.</p>
            </>
          )}
        </div>

        <div class="painel">
          <h3>Conferir cálculos</h3>
          <p class="ajuda">Recalcula a Tabela Geral por fora (mesmo código do app) e compara com as fórmulas da planilha, na etapa escolhida na célula B2 da Tabela Geral.</p>
          <button class="botao" onClick={async () => setConferencia(await acao('admin.conferir'))}>Conferir agora</button>
          {conferencia && (conferencia.ok
            ? <p class="aviso ok" style={{ marginTop: 12 }}>Tudo certo: {conferencia.candidatos} candidatos conferidos (etapa {conferencia.etapa}).</p>
            : <div class="aviso erro" style={{ marginTop: 12 }}><b>Diferenças encontradas:</b><ul>{conferencia.diferencas.slice(0, 20).map((x: string) => <li>{x}</li>)}</ul></div>)}
        </div>

        <div class="painel">
          <h3>Backup completo</h3>
          <p class="ajuda">Baixa todas as abas de dados (inclui tokens e contatos). Guarde em local seguro.</p>
          <button class="botao" onClick={async () => { const r = await acao('admin.backup', {}, 'Backup gerado'); if (r) baixarJson(`backup_${dataArquivo()}.json`, r); }}>Baixar backup</button>
        </div>
      </div>

      <div class="painel" style={{ borderColor: 'var(--erro)' }}>
        <h3>Apagar dados do processo</h3>
        <p>Ao fim do processo (LGPD), apaga <b>todos</b> os candidatos, avaliadores, inscrições, notas e observações desta planilha. A configuração e os critérios ficam. Não dá para desfazer.</p>
        <p class="ajuda">Depois, para apagar também o histórico de versões, faça uma cópia da planilha vazia e exclua a original (e esvazie a lixeira do Drive).</p>
        <label class="campo" style={{ maxWidth: 320 }}><span>Digite APAGAR para confirmar</span><input value={confirmacao} onInput={(e) => setConfirmacao((e.target as HTMLInputElement).value)} /></label>
        <button class="botao perigo cheio" disabled={confirmacao !== 'APAGAR'} onClick={async () => {
          if (!confirm('Última confirmação: apagar todos os dados do processo agora?')) return;
          if (await acao('admin.apagarDados', { confirmacao }, 'Dados do processo apagados')) { setConfirmacao(''); recarregar(); }
        }}>Apagar dados do processo</button>
      </div>
    </section>
  );
}
