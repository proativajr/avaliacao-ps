// Seleção de diretoria do avaliador: o mesmo componente em todas as telas do admin onde a diretoria é escolhida.
import { DIRETORIAS } from '@shared/texto.js';

export { DIRETORIAS };

type Props = {
  valor: string;
  aoMudar: (v: string) => void;
  /** Com rótulo: vira um campo de formulário (.campo). Sem rótulo: só o select (para listas e tabelas). */
  rotulo?: string;
  /** Nome lido pelo leitor de tela quando não há rótulo visível. */
  ariaLabel?: string;
};

export function SeletorDiretoria({ valor, aoMudar, rotulo, ariaLabel }: Props) {
  const sel = (
    <select class={rotulo ? undefined : 'entrada'} required value={DIRETORIAS.includes(valor) ? valor : ''} aria-label={rotulo ? undefined : ariaLabel || 'Diretoria'}
      onChange={(e) => aoMudar((e.target as HTMLSelectElement).value)}>
      <option value="" disabled>Escolha a diretoria</option>
      {DIRETORIAS.map((d: string) => <option value={d}>{d}</option>)}
    </select>
  );
  return rotulo ? <label class="campo"><span>{rotulo}</span>{sel}</label> : sel;
}
