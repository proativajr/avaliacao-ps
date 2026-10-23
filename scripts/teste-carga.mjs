// TESTE DE CARGA contra a API publicada (só na planilha de ENSAIO).
// Simula N avaliadores (padrão 15) dando notas ao mesmo tempo, como o app faz (lotes + novas tentativas),
// e confere no fim: uma linha por nota e o valor final certo.
// Uso: node scripts/teste-carga.mjs "URL_DO_WEB_APP_DE_ENSAIO" "TOKEN_ADMIN" [avaliadores] [candidatos]
const [url, adm, nAvArg, nCandArg] = process.argv.slice(2);
if (!url || !adm) { console.log('Uso: node scripts/teste-carga.mjs URL TOKEN_ADMIN [avaliadores=15] [candidatos=10]'); process.exit(1); }
const N_AV = Number(nAvArg || 15), N_CAND = Number(nCandArg || 10);
async function chamar(token, acao, dados = {}) {
  for (let t = 0; t < 6; t++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token, acao, dados }), redirect: 'follow' });
      const j = await r.json();
      if (!j.ok && j.codigo !== 'ERRO') throw Object.assign(new Error(j.erro), { fatal: true });
      if (j.ok) return j.dados;
      throw new Error(j.erro);
    } catch (e) { if (e.fatal) throw e; await new Promise((s) => setTimeout(s, 1000 * 2 ** t)); }
  }
  throw new Error('falhou depois de 6 tentativas: ' + acao);
}
let d = await chamar(adm, 'admin.iniciar');
if (String(d.config.modo).toUpperCase() !== 'ENSAIO') { console.log('Recusado: a planilha não está em modo ENSAIO.'); process.exit(1); }
if (d.avaliadores.filter((a) => a.ativo === 'SIM').length < N_AV || d.candidatos.filter((c) => c.status === 'ATIVO').length < N_CAND) {
  console.log('Gerando dados fictícios para o teste…');
  await chamar(adm, 'admin.gerarFicticios', { candidatos: N_CAND, avaliadores: N_AV });
  d = await chamar(adm, 'admin.iniciar');
}
const etapa = (d.etapas.find((e) => e.aberta === 'SIM') || d.etapas[0]).id;
const avs = d.avaliadores.filter((a) => a.ativo === 'SIM').slice(0, N_AV);
const cands = d.candidatos.filter((c) => c.status === 'ATIVO').slice(0, N_CAND);
const pub = await chamar(avs[0].token, 'av.iniciar');
const crits = pub.criterios.filter((k) => !k.etapas || k.etapas.split(',').includes(etapa)).map((k) => k.id);
const esperado = {};
let ts = Date.now() * 10, tempos = [];
console.log(`${avs.length} avaliadores × ${cands.length} candidatos × ${crits.length} critérios = ${avs.length * cands.length * crits.length} notas`);
const inicio = Date.now();
await Promise.all(avs.map(async (av) => {
  for (const c of cands) {
    // como no app: alguns toques, um lote; às vezes muda de ideia e manda de novo
    const lote = crits.map((k) => ({ etapa, candidato_id: c.id, criterio_id: k, nota: 1 + Math.floor(Math.random() * 5), cliente_ts: ++ts }));
    if (Math.random() < 0.3) lote.push({ ...lote[0], nota: lote[0].nota === 5 ? 4 : 5, cliente_ts: ++ts });
    lote.forEach((n) => { esperado[[etapa, av.id, c.id, n.criterio_id].join('|')] = n.nota; });
    const t0 = Date.now();
    await chamar(av.token, 'av.salvar', { notas: lote });
    tempos.push(Date.now() - t0);
    if (Math.random() < 0.2) await chamar(av.token, 'av.salvar', { notas: lote }); // reenvio (internet ruim)
  }
}));
const fim = Date.now();
const notas = (await chamar(adm, 'admin.notas')).avaliacoes;
const minhas = notas.filter((n) => n.etapa === etapa && avs.some((a) => a.id === n.avaliador_id) && cands.some((c) => c.id === n.candidato_id));
const chaves = minhas.map((n) => [n.etapa, n.avaliador_id, n.candidato_id, n.criterio_id].join('|'));
const duplicadas = chaves.length - new Set(chaves).size;
const erradas = minhas.filter((n) => esperado[[n.etapa, n.avaliador_id, n.candidato_id, n.criterio_id].join('|')] !== undefined &&
  esperado[[n.etapa, n.avaliador_id, n.candidato_id, n.criterio_id].join('|')] !== n.nota).length;
const faltando = Object.keys(esperado).filter((k) => !chaves.includes(k)).length;
tempos.sort((a, b) => a - b);
console.log(`Tempo total: ${((fim - inicio) / 1000).toFixed(1)} s · salvamento mediano ${tempos[Math.floor(tempos.length / 2)]} ms · pior ${tempos.at(-1)} ms`);
console.log(`Duplicadas: ${duplicadas} · Valores errados: ${erradas} · Faltando: ${faltando}`);
console.log(duplicadas || erradas || faltando ? 'FALHOU' : 'OK: nenhuma perda e nenhuma duplicata');
