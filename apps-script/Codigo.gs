/** @OnlyCurrentDoc */
/**
 * Avaliação do Processo Seletivo · Proativa Jr.
 * ARQUIVO GERADO por "npm run build:gas". Não edite aqui: edite apps-script/src/ e shared/.
 * Para instalar: copie TODO este conteúdo e cole no editor do Apps Script da planilha (arquivo Código.gs).
 */

// ===== shared/texto.js =====
// Funções de texto compartilhadas entre o app (navegador), o Apps Script e os testes.
// Este arquivo não pode ter "import": o build do Apps Script só remove a palavra "export".

/** Normaliza um nome para comparar duplicados: sem acento, minúsculas, sem espaços extras. */
function normalizarNome(texto) {
  return String(texto == null ? '' : texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normaliza email: minúsculas e sem espaços. */
function normalizarEmail(texto) {
  return String(texto == null ? '' : texto).trim().toLowerCase();
}

/** Email simples: algo@algo.algo, sem espaços. */
function emailValido(texto) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(texto || '').trim());
}

/** Deixa só dígitos do telefone (mantém o texto original para exibição em outro campo). */
function soDigitos(texto) {
  return String(texto == null ? '' : texto).replace(/\D+/g, '');
}

/** "maria  da silva " -> "Maria da Silva" (preposições minúsculas). */
function nomeProprio(texto) {
  const minusculas = ['da', 'de', 'do', 'das', 'dos', 'e'];
  return String(texto == null ? '' : texto)
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((p, i) => {
      const baixo = p.toLowerCase();
      if (i > 0 && minusculas.indexOf(baixo) >= 0) return baixo;
      return baixo.charAt(0).toUpperCase() + baixo.slice(1);
    })
    .join(' ');
}

/**
 * Nomes curtos para os avaliadores: primeiro nome, e o último sobrenome
 * quando dois candidatos têm o mesmo primeiro nome (se ainda empatar, usa o nome completo).
 * Recebe [{id, nome}] e devolve {id: nomeCurto}.
 */
function nomesParaAvaliador(candidatos) {
  const partes = candidatos.map((c) => {
    const p = String(c.nome || '').replace(/\s+/g, ' ').trim().split(' ');
    return { id: c.id, completo: p.join(' '), primeiro: p[0] || '', ultimo: p.length > 1 ? p[p.length - 1] : '' };
  });
  const contar = (lista, chave) => {
    const m = {};
    lista.forEach((x) => { const k = normalizarNome(x[chave]); m[k] = (m[k] || 0) + 1; });
    return m;
  };
  const porPrimeiro = contar(partes, 'primeiro');
  partes.forEach((x) => { x.curto = porPrimeiro[normalizarNome(x.primeiro)] > 1 ? (x.primeiro + ' ' + x.ultimo).trim() : x.primeiro; });
  const porCurto = contar(partes, 'curto');
  const saida = {};
  partes.forEach((x) => { saida[x.id] = porCurto[normalizarNome(x.curto)] > 1 ? x.completo : x.curto; });
  return saida;
}

// ===== shared/calc.js =====
// Regras de cálculo do processo seletivo (seção 10 do escopo).
// Mesmo código usado no app (ranking ao vivo), no Apps Script (conferir cálculos) e nos testes.
// Este arquivo não pode ter "import": o build do Apps Script só remove a palavra "export".

/** Casas usadas para comparar médias no ranking (evita ruído de ponto flutuante). */
const CASAS_RANKING = 9;

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
function criteriosAtivos(criterios, blocos) {
  const bl = {};
  (blocos || []).forEach((b) => { bl[b.id] = b; });
  return (criterios || [])
    .filter((c) => c.id && sim(c.ativo) && bl[c.bloco] && sim(bl[c.bloco].ativo))
    .map((c) => ({ ...c, peso: numOuNulo(c.peso) == null ? 1 : numOuNulo(c.peso), _ob: Number(bl[c.bloco].ordem) || 99 }))
    .sort((a, b) => (a._ob - b._ob) || ((Number(a.ordem) || 0) - (Number(b.ordem) || 0)));
}

/** Critérios que valem numa etapa: coluna "etapas" vazia = todas; senão lista separada por vírgula. */
function criteriosDaEtapa(ativos, etapaId) {
  return ativos.filter((c) => {
    const lista = String(c.etapas || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return !lista.length || lista.indexOf(String(etapaId).toLowerCase()) >= 0;
  });
}

/** Blocos ativos que têm pelo menos um critério ativo, na ordem. */
function blocosAtivos(blocos, ativos) {
  const usados = {};
  ativos.forEach((c) => { usados[c.bloco] = true; });
  return (blocos || []).filter((b) => sim(b.ativo) && usados[b.id]).sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
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
 *  p.config {nota_de_corte, vagas, min_avaliadores_por_candidato, limite_divergencia}
 * @returns {{criterios, blocos, linhas}} linhas na ordem do ranking
 */
function calcularResultados(p) {
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

  // Índice: candidato -> critério -> [notas] e candidato -> avaliador -> [notas]
  const porCandCrit = {}, porCandAval = {}, naPorCandCrit = {};
  (p.avaliacoes || []).forEach((a) => {
    if (!idsAtivos[a.criterio_id]) return;
    if (etapa !== '*' && a.etapa !== etapa) return;
    const n = a.nota;
    if (ehNumero(n)) {
      ((porCandCrit[a.candidato_id] = porCandCrit[a.candidato_id] || {})[a.criterio_id] = porCandCrit[a.candidato_id][a.criterio_id] || []).push(n);
      ((porCandAval[a.candidato_id] = porCandAval[a.candidato_id] || {})[a.avaliador_id] = porCandAval[a.candidato_id][a.avaliador_id] || []).push(n);
    } else if (String(n).toUpperCase() === 'NA') {
      const m = (naPorCandCrit[a.candidato_id] = naPorCandCrit[a.candidato_id] || {});
      m[a.criterio_id] = (m[a.criterio_id] || 0) + 1;
    }
  });

  const pesos = ativos.map((c) => c.peso);
  const linhas = (p.candidatos || []).filter((c) => c.id).map((c) => {
    const pc = porCandCrit[c.id] || {};
    const medias = ativos.map((k) => media(pc[k.id] || []));
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
 * Progresso de cada avaliador numa etapa: completos, parciais e pendentes (só candidatos ATIVO).
 * "Não posso avaliar" (NA) conta como respondido.
 */
function calcularProgresso(p) {
  const ativos = criteriosDaEtapa(criteriosAtivos(p.criterios, p.blocos), p.etapa);
  const exigidos = {};
  ativos.forEach((c) => { exigidos[c.id] = true; });
  const total = ativos.length;
  const cands = (p.candidatos || []).filter((c) => c.id && String(c.status || '').toUpperCase() === 'ATIVO');
  const idsCand = {};
  cands.forEach((c) => { idsCand[c.id] = true; });
  const resp = {}; // avaliador -> candidato -> {criterio: true}
  (p.avaliacoes || []).forEach((a) => {
    if (a.etapa !== p.etapa || !exigidos[a.criterio_id] || !idsCand[a.candidato_id]) return;
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
function estadoCandidato(respondidos, total) {
  if (total > 0 && respondidos >= total) return 'completo';
  return respondidos > 0 ? 'parcial' : 'pendente';
}

// ===== apps-script/src/00_esquema.js =====
/* =====================================================================
 * ESQUEMA DA PLANILHA: nomes das abas, cabeçalhos e valores iniciais.
 * Mexer aqui muda a estrutura criada pelo setup().
 * ===================================================================== */

var VERSAO_SISTEMA = '1.0.0';

var ABAS = {
  CONFIG: 'Config',
  ETAPAS: 'Config_Etapas',
  BLOCOS: 'Config_Blocos',
  CRITERIOS: 'Config_Criterios',
  AVALIADORES: 'Avaliadores',
  CANDIDATOS: 'Candidatos',
  INSCRICOES: 'Inscricoes_Original',
  IMPORTACOES: 'Importacoes',
  AVALIACOES: 'Avaliacoes',
  OBSERVACOES: 'Observacoes',
  GERAL: 'Tabela Geral',
  INDIVIDUAL: 'Tabela Individual',
  PROGRESSO: 'Progresso',
  CALIBRACAO: 'Calibracao',
  AUX: '_Aux',
};

/** Ordem das abas na planilha. */
var ORDEM_ABAS = [
  ABAS.GERAL, ABAS.INDIVIDUAL, ABAS.PROGRESSO, ABAS.CALIBRACAO,
  ABAS.CONFIG, ABAS.ETAPAS, ABAS.BLOCOS, ABAS.CRITERIOS,
  ABAS.AVALIADORES, ABAS.CANDIDATOS, ABAS.AVALIACOES, ABAS.OBSERVACOES,
  ABAS.INSCRICOES, ABAS.IMPORTACOES, ABAS.AUX,
];

/** Cabeçalhos das abas de dados (linha 1). A ordem das colunas é usada pelo script. */
var CABECALHOS = {};
CABECALHOS[ABAS.CONFIG] = ['chave', 'valor', 'descricao'];
CABECALHOS[ABAS.ETAPAS] = ['id', 'nome', 'ordem', 'aberta'];
CABECALHOS[ABAS.BLOCOS] = ['id', 'nome', 'nome_curto', 'ordem', 'ativo'];
CABECALHOS[ABAS.CRITERIOS] = ['id', 'bloco', 'ordem', 'sigla', 'nome', 'descricao', 'peso', 'ativo', 'etapas'];
CABECALHOS[ABAS.AVALIADORES] = ['id', 'nome', 'email', 'area', 'token', 'ativo', 'criado_em', 'ultimo_acesso'];
CABECALHOS[ABAS.CANDIDATOS] = ['id', 'nome_exibicao', 'nome_normalizado', 'email', 'telefone', 'curso', 'semestre',
  'foto_url', 'status', 'origem', 'importado_em', 'chave_inscricao', 'criado_em', 'atualizado_em'];
CABECALHOS[ABAS.INSCRICOES] = ['candidato_id', 'lote_id', 'importado_em', 'hash_linha', 'dados_json'];
CABECALHOS[ABAS.IMPORTACOES] = ['lote_id', 'em', 'origem', 'nome_arquivo', 'linhas', 'criados', 'atualizados', 'ignorados'];
CABECALHOS[ABAS.AVALIACOES] = ['chave', 'etapa', 'avaliador_id', 'candidato_id', 'criterio_id', 'nota', 'atualizado_em', 'cliente_ts'];
CABECALHOS[ABAS.OBSERVACOES] = ['chave', 'etapa', 'avaliador_id', 'candidato_id', 'texto', 'atualizado_em', 'cliente_ts'];

/** Abas que só o script escreve (protegidas para todos, exceto o dono). */
var ABAS_DADOS = [ABAS.AVALIADORES, ABAS.CANDIDATOS, ABAS.INSCRICOES, ABAS.IMPORTACOES, ABAS.AVALIACOES, ABAS.OBSERVACOES];
/** Abas de configuração: editadas pelo app; na planilha mostram aviso antes de editar. */
var ABAS_CONFIG = [ABAS.CONFIG, ABAS.ETAPAS, ABAS.BLOCOS, ABAS.CRITERIOS];
/** Abas de fórmulas: protegidas, exceto as células de seleção (dropdowns). */
var ABAS_FORMULAS = [ABAS.GERAL, ABAS.INDIVIDUAL, ABAS.PROGRESSO, ABAS.CALIBRACAO, ABAS.AUX];

var STATUS_CANDIDATO = ['ATIVO', 'FALTOU', 'ELIMINADO', 'DESISTIU'];

/** Chaves da aba Config: [chave, valor padrão, descrição]. */
var CONFIG_PADRAO = [
  ['nome_processo', 'PS 2026.2', 'Nome do processo seletivo'],
  ['data_inicio', '2026-11-07', 'Data de início (AAAA-MM-DD)'],
  ['data_fim', '', 'Data de fim (AAAA-MM-DD), opcional'],
  ['avaliacao_aberta', 'SIM', 'Chave geral: NÃO deixa todas as etapas somente leitura'],
  ['avaliadores_veem_notas_dos_outros', 'NÃO', 'SIM mostra ao avaliador a média dos colegas'],
  ['nota_de_corte', '', 'Média mínima para "acima do corte" (vazio = sem corte)'],
  ['vagas', '', 'Número de vagas (vazio = sem limite)'],
  ['min_avaliadores_por_candidato', 3, 'Abaixo disso o candidato fica com "dados insuficientes"'],
  ['limite_divergencia', 1, 'Desvio padrão entre avaliadores acima disso marca "divergência"'],
  ['modo', 'ENSAIO', 'ENSAIO (dados fictícios) ou PRODUCAO (processo real)'],
  ['url_app', '', 'Endereço do site do app (ex.: https://avaliacao-ps.vercel.app)'],
  ['em_votacao', '', 'IDs dos candidatos em votação agora, separados por vírgula (o app preenche)'],
];

var ETAPAS_PADRAO = [['geral', 'Geral', 1, 'SIM']];

var BLOCOS_PADRAO = [
  ['valores', 'Valores PREDADOR', 'PREDADOR', 1, 'SIM'],
  ['comport', 'Performance comportamental', 'Comport.', 2, 'SIM'],
];

/** Critérios iniciais (seção 4 do escopo): id, bloco, ordem, sigla, nome, descrição, peso, ativo, etapas. */
var CRITERIOS_PADRAO = [
  ['valores_proatividade', 'valores', 1, 'P', 'Proatividade', 'Um membro proativo age antes de ser solicitado. Ele identifica o que precisa ser feito e faz.', 1, 'SIM', ''],
  ['valores_resultado', 'valores', 2, 'R', 'Resultado', 'Um membro orientado a resultado não se contenta só com o esforço. Ele foca no que foi entregue e no impacto gerado.', 1, 'SIM', ''],
  ['valores_excelencia', 'valores', 3, 'E', 'Excelência', 'Um membro excelente não entrega o suficiente, entrega o melhor. Ele eleva o padrão de tudo que passa pelas suas mãos.', 1, 'SIM', ''],
  ['valores_dono', 'valores', 4, 'D', 'Dono', 'Um membro com visão de dono trata a Proativa como se fosse sua. Ele zela pelos espaços, equipamentos e materiais da empresa, e se importa com os resultados além das suas próprias tarefas.', 1, 'SIM', ''],
  ['valores_antecipacao', 'valores', 5, 'A', 'Antecipação', 'Um membro com antecipação enxerga problemas e oportunidades antes que apareçam. Ele raramente é pego de surpresa.', 1, 'SIM', ''],
  ['valores_dedicacao', 'valores', 6, 'D', 'Dedicação', 'Um membro dedicado se compromete de verdade com o que assume. Ele está presente e entrega com vontade até o fim.', 1, 'SIM', ''],
  ['valores_organizacao', 'valores', 7, 'O', 'Organização', 'Um membro organizado tem clareza sobre suas prioridades, prazos e responsabilidades. Ele não deixa nada se perder no caminho.', 1, 'SIM', ''],
  ['valores_rede', 'valores', 8, 'R', 'Rede', 'Um membro que valoriza a rede constrói relações dentro e fora da Proativa. Ele sabe que conexões são parte do trabalho.', 1, 'SIM', ''],
  ['comport_proatividade', 'comport', 1, '', 'Proatividade', 'Tomar a iniciativa na realização das dinâmicas, antecipando desafios e soluções.', 1, 'SIM', ''],
  ['comport_criatividade', 'comport', 2, '', 'Criatividade', 'Atitude inovadora para solucionar problemas, se adaptando a situações imprevistas.', 1, 'SIM', ''],
  ['comport_comunicacao', 'comport', 3, '', 'Comunicação', 'Habilidade de transmitir informações de maneira clara e objetiva.', 1, 'SIM', ''],
  ['comport_analitica', 'comport', 4, '', 'Capacidade Analítica', 'Aptidão para analisar fatos ou dados, bem como a capacidade de síntese e objetividade das dinâmicas.', 1, 'SIM', ''],
  ['comport_equipe', 'comport', 5, '', 'Trabalho em Equipe', 'Capacidade de colaborar efetivamente com colegas de equipe, auxiliando no que fosse necessário.', 1, 'SIM', ''],
  ['comport_desafio', 'comport', 6, '', 'Desafio Individual', 'Com base no que foi passado, como você avalia o conteúdo, organização e aplicabilidade dos textos dos candidatos.', 1, 'SIM', ''],
];

// ===== apps-script/src/10_formulas.js =====
/* =====================================================================
 * FÓRMULAS das abas de cálculo (Tabela Geral, Individual, Progresso,
 * Calibracao e a aba oculta _Aux).
 *
 * Tudo é calculado pela própria planilha, ligando as abas por ID
 * (nunca pelo texto do nome). As fórmulas usam funções do Google Sheets
 * (LET, LAMBDA, MAP, MAKEARRAY, FILTER, XLOOKUP, AVERAGEIFS, COUNTIFS).
 *
 * Regras (seção 10 do escopo):
 *  - "NA" e vazio são ignorados nas médias.
 *  - Média do critério = média das notas numéricas da etapa selecionada.
 *  - Média geral = média ponderada pelos pesos dos critérios que têm nota.
 *  - Ranking por competição só para status ATIVO, comparando o valor sem
 *    arredondar (9 casas, para evitar ruído de ponto flutuante).
 * ===================================================================== */

/**
 * Mapa da aba _Aux (oculta). Colunas:
 *  A:B  parâmetros (etapa filtrada, etapa do progresso, contagens, config)
 *  D:L  critérios ativos  (id, bloco, peso, sigla, nome, ordem_bloco, ordem, etapas, rótulo)
 *  N:Q  blocos ativos     (id, nome, nome_curto, ordem)
 *  S:W  avaliações filtradas pela etapa da Tabela Geral (etapa, avaliador, candidato, critério, nota)
 *  Y:AC só as notas numéricas de S:W
 *  AE:AG respostas da etapa do Progresso (avaliador, candidato, critério)
 *  AI   critérios exigidos na etapa do Progresso
 *  AK:AL candidatos para o dropdown da Tabela Individual (id, rótulo)
 *  AN   etapas para o dropdown da Tabela Geral (com "Todas")
 *  AO   etapas para o dropdown do Progresso
 */
var AUX = {
  ETAPA_FILTRO: "'_Aux'!$B$1",
  ETAPA_PROG: "'_Aux'!$B$2",
  N_CRIT_PROG: "'_Aux'!$B$3",
  N_CRIT: "'_Aux'!$B$4",
  CORTE: "'_Aux'!$B$5",
  VAGAS: "'_Aux'!$B$6",
  MIN_AVAL: "'_Aux'!$B$7",
  LIMITE: "'_Aux'!$B$8",
  NOME_PROC: "'_Aux'!$B$9",
  CAND_SEL: "'_Aux'!$B$10",
};

function formulasDasAbas() {
  var A = "'_Aux'!";
  var TG = "'Tabela Geral'!";
  var TI = "'Tabela Individual'!";
  var cfg = function (chave) {
    return '=IFERROR(XLOOKUP("' + chave + '",Config!$A$2:$A,Config!$B$2:$B,""),"")';
  };
  // Pedaços reutilizados
  var CRIT = 'FILTER(' + A + '$D$2:$D,' + A + '$D$2:$D<>"")';
  var ROT = 'FILTER(' + A + '$L$2:$L,' + A + '$D$2:$D<>"")';

  var f = [];
  var add = function (aba, celula, formula) { f.push({ aba: aba, celula: celula, formula: formula }); };

  // ---------------- _Aux: parâmetros ----------------
  add(ABAS.AUX, 'B1', '=LET(s,' + TG + '$B$2,IF(OR(s="",s="Todas"),"*",IFERROR(XLOOKUP(s,Config_Etapas!$B$2:$B,Config_Etapas!$A$2:$A),"*")))');
  add(ABAS.AUX, 'B2', '=LET(s,Progresso!$B$2,IFERROR(XLOOKUP(s,Config_Etapas!$B$2:$B,Config_Etapas!$A$2:$A),IFERROR(INDEX(SORT(FILTER(Config_Etapas!$A$2:$A,Config_Etapas!$A$2:$A<>""),FILTER(Config_Etapas!$C$2:$C,Config_Etapas!$A$2:$A<>""),TRUE),1),"geral")))');
  add(ABAS.AUX, 'B3', '=COUNTIF($AI$2:$AI,"?*")');
  add(ABAS.AUX, 'B4', '=COUNTIF($D$2:$D,"?*")');
  add(ABAS.AUX, 'B5', cfg('nota_de_corte'));
  add(ABAS.AUX, 'B6', cfg('vagas'));
  add(ABAS.AUX, 'B7', cfg('min_avaliadores_por_candidato'));
  add(ABAS.AUX, 'B8', cfg('limite_divergencia'));
  add(ABAS.AUX, 'B9', cfg('nome_processo'));
  add(ABAS.AUX, 'B10', '=IFERROR(REGEXEXTRACT(' + TI + '$B$2,"\\(([^()]+)\\)$"),"")');

  // ---------------- _Aux: critérios ativos (critério SIM e bloco SIM), ordenados ----------------
  add(ABAS.AUX, 'D2', '=ARRAYFORMULA(IFERROR(LET(' +
    'id,Config_Criterios!$A$2:$A,bl,Config_Criterios!$B$2:$B,ord,Config_Criterios!$C$2:$C,sg,Config_Criterios!$D$2:$D,' +
    'nm,Config_Criterios!$E$2:$E,ps,Config_Criterios!$G$2:$G,at,Config_Criterios!$H$2:$H,et,Config_Criterios!$I$2:$I,' +
    'blAt,IFERROR(XLOOKUP(bl,Config_Blocos!$A$2:$A,Config_Blocos!$E$2:$E),"NÃO"),' +
    'blOrd,IFERROR(XLOOKUP(bl,Config_Blocos!$A$2:$A,Config_Blocos!$D$2:$D),99),' +
    'blCurto,IFERROR(XLOOKUP(bl,Config_Blocos!$A$2:$A,Config_Blocos!$C$2:$C),bl),' +
    'peso,IF(ISNUMBER(ps),ps,1),' +
    'rot,blCurto&" · "&IF(sg<>"",sg&" ","")&nm,' +
    'ok,(id<>"")*(UPPER(TRIM(at))="SIM")*(UPPER(TRIM(blAt))="SIM"),' +
    'SORT(FILTER(HSTACK(id,bl,peso,sg,nm,blOrd,ord,et,rot),ok),6,TRUE,7,TRUE)),""))');

  // ---------------- _Aux: blocos ativos com algum critério ativo ----------------
  add(ABAS.AUX, 'N2', '=ARRAYFORMULA(IFERROR(SORT(FILTER(HSTACK(Config_Blocos!$A$2:$A,Config_Blocos!$B$2:$B,Config_Blocos!$C$2:$C,Config_Blocos!$D$2:$D),' +
    'Config_Blocos!$A$2:$A<>"",UPPER(TRIM(Config_Blocos!$E$2:$E))="SIM",COUNTIF($E$2:$E,Config_Blocos!$A$2:$A)>0),4,TRUE),""))');

  // ---------------- _Aux: avaliações da etapa selecionada (só critérios ativos) ----------------
  add(ABAS.AUX, 'S2', '=ARRAYFORMULA(IFERROR(FILTER(Avaliacoes!$B$2:$F,Avaliacoes!$B$2:$B<>"",' +
    '($B$1="*")+(Avaliacoes!$B$2:$B=$B$1),ISNUMBER(MATCH(Avaliacoes!$E$2:$E,$D$2:$D,0)),Avaliacoes!$F$2:$F<>""),""))');
  add(ABAS.AUX, 'Y2', '=IFERROR(FILTER($S$2:$W,ISNUMBER($W$2:$W)),"")');

  // ---------------- _Aux: progresso ----------------
  add(ABAS.AUX, 'AI2', '=ARRAYFORMULA(IFERROR(FILTER($D$2:$D,$D$2:$D<>"",($K$2:$K="")+ISNUMBER(SEARCH(","&$B$2&",",","&SUBSTITUTE($K$2:$K," ","")&","))),""))');
  add(ABAS.AUX, 'AE2', '=ARRAYFORMULA(IFERROR(FILTER(Avaliacoes!$C$2:$E,Avaliacoes!$B$2:$B=$B$2,Avaliacoes!$F$2:$F<>"",ISNUMBER(MATCH(Avaliacoes!$E$2:$E,$AI$2:$AI,0))),""))');

  // ---------------- _Aux: listas para dropdowns ----------------
  add(ABAS.AUX, 'AK2', '=ARRAYFORMULA(IFERROR(SORT(FILTER(HSTACK(Candidatos!$A$2:$A,Candidatos!$B$2:$B&" ("&Candidatos!$A$2:$A&")"),Candidatos!$A$2:$A<>""),2,TRUE),""))');
  add(ABAS.AUX, 'AN2', '=VSTACK("Todas",IFERROR(SORT(FILTER(Config_Etapas!$B$2:$B,Config_Etapas!$B$2:$B<>""),FILTER(Config_Etapas!$C$2:$C,Config_Etapas!$B$2:$B<>""),TRUE),""))');
  add(ABAS.AUX, 'AO2', '=IFERROR(SORT(FILTER(Config_Etapas!$B$2:$B,Config_Etapas!$B$2:$B<>""),FILTER(Config_Etapas!$C$2:$C,Config_Etapas!$B$2:$B<>""),TRUE),"")');

  // ---------------- Tabela Geral ----------------
  add(ABAS.GERAL, 'A1', '="Tabela Geral · "&' + AUX.NOME_PROC);
  add(ABAS.GERAL, 'D2', '="Nota de corte: "&IF(' + AUX.CORTE + '="","—",' + AUX.CORTE + ')&"   ·   Vagas: "&IF(' + AUX.VAGAS + '="","—",' + AUX.VAGAS +
    ')&"   ·   Mín. avaliadores: "&' + AUX.MIN_AVAL + '&"   ·   Limite de divergência: "&' + AUX.LIMITE);
  // Linha 3: IDs das colunas (usada pela Tabela Individual e pelo script para conferir os cálculos)
  add(ABAS.GERAL, 'A3', '=ARRAYFORMULA(IFERROR(HSTACK("id","nome","status","ranking","media","situacao","n_avaliadores","desvio","alertas",' +
    'TRANSPOSE("bloco:"&FILTER(' + A + '$N$2:$N,' + A + '$N$2:$N<>"")),TRANSPOSE(' + CRIT + ')),' +
    'HSTACK("id","nome","status","ranking","media","situacao","n_avaliadores","desvio","alertas")))');
  add(ABAS.GERAL, 'A4', '=ARRAYFORMULA(IFERROR(HSTACK("ID","Candidato","Status","Ranking","Média geral","Situação","Nº avaliadores","Desvio padrão","Alertas",' +
    'TRANSPOSE("Média "&FILTER(' + A + '$P$2:$P,' + A + '$N$2:$N<>"")),TRANSPOSE(' + ROT + ')),' +
    'HSTACK("ID","Candidato","Status","Ranking","Média geral","Situação","Nº avaliadores","Desvio padrão","Alertas")))');
  add(ABAS.GERAL, 'A5', '=ARRAYFORMULA(IFERROR(LET(' +
    'ids,FILTER(Candidatos!$A$2:$A,Candidatos!$A$2:$A<>""),' +
    'nomes,XLOOKUP(ids,Candidatos!$A$2:$A,Candidatos!$B$2:$B),' +
    'st,UPPER(TRIM(XLOOKUP(ids,Candidatos!$A$2:$A,Candidatos!$I$2:$I))),' +
    'crit,' + CRIT + ',' +
    'cbT,TRANSPOSE(FILTER(' + A + '$E$2:$E,' + A + '$D$2:$D<>"")),' +
    'w,TRANSPOSE(FILTER(' + A + '$F$2:$F,' + A + '$D$2:$D<>"")),' +
    'bls,FILTER(' + A + '$N$2:$N,' + A + '$N$2:$N<>""),' +
    'bA,' + A + '$Z$2:$Z,bC,' + A + '$AA$2:$AA,bK,' + A + '$AB$2:$AB,bN,' + A + '$AC$2:$AC,' +
    'nC,ROWS(ids),nK,ROWS(crit),nB,ROWS(bls),' +
    'M,MAKEARRAY(nC,nK,LAMBDA(i,j,IFERROR(AVERAGEIFS(bN,bC,INDEX(ids,i),bK,INDEX(crit,j)),""))),' +
    'pond,LAMBDA(lin,pes,LET(num,SUMPRODUCT(IF(ISNUMBER(lin),lin,0)*pes),den,SUMPRODUCT(ISNUMBER(lin)*pes),IF(den=0,"",num/den))),' +
    'MB,MAKEARRAY(nC,nB,LAMBDA(i,j,pond(INDEX(M,i,0),w*(cbT=INDEX(bls,j))))),' +
    'MG,MAKEARRAY(nC,1,LAMBDA(i,j,pond(INDEX(M,i,0),w))),' +
    'NAV,MAP(ids,LAMBDA(c,IFERROR(ROWS(UNIQUE(FILTER(bA,bC=c))),0))),' +
    'DP,MAP(ids,NAV,LAMBDA(c,n,IF(n<2,"",STDEV(MAP(UNIQUE(FILTER(bA,bC=c)),LAMBDA(a,AVERAGEIFS(bN,bC,c,bA,a))))))),' +
    'mR,IF(ISNUMBER(MG),ROUND(MG,9),-1),' +
    'RK,MAP(mR,st,LAMBDA(m,s,IF(AND(s="ATIVO",m>=0),1+SUMPRODUCT((st="ATIVO")*(mR>m)),""))),' +
    'corte,' + AUX.CORTE + ',vagas,' + AUX.VAGAS + ',minA,' + AUX.MIN_AVAL + ',lim,' + AUX.LIMITE + ',' +
    'SIT,MAP(st,MG,RK,LAMBDA(s,m,r,IF(s<>"ATIVO","Fora do ranking",IF(NOT(ISNUMBER(m)),"Sem notas",' +
    'IF(AND(corte="",vagas=""),"",LET(dc,OR(corte="",IFERROR(m>=corte,TRUE)),dv,OR(vagas="",IFERROR(r<=vagas,TRUE)),' +
    'IF(AND(dc,dv),"Classificado",IF(NOT(dc),"Abaixo do corte","Fora das vagas")))))))),' +
    'AL,MAP(NAV,DP,LAMBDA(n,d,TEXTJOIN(" · ",TRUE,IF(AND(ISNUMBER(minA),n<minA),"Dados insuficientes",""),IF(AND(ISNUMBER(d),ISNUMBER(lim),d>lim),"Divergência","")))),' +
    'T,HSTACK(ids,nomes,st,RK,MG,SIT,NAV,DP,AL,MB,M),' +
    'SORT(T,IF(RK="",1000000,RK),TRUE,nomes,TRUE)),' +
    '"Nenhum candidato cadastrado ainda."))');

  // ---------------- Tabela Individual ----------------
  add(ABAS.INDIVIDUAL, 'A1', '="Tabela Individual · "&' + AUX.NOME_PROC);
  add(ABAS.INDIVIDUAL, 'D2', '="Etapa: "&IF(' + TG + '$B$2="","Todas",' + TG + '$B$2)&"  (mude a etapa na Tabela Geral)"');
  add(ABAS.INDIVIDUAL, 'A4', '=IF(' + AUX.CAND_SEL + '="","Escolha um candidato no campo B2.",IFERROR(LET(id,' + AUX.CAND_SEL + ',' +
    'g,LAMBDA(col,XLOOKUP(id,' + TG + '$A$5:$A,INDEX(' + TG + '$A$5:$ZZ,0,MATCH(col,' + TG + '$A$3:$ZZ$3,0)),"")),' +
    'HSTACK("Status: "&g("status"),"Ranking: "&IF(g("ranking")="","—",g("ranking")),"Média: "&IF(ISNUMBER(g("media")),TEXT(g("media"),"0.00"),"—"),' +
    '"Situação: "&g("situacao"),"Avaliadores: "&g("n_avaliadores"),"Alertas: "&IF(g("alertas")="","—",g("alertas")))),"Candidato não encontrado."))');
  // Tabela 1: por critério (A6)
  add(ABAS.INDIVIDUAL, 'A7', '=ARRAYFORMULA(IF(' + AUX.CAND_SEL + '="","",IFERROR(LET(id,' + AUX.CAND_SEL + ',' +
    'crit,' + CRIT + ',' +
    'blc,XLOOKUP(FILTER(' + A + '$E$2:$E,' + A + '$D$2:$D<>""),' + A + '$N$2:$N,' + A + '$P$2:$P,""),' +
    'nm,FILTER(IF(' + A + '$G$2:$G<>"",' + A + '$G$2:$G&" ","")&' + A + '$H$2:$H,' + A + '$D$2:$D<>""),' +
    'mc,MAP(crit,LAMBDA(k,IFERROR(AVERAGEIFS(' + A + '$AC$2:$AC,' + A + '$AA$2:$AA,id,' + A + '$AB$2:$AB,k),""))),' +
    'mg,MAP(crit,LAMBDA(k,IFERROR(AVERAGEIFS(INDEX(' + TG + '$A$5:$ZZ,0,MATCH(k,' + TG + '$A$3:$ZZ$3,0)),' + TG + '$C$5:$C,"ATIVO"),""))),' +
    'dif,MAP(mc,mg,LAMBDA(a,b,IF(AND(ISNUMBER(a),ISNUMBER(b)),a-b,""))),' +
    'nn,MAP(crit,LAMBDA(k,COUNTIFS(' + A + '$AA$2:$AA,id,' + A + '$AB$2:$AB,k))),' +
    'nna,MAP(crit,LAMBDA(k,COUNTIFS(' + A + '$U$2:$U,id,' + A + '$V$2:$V,k,' + A + '$W$2:$W,"NA"))),' +
    'HSTACK(blc,nm,mc,mg,dif,nn,nna)),"")))');
  // Observações (I6)
  add(ABAS.INDIVIDUAL, 'I7', '=ARRAYFORMULA(IF(' + AUX.CAND_SEL + '="","",IFERROR(FILTER(HSTACK(' +
    'XLOOKUP(Observacoes!$B$2:$B,Config_Etapas!$A$2:$A,Config_Etapas!$B$2:$B,Observacoes!$B$2:$B),' +
    'XLOOKUP(Observacoes!$C$2:$C,Avaliadores!$A$2:$A,Avaliadores!$B$2:$B,Observacoes!$C$2:$C),Observacoes!$E$2:$E),' +
    'Observacoes!$D$2:$D=' + AUX.CAND_SEL + ',Observacoes!$E$2:$E<>"",(' + AUX.ETAPA_FILTRO + '="*")+(Observacoes!$B$2:$B=' + AUX.ETAPA_FILTRO + ')),"Sem observações.")))');
  // Matriz avaliador × critério (M6)
  add(ABAS.INDIVIDUAL, 'M6', '=ARRAYFORMULA(IFERROR(HSTACK("Avaliador",TRANSPOSE(' + ROT + ')),"Avaliador"))');
  add(ABAS.INDIVIDUAL, 'M7', '=ARRAYFORMULA(IF(' + AUX.CAND_SEL + '="","",IFERROR(LET(id,' + AUX.CAND_SEL + ',' +
    'crit,' + CRIT + ',' +
    'avs,UNIQUE(FILTER(' + A + '$T$2:$T,' + A + '$U$2:$U=id)),' +
    'nomes,XLOOKUP(avs,Avaliadores!$A$2:$A,Avaliadores!$B$2:$B,avs),' +
    'MX,MAKEARRAY(ROWS(avs),ROWS(crit),LAMBDA(i,j,LET(a,INDEX(avs,i),k,INDEX(crit,j),' +
    'm,IFERROR(AVERAGEIFS(' + A + '$AC$2:$AC,' + A + '$Z$2:$Z,a,' + A + '$AA$2:$AA,id,' + A + '$AB$2:$AB,k),""),' +
    'IF(ISNUMBER(m),m,IF(COUNTIFS(' + A + '$T$2:$T,a,' + A + '$U$2:$U,id,' + A + '$V$2:$V,k,' + A + '$W$2:$W,"NA")>0,"NA",""))))),' +
    'HSTACK(nomes,MX)),"Sem avaliações.")))');

  // ---------------- Progresso ----------------
  add(ABAS.PROGRESSO, 'A1', '="Progresso dos avaliadores · "&' + AUX.NOME_PROC);
  add(ABAS.PROGRESSO, 'D2', '="Critérios nesta etapa: "&' + AUX.N_CRIT_PROG + '&"   ·   Candidatos ativos: "&COUNTIF(Candidatos!$I$2:$I,"ATIVO")');
  add(ABAS.PROGRESSO, 'A5', '=ARRAYFORMULA(IFERROR(LET(' +
    'av,FILTER(Avaliadores!$A$2:$A,Avaliadores!$A$2:$A<>""),' +
    'nm,XLOOKUP(av,Avaliadores!$A$2:$A,Avaliadores!$B$2:$B),' +
    'at,XLOOKUP(av,Avaliadores!$A$2:$A,Avaliadores!$F$2:$F),' +
    'ua,XLOOKUP(av,Avaliadores!$A$2:$A,Avaliadores!$H$2:$H),' +
    'cs,FILTER(Candidatos!$A$2:$A,Candidatos!$A$2:$A<>"",UPPER(TRIM(Candidatos!$I$2:$I))="ATIVO"),' +
    'req,' + AUX.N_CRIT_PROG + ',nc,ROWS(cs),' +
    'MX,MAKEARRAY(ROWS(av),nc,LAMBDA(i,j,COUNTIFS(' + A + '$AE$2:$AE,INDEX(av,i),' + A + '$AF$2:$AF,INDEX(cs,j)))),' +
    'comp,BYROW(MX,LAMBDA(r,SUMPRODUCT((r>=req)*(req>0)))),' +
    'parc,BYROW(MX,LAMBDA(r,SUMPRODUCT((r>0)*((r<req)+(req=0)>0)))),' +
    'pend,nc-comp-parc,' +
    'pct,comp/nc,' +
    'SORT(HSTACK(av,nm,at,comp,parc,pend,pct,ua),7,TRUE,2,TRUE)),' +
    '"Cadastre avaliadores e candidatos ativos para ver o progresso."))');

  // ---------------- Calibracao ----------------
  add(ABAS.CALIBRACAO, 'A1', '="Calibração dos avaliadores · "&' + AUX.NOME_PROC);
  add(ABAS.CALIBRACAO, 'A2', '="Etapa: "&IF(' + TG + '$B$2="","Todas",' + TG + '$B$2)&"  (mude a etapa na Tabela Geral)"');
  add(ABAS.CALIBRACAO, 'A5', '=ARRAYFORMULA(IFERROR(LET(' +
    'av,UNIQUE(FILTER(' + A + '$T$2:$T,' + A + '$T$2:$T<>"")),' +
    'nm,XLOOKUP(av,Avaliadores!$A$2:$A,Avaliadores!$B$2:$B,av),' +
    'mg,AVERAGE(' + A + '$AC$2:$AC),' +
    'md,MAP(av,LAMBDA(a,IFERROR(AVERAGEIFS(' + A + '$AC$2:$AC,' + A + '$Z$2:$Z,a),""))),' +
    'nn,MAP(av,LAMBDA(a,COUNTIFS(' + A + '$Z$2:$Z,a))),' +
    'nna,MAP(av,LAMBDA(a,COUNTIFS(' + A + '$T$2:$T,a,' + A + '$W$2:$W,"NA"))),' +
    'dif,MAP(md,LAMBDA(x,IF(ISNUMBER(x),x-mg,""))),' +
    'SORT(HSTACK(nm,md,MAP(av,LAMBDA(a,mg)),dif,nn,nna,nna/(nn+nna)),4,FALSE)),' +
    '"Sem avaliações nesta etapa."))');
  add(ABAS.CALIBRACAO, 'J5', '=ARRAYFORMULA(IFERROR(LET(' +
    'crit,' + CRIT + ',rot,' + ROT + ',' +
    'D,MAKEARRAY(ROWS(crit),6,LAMBDA(i,j,COUNTIFS(' + A + '$V$2:$V,INDEX(crit,i),' + A + '$W$2:$W,IF(j=6,"NA",j)))),' +
    'tot,BYROW(D,LAMBDA(r,SUM(r))),' +
    'med,MAP(crit,LAMBDA(k,IFERROR(AVERAGEIFS(' + A + '$AC$2:$AC,' + A + '$AB$2:$AB,k),""))),' +
    'HSTACK(rot,D,tot,med)),"Sem avaliações nesta etapa."))');

  return f;
}

/** Textos fixos (rótulos e cabeçalhos) das abas de cálculo. */
function rotulosDasAbas() {
  var r = [];
  var add = function (aba, celula, valores) { r.push({ aba: aba, celula: celula, valores: valores }); };
  add(ABAS.AUX, 'A1', [['etapa_filtro'], ['etapa_progresso'], ['n_crit_progresso'], ['n_crit_ativos'], ['nota_de_corte'],
    ['vagas'], ['min_avaliadores'], ['limite_divergencia'], ['nome_processo'], ['candidato_individual']]);
  add(ABAS.AUX, 'D1', [['crit_id', 'bloco_id', 'peso', 'sigla', 'nome', 'ordem_bloco', 'ordem', 'etapas', 'rotulo']]);
  add(ABAS.AUX, 'N1', [['bloco_id', 'bloco_nome', 'bloco_curto', 'ordem']]);
  add(ABAS.AUX, 'S1', [['etapa', 'avaliador_id', 'candidato_id', 'criterio_id', 'nota']]);
  add(ABAS.AUX, 'Y1', [['etapa', 'avaliador_id', 'candidato_id', 'criterio_id', 'nota_num']]);
  add(ABAS.AUX, 'AE1', [['avaliador_id', 'candidato_id', 'criterio_id']]);
  add(ABAS.AUX, 'AI1', [['crit_progresso']]);
  add(ABAS.AUX, 'AK1', [['cand_id', 'rotulo']]);
  add(ABAS.AUX, 'AN1', [['etapas_com_todas', 'etapas']]);

  add(ABAS.GERAL, 'A2', [['Etapa:']]);
  add(ABAS.INDIVIDUAL, 'A2', [['Candidato:']]);
  add(ABAS.INDIVIDUAL, 'A6', [['Bloco', 'Critério', 'Média do candidato', 'Média do grupo', 'Diferença', 'Nº notas', 'Nº "não posso avaliar"']]);
  add(ABAS.INDIVIDUAL, 'I6', [['Etapa', 'Avaliador', 'Observação']]);
  add(ABAS.PROGRESSO, 'A2', [['Etapa:']]);
  add(ABAS.PROGRESSO, 'A4', [['ID', 'Avaliador', 'Ativo', 'Completos', 'Parciais', 'Pendentes', '% concluído', 'Último acesso']]);
  add(ABAS.CALIBRACAO, 'A4', [['Avaliador', 'Média dada', 'Média geral', 'Diferença', 'Nº notas', 'Nº "não posso avaliar"', '% "não posso avaliar"']]);
  add(ABAS.CALIBRACAO, 'J4', [['Critério', 'Nota 1', 'Nota 2', 'Nota 3', 'Nota 4', 'Nota 5', 'Não posso avaliar', 'Total', 'Média']]);
  return r;
}

/** Células com lista suspensa: [aba, célula, intervalo de origem, valor inicial]. */
function dropdownsDasAbas() {
  return [
    [ABAS.GERAL, 'B2', "'_Aux'!$AN$2:$AN", 'Todas'],
    [ABAS.PROGRESSO, 'B2', "'_Aux'!$AO$2:$AO", 'Geral'],
    [ABAS.INDIVIDUAL, 'B2', "'_Aux'!$AL$2:$AL", ''],
  ];
}

// ===== apps-script/src/20_util.js =====
/* =====================================================================
 * UTILITÁRIOS: acesso às abas, leitura em lote, IDs, tokens e trava.
 * ===================================================================== */

function planilha_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function aba_(nome) {
  var sh = planilha_().getSheetByName(nome);
  if (!sh) throw new Error('A aba "' + nome + '" não existe. Rode o setup() pelo menu "PS Proativa".');
  return sh;
}

function props_() {
  return PropertiesService.getScriptProperties();
}

/** Lê uma aba de dados inteira como lista de objetos {coluna: valor}; guarda o nº da linha em _linha. */
function lerObjetos_(nomeAba) {
  var sh = aba_(nomeAba);
  var cab = CABECALHOS[nomeAba];
  var n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  var valores = sh.getRange(2, 1, n, cab.length).getValues();
  var saida = [];
  for (var i = 0; i < valores.length; i++) {
    var linha = valores[i];
    if (linha[0] === '' || linha[0] === null) continue;
    var o = { _linha: i + 2 };
    for (var j = 0; j < cab.length; j++) o[cab[j]] = linha[j];
    saida.push(o);
  }
  return saida;
}

/** Converte objeto em linha seguindo a ordem do cabeçalho. */
function paraLinha_(nomeAba, obj) {
  return CABECALHOS[nomeAba].map(function (c) { return obj[c] === undefined || obj[c] === null ? '' : obj[c]; });
}

/** Acrescenta várias linhas de uma vez (uma única escrita). */
function acrescentar_(nomeAba, objetos) {
  if (!objetos.length) return;
  var sh = aba_(nomeAba);
  var linhas = objetos.map(function (o) { return paraLinha_(nomeAba, o); });
  sh.getRange(sh.getLastRow() + 1, 1, linhas.length, linhas[0].length).setValues(linhas);
}

/** Reescreve linhas existentes (cada objeto precisa de _linha). Agrupa linhas vizinhas numa só escrita. */
function reescrever_(nomeAba, objetos) {
  if (!objetos.length) return;
  var sh = aba_(nomeAba);
  var ord = objetos.slice().sort(function (a, b) { return a._linha - b._linha; });
  var bloco = [ord[0]];
  var gravar = function (b) {
    sh.getRange(b[0]._linha, 1, b.length, CABECALHOS[nomeAba].length)
      .setValues(b.map(function (o) { return paraLinha_(nomeAba, o); }));
  };
  for (var i = 1; i < ord.length; i++) {
    if (ord[i]._linha === bloco[bloco.length - 1]._linha + 1) bloco.push(ord[i]);
    else { gravar(bloco); bloco = [ord[i]]; }
  }
  gravar(bloco);
}

/** Apaga todas as linhas de dados (mantém o cabeçalho). */
function limparDados_(nomeAba) {
  var sh = aba_(nomeAba);
  var n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, sh.getMaxColumns()).clearContent();
}

/** Executa fn com a trava do script (uma escrita por vez). */
function comTrava_(fn) {
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(25000)) throw new Error('Servidor ocupado. Tente de novo em alguns segundos.');
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    trava.releaseLock();
  }
}

/** Token aleatório: SHA-256 de dois UUIDs v4 (≈244 bits aleatórios), em base64 seguro para URL (43 caracteres). */
function gerarToken_() {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + Utilities.getUuid() + Date.now());
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

/**
 * Próximo ID sequencial (c001, a001…). Nunca reutiliza: guarda o maior número já usado
 * nas propriedades do script e também confere o maior ID existente na aba.
 */
function proximosIds_(prefixo, nomeAba, quantidade) {
  var chave = 'seq_' + prefixo;
  var usado = Number(props_().getProperty(chave) || 0);
  lerObjetos_(nomeAba).forEach(function (o) {
    var m = String(o.id).match(/^[a-z](\d+)$/);
    if (m) usado = Math.max(usado, Number(m[1]));
  });
  var ids = [];
  for (var i = 1; i <= quantidade; i++) {
    var n = usado + i;
    ids.push(prefixo + (n < 1000 ? ('00' + n).slice(-3) : String(n)));
  }
  props_().setProperty(chave, String(usado + quantidade));
  return ids;
}

/** Lê a aba Config como objeto {chave: valor}. */
function lerConfig_() {
  var cfg = {};
  lerObjetos_(ABAS.CONFIG).forEach(function (o) {
    var v = o.valor;
    // Datas viram texto AAAA-MM-DD (a planilha às vezes converte sozinha)
    if (v instanceof Date) v = Utilities.formatDate(v, 'America/Fortaleza', 'yyyy-MM-dd');
    cfg[String(o.chave).trim()] = v;
  });
  return cfg;
}

/** Chaves gravadas como texto puro (com apóstrofo), para a planilha não transformar em data. */
var CONFIG_TEXTO = ['data_inicio', 'data_fim', 'em_votacao', 'url_app', 'nome_processo'];
function valorConfigParaCelula_(chave, valor) {
  return CONFIG_TEXTO.indexOf(chave) >= 0 && valor !== '' ? "'" + String(valor) : valor;
}

/** Grava um valor na aba Config (cria a chave se não existir). */
function gravarConfig_(chave, valor) {
  var linhas = lerObjetos_(ABAS.CONFIG);
  var achou = linhas.filter(function (o) { return o.chave === chave; })[0];
  var v = valorConfigParaCelula_(chave, valor);
  if (achou) aba_(ABAS.CONFIG).getRange(achou._linha, 2).setValue(v);
  else acrescentar_(ABAS.CONFIG, [{ chave: chave, valor: v, descricao: '' }]);
}

function ehSim_(v) {
  return String(v == null ? '' : v).trim().toUpperCase() === 'SIM';
}

function modo_() {
  return String(lerConfig_().modo || 'ENSAIO').trim().toUpperCase();
}

/** Mostra uma mensagem na planilha (quando há interface) e no registro de execução. */
function avisar_(titulo, mensagem) {
  Logger.log(titulo + '\n' + mensagem);
  try {
    SpreadsheetApp.getUi().alert(titulo, mensagem, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // Sem interface (execução pelo app): só registra.
  }
}

// ===== apps-script/src/30_setup.js =====
/* =====================================================================
 * SETUP: cria/atualiza a planilha inteira. Pode rodar quantas vezes quiser
 * (idempotente): nunca apaga dados, só completa o que falta e reescreve
 * as fórmulas, formatações e proteções.
 * ===================================================================== */

var CORES = {
  cabecalho: '#1f2937', textoCabecalho: '#ffffff',
  verde: '#d9f2e3', laranja: '#fde7c2', vermelho: '#f8d0cc', cinza: '#eceff1', textoCinza: '#7b8794',
};

function setup() {
  var ss = planilha_();
  ss.setSpreadsheetTimeZone('America/Fortaleza');
  try { ss.setSpreadsheetLocale('pt_BR'); } catch (e) { /* algumas contas não permitem */ }

  // Se o script foi copiado junto com a planilha, não herda tokens nem contadores da original.
  var p = props_();
  if (p.getProperty('planilha_id') && p.getProperty('planilha_id') !== ss.getId()) {
    p.deleteAllProperties();
  }
  p.setProperty('planilha_id', ss.getId());

  criarAbas_(ss);
  Object.keys(CABECALHOS).forEach(function (nome) { garantirCabecalho_(nome); });
  preencherPadroes_();
  montarAbasDeCalculo_();
  // Conferência de segurança: se as fórmulas não forem entendidas (problema de idioma da planilha),
  // troca o idioma para inglês (EUA), que sempre funciona, e refaz as fórmulas.
  SpreadsheetApp.flush();
  if (/^#(ERROR|NAME|ERRO)/i.test(String(aba_(ABAS.AUX).getRange('B4').getDisplayValue()))) {
    ss.setSpreadsheetLocale('en_US');
    montarAbasDeCalculo_();
  }
  aplicarValidacoes_();
  aplicarProtecoes_(ss);

  if (!p.getProperty('ADMIN_TOKEN')) p.setProperty('ADMIN_TOKEN', gerarToken_());
  p.setProperty('versao', VERSAO_SISTEMA);
  SpreadsheetApp.flush();

  var msg = 'Planilha pronta (versão ' + VERSAO_SISTEMA + ', modo ' + modo_() + ').\n\n' + textoLinkAdmin_();
  avisar_('Setup concluído', msg);
  return msg;
}

function criarAbas_(ss) {
  ORDEM_ABAS.forEach(function (nome, i) {
    var sh = ss.getSheetByName(nome);
    if (!sh) sh = ss.insertSheet(nome, Math.min(i, ss.getSheets().length));
  });
  // Remove a aba padrão vazia de uma planilha nova ("Página1"/"Sheet1").
  ss.getSheets().forEach(function (sh) {
    if (ORDEM_ABAS.indexOf(sh.getName()) < 0 && /^(Página|Pagina|Sheet|Planilha)\d*$/.test(sh.getName()) && sh.getLastRow() === 0) {
      ss.deleteSheet(sh);
    }
  });
  ORDEM_ABAS.forEach(function (nome, i) {
    var sh = ss.getSheetByName(nome);
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });
  ss.getSheetByName(ABAS.AUX).hideSheet();
  ss.setActiveSheet(ss.getSheetByName(ABAS.GERAL));
}

function garantirCabecalho_(nome) {
  var sh = aba_(nome);
  var cab = CABECALHOS[nome];
  if (sh.getMaxColumns() < cab.length) sh.insertColumnsAfter(sh.getMaxColumns(), cab.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, cab.length).setValues([cab])
    .setFontWeight('bold').setBackground(CORES.cabecalho).setFontColor(CORES.textoCabecalho);
  sh.setFrozenRows(1);
  // Datas e textos com formato fixo (evita "c001" virar outra coisa e notas virarem datas)
  if (nome === ABAS.AVALIACOES) {
    sh.getRange('A:E').setNumberFormat('@');
    sh.getRange('G:G').setNumberFormat('dd/mm/yyyy hh:mm:ss');
  }
  if (nome === ABAS.CANDIDATOS) {
    sh.getRange('A:H').setNumberFormat('@');
    sh.getRange('K:K').setNumberFormat('dd/mm/yyyy hh:mm');
    sh.getRange('M:N').setNumberFormat('dd/mm/yyyy hh:mm');
  }
  if (nome === ABAS.AVALIADORES) {
    sh.getRange('A:E').setNumberFormat('@');
    sh.getRange('G:H').setNumberFormat('dd/mm/yyyy hh:mm');
  }
  if (nome === ABAS.OBSERVACOES) sh.getRange('F:F').setNumberFormat('dd/mm/yyyy hh:mm:ss');
  if (nome === ABAS.CRITERIOS) sh.getRange('F:F').setWrap(true);
}

/** Valores iniciais: só entram onde a aba ainda está vazia (ou falta a chave na Config). */
function preencherPadroes_() {
  var existentes = {};
  lerObjetos_(ABAS.CONFIG).forEach(function (o) { existentes[o.chave] = true; });
  var faltam = CONFIG_PADRAO.filter(function (c) { return !existentes[c[0]]; })
    .map(function (c) { return { chave: c[0], valor: valorConfigParaCelula_(c[0], c[1]), descricao: c[2] }; });
  acrescentar_(ABAS.CONFIG, faltam);

  var linhas = function (cab, matriz) {
    return matriz.map(function (l) { var o = {}; cab.forEach(function (c, i) { o[c] = l[i]; }); return o; });
  };
  if (!lerObjetos_(ABAS.ETAPAS).length) acrescentar_(ABAS.ETAPAS, linhas(CABECALHOS[ABAS.ETAPAS], ETAPAS_PADRAO));
  if (!lerObjetos_(ABAS.BLOCOS).length) acrescentar_(ABAS.BLOCOS, linhas(CABECALHOS[ABAS.BLOCOS], BLOCOS_PADRAO));
  if (!lerObjetos_(ABAS.CRITERIOS).length) acrescentar_(ABAS.CRITERIOS, linhas(CABECALHOS[ABAS.CRITERIOS], CRITERIOS_PADRAO));
}

/** Reescreve rótulos, fórmulas, formatos e formatação condicional das abas de cálculo. */
function montarAbasDeCalculo_() {
  // Guarda as escolhas atuais dos dropdowns para não perder ao refazer as abas.
  var escolhas = {};
  dropdownsDasAbas().forEach(function (d) {
    escolhas[d[0] + d[1]] = aba_(d[0]).getRange(d[1]).getValue() || d[3];
  });

  [ABAS.GERAL, ABAS.INDIVIDUAL, ABAS.PROGRESSO, ABAS.CALIBRACAO, ABAS.AUX].forEach(function (nome) {
    var sh = aba_(nome);
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations().breakApart();
    sh.clear();
    sh.clearConditionalFormatRules();
    sh.showRows(1, Math.min(10, sh.getMaxRows()));
    if (sh.getMaxColumns() < 60) sh.insertColumnsAfter(sh.getMaxColumns(), 60 - sh.getMaxColumns());
  });

  rotulosDasAbas().forEach(function (r) {
    aba_(r.aba).getRange(r.celula).offset(0, 0, r.valores.length, r.valores[0].length).setValues(r.valores);
  });
  formulasDasAbas().forEach(function (f) { aba_(f.aba).getRange(f.celula).setFormula(f.formula); });

  dropdownsDasAbas().forEach(function (d) {
    var sh = aba_(d[0]);
    var regra = SpreadsheetApp.newDataValidation()
      .requireValueInRange(planilha_().getRange(d[2]), true).setAllowInvalid(false).build();
    // Grava o valor ANTES de ligar a validação: a lista de opções (aba _Aux) ainda está sendo calculada
    // e, se a validação já estivesse ativa, o Google recusaria o valor.
    sh.getRange(d[1]).clearDataValidations().setValue(escolhas[d[0] + d[1]])
      .setBackground('#fff8e1').setFontWeight('bold');
    SpreadsheetApp.flush();
    sh.getRange(d[1]).setDataValidation(regra);
  });

  formatarTabelaGeral_();
  formatarOutras_();
}

function formatarTitulo_(sh) {
  sh.getRange('A1').setFontSize(14).setFontWeight('bold');
}

function formatarCabecalhoLinha_(sh, a1) {
  sh.getRange(a1).setFontWeight('bold').setBackground(CORES.cabecalho).setFontColor(CORES.textoCabecalho).setWrap(true);
}

function formatarTabelaGeral_() {
  var sh = aba_(ABAS.GERAL);
  formatarTitulo_(sh);
  sh.getRange('A2').setFontWeight('bold');
  sh.getRange('D2').setFontColor(CORES.textoCinza);
  sh.getRange('A3:BH3').setFontColor(CORES.textoCinza).setFontSize(8);
  sh.hideRows(3);
  formatarCabecalhoLinha_(sh, 'A4:BH4');
  sh.setRowHeight(4, 48);
  sh.setFrozenRows(4);
  sh.setFrozenColumns(2);
  sh.getRange('E5:E').setNumberFormat('0.00');
  sh.getRange('H5:H').setNumberFormat('0.00');
  sh.getRange('J5:BH').setNumberFormat('0.00');
  sh.setColumnWidth(1, 60); sh.setColumnWidth(2, 200); sh.setColumnWidth(6, 130); sh.setColumnWidth(9, 190);

  var faixa = sh.getRange('A5:BH1000');
  var colI = sh.getRange('I5:I1000');
  var regras = [
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=ISNUMBER(SEARCH("insuficientes",$I5))')
      .setBackground(CORES.laranja).setRanges([colI]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=ISNUMBER(SEARCH("Divergência",$I5))')
      .setBackground(CORES.vermelho).setRanges([colI]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($A5<>"",$C5<>"ATIVO")')
      .setBackground(CORES.cinza).setFontColor(CORES.textoCinza).setItalic(true).setRanges([faixa]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($C5="ATIVO",OR($F5="Classificado",AND(ISNUMBER($E5),ISNUMBER(INDIRECT("\'_Aux\'!B5")),$E5>=INDIRECT("\'_Aux\'!B5"))))')
      .setBackground(CORES.verde).setRanges([faixa]).build(),
  ];
  sh.setConditionalFormatRules(regras);
}

function formatarOutras_() {
  var ind = aba_(ABAS.INDIVIDUAL);
  formatarTitulo_(ind);
  ind.getRange('A2').setFontWeight('bold');
  ind.getRange('D2').setFontColor(CORES.textoCinza);
  ind.getRange('A4:F4').setFontWeight('bold');
  formatarCabecalhoLinha_(ind, 'A6:G6');
  formatarCabecalhoLinha_(ind, 'I6:K6');
  formatarCabecalhoLinha_(ind, 'M6:AH6');
  ind.setRowHeight(6, 48);
  ind.getRange('C7:E').setNumberFormat('0.00');
  ind.getRange('N7:AH').setNumberFormat('0.00');
  ind.setColumnWidth(2, 170); ind.setColumnWidth(2, 220); ind.setColumnWidth(11, 320); ind.setColumnWidth(13, 160);
  ind.getRange('K7:K').setWrap(true);
  ind.getRange('B2').offset(0, 0, 1, 2).merge();

  var pr = aba_(ABAS.PROGRESSO);
  formatarTitulo_(pr);
  pr.getRange('A2').setFontWeight('bold');
  pr.getRange('D2').setFontColor(CORES.textoCinza);
  formatarCabecalhoLinha_(pr, 'A4:H4');
  pr.setFrozenRows(4);
  pr.getRange('G5:G').setNumberFormat('0%');
  pr.getRange('H5:H').setNumberFormat('dd/mm/yyyy hh:mm');
  pr.setColumnWidth(2, 200); pr.setColumnWidth(8, 140);
  pr.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($A5<>"",$F5>0)')
      .setBackground(CORES.laranja).setRanges([pr.getRange('F5:F1000')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($A5<>"",$F5=0,$E5=0,$D5>0)')
      .setBackground(CORES.verde).setRanges([pr.getRange('A5:H1000')]).build(),
  ]);

  var ca = aba_(ABAS.CALIBRACAO);
  formatarTitulo_(ca);
  ca.getRange('A2').setFontColor(CORES.textoCinza);
  formatarCabecalhoLinha_(ca, 'A4:G4');
  formatarCabecalhoLinha_(ca, 'J4:R4');
  ca.setRowHeight(4, 48);
  ca.getRange('B5:D').setNumberFormat('0.00');
  ca.getRange('G5:G').setNumberFormat('0%');
  ca.getRange('R5:R').setNumberFormat('0.00');
  ca.setColumnWidth(1, 200); ca.setColumnWidth(10, 240);
}

/** Listas suspensas nas abas de configuração e dados (ajudam quem edita direto na planilha). */
function aplicarValidacoes_() {
  var simNao = SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).setAllowInvalid(false).build();
  aba_(ABAS.ETAPAS).getRange('D2:D').setDataValidation(simNao);
  aba_(ABAS.BLOCOS).getRange('E2:E').setDataValidation(simNao);
  aba_(ABAS.CRITERIOS).getRange('H2:H').setDataValidation(simNao);
  aba_(ABAS.AVALIADORES).getRange('F2:F').setDataValidation(simNao);
  aba_(ABAS.CRITERIOS).getRange('B2:B').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(aba_(ABAS.BLOCOS).getRange('A2:A'), true).setAllowInvalid(false).build());
  aba_(ABAS.CRITERIOS).getRange('G2:G').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireNumberBetween(0, 100).setAllowInvalid(false).build());
  aba_(ABAS.CANDIDATOS).getRange('I2:I').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_CANDIDATO, true).setAllowInvalid(false).build());
}

/**
 * Proteções:
 *  - abas de dados e de fórmulas: só o dono (o script roda como o dono);
 *  - abas de fórmulas deixam livres os dropdowns de seleção;
 *  - abas de configuração: aviso antes de editar (o certo é editar pelo app).
 */
function aplicarProtecoes_(ss) {
  ss.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (pr) {
    if (String(pr.getDescription()).indexOf('PS:') === 0) pr.remove();
  });
  var travar = function (nome, livres) {
    var pr = aba_(nome).protect().setDescription('PS: só o script escreve aqui');
    if (livres && livres.length) pr.setUnprotectedRanges(livres.map(function (a1) { return aba_(nome).getRange(a1); }));
    var eu = Session.getEffectiveUser();
    try { pr.addEditor(eu); } catch (e) { /* dono já é editor */ }
    pr.removeEditors(pr.getEditors().filter(function (u) { return u.getEmail() !== eu.getEmail(); }));
    if (pr.canDomainEdit()) pr.setDomainEdit(false);
  };
  ABAS_DADOS.forEach(function (n) { travar(n); });
  travar(ABAS.GERAL, ['B2']);
  travar(ABAS.PROGRESSO, ['B2']);
  travar(ABAS.INDIVIDUAL, ['B2:C2']);
  travar(ABAS.CALIBRACAO);
  travar(ABAS.AUX);
  ABAS_CONFIG.forEach(function (n) {
    aba_(n).protect().setDescription('PS: edite pelo app (Configuração)').setWarningOnly(true);
  });
}

function textoLinkAdmin_() {
  var url = String(lerConfig_().url_app || '').replace(/\/+$/, '');
  var tok = props_().getProperty('ADMIN_TOKEN') || '(rode o setup)';
  var amb = modo_() === 'ENSAIO' ? '&amb=ensaio' : '';
  if (!url) return 'Link do admin: preencha "url_app" na aba Config com o endereço do site e use o menu ' +
    '"PS Proativa > Mostrar link do admin".\nToken do admin: ' + tok;
  return 'Link do admin (não compartilhe):\n' + url + '/#adm=' + tok + amb;
}

function mostrarLinkAdmin() {
  avisar_('Link do admin', textoLinkAdmin_());
}

/** Gera um novo token de admin (o link antigo para de funcionar). */
function regerarTokenAdmin() {
  props_().setProperty('ADMIN_TOKEN', gerarToken_());
  mostrarLinkAdmin();
}

// ===== apps-script/src/40_ensaio.js =====
/* =====================================================================
 * MODO ENSAIO: dados fictícios para testar antes do processo, e botões
 * para zerar. Também o "apagar dados do processo" (LGPD) ao final.
 * ===================================================================== */

var NOMES_FICTICIOS = ['Ana', 'Bruno', 'Carla', 'Davi', 'Elisa', 'Felipe', 'Gabriela', 'Heitor', 'Isabela', 'João',
  'Larissa', 'Mateus', 'Natália', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Tiago', 'Vitória', 'Yuri', 'Ana', 'João', 'Lucas', 'Marina'];
var SOBRENOMES_FICTICIOS = ['Albuquerque', 'Barros', 'Cavalcante', 'Diniz', 'Esteves', 'Farias', 'Gurgel', 'Holanda',
  'Iório', 'Jucá', 'Lacerda', 'Moraes', 'Nogueira', 'Oliveira', 'Pinheiro', 'Queiroz', 'Rocha', 'Sampaio', 'Teixeira', 'Uchoa', 'Viana'];
var CURSOS_FICTICIOS = ['Engenharia de Produção', 'Engenharia Civil', 'Administração', 'Economia', 'Engenharia Elétrica', 'Ciência da Computação'];

function aleatorioInt_(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function escolher_(lista) { return lista[Math.floor(Math.random() * lista.length)]; }
function normal_() { // Box-Muller
  var u = 1 - Math.random(), v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function exigirEnsaio_() {
  if (modo_() !== 'ENSAIO') {
    throw new Error('Esta ação só funciona no modo ENSAIO (aba Config, chave "modo"). A planilha está em ' + modo_() + '.');
  }
}

/**
 * Gera candidatos, avaliadores e notas fictícias.
 * Notas: cada candidato tem um "nível" e cada avaliador um viés; ~8% "NA",
 * alguns candidatos marcados inteiros como "não posso avaliar", alguns parciais e alguns pendentes.
 */
function gerarDadosFicticios_(nCand, nAval) {
  exigirEnsaio_();
  nCand = Math.max(1, Math.min(200, Number(nCand) || 30));
  nAval = Math.max(1, Math.min(50, Number(nAval) || 12));
  return comTrava_(function () {
    var agora = new Date();
    var idsC = proximosIds_('c', ABAS.CANDIDATOS, nCand);
    var cands = idsC.map(function (id, i) {
      var nome = escolher_(NOMES_FICTICIOS) + ' ' + escolher_(SOBRENOMES_FICTICIOS) + (i % 3 === 0 ? ' ' + escolher_(SOBRENOMES_FICTICIOS) : '');
      var status = i === nCand - 1 && nCand > 5 ? 'FALTOU' : (i === nCand - 2 && nCand > 8 ? 'DESISTIU' : 'ATIVO');
      return {
        id: id, nome_exibicao: nome, nome_normalizado: normalizarNome(nome),
        email: 'candidato.' + id + '@exemplo.com', telefone: '(85) 9' + aleatorioInt_(1000, 9999) + '-' + aleatorioInt_(1000, 9999),
        curso: escolher_(CURSOS_FICTICIOS), semestre: aleatorioInt_(1, 8), foto_url: '', status: status,
        origem: 'manual', importado_em: '', chave_inscricao: '', criado_em: agora, atualizado_em: agora,
      };
    });
    acrescentar_(ABAS.CANDIDATOS, cands);

    var idsA = proximosIds_('a', ABAS.AVALIADORES, nAval);
    var avs = idsA.map(function (id, i) {
      return {
        id: id, nome: 'Avaliador(a) fictício(a) ' + ('0' + (i + 1)).slice(-2), email: 'avaliador.' + id + '@exemplo.com',
        area: escolher_(['Projetos', 'Comercial', 'Gente', 'Financeiro']), token: gerarToken_(), ativo: 'SIM',
        criado_em: agora, ultimo_acesso: '',
      };
    });
    acrescentar_(ABAS.AVALIADORES, avs);

    var crits = criteriosAtivos(lerObjetos_(ABAS.CRITERIOS), lerObjetos_(ABAS.BLOCOS));
    var etapas = lerObjetos_(ABAS.ETAPAS).filter(function (e) { return ehSim_(e.aberta); });
    if (!etapas.length) etapas = lerObjetos_(ABAS.ETAPAS).slice(0, 1);
    var nivel = {};
    cands.forEach(function (c) { nivel[c.id] = 3.2 + 0.8 * normal_(); });
    var linhas = [];
    etapas.forEach(function (et) {
      var critsEt = criteriosDaEtapa(crits, et.id);
      avs.forEach(function (av) {
        var vies = 0.4 * normal_();
        cands.forEach(function (c) {
          var sorte = Math.random();
          if (sorte < 0.15) return;                       // pendente
          var tudoNA = sorte < 0.27;                      // "não posso avaliar este candidato"
          var parcial = !tudoNA && sorte < 0.35;          // só alguns critérios
          critsEt.forEach(function (k, j) {
            if (parcial && j % 2 === 1) return;
            var nota = tudoNA || Math.random() < 0.08 ? 'NA'
              : Math.max(1, Math.min(5, Math.round(nivel[c.id] + vies + 0.7 * normal_())));
            linhas.push({
              chave: [et.id, av.id, c.id, k.id].join('|'), etapa: et.id, avaliador_id: av.id, candidato_id: c.id,
              criterio_id: k.id, nota: nota, atualizado_em: agora, cliente_ts: agora.getTime(),
            });
          });
        });
      });
    });
    acrescentar_(ABAS.AVALIACOES, linhas);
    return { candidatos: cands.length, avaliadores: avs.length, notas: linhas.length };
  });
}

/** Apaga candidatos, avaliadores, inscrições, notas e observações. Mantém a configuração. */
function apagarDados_(zerarContadores) {
  return comTrava_(function () {
    [ABAS.AVALIACOES, ABAS.OBSERVACOES, ABAS.INSCRICOES, ABAS.IMPORTACOES, ABAS.CANDIDATOS, ABAS.AVALIADORES]
      .forEach(function (n) { limparDados_(n); });
    gravarConfig_('em_votacao', '');
    if (zerarContadores) { props_().deleteProperty('seq_c'); props_().deleteProperty('seq_a'); }
    limparCache_();
    return { ok: true };
  });
}

// ------------------- Itens do menu da planilha -------------------

function menuGerarDadosFicticios() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Gerar dados fictícios', 'Quantos candidatos e avaliadores? (ex.: 30,12)', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var partes = String(r.getResponseText() || '30,12').split(/[,;\s]+/);
  var res = gerarDadosFicticios_(partes[0], partes[1]);
  avisar_('Dados fictícios gerados', res.candidatos + ' candidatos, ' + res.avaliadores + ' avaliadores e ' + res.notas + ' notas.');
}

function menuZerarEnsaio() {
  exigirEnsaio_();
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Zerar dados do ensaio', 'Apaga candidatos, avaliadores e notas desta planilha de ENSAIO. Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  apagarDados_(true);
  avisar_('Ensaio zerado', 'Pronto. A configuração e os critérios foram mantidos.');
}

function menuApagarDadosDoProcesso() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Apagar dados do processo', 'Isto apaga TODOS os candidatos, avaliadores, inscrições, notas e observações ' +
    '(modo ' + modo_() + '). Não dá para desfazer.\n\nDigite APAGAR para confirmar:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || String(r.getResponseText()).trim() !== 'APAGAR') {
    avisar_('Cancelado', 'Nada foi apagado.');
    return;
  }
  apagarDados_(modo_() === 'ENSAIO');
  avisar_('Dados apagados', 'Os dados pessoais do processo foram apagados. Lembre de esvaziar a lixeira e o histórico de versões se necessário.');
}

// ===== apps-script/src/50_conferir.js =====
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

// ===== apps-script/src/60_api.js =====
/* =====================================================================
 * API (Web App): o site chama este script via POST com um JSON
 *   { acao: "...", token: "...", dados: {...} }
 * e recebe { ok: true, dados: {...} } ou { ok: false, erro: "...", codigo: "..." }.
 *
 * Segurança:
 *  - toda chamada valida o token NO SERVIDOR;
 *  - token de avaliador só acessa ações "av.*" e só as próprias notas;
 *  - token de admin (guardado nas propriedades do script) acessa tudo;
 *  - avaliador nunca recebe email nem telefone de candidatos.
 * ===================================================================== */

var CACHE_SEG = 300; // 5 minutos
var CHAVES_CACHE = ['pub', 'tokens'];

function limparCache_() {
  try { CacheService.getScriptCache().removeAll(CHAVES_CACHE); } catch (e) { /* sem cache */ }
  props_().setProperty('versao_pub', String(Date.now()));
}

function erroApi_(codigo, mensagem) {
  var e = new Error(mensagem);
  e.codigoApi = codigo;
  return e;
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** GET: só diz se a API está no ar (não devolve dados). */
function doGet() {
  return responder_({ ok: true, dados: { sistema: 'avaliacao-ps', versao: VERSAO_SISTEMA, modo: modo_() } });
}

function doPost(e) {
  var corpo;
  try {
    corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return responder_({ ok: false, codigo: 'JSON', erro: 'Requisição inválida.' });
  }
  try {
    return responder_({ ok: true, dados: executarAcao_(corpo) });
  } catch (err) {
    if (!err.codigoApi) console.error(err && err.stack ? err.stack : err);
    return responder_({ ok: false, codigo: err.codigoApi || 'ERRO', erro: err.message || String(err) });
  }
}

/** Roteador: identifica quem chama e executa a ação permitida. Também usado pelos testes. */
function executarAcao_(corpo) {
  var acao = String(corpo.acao || '');
  var dados = corpo.dados || {};
  if (acao === 'ping') return { versao: VERSAO_SISTEMA, modo: modo_() };

  var quem = identificar_(String(corpo.token || ''));
  if (acao.indexOf('admin.') === 0) {
    if (quem.perfil !== 'admin') throw erroApi_('SEM_PERMISSAO', 'Este link não tem acesso de administrador.');
    var fa = ACOES_ADMIN[acao];
    if (!fa) throw erroApi_('ACAO', 'Ação desconhecida: ' + acao);
    return fa(dados);
  }
  if (acao.indexOf('av.') === 0) {
    if (quem.perfil !== 'avaliador') throw erroApi_('SEM_PERMISSAO', 'Use o seu link pessoal de avaliador.');
    var fv = ACOES_AVALIADOR[acao];
    if (!fv) throw erroApi_('ACAO', 'Ação desconhecida: ' + acao);
    return fv(quem.avaliador, dados);
  }
  throw erroApi_('ACAO', 'Ação desconhecida: ' + acao);
}

function identificar_(token) {
  if (!token || token.length < 20) throw erroApi_('TOKEN_INVALIDO', 'Link inválido. Peça um novo link ao admin.');
  var adm = props_().getProperty('ADMIN_TOKEN');
  if (adm && token === adm) return { perfil: 'admin' };
  var mapa = mapaTokens_();
  var av = mapa[token];
  if (!av) throw erroApi_('TOKEN_INVALIDO', 'Link inválido ou desativado. Peça um novo link ao admin.');
  return { perfil: 'avaliador', avaliador: av };
}

/** token -> {id, nome} só de avaliadores ativos (em cache). */
function mapaTokens_() {
  var cache = CacheService.getScriptCache();
  var txt = cache.get('tokens');
  if (txt) return JSON.parse(txt);
  var mapa = {};
  lerObjetos_(ABAS.AVALIADORES).forEach(function (a) {
    if (a.token && ehSim_(a.ativo)) mapa[a.token] = { id: String(a.id), nome: String(a.nome) };
  });
  cache.put('tokens', JSON.stringify(mapa), CACHE_SEG);
  return mapa;
}

/** Dados "públicos" para avaliadores (sem email/telefone), em cache. */
function pacotePublico_() {
  var cache = CacheService.getScriptCache();
  var txt = cache.get('pub');
  if (txt) return JSON.parse(txt);
  var cfg = lerConfig_();
  var blocos = lerObjetos_(ABAS.BLOCOS).map(limparObj_);
  var criterios = criteriosAtivos(lerObjetos_(ABAS.CRITERIOS).map(limparObj_), blocos).map(function (c) {
    return { id: c.id, bloco: c.bloco, ordem: c.ordem, sigla: c.sigla, nome: c.nome, descricao: c.descricao, etapas: c.etapas };
  });
  var cands = lerObjetos_(ABAS.CANDIDATOS).filter(function (c) { return String(c.status).toUpperCase() === 'ATIVO'; });
  var curtos = nomesParaAvaliador(cands.map(function (c) { return { id: String(c.id), nome: String(c.nome_exibicao) }; }));
  var pub = {
    versao: props_().getProperty('versao_pub') || '0',
    processo: { nome: String(cfg.nome_processo || ''), modo: String(cfg.modo || 'ENSAIO').toUpperCase() },
    avaliacao_aberta: ehSim_(cfg.avaliacao_aberta),
    veem_outros: ehSim_(cfg.avaliadores_veem_notas_dos_outros),
    em_votacao: String(cfg.em_votacao || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
    etapas: lerObjetos_(ABAS.ETAPAS).map(function (e) { return { id: String(e.id), nome: String(e.nome), ordem: Number(e.ordem) || 0, aberta: ehSim_(e.aberta) }; })
      .sort(function (a, b) { return a.ordem - b.ordem; }),
    blocos: blocosAtivos(blocos, criterios).map(function (b) { return { id: b.id, nome: b.nome, nome_curto: b.nome_curto, ordem: b.ordem }; }),
    criterios: criterios,
    candidatos: cands.map(function (c) {
      return { id: String(c.id), nome: String(c.nome_exibicao), nome_curto: curtos[String(c.id)], foto_url: String(c.foto_url || '') };
    }),
  };
  cache.put('pub', JSON.stringify(pub), CACHE_SEG);
  return pub;
}

/** Tira _linha e converte datas em texto ISO (para JSON). */
function limparObj_(o) {
  var r = {};
  Object.keys(o).forEach(function (k) {
    if (k === '_linha') return;
    var v = o[k];
    r[k] = v instanceof Date ? v.toISOString() : v;
  });
  return r;
}

/** Notas da aba Avaliacoes, opcionalmente só de um avaliador. Formato compacto. */
function lerAvaliacoes_(avaliadorId) {
  return lerObjetos_(ABAS.AVALIACOES).filter(function (a) {
    return !avaliadorId || String(a.avaliador_id) === avaliadorId;
  }).map(function (a) {
    var n = a.nota;
    return {
      etapa: String(a.etapa), avaliador_id: String(a.avaliador_id), candidato_id: String(a.candidato_id),
      criterio_id: String(a.criterio_id), nota: typeof n === 'number' ? n : (String(n).toUpperCase() === 'NA' ? 'NA' : ''),
      cliente_ts: Number(a.cliente_ts) || 0,
    };
  });
}

function lerObservacoes_(avaliadorId) {
  return lerObjetos_(ABAS.OBSERVACOES).filter(function (o) {
    return !avaliadorId || String(o.avaliador_id) === avaliadorId;
  }).map(function (o) {
    return { etapa: String(o.etapa), avaliador_id: String(o.avaliador_id), candidato_id: String(o.candidato_id), texto: String(o.texto || ''), cliente_ts: Number(o.cliente_ts) || 0 };
  });
}

/** Registra o último acesso do avaliador (no máximo a cada 5 minutos, para não pesar). */
function registrarAcesso_(av) {
  var cache = CacheService.getScriptCache();
  var k = 'acesso_' + av.id;
  if (cache.get(k)) return;
  cache.put(k, '1', CACHE_SEG);
  var linha = lerObjetos_(ABAS.AVALIADORES).filter(function (a) { return String(a.id) === av.id; })[0];
  if (linha) aba_(ABAS.AVALIADORES).getRange(linha._linha, CABECALHOS[ABAS.AVALIADORES].indexOf('ultimo_acesso') + 1).setValue(new Date());
}

// ===================================================================
// AÇÕES DO AVALIADOR
// ===================================================================

var ACOES_AVALIADOR = {};

/** Abre o app: quem sou eu, critérios, candidatos, minhas notas. */
ACOES_AVALIADOR['av.iniciar'] = function (av) {
  registrarAcesso_(av);
  var pub = pacotePublico_();
  var r = JSON.parse(JSON.stringify(pub));
  r.eu = { id: av.id, nome: av.nome };
  r.minhas = { notas: lerAvaliacoes_(av.id), observacoes: lerObservacoes_(av.id) };
  if (pub.veem_outros) r.colegas = mediasDosColegas_(av.id);
  return r;
};

/** Consulta leve, feita de tempos em tempos: votação atual, etapas abertas e se algo mudou. */
ACOES_AVALIADOR['av.sincronizar'] = function (av) {
  var pub = pacotePublico_();
  return { versao: pub.versao, em_votacao: pub.em_votacao, avaliacao_aberta: pub.avaliacao_aberta, etapas: pub.etapas };
};

/** Média dos colegas por etapa|candidato|critério (só quando a configuração permite). */
function mediasDosColegas_(meuId) {
  var soma = {};
  lerAvaliacoes_().forEach(function (a) {
    if (a.avaliador_id === meuId || typeof a.nota !== 'number') return;
    var k = a.etapa + '|' + a.candidato_id + '|' + a.criterio_id;
    var s = soma[k] || (soma[k] = [0, 0]);
    s[0] += a.nota; s[1]++;
  });
  var r = {};
  Object.keys(soma).forEach(function (k) { r[k] = { media: soma[k][0] / soma[k][1], n: soma[k][1] }; });
  return r;
}

/**
 * Salva notas e observações em lote (upsert pela chave, "vale a mais recente").
 * dados.notas: [{etapa, candidato_id, criterio_id, nota: 1..5 | 'NA' | '', cliente_ts}]
 * dados.observacoes: [{etapa, candidato_id, texto, cliente_ts}]
 * Devolve as chaves salvas e as recusadas (com motivo), para o app limpar a fila.
 */
ACOES_AVALIADOR['av.salvar'] = function (av, dados) {
  var notas = (dados.notas || []).slice(0, 500);
  var obs = (dados.observacoes || []).slice(0, 100);
  var pub = pacotePublico_();
  var etapas = {};
  pub.etapas.forEach(function (e) { etapas[e.id] = e; });
  var cands = {};
  pub.candidatos.forEach(function (c) { cands[c.id] = true; });
  var crits = {};
  pub.criterios.forEach(function (c) { crits[c.id] = c; });

  var salvos = [], recusados = [];
  var validar = function (item, ehNota) {
    var e = etapas[item.etapa];
    if (!e) return 'Etapa inexistente.';
    if (!pub.avaliacao_aberta || !e.aberta) return 'A avaliação desta etapa está fechada.';
    if (!cands[item.candidato_id]) return 'Candidato não está ativo.';
    if (ehNota) {
      var k = crits[item.criterio_id];
      if (!k) return 'Critério inativo.';
      if (criteriosDaEtapa([k], item.etapa).length === 0) return 'Critério não vale nesta etapa.';
      var n = item.nota;
      if (!(n === 'NA' || n === '' || n === null || (typeof n === 'number' && n >= 1 && n <= 5 && Math.floor(n) === n))) return 'Nota inválida.';
    }
    return '';
  };

  var notasOk = [], obsOk = [];
  notas.forEach(function (n) {
    var chave = [n.etapa, av.id, n.candidato_id, n.criterio_id].join('|');
    var motivo = validar(n, true);
    if (motivo) recusados.push({ chave: chave, motivo: motivo });
    else notasOk.push({ chave: chave, etapa: n.etapa, avaliador_id: av.id, candidato_id: n.candidato_id, criterio_id: n.criterio_id,
      nota: n.nota === null ? '' : n.nota, cliente_ts: Number(n.cliente_ts) || Date.now() });
  });
  obs.forEach(function (o) {
    var chave = [o.etapa, av.id, o.candidato_id].join('|');
    var motivo = validar(o, false);
    if (motivo) recusados.push({ chave: 'obs:' + chave, motivo: motivo });
    else obsOk.push({ chave: chave, etapa: o.etapa, avaliador_id: av.id, candidato_id: o.candidato_id,
      texto: String(o.texto || '').slice(0, 2000), cliente_ts: Number(o.cliente_ts) || Date.now() });
  });

  if (notasOk.length || obsOk.length) {
    comTrava_(function () {
      upsert_(ABAS.AVALIACOES, notasOk).forEach(function (k) { salvos.push(k); });
      upsert_(ABAS.OBSERVACOES, obsOk).forEach(function (k) { salvos.push('obs:' + k); });
    });
  }
  registrarAcesso_(av);
  return { salvos: salvos, recusados: recusados, servidor_ts: Date.now() };
};

/**
 * Upsert em lote pela coluna "chave" (coluna A). Se a linha já existe e é mais nova
 * (cliente_ts maior), mantém a existente. Nunca cria linha duplicada.
 * Devolve as chaves tratadas (gravadas ou já atualizadas).
 */
function upsert_(nomeAba, itens) {
  if (!itens.length) return [];
  var sh = aba_(nomeAba);
  var cab = CABECALHOS[nomeAba];
  var colTs = cab.indexOf('cliente_ts') + 1;
  var n = sh.getLastRow() - 1;
  var chaves = n > 0 ? sh.getRange(2, 1, n, 1).getValues() : [];
  var tss = n > 0 ? sh.getRange(2, colTs, n, 1).getValues() : [];
  var indice = {};
  for (var i = 0; i < chaves.length; i++) if (chaves[i][0] !== '') indice[chaves[i][0]] = { linha: i + 2, ts: Number(tss[i][0]) || 0 };

  // Se o mesmo item vier repetido no lote, vale o de maior cliente_ts.
  var ultimo = {};
  itens.forEach(function (it) { if (!ultimo[it.chave] || it.cliente_ts >= ultimo[it.chave].cliente_ts) ultimo[it.chave] = it; });

  var agora = new Date();
  var novos = [], atualizar = [];
  Object.keys(ultimo).forEach(function (k) {
    var it = ultimo[k];
    it.atualizado_em = agora;
    var ex = indice[k];
    if (!ex) novos.push(it);
    else if (it.cliente_ts >= ex.ts) { it._linha = ex.linha; atualizar.push(it); }
  });
  reescrever_(nomeAba, atualizar);
  acrescentar_(nomeAba, novos);
  return Object.keys(ultimo);
}

// ===================================================================
// AÇÕES DO ADMIN
// ===================================================================

var ACOES_ADMIN = {};

ACOES_ADMIN['admin.iniciar'] = function () {
  return {
    versao: VERSAO_SISTEMA,
    planilha_url: planilha_().getUrl ? planilha_().getUrl() : '',
    config: lerConfig_(),
    etapas: lerObjetos_(ABAS.ETAPAS).map(limparObj_),
    blocos: lerObjetos_(ABAS.BLOCOS).map(limparObj_),
    criterios: lerObjetos_(ABAS.CRITERIOS).map(limparObj_),
    avaliadores: lerObjetos_(ABAS.AVALIADORES).map(limparObj_),
    candidatos: lerObjetos_(ABAS.CANDIDATOS).map(limparObj_),
    inscricoes: lerObjetos_(ABAS.INSCRICOES).map(function (i) { return { candidato_id: String(i.candidato_id), hash: String(i.hash_linha) }; }),
    importacoes: lerObjetos_(ABAS.IMPORTACOES).map(limparObj_),
    avaliacoes: lerAvaliacoes_(),
    observacoes: lerObservacoes_(),
  };
};

/** Só as notas e observações (para atualizar o ranking ao vivo sem baixar tudo). */
ACOES_ADMIN['admin.notas'] = function () {
  return { avaliacoes: lerAvaliacoes_(), observacoes: lerObservacoes_(),
    candidatos: lerObjetos_(ABAS.CANDIDATOS).map(function (c) { return { id: String(c.id), status: String(c.status) }; }),
    acessos: lerObjetos_(ABAS.AVALIADORES).map(function (a) { return { id: String(a.id), ultimo_acesso: a.ultimo_acesso instanceof Date ? a.ultimo_acesso.toISOString() : a.ultimo_acesso }; }) };
};

var VALIDA_CONFIG = {
  nome_processo: function (v) { return String(v).trim().slice(0, 80); },
  data_inicio: dataOuVazio_,
  data_fim: dataOuVazio_,
  avaliacao_aberta: simNao_,
  avaliadores_veem_notas_dos_outros: simNao_,
  nota_de_corte: function (v) { return numeroOuVazio_(v, 1, 5); },
  vagas: function (v) { return inteiroOuVazio_(v, 0); },
  min_avaliadores_por_candidato: function (v) { return inteiroOuVazio_(v, 0); },
  limite_divergencia: function (v) { return numeroOuVazio_(v, 0, 4); },
  modo: function (v) {
    var m = String(v).trim().toUpperCase();
    if (m !== 'ENSAIO' && m !== 'PRODUCAO') throw erroApi_('VALIDACAO', 'Modo deve ser ENSAIO ou PRODUCAO.');
    return m;
  },
  url_app: function (v) { return String(v).trim().replace(/\/+$/, ''); },
};

function dataOuVazio_(v) {
  var s = String(v || '').trim();
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw erroApi_('VALIDACAO', 'Use datas no formato AAAA-MM-DD.');
  return s;
}

function simNao_(v) {
  if (v === true) return 'SIM';
  if (v === false) return 'NÃO';
  var s = String(v).trim().toUpperCase();
  if (s === 'SIM') return 'SIM';
  if (s === 'NÃO' || s === 'NAO') return 'NÃO';
  throw erroApi_('VALIDACAO', 'Use SIM ou NÃO.');
}
function numeroOuVazio_(v, min, max) {
  if (v === '' || v === null || v === undefined) return '';
  var n = Number(String(v).replace(',', '.'));
  if (!isFinite(n) || n < min || n > max) throw erroApi_('VALIDACAO', 'Valor fora do intervalo ' + min + ' a ' + max + '.');
  return n;
}
function inteiroOuVazio_(v, min) {
  if (v === '' || v === null || v === undefined) return '';
  var n = Number(v);
  if (!isFinite(n) || n < min || Math.floor(n) !== n) throw erroApi_('VALIDACAO', 'Use um número inteiro.');
  return n;
}

ACOES_ADMIN['admin.salvarConfig'] = function (dados) {
  var valores = dados.config || {};
  comTrava_(function () {
    Object.keys(valores).forEach(function (k) {
      if (!VALIDA_CONFIG[k]) throw erroApi_('VALIDACAO', 'Configuração desconhecida: ' + k);
      gravarConfig_(k, VALIDA_CONFIG[k](valores[k]));
    });
  });
  limparCache_();
  return { config: lerConfig_() };
};

/** Marca quem está "em votação agora" (lista de IDs de candidatos; vazia encerra). */
ACOES_ADMIN['admin.emVotacao'] = function (dados) {
  var ids = (dados.ids || []).map(String).filter(function (s) { return /^c\d+$/.test(s); });
  comTrava_(function () { gravarConfig_('em_votacao', ids.join(',')); });
  limparCache_();
  return { em_votacao: ids };
};

function slug_(txt) {
  return normalizarNome(txt).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'item';
}

/** Salva uma lista de linhas de configuração (etapas, blocos ou critérios) por ID. */
function salvarListaConfig_(nomeAba, lista, normalizar) {
  return comTrava_(function () {
    var existentes = lerObjetos_(nomeAba);
    var porId = {};
    existentes.forEach(function (o) { porId[String(o.id)] = o; });
    var novos = [], atualizar = [];
    lista.forEach(function (item) {
      var o = normalizar(item);
      if (!o.id) throw erroApi_('VALIDACAO', 'Item sem ID.');
      if (porId[o.id]) { o._linha = porId[o.id]._linha; atualizar.push(o); }
      else { novos.push(o); porId[o.id] = o; }
    });
    reescrever_(nomeAba, atualizar);
    acrescentar_(nomeAba, novos);
    limparCache_();
    return lerObjetos_(nomeAba).map(limparObj_);
  });
}

/** Remove linhas de configuração por ID, só se não houver notas ligadas a elas. */
function removerConfig_(nomeAba, ids, colunaNotas) {
  return comTrava_(function () {
    var usados = {};
    lerAvaliacoes_().forEach(function (a) { usados[a[colunaNotas]] = true; });
    var sh = aba_(nomeAba);
    var linhas = lerObjetos_(nomeAba).filter(function (o) { return ids.indexOf(String(o.id)) >= 0; });
    linhas.forEach(function (o) {
      if (usados[String(o.id)]) throw erroApi_('VALIDACAO', '"' + o.id + '" já tem notas. Desative em vez de apagar.');
    });
    linhas.sort(function (a, b) { return b._linha - a._linha; }).forEach(function (o) { sh.deleteRow(o._linha); });
    limparCache_();
    return lerObjetos_(nomeAba).map(limparObj_);
  });
}

ACOES_ADMIN['admin.salvarEtapas'] = function (dados) {
  return { etapas: salvarListaConfig_(ABAS.ETAPAS, dados.lista || [], function (e) {
    var nome = String(e.nome || '').trim();
    if (!nome) throw erroApi_('VALIDACAO', 'Etapa sem nome.');
    return { id: String(e.id || slug_(nome)), nome: nome, ordem: Number(e.ordem) || 1, aberta: simNao_(e.aberta === undefined ? 'SIM' : e.aberta) };
  }) };
};
ACOES_ADMIN['admin.removerEtapas'] = function (dados) {
  var r = removerConfig_(ABAS.ETAPAS, (dados.ids || []).map(String), 'etapa');
  if (!r.length) throw erroApi_('VALIDACAO', 'É preciso ter pelo menos uma etapa.');
  return { etapas: r };
};

ACOES_ADMIN['admin.salvarBlocos'] = function (dados) {
  return { blocos: salvarListaConfig_(ABAS.BLOCOS, dados.lista || [], function (b) {
    var nome = String(b.nome || '').trim();
    if (!nome) throw erroApi_('VALIDACAO', 'Bloco sem nome.');
    return { id: String(b.id || slug_(nome)), nome: nome, nome_curto: String(b.nome_curto || nome).trim().slice(0, 20),
      ordem: Number(b.ordem) || 1, ativo: simNao_(b.ativo === undefined ? 'SIM' : b.ativo) };
  }) };
};

ACOES_ADMIN['admin.salvarCriterios'] = function (dados) {
  var blocos = {};
  lerObjetos_(ABAS.BLOCOS).forEach(function (b) { blocos[String(b.id)] = true; });
  return { criterios: salvarListaConfig_(ABAS.CRITERIOS, dados.lista || [], function (c) {
    var nome = String(c.nome || '').trim();
    if (!nome) throw erroApi_('VALIDACAO', 'Critério sem nome.');
    if (!blocos[String(c.bloco)]) throw erroApi_('VALIDACAO', 'Bloco inexistente: ' + c.bloco);
    var peso = numeroOuVazio_(c.peso === undefined ? 1 : c.peso, 0, 100);
    return {
      id: String(c.id || (c.bloco + '_' + slug_(nome))), bloco: String(c.bloco), ordem: Number(c.ordem) || 1,
      sigla: String(c.sigla || '').trim().slice(0, 3), nome: nome, descricao: String(c.descricao || '').trim(),
      peso: peso === '' ? 1 : peso, ativo: simNao_(c.ativo === undefined ? 'SIM' : c.ativo),
      etapas: String(c.etapas || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).join(','),
    };
  }) };
};
ACOES_ADMIN['admin.removerCriterios'] = function (dados) {
  return { criterios: removerConfig_(ABAS.CRITERIOS, (dados.ids || []).map(String), 'criterio_id') };
};

// ------------------- Avaliadores -------------------

/** Cria ou atualiza avaliadores. Itens sem id são novos (ganham id e token). */
ACOES_ADMIN['admin.salvarAvaliadores'] = function (dados) {
  var lista = dados.lista || [];
  return comTrava_(function () {
    var existentes = lerObjetos_(ABAS.AVALIADORES);
    var porId = {};
    existentes.forEach(function (a) { porId[String(a.id)] = a; });
    var novosItens = lista.filter(function (a) { return !a.id; });
    var ids = proximosIds_('a', ABAS.AVALIADORES, novosItens.length);
    var agora = new Date();
    var novos = novosItens.map(function (a, i) {
      var nome = String(a.nome || '').replace(/\s+/g, ' ').trim();
      if (!nome) throw erroApi_('VALIDACAO', 'Avaliador sem nome.');
      return { id: ids[i], nome: nome, email: normalizarEmail(a.email), area: String(a.area || '').trim(), token: gerarToken_(),
        ativo: 'SIM', criado_em: agora, ultimo_acesso: '' };
    });
    var atualizar = lista.filter(function (a) { return a.id; }).map(function (a) {
      var ex = porId[String(a.id)];
      if (!ex) throw erroApi_('VALIDACAO', 'Avaliador não encontrado: ' + a.id);
      var o = {};
      Object.keys(ex).forEach(function (k) { o[k] = ex[k]; });
      if (a.nome !== undefined) o.nome = String(a.nome).replace(/\s+/g, ' ').trim() || ex.nome;
      if (a.email !== undefined) o.email = normalizarEmail(a.email);
      if (a.area !== undefined) o.area = String(a.area).trim();
      if (a.ativo !== undefined) o.ativo = simNao_(a.ativo);
      return o;
    });
    reescrever_(ABAS.AVALIADORES, atualizar);
    acrescentar_(ABAS.AVALIADORES, novos);
    limparCache_();
    return { avaliadores: lerObjetos_(ABAS.AVALIADORES).map(limparObj_), criados: ids };
  });
};

/** Gera token novo: o link antigo para de funcionar na hora. */
ACOES_ADMIN['admin.regerarToken'] = function (dados) {
  return comTrava_(function () {
    var a = lerObjetos_(ABAS.AVALIADORES).filter(function (x) { return String(x.id) === String(dados.id); })[0];
    if (!a) throw erroApi_('VALIDACAO', 'Avaliador não encontrado.');
    a.token = gerarToken_();
    reescrever_(ABAS.AVALIADORES, [a]);
    limparCache_();
    return { avaliador: limparObj_(a) };
  });
};

// ------------------- Candidatos -------------------

var CAMPOS_CANDIDATO = ['nome_exibicao', 'email', 'telefone', 'curso', 'semestre', 'foto_url'];

function dadosCandidato_(d) {
  var o = {};
  CAMPOS_CANDIDATO.forEach(function (k) {
    if (d[k] === undefined || d[k] === null) return;
    var v = String(d[k]).trim();
    if (k === 'nome_exibicao') v = v.replace(/\s+/g, ' ');
    if (k === 'email') v = normalizarEmail(v);
    o[k] = v;
  });
  return o;
}

/** Cria (sem id) ou edita (com id) candidatos à mão. */
ACOES_ADMIN['admin.salvarCandidatos'] = function (dados) {
  var lista = dados.lista || [];
  return comTrava_(function () {
    var existentes = lerObjetos_(ABAS.CANDIDATOS);
    var porId = {};
    existentes.forEach(function (c) { porId[String(c.id)] = c; });
    var agora = new Date();
    var novosItens = lista.filter(function (c) { return !c.id; });
    var ids = proximosIds_('c', ABAS.CANDIDATOS, novosItens.length);
    var novos = novosItens.map(function (c, i) {
      var d = dadosCandidato_(c);
      if (!d.nome_exibicao) throw erroApi_('VALIDACAO', 'Candidato sem nome.');
      if (d.email && !emailValido(d.email)) throw erroApi_('VALIDACAO', 'Email inválido: ' + d.email);
      d.id = ids[i]; d.nome_normalizado = normalizarNome(d.nome_exibicao); d.status = 'ATIVO'; d.origem = 'manual';
      d.criado_em = agora; d.atualizado_em = agora;
      return d;
    });
    var atualizar = lista.filter(function (c) { return c.id; }).map(function (c) {
      var ex = porId[String(c.id)];
      if (!ex) throw erroApi_('VALIDACAO', 'Candidato não encontrado: ' + c.id);
      var d = dadosCandidato_(c);
      if (d.email && !emailValido(d.email)) throw erroApi_('VALIDACAO', 'Email inválido: ' + d.email);
      Object.keys(d).forEach(function (k) { ex[k] = d[k]; });
      if (!ex.nome_exibicao) throw erroApi_('VALIDACAO', 'Candidato sem nome.');
      if (c.status !== undefined) {
        var st = String(c.status).toUpperCase();
        if (STATUS_CANDIDATO.indexOf(st) < 0) throw erroApi_('VALIDACAO', 'Status inválido: ' + c.status);
        ex.status = st;
      }
      ex.nome_normalizado = normalizarNome(ex.nome_exibicao);
      ex.atualizado_em = agora;
      return ex;
    });
    reescrever_(ABAS.CANDIDATOS, atualizar);
    acrescentar_(ABAS.CANDIDATOS, novos);
    limparCache_();
    return { candidatos: lerObjetos_(ABAS.CANDIDATOS).map(limparObj_), criados: ids };
  });
};

/**
 * Importação já mapeada e revisada no app.
 * dados.lote: {origem: 'arquivo'|'colagem', nome_arquivo}
 * dados.linhas: [{acao: 'criar'|'atualizar'|'ignorar', candidato_id?, forcar?, dados: {nome_exibicao,...}, original: {...}, hash}]
 * Segurança extra: "criar" com um hash já importado é ignorado, a menos que forcar=true ("criar mesmo assim").
 */
ACOES_ADMIN['admin.importarCandidatos'] = function (dados) {
  var linhas = dados.linhas || [];
  var lote = dados.lote || {};
  return comTrava_(function () {
    var agora = new Date();
    var loteId = 'L' + Utilities.formatDate(agora, 'America/Fortaleza', 'yyyyMMdd-HHmmss');
    var cands = lerObjetos_(ABAS.CANDIDATOS);
    var porId = {};
    cands.forEach(function (c) { porId[String(c.id)] = c; });
    var hashes = {};
    lerObjetos_(ABAS.INSCRICOES).forEach(function (i) { hashes[String(i.hash_linha)] = String(i.candidato_id); });

    var criar = linhas.filter(function (l) { return l.acao === 'criar' && (l.forcar || !hashes[l.hash]); });
    var ignoradas = (Number(lote.ignorados_no_app) || 0) + linhas.length - criar.length - linhas.filter(function (l) { return l.acao === 'atualizar'; }).length;
    var ids = proximosIds_('c', ABAS.CANDIDATOS, criar.length);
    var novos = [], inscr = [], atualizados = [];
    criar.forEach(function (l, i) {
      var d = dadosCandidato_(l.dados || {});
      if (!d.nome_exibicao) throw erroApi_('VALIDACAO', 'Linha sem nome na importação.');
      d.id = ids[i]; d.nome_normalizado = normalizarNome(d.nome_exibicao); d.status = 'ATIVO'; d.origem = 'importado';
      d.importado_em = agora; d.chave_inscricao = String(l.hash || ''); d.criado_em = agora; d.atualizado_em = agora;
      novos.push(d);
      inscr.push({ candidato_id: d.id, lote_id: loteId, importado_em: agora, hash_linha: String(l.hash || ''), dados_json: JSON.stringify(l.original || {}) });
    });
    linhas.filter(function (l) { return l.acao === 'atualizar'; }).forEach(function (l) {
      var ex = porId[String(l.candidato_id)];
      if (!ex) throw erroApi_('VALIDACAO', 'Candidato para atualizar não encontrado: ' + l.candidato_id);
      var d = dadosCandidato_(l.dados || {});
      Object.keys(d).forEach(function (k) { if (d[k] !== '' && k !== 'nome_exibicao') ex[k] = d[k]; }); // não apaga o que já existe nem troca o nome editado
      ex.importado_em = agora; ex.atualizado_em = agora;
      atualizados.push(ex);
      inscr.push({ candidato_id: ex.id, lote_id: loteId, importado_em: agora, hash_linha: String(l.hash || ''), dados_json: JSON.stringify(l.original || {}) });
    });
    reescrever_(ABAS.CANDIDATOS, atualizados);
    acrescentar_(ABAS.CANDIDATOS, novos);
    acrescentar_(ABAS.INSCRICOES, inscr);
    acrescentar_(ABAS.IMPORTACOES, [{ lote_id: loteId, em: agora, origem: String(lote.origem || ''), nome_arquivo: String(lote.nome_arquivo || '').slice(0, 120),
      linhas: linhas.length, criados: novos.length, atualizados: atualizados.length, ignorados: ignoradas }]);
    limparCache_();
    return { lote_id: loteId, criados: novos.length, atualizados: atualizados.length, ignorados: ignoradas,
      candidatos: lerObjetos_(ABAS.CANDIDATOS).map(limparObj_),
      inscricoes: lerObjetos_(ABAS.INSCRICOES).map(function (i) { return { candidato_id: String(i.candidato_id), hash: String(i.hash_linha) }; }) };
  });
};

/** Linhas originais da inscrição de um candidato (para consulta do admin). */
ACOES_ADMIN['admin.inscricao'] = function (dados) {
  return { inscricoes: lerObjetos_(ABAS.INSCRICOES).filter(function (i) { return String(i.candidato_id) === String(dados.id); })
    .map(function (i) {
      var d = {};
      try { d = JSON.parse(i.dados_json); } catch (e) { d = { erro: 'JSON inválido' }; }
      return { lote_id: i.lote_id, importado_em: i.importado_em instanceof Date ? i.importado_em.toISOString() : i.importado_em, dados: d };
    }) };
};

// ------------------- Ensaio, conferência e dados -------------------

ACOES_ADMIN['admin.gerarFicticios'] = function (dados) {
  var r = gerarDadosFicticios_(dados.candidatos, dados.avaliadores);
  limparCache_();
  return r;
};
ACOES_ADMIN['admin.zerarEnsaio'] = function () {
  exigirEnsaio_();
  return apagarDados_(true);
};
ACOES_ADMIN['admin.apagarDados'] = function (dados) {
  if (String(dados.confirmacao || '') !== 'APAGAR') throw erroApi_('VALIDACAO', 'Digite APAGAR para confirmar.');
  return apagarDados_(modo_() === 'ENSAIO');
};
ACOES_ADMIN['admin.conferir'] = function () {
  return conferirCalculos_();
};
ACOES_ADMIN['admin.backup'] = function () {
  var r = {};
  Object.keys(CABECALHOS).forEach(function (aba) { r[aba] = lerObjetos_(aba).map(limparObj_); });
  return { gerado_em: new Date().toISOString(), versao: VERSAO_SISTEMA, abas: r };
};

// ===== apps-script/src/90_menu.js =====
/* =====================================================================
 * MENU da planilha ("PS Proativa"), aparece ao abrir a planilha.
 * ===================================================================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('PS Proativa')
    .addItem('Configurar planilha (setup)', 'setup')
    .addItem('Mostrar link do admin', 'mostrarLinkAdmin')
    .addItem('Conferir cálculos', 'menuConferirCalculos')
    .addSeparator()
    .addItem('Ensaio: gerar dados fictícios', 'menuGerarDadosFicticios')
    .addItem('Ensaio: zerar dados', 'menuZerarEnsaio')
    .addSeparator()
    .addItem('Regerar token do admin', 'regerarTokenAdmin')
    .addItem('Apagar dados do processo…', 'menuApagarDadosDoProcesso')
    .addToUi();
}
