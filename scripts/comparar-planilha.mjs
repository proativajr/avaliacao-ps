// Compara valores lidos da Tabela Geral (JSON: linha de IDs + linhas de dados) com o cálculo independente.
import { readFileSync } from 'node:fs';
const pacote = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const [ids, ...linhas] = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const esperado = pacote.esperado[process.argv[4] || 'Todas'];
const n = (v) => (v === '' || v == null ? null : Number(v));
const perto = (a, b) => (a == null || b == null ? a == b : Math.abs(a - b) < 1e-6);
let erros = 0;
for (const e of esperado) {
  const l = linhas.find((x) => x[0] === e.id);
  if (!l) { console.log('FALTA', e.id); erros++; continue; }
  const p = Object.fromEntries(ids.map((k, i) => [k, l[i] ?? '']));
  const chk = (nome, a, b, ok) => { if (!ok) { erros++; console.log(e.id, nome, 'planilha=', a, 'esperado=', b); } };
  chk('media', p.media, e.media, perto(n(p.media), e.media));
  chk('ranking', p.ranking, e.ranking, perto(n(p.ranking), e.ranking));
  chk('nAval', p.n_avaliadores, e.nAvaliadores, n(p.n_avaliadores) === e.nAvaliadores);
  chk('desvio', p.desvio, e.desvio, perto(n(p.desvio), e.desvio));
  chk('situacao', p.situacao, e.situacao, p.situacao === e.situacao);
  chk('alertas', p.alertas, e.alertas, p.alertas === e.alertas);
  for (const k of Object.keys(e.porCriterio)) chk(k, p[k], e.porCriterio[k], perto(n(p[k]), e.porCriterio[k]));
  for (const b of Object.keys(e.porBloco)) chk('bloco:' + b, p['bloco:' + b], e.porBloco[b], perto(n(p['bloco:' + b]), e.porBloco[b]));
}
console.log(erros ? `${erros} diferença(s)` : 'OK: planilha bate com o cálculo independente (' + esperado.length + ' candidatos)');
process.exit(erros ? 1 : 0);
