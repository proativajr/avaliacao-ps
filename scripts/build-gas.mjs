// Junta o código do Apps Script num único arquivo (apps-script/Codigo.gs) para colar no editor.
// Uso: npm run build:gas
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const compartilhados = ['shared/texto.js', 'shared/calc.js'];
const fontes = readdirSync(join(raiz, 'apps-script/src')).filter((f) => f.endsWith('.js')).sort()
  .map((f) => 'apps-script/src/' + f);

const partes = [...compartilhados, ...fontes].map((arq) => {
  let txt = readFileSync(join(raiz, arq), 'utf8');
  if (arq.startsWith('shared/')) {
    if (/^\s*import\s/m.test(txt)) throw new Error(arq + ' não pode ter import');
    txt = txt.replace(/^export\s+/gm, '');
  }
  return `// ===== ${arq} =====\n${txt.trim()}\n`;
});

const cabecalho = `/** @OnlyCurrentDoc */
/**
 * Avaliação do Processo Seletivo · Proativa Jr.
 * ARQUIVO GERADO por "npm run build:gas". Não edite aqui: edite apps-script/src/ e shared/.
 * Para instalar: copie TODO este conteúdo e cole no editor do Apps Script da planilha (arquivo Código.gs).
 */
`;
writeFileSync(join(raiz, 'apps-script/Codigo.gs'), cabecalho + '\n' + partes.join('\n'));
console.log('apps-script/Codigo.gs gerado com', partes.length, 'partes');
