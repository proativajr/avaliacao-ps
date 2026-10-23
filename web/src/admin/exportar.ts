// Exportação: CSV (padrão Excel pt-BR: ";" e vírgula decimal) e XLSX.
export type Celula = string | number | null | undefined;

function baixar(nome: string, conteudo: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function baixarCsv(nome: string, linhas: Celula[][]) {
  const esc = (v: Celula) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  baixar(nome, '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}

export async function baixarXlsx(nome: string, aba: string, linhas: Celula[][]) {
  const { default: writeXlsxFile } = await import('write-excel-file');
  const dados = linhas.map((l, i) => l.map((v) => (v == null || v === '' ? null : {
    value: v, type: typeof v === 'number' ? Number : String, fontWeight: i === 0 ? 'bold' : undefined,
    format: typeof v === 'number' && !Number.isInteger(v) ? '0.00' : undefined,
  } as any)));
  await writeXlsxFile(dados, { fileName: nome, sheet: aba.slice(0, 31) } as any);
}

export function baixarJson(nome: string, obj: unknown) {
  baixar(nome, JSON.stringify(obj, null, 1), 'application/json');
}

export function dataArquivo() {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
