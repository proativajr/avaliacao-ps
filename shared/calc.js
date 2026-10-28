// Regras de cálculo do processo seletivo (seção 10 do escopo).
// Mesmo código usado no app (ranking ao vivo), no Apps Script (conferir cálculos) e nos testes.
// Este arquivo não pode ter "import": o build do Apps Script só remove a palavra "export".

/** Casas usadas para comparar médias no ranking (evita ruído de ponto flutuante). */
export const CASAS_RANKING = 9;

function ehNumero(v) { return typeof v === 'number' && isFinite(v); }
function sim(v) { return String(v == null ? '' : v).trim().toUpperCase() === 'SIM'; }
function numOuNulo(v) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return isFinite(n) ? n : null;
}
function arred(v, casas) { const f = Math.pow(10, casas); return Math.round(v * f) / f; }
function media(lista) { return lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : null; }
function desvioAmostral(lista) {
  if (lista.length < 2) return null;
  const m = media(lista);
  return Math.sqrt(lista.reduce((a, x) => a + (x - m) * (x - m), 0) / (lista.length - 1));
}

/** Critérios ativos (critério SIM e bloco SIM), na ordem: bloco.ordem, criterio.ordem. */
export function criteriosAtivos(criterios, blocos) {
  const bl = {};
  (blocos || []).forEach((b) => { bl[b.id] = b; });
  return (criterios || [])
    .filter((c) => c.id && sim(c.ativo) && bl[c.bloco] && sim(bl[c.bloco].ativo))
    .map((c) => ({ ...c, peso: numOuNulo(c.peso) == null ? 1 : numOuNulo(c.peso), _ob: Number(bl[c.bloco].ordem) || 99 }))
    .sort((a, b) => (a._ob - b._ob) || ((Number(a.ordem) || 0) - (Number(b.ordem) || 0)));
}

/** Critérios que valem numa etapa: coluna "etapas" vazia = todas; senão lista separada por vírgula. */
export function criteriosDaEtapa(ativos, etapaId) {
  return ativos.filter((c) => {
    const lista = String(c.etapas || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return !lista.length || lista.indexOf(String(etapaId).toLowerCase()) >= 0;
  });
}

/** Blocos ativos que têm pelo menos um critério ativo, na ordem. */
export function blocosAtivos(blocos, ativos) {
  const usados = {};
  ativos.forEach((c) => { usados[c.bloco] = true; });
  return (blocos || []).filter((b) => sim(b.ativo) && usados[b.id]).sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
}

/** Notas sem momento (dados antigos, dinâmicas sem equipe) valem como Apresentação. */
export function momentoDe(a) {
  return String(a && a.momento || '').trim().toLowerCase() === 'construcao' ? 'construcao' : 'apresentacao';
}

/** Pesos dos dois momentos (Config: peso_construcao e peso_apresentacao; vazio ou inválido = 1). */
export function pesosMomentos(cfg) {
  const pc = numOuNulo((cfg || {}).peso_construcao), pa = numOuNulo((cfg || {}).peso_apresentacao);
  return { construcao: pc == null || pc < 0 ? 1 : pc, apresentacao: pa == null || pa < 0 ? 1 : pa };
}

/** Junta a média da Construção com a da Apresentação. Com só um momento, devolve esse valor sem conta. */
function combinar(c, a, w) {
  const nc = ehNumero(c), na = ehNumero(a);
  if (nc && na) { const den = w.construcao + w.apresentacao; return den === 0 ? null : (c * w.construcao + a * w.apresentacao) / den; }
  return nc ? c : (na ? a : null);
}

function mediaPonderada(medias, pesos) {
  let num = 0, den = 0;
  medias.forEach((m, i) => { if (ehNumero(m)) { num += m * pesos[i]; den += pesos[i]; } });
  return den === 0 ? null : num / den;
}

/**
 * Calcula a Tabela Geral.
 * @param {object} p
 *  p.candidatos [{id, nome, status}], p.criterios, p.blocos, p.avaliacoes [{etapa, avaliador_id, candidato_id, criterio_id, nota}]
 *  p.etapa '*' para todas ou o id da etapa
 *  p.config {nota_de_corte, vagas, min_avaliadores_por_candidato, limite_divergencia, peso_construcao, peso_apresentacao}
 *  Cada avaliação pode ter momento 'construcao' (senão vale 'apresentacao'). A média do critério na dinâmica é a média
 *  ponderada das médias dos dois momentos; sem notas de Construção, é a média de sempre.
 * @returns {{criterios, blocos, linhas}} linhas na ordem do ranking
 */
export function calcularResultados(p) {
  const ativos = criteriosAtivos(p.criterios, p.blocos);
  const blocos = blocosAtivos(p.blocos, ativos);
  const idsAtivos = {};
  ativos.forEach((c) => { idsAtivos[c.id] = true; });
  const etapa = p.etapa || '*';
  const cfg = p.config || {};
  const corte = numOuNulo(cfg.nota_de_corte);
  const vagas = numOuNulo(cfg.vagas);
  const minAval = numOuNulo(cfg.min_avaliadores_por_candidato);
  const limite = numOuNulo(cfg.limite_divergencia);

  // Índice: momento -> candidato -> critério -> [notas] e candidato -> avaliador -> [notas]
  const pesoMom = pesosMomentos(cfg);
  const porCandAval = {}, naPorCandCrit = {};
  const porMom = { construcao: {}, apresentacao: {} };
  (p.avaliacoes || []).forEach((a) => {
    if (!idsAtivos[a.criterio_id]) return;
    if (etapa !== '*' && a.etapa !== etapa) return;
    const n = a.nota;
    if (ehNumero(n)) {
      const pm = porMom[momentoDe(a)];
      ((pm[a.candidato_id] = pm[a.candidato_id] || {})[a.criterio_id] = pm[a.candidato_id][a.criterio_id] || []).push(n);
      ((porCandAval[a.candidato_id] = porCandAval[a.candidato_id] || {})[a.avaliador_id] = porCandAval[a.candidato_id][a.avaliador_id] || []).push(n);
    } else if (String(n).toUpperCase() === 'NA') {
      const m = (naPorCandCrit[a.candidato_id] = naPorCandCrit[a.candidato_id] || {});
      m[a.criterio_id] = (m[a.criterio_id] || 0) + 1;
    }
  });

  const pesos = ativos.map((c) => c.peso);
  const linhas = (p.candidatos || []).filter((c) => c.id).map((c) => {
    const pcC = porMom.construcao[c.id] || {}, pcA = porMom.apresentacao[c.id] || {};
    const mediasC = ativos.map((k) => media(pcC[k.id] || []));
    const mediasA = ativos.map((k) => media(pcA[k.id] || []));
    const medias = ativos.map((k, i) => combinar(mediasC[i], mediasA[i], pesoMom));
    const porCriterio = {};
    ativos.forEach((k, i) => { porCriterio[k.id] = medias[i]; });
    const porBloco = {};
    blocos.forEach((b) => {
      porBloco[b.id] = mediaPonderada(medias, ativos.map((k, i) => (k.bloco === b.id ? pesos[i] : 0)));
    });
    const mediasAval = Object.keys(porCandAval[c.id] || {}).map((av) => media(porCandAval[c.id][av]));
    return {
      id: c.id,
      nome: c.nome,
      status: String(c.status || '').toUpperCase(),
      porCriterio,
      porBloco,
      media: mediaPonderada(medias, pesos),
      mediaConstrucao: mediaPonderada(mediasC, pesos),
      mediaApresentacao: mediaPonderada(mediasA, pesos),
      nAvaliadores: mediasAval.length,
      desvio: desvioAmostral(mediasAval),
      naPorCriterio: naPorCandCrit[c.id] || {},
    };
  });

  // Ranking por competição (1, 2, 2, 4), só ATIVO com média; compara arredondado a 9 casas.
  const noRanking = linhas.filter((l) => l.status === 'ATIVO' && ehNumero(l.media));
  linhas.forEach((l) => {
    if (l.status === 'ATIVO' && ehNumero(l.media)) {
      const m = arred(l.media, CASAS_RANKING);
      l.ranking = 1 + noRanking.filter((o) => arred(o.media, CASAS_RANKING) > m).length;
    } else {
      l.ranking = null;
    }
    // Situação frente ao corte e às vagas
    if (l.status !== 'ATIVO') l.situacao = 'Fora do ranking';
    else if (!ehNumero(l.media)) l.situacao = 'Sem notas';
    else if (corte == null && vagas == null) l.situacao = '';
    else {
      const dentroCorte = corte == null || l.media >= corte;
      const dentroVagas = vagas == null || l.ranking <= vagas;
      l.situacao = dentroCorte && dentroVagas ? 'Classificado' : (!dentroCorte ? 'Abaixo do corte' : 'Fora das vagas');
    }
    l.alertas = [];
    if (minAval != null && l.nAvaliadores < minAval) l.alertas.push('Dados insuficientes');
    if (limite != null && ehNumero(l.desvio) && l.desvio > limite) l.alertas.push('Divergência');
  });

  linhas.sort((a, b) => ((a.ranking == null ? 1e9 : a.ranking) - (b.ranking == null ? 1e9 : b.ranking)) ||
    String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  return { criterios: ativos, blocos, linhas };
}

/**
 * Progresso de cada avaliador numa etapa (só a Apresentação conta; a Construção é de equipes específicas): completos, parciais e pendentes (só candidatos ATIVO).
 * "Não posso avaliar" (NA) conta como respondido.
 */
export function calcularProgresso(p) {
  const ativos = criteriosDaEtapa(criteriosAtivos(p.criterios, p.blocos), p.etapa);
  const exigidos = {};
  ativos.forEach((c) => { exigidos[c.id] = true; });
  const total = ativos.length;
  const cands = (p.candidatos || []).filter((c) => c.id && String(c.status || '').toUpperCase() === 'ATIVO');
  const idsCand = {};
  cands.forEach((c) => { idsCand[c.id] = true; });
  const resp = {}; // avaliador -> candidato -> {criterio: true}
  (p.avaliacoes || []).forEach((a) => {
    if (a.etapa !== p.etapa || !exigidos[a.criterio_id] || !idsCand[a.candidato_id] || momentoDe(a) === 'construcao') return;
    if (a.nota === '' || a.nota == null) return;
    const m = ((resp[a.avaliador_id] = resp[a.avaliador_id] || {})[a.candidato_id] = resp[a.avaliador_id][a.candidato_id] || {});
    m[a.criterio_id] = true;
  });
  return (p.avaliadores || []).filter((a) => a.id).map((av) => {
    let completos = 0, parciais = 0;
    cands.forEach((c) => {
      const n = Object.keys((resp[av.id] || {})[c.id] || {}).length;
      if (total > 0 && n >= total) completos++;
      else if (n > 0) parciais++;
    });
    return {
      id: av.id, nome: av.nome, completos, parciais,
      pendentes: cands.length - completos - parciais,
      total: cands.length,
      pct: cands.length ? completos / cands.length : 0,
    };
  });
}

/** Estado de um candidato para um avaliador: 'pendente' | 'parcial' | 'completo'. */
export function estadoCandidato(respondidos, total) {
  if (total > 0 && respondidos >= total) return 'completo';
  return respondidos > 0 ? 'parcial' : 'pendente';
}
