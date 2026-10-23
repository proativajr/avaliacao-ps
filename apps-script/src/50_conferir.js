/* =====================================================================
 * CONFERIR CÁLCULOS: recalcula tudo em JavaScript (mesmo código do app)
 * e compara com o que as fórmulas da Tabela Geral mostram.
 * ===================================================================== */

/** Lê todas as avaliações no formato usado pelo cálculo. */
function avaliacoesParaCalculo_() {
  return lerObjetos_(ABAS.AVALIACOES).map(function (a) {
    var n = a.nota;
    return {
      etapa: String(a.etapa), avaliador_id: String(a.avaliador_id), candidato_id: String(a.candidato_id),
      criterio_id: String(a.criterio_id), nota: typeof n === 'number' ? n : String(n).toUpperCase(),
    };
  });
}

function configParaCalculo_() {
  var c = lerConfig_();
  return {
    nota_de_corte: c.nota_de_corte, vagas: c.vagas,
    min_avaliadores_por_candidato: c.min_avaliadores_por_candidato, limite_divergencia: c.limite_divergencia,
  };
}

/** Compara a Tabela Geral com o cálculo independente. Devolve {ok, diferencas: [...]} */
function conferirCalculos_() {
  SpreadsheetApp.flush();
  var tg = aba_(ABAS.GERAL);
  var etapaNome = tg.getRange('B2').getValue();
  var etapa = '*';
  if (etapaNome && etapaNome !== 'Todas') {
    var e = lerObjetos_(ABAS.ETAPAS).filter(function (x) { return x.nome === etapaNome; })[0];
    if (e) etapa = e.id;
  }
  var res = calcularResultados({
    candidatos: lerObjetos_(ABAS.CANDIDATOS).map(function (c) { return { id: c.id, nome: c.nome_exibicao, status: c.status }; }),
    criterios: lerObjetos_(ABAS.CRITERIOS), blocos: lerObjetos_(ABAS.BLOCOS),
    avaliacoes: avaliacoesParaCalculo_(), etapa: etapa, config: configParaCalculo_(),
  });

  var ultimaCol = tg.getLastColumn();
  var ultimaLin = tg.getLastRow();
  var ids = tg.getRange(3, 1, 1, ultimaCol).getValues()[0];
  var dados = ultimaLin >= 5 ? tg.getRange(5, 1, ultimaLin - 4, ultimaCol).getValues() : [];
  var planilha = {};
  dados.forEach(function (l) { if (l[0]) { var o = {}; ids.forEach(function (k, i) { o[k] = l[i]; }); planilha[l[0]] = o; } });

  var dif = [];
  var perto = function (a, b) {
    var na = (a === '' || a == null), nb = (b === '' || b == null);
    if (na || nb) return na && nb;
    return Math.abs(Number(a) - Number(b)) < 1e-9;
  };
  res.linhas.forEach(function (l) {
    var p = planilha[l.id];
    if (!p) { dif.push(l.id + ': não aparece na Tabela Geral'); return; }
    if (!perto(p.media, l.media)) dif.push(l.id + ' média: planilha ' + p.media + ' × cálculo ' + l.media);
    if (!perto(p.ranking, l.ranking)) dif.push(l.id + ' ranking: planilha ' + p.ranking + ' × cálculo ' + l.ranking);
    if (Number(p.n_avaliadores) !== l.nAvaliadores) dif.push(l.id + ' nº avaliadores: planilha ' + p.n_avaliadores + ' × cálculo ' + l.nAvaliadores);
    if (!perto(p.desvio, l.desvio)) dif.push(l.id + ' desvio: planilha ' + p.desvio + ' × cálculo ' + l.desvio);
    if (String(p.situacao) !== String(l.situacao)) dif.push(l.id + ' situação: planilha "' + p.situacao + '" × cálculo "' + l.situacao + '"');
    if (String(p.alertas) !== l.alertas.join(' · ')) dif.push(l.id + ' alertas: planilha "' + p.alertas + '" × cálculo "' + l.alertas.join(' · ') + '"');
    res.criterios.forEach(function (k) {
      if (!perto(p[k.id], l.porCriterio[k.id])) dif.push(l.id + ' ' + k.id + ': planilha ' + p[k.id] + ' × cálculo ' + l.porCriterio[k.id]);
    });
    res.blocos.forEach(function (b) {
      if (!perto(p['bloco:' + b.id], l.porBloco[b.id])) dif.push(l.id + ' bloco ' + b.id + ': planilha ' + p['bloco:' + b.id] + ' × cálculo ' + l.porBloco[b.id]);
    });
  });
  if (Object.keys(planilha).length !== res.linhas.length) {
    dif.push('Quantidade de candidatos: planilha ' + Object.keys(planilha).length + ' × cálculo ' + res.linhas.length);
  }
  return { ok: dif.length === 0, etapa: etapaNome || 'Todas', candidatos: res.linhas.length, diferencas: dif };
}

function menuConferirCalculos() {
  var r = conferirCalculos_();
  avisar_(r.ok ? 'Cálculos conferidos ✓' : 'Diferenças encontradas',
    'Etapa: ' + r.etapa + ' · ' + r.candidatos + ' candidatos.\n\n' +
    (r.ok ? 'A Tabela Geral bate com o cálculo independente.' : r.diferencas.slice(0, 30).join('\n')));
}
