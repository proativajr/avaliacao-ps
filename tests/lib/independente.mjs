// Cálculo INDEPENDENTE da Tabela Geral, escrito de outro jeito (força bruta, sem reaproveitar shared/calc.js).
// Serve para conferir o app e as fórmulas da planilha.

const SIM = (v) => String(v ?? '').trim().toUpperCase() === 'SIM';
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));

export function tabelaGeralIndependente({ candidatos, criterios, blocos, avaliacoes, etapa, config }) {
  const blocoAtivo = new Set(blocos.filter((b) => SIM(b.ativo)).map((b) => b.id));
  const crit = criterios.filter((c) => SIM(c.ativo) && blocoAtivo.has(c.bloco));
  const peso = (c) => (num(c.peso) == null ? 1 : num(c.peso));
  const valeEtapa = (a) => etapa === '*' || a.etapa === etapa;
  const numericas = avaliacoes.filter((a) => valeEtapa(a) && typeof a.nota === 'number' && crit.some((c) => c.id === a.criterio_id));

  const linhas = candidatos.map((cand) => {
    const minhas = numericas.filter((a) => a.candidato_id === cand.id);
    const porCriterio = {};
    for (const c of crit) {
      const ns = minhas.filter((a) => a.criterio_id === c.id).map((a) => a.nota);
      porCriterio[c.id] = ns.length ? ns.reduce((x, y) => x + y) / ns.length : null;
    }
    let s = 0, w = 0;
    for (const c of crit) if (porCriterio[c.id] != null) { s += porCriterio[c.id] * peso(c); w += peso(c); }
    const porBloco = {};
    for (const b of blocos) {
      let sb = 0, wb = 0;
      for (const c of crit.filter((x) => x.bloco === b.id)) if (porCriterio[c.id] != null) { sb += porCriterio[c.id] * peso(c); wb += peso(c); }
      if (crit.some((x) => x.bloco === b.id)) porBloco[b.id] = wb ? sb / wb : null;
    }
    const avs = [...new Set(minhas.map((a) => a.avaliador_id))];
    const medAv = avs.map((av) => { const ns = minhas.filter((a) => a.avaliador_id === av).map((a) => a.nota); return ns.reduce((x, y) => x + y) / ns.length; });
    let desvio = null;
    if (medAv.length >= 2) {
      const m = medAv.reduce((x, y) => x + y) / medAv.length;
      desvio = Math.sqrt(medAv.reduce((x, y) => x + (y - m) ** 2, 0) / (medAv.length - 1));
    }
    return { id: cand.id, status: String(cand.status).toUpperCase(), porCriterio, porBloco, media: w ? s / w : null, nAvaliadores: avs.length, desvio };
  });

  const r9 = (x) => Math.round(x * 1e9) / 1e9;
  const elegiveis = linhas.filter((l) => l.status === 'ATIVO' && l.media != null);
  const corte = num(config.nota_de_corte), vagas = num(config.vagas), minA = num(config.min_avaliadores_por_candidato), lim = num(config.limite_divergencia);
  for (const l of linhas) {
    l.ranking = l.status === 'ATIVO' && l.media != null ? 1 + elegiveis.filter((o) => r9(o.media) > r9(l.media)).length : null;
    if (l.status !== 'ATIVO') l.situacao = 'Fora do ranking';
    else if (l.media == null) l.situacao = 'Sem notas';
    else if (corte == null && vagas == null) l.situacao = '';
    else {
      const ok1 = corte == null || l.media >= corte, ok2 = vagas == null || l.ranking <= vagas;
      l.situacao = ok1 && ok2 ? 'Classificado' : ok1 ? 'Fora das vagas' : 'Abaixo do corte';
    }
    const al = [];
    if (minA != null && l.nAvaliadores < minA) al.push('Dados insuficientes');
    if (lim != null && l.desvio != null && l.desvio > lim) al.push('Divergência');
    l.alertas = al.join(' · ');
  }
  return linhas;
}

export function progressoIndependente({ avaliadores, candidatos, criterios, blocos, avaliacoes, etapa }) {
  const blocoAtivo = new Set(blocos.filter((b) => SIM(b.ativo)).map((b) => b.id));
  const crit = criterios.filter((c) => SIM(c.ativo) && blocoAtivo.has(c.bloco) &&
    (!String(c.etapas || '').trim() || String(c.etapas).split(',').map((s) => s.trim()).includes(etapa))).map((c) => c.id);
  const ativos = candidatos.filter((c) => String(c.status).toUpperCase() === 'ATIVO');
  return avaliadores.map((av) => {
    let comp = 0, parc = 0;
    for (const c of ativos) {
      const n = new Set(avaliacoes.filter((a) => a.etapa === etapa && a.avaliador_id === av.id && a.candidato_id === c.id &&
        crit.includes(a.criterio_id) && a.nota !== '' && a.nota != null).map((a) => a.criterio_id)).size;
      if (crit.length && n >= crit.length) comp++; else if (n > 0) parc++;
    }
    return { id: av.id, completos: comp, parciais: parc, pendentes: ativos.length - comp - parc };
  });
}
