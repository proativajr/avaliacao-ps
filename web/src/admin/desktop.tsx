// Peças do admin no desktop (≥ 1024 px), na direção B "Linha ascendente" do kit de marca.
// Tudo aqui só aparece no computador: no celular e no tablet o admin continua igual.
import { createContext } from 'preact';
import type { ComponentChildren, FunctionComponent } from 'preact';
import { createPortal } from 'preact/compat';
import { useContext, useEffect, useState } from 'preact/hooks';

const MQ = '(min-width: 1024px)';

/** true no desktop (≥ 1024 px). Acompanha a mudança de largura da janela. */
export function useLargo() {
  const [largo, setLargo] = useState(() => matchMedia(MQ).matches);
  useEffect(() => {
    const m = matchMedia(MQ);
    const f = () => setLargo(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return largo;
}

/** Ícone Lucide no padrão do kit: traço de 2 px e cantos retos (o CSS da classe .i acerta as pontas). */
export function I({ c: C, t = 20 }: { c: FunctionComponent<any>; t?: number }) {
  return <C class="i" size={t} strokeWidth={2} aria-hidden="true" focusable="false" />;
}

/** Lugar do título dentro do campo azul do topo. Cada seção põe ali o próprio título com <NoCampo>. */
export const AlvoCampo = createContext<HTMLElement | null>(null);
export function NoCampo({ children }: { children: ComponentChildren }) {
  const alvo = useContext(AlvoCampo);
  return alvo ? createPortal(<>{children}</>, alvo) : null;
}
