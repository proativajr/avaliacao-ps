// Carrega o Codigo.gs (gerado) num contexto isolado do Node, para testar sem o Google.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function carregarGas(globais = {}) {
  const codigo = readFileSync(join(RAIZ, 'apps-script/Codigo.gs'), 'utf8');
  const ctx = vm.createContext({ console, Date, Math, JSON, ...globais });
  vm.runInContext(codigo, ctx, { filename: 'Codigo.gs' });
  return ctx;
}
