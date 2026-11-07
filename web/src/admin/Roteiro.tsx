// Roteiro do Manual do Avaliador 2026.2: cria as 5 dinâmicas (em salas), os grupos e a designação dos avaliadores,
// achando cada nome do manual no cadastro. Mostra a prévia antes de gravar; o admin resolve os nomes que não casaram.
import { useState } from 'preact/hooks';
import type { Equipe, Etapa } from '../tipos';
import type { PropsAba } from './Admin';
import { BotaoAcao } from '../ui';
import { I, useLargo } from './desktop';
import { BookOpen, Check, TriangleAlert } from 'lucide-preact';

interface Casamento { nome: string; achados: string[]; id: string; cadastro: string }
interface Previa { casamento: Casamento[]; dinamicas: { id: string; nome: string; grupos: number; grupo: string; nome_construcao: string; nome_apresentacao: string; fases: string }[] }

export function Roteiro({ d, setD, acao, aoGravar }: Pick<PropsAba, 'd' | 'setD' | 'acao'> & { aoGravar: (etapas: Etapa[]) => void }) {
  const largo = useLargo();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const avs = d.avaliadores.filter((a) => a.ativo === 'SIM').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const jaTem = ['geral', 'd2', 'd3', 'd4', 'd5'].every((id) => d.etapas.some((e) => e.id === id && String(e.formato).toUpperCase() === 'SALAS'));

  const verPrevia = async () => {
    const r = await acao<Previa>('admin.roteiroManual', {});
    if (r) { setPrevia(r); setEscolhas(Object.fromEntries(r.casamento.map((c) => [c.nome, c.id]))); }
  };
  const gravar = async () => {
    const r = await acao<Previa & { etapas: Etapa[]; equipes: Equipe[]; config: Record<string, any> }>('admin.roteiroManual', { gravar: true, escolhas }, 'Roteiro do manual gravado');
    if (r) { setD((x) => ({ ...x, etapas: r.etapas, equipes: r.equipes, config: r.config })); aoGravar(r.etapas); setPrevia(null); }
  };

  const faltam = previa ? previa.casamento.filter((c) => !escolhas[c.nome]) : [];
  const ordenados = previa ? [...previa.casamento].sort((a, b) => Number(!!escolhas[a.nome]) - Number(!!escolhas[b.nome])) : [];

  return (
    <div class="bloco roteiro">
      <div class="bloco-topo"><h2>{largo && <I c={BookOpen} />}Roteiro do manual</h2></div>
      {!previa ? (
        <>
          <p class="ajuda">
            Cria as 5 dinâmicas do Manual do Avaliador 2026.2 (Mapeamento às cegas, Gestão da qualidade na prática, Lidando com clientes,
            Laranjas Ugli e Feedbacks), com os grupos e trios já nomeados, os avaliadores de cada um, os narradores e as personas.
            Os candidatos continuam sendo distribuídos no Ao vivo.
            {jaTem && ' O roteiro já foi gravado nesta planilha. Gravar de novo refaz a designação e mantém os candidatos de cada grupo.'}
          </p>
          <div class="barra-acoes"><BotaoAcao class={'botao' + (jaTem ? '' : ' principal')} aoClicar={verPrevia}>{largo && <I c={BookOpen} />}Ver como fica</BotaoAcao></div>
        </>
      ) : (
        <>
          <ul class="roteiro-dinamicas">
            {previa.dinamicas.map((x, i) => (
              <li><b>{i + 1}. {x.nome}</b><small>{x.grupos} {x.grupo.toLowerCase()}s · {x.nome_construcao} e {x.nome_apresentacao}</small></li>
            ))}
          </ul>
          {faltam.length > 0 ? (
            <p class="aviso alerta" role="status">{largo && <I c={TriangleAlert} />}
              {faltam.length === 1 ? '1 nome do manual não foi achado' : `${faltam.length} nomes do manual não foram achados`} no cadastro. Escolha quem é cada um.
              Quem ficar como “Deixar de fora” não entra nos grupos.
            </p>
          ) : <p class="aviso" role="status">{largo && <I c={Check} />}Todos os {previa.casamento.length} nomes do manual foram achados no cadastro.</p>}
          <div class="roteiro-nomes">
            {ordenados.map((c) => (
              <label class="campo">
                <span>{c.nome}{c.achados.length > 1 && <small class="ajuda"> ({c.achados.length} parecidos)</small>}</span>
                <select value={escolhas[c.nome] || ''} onChange={(e) => setEscolhas((m) => ({ ...m, [c.nome]: (e.target as HTMLSelectElement).value }))}>
                  <option value="">Deixar de fora</option>
                  {avs.map((a) => <option value={a.id}>{a.nome}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div class="barra-acoes fim">
            <button class="botao leve" onClick={() => setPrevia(null)}>Cancelar</button>
            <BotaoAcao class="botao principal" aoClicar={gravar}>{largo && <I c={Check} />}Gravar roteiro</BotaoAcao>
          </div>
        </>
      )}
    </div>
  );
}
