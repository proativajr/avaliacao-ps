// Auditoria de responsividade: rolagem horizontal, texto pequeno, alvos de toque e contraste.
// Uso: SITE=http://localhost:4173 node scripts/auditoria-responsiva.mjs <pasta-com-api.log> [prefixo]
// (rodar com scripts/servidor-local.mjs e o site em preview apontando para ele)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const SP = process.argv[2], SAIDA = process.argv[3] || 'auditoria';
const log = readFileSync(SP + '/api.log', 'utf8');
const AV = log.match(/#t=([^&\s]+)/)[1];
const ADM = log.match(/#adm=([^&\s]+)/)[1];
const api = async (token, acao, dados = {}) => (await (await fetch('http://localhost:8787', { method: 'POST', body: JSON.stringify({ token, acao, dados }) })).json());
// estado: dinâmica 2 com 3 equipes e a equipe 2 ao vivo
const ini = (await api(ADM, 'admin.iniciar')).dados;
if (!ini.etapas.find((e) => e.id === 'dinamica_2')) await api(ADM, 'admin.salvarEtapas', { lista: [{ nome: 'Dinâmica 2', ordem: 2, aberta: 'SIM' }] });
const ativos = ini.candidatos.filter((c) => c.status === 'ATIVO').map((c) => c.id);
await api(ADM, 'admin.salvarEquipes', { etapa: 'dinamica_2', equipes: [0, 1, 2].map((i) => ({ nome: 'Equipe ' + (i + 1), membros: ativos.filter((_, j) => j % 3 === i) })) });

const LARGURAS = [320, 375, 768, 1024, 1440, 1920];
const medir = () => {
  const W = innerWidth;
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[aria-hidden="true"]'); };
  const dentroDeRolagem = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p !== document.documentElement && p !== document.body) return true; } return false; };
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fundo = (el) => { for (let p = el; p; p = p.parentElement) { const c = rgb(getComputedStyle(p).backgroundColor); if (c.length === 4 ? c[3] > 0.5 : c.length === 3) return c.slice(0, 3); } return [255, 255, 255]; };
  const desc = (el) => (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' "' + (el.innerText || el.getAttribute('aria-label') || el.placeholder || '').trim().slice(0, 28) + '"');
  const r = { hscroll: document.documentElement.scrollWidth > W + 1 ? document.documentElement.scrollWidth - W : 0, vazam: [], contidos: 0, texto: [], toque: [], contraste: [] };
  document.querySelectorAll('body *').forEach((el) => {
    if (!vis(el)) return;
    const rc = el.getBoundingClientRect();
    if ((rc.right > W + 1 || rc.left < -1) && !dentroDeRolagem(el) && !el.closest('.toast')) r.vazam.push(desc(el));
    const s = getComputedStyle(el);
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) r.contidos++;
    const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (temTexto) {
      const fs = parseFloat(s.fontSize);
      if (fs < 14 && !el.closest('.faixa-teste')) r.texto.push(fs + 'px ' + desc(el));
      const c = rgb(s.color), a = c[3] ?? 1;
      const bg = fundo(el), fg = c.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
      const L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const grande = fs >= 24 || (fs >= 18.66 && Number(s.fontWeight) >= 700);
      const op = parseFloat(s.opacity);
      if (cr < (grande ? 3 : 4.5) && !el.closest('button:disabled') && op === 1) r.contraste.push(cr.toFixed(2) + ' ' + desc(el));
    }
    if (el.matches('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=radio], [role=tab]') && !el.matches('.link, p a') && !el.disabled) {
      if (el.matches('input[type=checkbox], input[type=radio]')) { const l = el.closest('label'); if (l && l.getBoundingClientRect().height >= 44) return; }
      if (rc.width < 43.5 || rc.height < 43.5) r.toque.push(Math.round(rc.width) + 'x' + Math.round(rc.height) + ' ' + desc(el));
    }
  });
  const uniq = (a) => [...new Set(a)];
  r.vazam = uniq(r.vazam); r.texto = uniq(r.texto); r.toque = uniq(r.toque); r.contraste = uniq(r.contraste);
  return r;
};

const TELAS = {
  'av-equipe': async (p) => { await p.goto(`http://localhost:4173/#t=${AV}&amb=ensaio`); await p.waitForSelector('.cands, .espera'); },
  'av-candidato': async (p) => { await TELAS['av-equipe'](p); await p.locator('.cands li button').first().click(); await p.waitForSelector('.notas'); },
  'av-menu': async (p) => { await TELAS['av-candidato'](p); await p.click('button[aria-label="Mais opções"]'); await p.waitForSelector('.folha'); },
  'adm-aovivo': async (p) => { await p.goto(`http://localhost:4173/#adm=${ADM}&amb=ensaio`); await p.waitForSelector('.aovivo'); await p.selectOption('.titulo-select', 'dinamica_2'); await p.waitForTimeout(150); },
  'adm-montar': async (p) => { await TELAS['adm-aovivo'](p); const b = p.locator('button:has-text("Montar"):visible'); if (await b.count()) await b.first().click(); await p.waitForSelector('.alocar'); },
  'adm-ranking': async (p) => { await TELAS.admin(p, 'Ranking'); await p.waitForSelector('.ranking'); },
  'adm-detalhe': async (p) => { await TELAS['adm-ranking'](p); await p.locator('.ranking tbody tr').first().click(); await p.waitForSelector('.modal'); },
  'adm-candidatos': async (p) => { await TELAS.admin(p, 'Pessoas'); await p.waitForTimeout(200); },
  'adm-importar': async (p) => { await TELAS['adm-candidatos'](p); await p.click('button:has-text("Importar inscrições")'); await p.waitForTimeout(200); },
  'adm-avaliadores': async (p) => { await TELAS.admin(p, 'Pessoas'); await p.click('[role=tab]:has-text("Avaliadores")'); await p.waitForTimeout(200); },
  'adm-config': async (p) => { await TELAS.admin(p, 'Ajustes'); await p.waitForTimeout(200); },
  'adm-dados': async (p) => { await TELAS.admin(p, 'Ajustes'); await p.click('[role=tab]:has-text("Ensaio")'); await p.waitForTimeout(200); },
  admin: async (p, secao) => {
    await p.goto(`http://localhost:4173/#adm=${ADM}&amb=ensaio`); await p.waitForSelector('.aovivo');
    const nav = p.locator(`.adm-barra button:has-text("${secao}"):visible, .adm-nav button:has-text("${secao}"):visible, .adm-lateral button:has-text("${secao}"):visible`).first();
    await nav.click();
  },
};

const b = await chromium.launch();
const res = {};
// a equipe 2 ao vivo para as telas do avaliador
await api(ADM, 'admin.aoVivo', { etapa: 'dinamica_2', equipe: 'dinamica_2_eq2' });
for (const w of LARGURAS) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 640 ? 740 : w < 1024 ? 1024 : 900 }, hasTouch: w < 1024, isMobile: w < 640 });
  for (const [nome, fn] of Object.entries(TELAS)) {
    if (nome === 'admin') continue;
    const p = await ctx.newPage();
    p.on('dialog', (d) => d.accept());
    p.on('pageerror', (e) => console.log(w, nome, 'pageerror', e.message));
    try { await fn(p); await p.waitForTimeout(250); res[`${nome}@${w}`] = await p.evaluate(medir); if (true) await p.screenshot({ path: `${SP}/${SAIDA}-${nome}-${w}.png`, fullPage: false }); }
    catch (e) { res[`${nome}@${w}`] = { erro: e.message.split('\n')[0] }; }
    await p.close();
  }
  await ctx.close();
}
await b.close();
writeFileSync(`${SP}/${SAIDA}.json`, JSON.stringify(res, null, 1));
// resumo
const tot = { hscroll: 0, vazam: 0, texto: 0, toque: 0, contraste: 0, erro: 0 };
for (const [k, r] of Object.entries(res)) {
  if (r.erro) { tot.erro++; console.log('ERRO', k, r.erro); continue; }
  if (r.hscroll) tot.hscroll++; tot.vazam += r.vazam.length; tot.texto += r.texto.length; tot.toque += r.toque.length; tot.contraste += r.contraste.length;
}
console.log('TOTAL', JSON.stringify(tot));
