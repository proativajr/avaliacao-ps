// Foto do candidato com as iniciais por baixo: enquanto carrega, se não existir ou se o Drive recusar,
// aparecem as iniciais. A imagem vem direto do Drive (nada é baixado nem guardado pelo app).
import { useState } from 'preact/hooks';
import { linkFoto } from '@shared/importacao.js';

export function iniciais(nome: string) {
  const partes = String(nome || '').split(' ').filter(Boolean);
  const ps = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes;
  return ps.map((p) => p[0]).join('').toUpperCase() || '?';
}

/** forma "redonda" (lista) ou "quadrada" (tela de avaliação, raio da marca). */
export function Foto({ nome, foto, tam = 44, forma = 'redonda' }: { nome: string; foto?: string; tam?: number; forma?: 'redonda' | 'quadrada' }) {
  const src = linkFoto(foto);
  const [falhou, setFalhou] = useState('');
  const mostrar = !!src && falhou !== src;
  return (
    <span class={'avatar ' + forma} style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.34) }}>
      <span aria-hidden="true">{iniciais(nome)}</span>
      {mostrar && (
        <img src={src} alt="" width={tam} height={tam} loading="lazy" decoding="async"
          referrerPolicy="no-referrer" onError={() => setFalhou(src)} />
      )}
    </span>
  );
}
