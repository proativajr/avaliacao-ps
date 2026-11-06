// Pequenos componentes reutilizados no app.
import { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

let mostrarToast: (t: string, ms: number) => void = () => {};

/** Mensagem curta no rodapé ("Link copiado"). Erros ficam mais tempo (ms maior). */
export function toast(texto: string, ms = 2600) { mostrarToast(texto, ms); }

export function Toasts() {
  const [texto, setTexto] = useState('');
  useEffect(() => {
    let timer: any;
    mostrarToast = (t, ms) => { setTexto(t); clearTimeout(timer); timer = setTimeout(() => setTexto(''), ms); };
  }, []);
  return texto ? <div class="toast" role="status">{texto}</div> : null;
}

export async function copiar(texto: string, aviso = 'Copiado') {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const t = document.createElement('textarea');
    t.value = texto; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } finally { t.remove(); }
  }
  toast(aviso);
}

export function Modal({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [aoFechar]);
  return (
    <div class="modal-fundo" onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div class="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

export function FaixaTeste() {
  return <div class="faixa-teste" role="note">AMBIENTE DE TESTE: dados fictícios</div>;
}

/** Data/hora curta em pt-BR ("23/10 14:05"); vazio vira "—". */
export function dataCurta(v: string | Date | null | undefined) {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function dataRelativa(v: string | null | undefined) {
  if (!v) return 'nunca';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return dataCurta(d);
}

export function num2(v: number | null | undefined) {
  return typeof v === 'number' && isFinite(v) ? v.toFixed(2).replace('.', ',') : '—';
}

/**
 * Trava síncrona para ações que chamam o servidor. A ref bloqueia o segundo clique na hora,
 * antes de o estado do Preact (rodando) ser aplicado, e o estado mostra o carregamento.
 * rodar(fn) ignora a chamada se já houver uma em andamento e destrava quando fn termina (sucesso ou erro).
 */
export function useTrava() {
  const trava = useRef(false);
  const vivo = useRef(true);
  const [rodando, setRodando] = useState(false);
  useEffect(() => () => { vivo.current = false; }, []);
  const rodar = async <T,>(fn: () => Promise<T> | T): Promise<T | undefined> => {
    if (trava.current) return undefined;
    trava.current = true;
    setRodando(true);
    try {
      return await fn();
    } finally {
      trava.current = false;
      if (vivo.current) setRodando(false);
    }
  };
  return { rodando, rodar };
}

type PropsBotao = Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'onClick' | 'class'> & {
  class?: string;
  /** Ação do botão. Se devolver uma Promise, o botão fica inativo e com carregamento até ela terminar. */
  aoClicar?: (e: MouseEvent) => unknown;
  /** Para botões de envio de formulário: o formulário controla a trava (useTrava) e passa o estado aqui. */
  rodando?: boolean;
  /** Trava compartilhada com outro gatilho da mesma ação (ex.: Enter no campo). Sem ela, o botão tem a própria. */
  trava?: ReturnType<typeof useTrava>;
  disabled?: boolean;
  type?: 'button' | 'submit';
  children?: ComponentChildren;
};

/**
 * Botão de ação com carregamento: o mesmo em todo o admin. Enquanto a requisição roda, fica desabilitado,
 * com aria-busy e um anel girando no lugar do ícone (o texto continua). Não cobre a tela nem atrasa o clique.
 */
export function BotaoAcao({ aoClicar, rodando, trava, disabled, class: cls = 'botao', type, children, ...resto }: PropsBotao) {
  const propria = useTrava();
  const t = trava || propria;
  const ocupado = !!rodando || t.rodando;
  return (
    <button {...resto} type={type || (aoClicar ? 'button' : 'submit')} class={cls} disabled={disabled || ocupado} aria-busy={ocupado || undefined}
      onClick={aoClicar ? (e) => { t.rodar(() => aoClicar(e as unknown as MouseEvent)); } : undefined}>
      {ocupado && <span class="giro-botao" aria-hidden="true" />}
      {children}
    </button>
  );
}
