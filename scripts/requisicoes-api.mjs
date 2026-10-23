// Converte rótulos + fórmulas do pacote em requisições batchUpdate da API do Sheets (para a planilha de teste).
import { readFileSync, writeFileSync } from 'node:fs';
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const idAba = Object.fromEntries(p.abas.map((t, i) => [t, i]));
const col = (s) => s.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const pos = (a1) => { const m = a1.match(/^([A-Z]+)(\d+)$/); return { c: col(m[1]), r: Number(m[2]) - 1 }; };
const val = (v) => (typeof v === 'number' ? { numberValue: v } : { stringValue: String(v) });
const reqs = [];
for (const r of p.rotulos) {
  const { c, r: lin } = pos(r.celula);
  reqs.push({ updateCells: { start: { sheetId: idAba[r.aba], rowIndex: lin, columnIndex: c }, fields: 'userEnteredValue',
    rows: r.valores.map((l) => ({ values: l.map((v) => ({ userEnteredValue: val(v) })) })) } });
}
for (const f of p.formulas) {
  const { c, r: lin } = pos(f.celula);
  reqs.push({ updateCells: { start: { sheetId: idAba[f.aba], rowIndex: lin, columnIndex: c }, fields: 'userEnteredValue',
    rows: [{ values: [{ userEnteredValue: { formulaValue: f.formula } }] }] } });
}
for (const [aba, cel, v] of (JSON.parse(process.argv[4] || '[]'))) {
  const { c, r: lin } = pos(cel);
  reqs.push({ updateCells: { start: { sheetId: idAba[aba], rowIndex: lin, columnIndex: c }, fields: 'userEnteredValue',
    rows: [{ values: [{ userEnteredValue: val(v) }] }] } });
}
writeFileSync(process.argv[3], JSON.stringify(reqs));
console.log(reqs.length, 'requisições', JSON.stringify(reqs).length, 'bytes');
