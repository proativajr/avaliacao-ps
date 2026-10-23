// Lê o arquivo de respostas do formulário de inscrição (CSV ou XLSX) ou o texto colado do Google Sheets.
import Papa from 'papaparse';
import { limparMatriz } from '@shared/importacao.js';

/** CSV do Google Forms vem em UTF-8; o do Excel às vezes em Windows-1252. Tenta os dois. */
function decodificar(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export function lerTexto(texto: string): string[][] {
  const r = Papa.parse<string[]>(texto.replace(/^﻿/, ''), { delimiter: '', skipEmptyLines: false });
  return limparMatriz(r.data as any);
}

export async function lerArquivo(arq: File): Promise<string[][]> {
  const nome = arq.name.toLowerCase();
  if (nome.endsWith('.xlsx')) {
    const { default: readXlsxFile } = await import('read-excel-file');
    const linhas = await readXlsxFile(arq);
    return limparMatriz(linhas as any);
  }
  if (nome.endsWith('.xls')) throw new Error('Formato .xls antigo não é aceito. Salve como .xlsx ou .csv.');
  return lerTexto(decodificar(await arq.arrayBuffer()));
}
