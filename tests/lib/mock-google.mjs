// Simulador mínimo dos serviços do Google Apps Script, para rodar o Codigo.gs no Node.
// Guarda valores e fórmulas de verdade; o resto (formatação, proteção...) vira "faz nada encadeável".
import { createHash, randomUUID } from 'node:crypto';
import { carregarGas } from './gas.mjs';

function encadeavel(extras = {}) {
  const alvo = function () {};
  const p = new Proxy(alvo, {
    get(_t, k) {
      if (k in extras) return extras[k];
      if (k === 'then' || typeof k === 'symbol') return undefined;
      return () => p;
    },
    apply() { return p; },
  });
  return p;
}

const colNum = (s) => s.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);

class Aba {
  constructor(nome, planilha) { this.nome = nome; this.planilha = planilha; this.dados = []; this.maxCols = 26; this.maxRows = 1000; this.oculta = false; }
  getName() { return this.nome; }
  celula(r, c) { return (this.dados[r - 1] || [])[c - 1]; }
  definir(r, c, v) { if (typeof v === 'string' && v.startsWith("'")) v = v.slice(1); /* como no Sheets: apóstrofo = texto */ while (this.dados.length < r) this.dados.push([]); const l = this.dados[r - 1]; while (l.length < c) l.push(''); l[c - 1] = v; }
  getLastRow() { for (let i = this.dados.length; i > 0; i--) if ((this.dados[i - 1] || []).some((v) => v !== '' && v != null)) return i; return 0; }
  getLastColumn() { let m = 0; this.dados.forEach((l) => l.forEach((v, j) => { if (v !== '' && v != null) m = Math.max(m, j + 1); })); return m; }
  getMaxColumns() { return this.maxCols; }
  getMaxRows() { return this.maxRows; }
  insertColumnsAfter(_a, n) { this.maxCols += n; }
  getRange(a, b, c, d) {
    if (typeof a === 'number') return new Intervalo(this, a, b, c || 1, d || 1);
    const m = String(a).match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/);
    if (!m) throw new Error('A1 inválido no mock: ' + a);
    const c1 = colNum(m[1]), r1 = m[2] ? Number(m[2]) : 1;
    const c2 = m[3] ? colNum(m[3]) : c1, r2 = m[4] ? Number(m[4]) : (m[3] || !m[2] ? this.maxRows : r1);
    return new Intervalo(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1);
  }
  getDataRange() { return new Intervalo(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  clear() { this.dados = []; return this; }
  deleteRow(r) { this.dados.splice(r - 1, 1); return this; }
  hideSheet() { this.oculta = true; return this; }
  protect() { return encadeavel({ getEditors: () => [], canDomainEdit: () => false, getDescription: () => 'PS:' }); }
  setFrozenRows() { return this; } setFrozenColumns() { return this; } setColumnWidth() { return this; } setRowHeight() { return this; }
  hideRows() { return this; } showRows() { return this; } clearConditionalFormatRules() { return this; } setConditionalFormatRules() { return this; }
}

class Intervalo {
  constructor(aba, r, c, nr, nc) {
    Object.assign(this, { aba, r, c, nr, nc });
    const p = new Proxy(this, { get: (t, k) => (k in t ? (typeof t[k] === 'function' ? t[k].bind(p) : t[k]) : (typeof k === 'string' ? () => p : undefined)) });
    return p;
  }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const l = []; for (let j = 0; j < this.nc; j++) { const v = this.aba.celula(this.r + i, this.c + j); l.push(v == null ? '' : (typeof v === 'object' && v && v.formula ? '' : v)); } out.push(l); } return out; }
  setValues(vals) {
    if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error(`setValues: tamanho ${vals.length}x${vals[0].length} ≠ intervalo ${this.nr}x${this.nc} em ${this.aba.nome}`);
    vals.forEach((l, i) => l.forEach((v, j) => this.aba.definir(this.r + i, this.c + j, v))); return this;
  }
  getValue() { return this.getValues()[0][0]; }
  getDisplayValue() { return String(this.getValue()); }
  setValue(v) { this.aba.definir(this.r, this.c, v); return this; }
  setFormula(f) { this.aba.definir(this.r, this.c, { formula: f }); return this; }
  getFormula() { const v = this.aba.celula(this.r, this.c); return v && v.formula ? v.formula : ''; }
  offset(dr, dc, nr, nc) { return new Intervalo(this.aba, this.r + dr, this.c + dc, nr || this.nr, nc || this.nc); }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) if (this.aba.celula(this.r + i, this.c + j) !== undefined) this.aba.definir(this.r + i, this.c + j, ''); return this; }
  getRow() { return this.r; } getColumn() { return this.c; } getNumRows() { return this.nr; } getNumColumns() { return this.nc; }
}

class Planilha {
  constructor() { this.abas = [new Aba('Página1', this)]; this.id = 'planilha-teste'; }
  getId() { return this.id; }
  getSheetByName(n) { return this.abas.find((a) => a.nome === n) || null; }
  getSheets() { return this.abas.slice(); }
  insertSheet(n, i) { const a = new Aba(n, this); this.abas.splice(i ?? this.abas.length, 0, a); return a; }
  deleteSheet(a) { this.abas = this.abas.filter((x) => x !== a); }
  setActiveSheet(a) { this.ativa = a; return a; }
  moveActiveSheet(pos) { this.abas = this.abas.filter((x) => x !== this.ativa); this.abas.splice(pos - 1, 0, this.ativa); }
  getProtections() { return []; }
  getRange(a1) { const m = a1.match(/^'?(.+?)'?!(.+)$/); return this.getSheetByName(m[1]).getRange(m[2].replace(/\$/g, '')); }
  setSpreadsheetTimeZone() {} setSpreadsheetLocale() {}
}

/** Cria o ambiente simulado e carrega o Codigo.gs nele. */
export function ambienteGoogle() {
  const planilha = new Planilha();
  const props = new Map();
  const cache = new Map();
  let travado = false;
  const globais = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => planilha, getActive: () => planilha, flush: () => {},
      getUi: () => { throw new Error('sem interface'); },
      newDataValidation: () => encadeavel(), newConditionalFormatRule: () => encadeavel(),
      ProtectionType: { SHEET: 'SHEET', RANGE: 'RANGE' },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => { props.set(k, String(v)); },
        deleteProperty: (k) => { props.delete(k); }, deleteAllProperties: () => props.clear(), getProperties: () => Object.fromEntries(props),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (travado) return false; travado = true; return true; }, waitLock: () => { travado = true; }, releaseLock: () => { travado = false; } }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => { cache.set(k, v); },
        remove: (k) => cache.delete(k), removeAll: (ks) => ks.forEach((k) => cache.delete(k)),
        getAll: (ks) => Object.fromEntries(ks.filter((k) => cache.has(k)).map((k) => [k, cache.get(k)])), putAll: (o) => Object.entries(o).forEach(([k, v]) => cache.set(k, v)),
      }),
    },
    Utilities: {
      getUuid: () => randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_alg, txt) => [...createHash('sha256').update(String(txt)).digest()].map((b) => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes.map((b) => (b < 0 ? b + 256 : b))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      formatDate: (d) => new Date(d).toISOString(),
      sleep: () => {},
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'dono@exemplo.com' }), getScriptTimeZone: () => 'America/Fortaleza' },
    Logger: { log: () => {} },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (t) => ({ _texto: t, setMimeType() { return this; }, getContent() { return this._texto; } }),
    },
  };
  const gas = carregarGas(globais);
  return { gas, planilha, props, cache };
}
