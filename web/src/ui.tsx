// Pequenos componentes reutilizados no app.
import { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

let mostrarToast: (t: string) => void = () => {};

/** Mensagem curta no rodapé ("Link copiado"). */
export function toast(texto: string) { mostrarToast(texto); }

export function Toasts() {
  const [texto, setTexto] = useState('');
  useEffect(() => {
    let timer: any;
    mostrarToast = (t) => { setTexto(t); clearTimeout(timer); timer = setTimeout(() => setTexto(''), 2600); };
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
