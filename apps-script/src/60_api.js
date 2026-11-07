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

/** Limpa o cache. manterVersao = true para mudanças que a consulta leve já entrega (equipe, votação):
 *  assim os celulares não baixam tudo de novo. */
function limparCache_(manterVersao) {
  try { CacheService.getScriptCache().removeAll(CHAVES_CACHE); } catch (e) { /* sem cache */ }
  if (!manterVersao) props_().setProperty('versao_pub', String(Date.now()));
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
  migrarEsquema_();
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

/** Depois de colar uma versão nova do script: completa cabeçalhos/colunas novas uma única vez (não apaga nada). */
function migrarEsquema_() {
  if (props_().getProperty('versao') === VERSAO_SISTEMA) return;
  comTrava_(function () {
    Object.keys(CABECALHOS).forEach(function (nome) { garantirCabecalho_(nome); });
    preencherPadroes_();
    aplicarMigracoes_();
    props_().setProperty('versao', VERSAO_SISTEMA);
    limparCache_();
  });
}

/** Ajustes de dados de versões novas. Idempotente: pode rodar de novo sem efeito. */
function aplicarMigracoes_() {
  migrarCriterios130_();
  migrarDiretorias_();
  migrarSoPredador140_();
}

/** 1.4.0: desliga o bloco comportamental uma única vez (nada é apagado). Depois disso, vale o que o admin escolher. */
function migrarSoPredador140_() {
  var p = props_();
  if (p.getProperty('mig_so_predador')) return;
  var b = lerObjetos_(ABAS.BLOCOS).filter(function (x) { return String(x.id) === 'comport'; })[0];
  if (b && ehSim_(b.ativo)) { b.ativo = 'NÃO'; reescrever_(ABAS.BLOCOS, [b]); }
  p.setProperty('mig_so_predador', '1');
}

/** 1.3.0: acrescenta o critério Respeito ao bloco comportamental e troca a descrição antiga da Proatividade. */
function migrarCriterios130_() {
  var crits = lerObjetos_(ABAS.CRITERIOS);
  var temBloco = lerObjetos_(ABAS.BLOCOS).some(function (b) { return String(b.id) === 'comport'; });
  var prot = crits.filter(function (c) { return String(c.id) === 'comport_proatividade'; })[0];
  if (prot && String(prot.descricao).trim() === DESCRICAO_PROATIVIDADE_ANTIGA) {
    prot.descricao = DESCRICAO_PROATIVIDADE;
    reescrever_(ABAS.CRITERIOS, [prot]);
  }
  if (!temBloco || crits.some(function (c) { return String(c.id) === CRITERIO_RESPEITO[0]; })) return;
  var o = {};
  CABECALHOS[ABAS.CRITERIOS].forEach(function (k, i) { o[k] = CRITERIO_RESPEITO[i]; });
  var ordens = crits.filter(function (c) { return String(c.bloco) === 'comport'; }).map(function (c) { return Number(c.ordem) || 0; });
  o.ordem = (ordens.length ? Math.max.apply(null, ordens) : 0) + 1;
  acrescentar_(ABAS.CRITERIOS, [o]);
}

/** Área em texto livre -> uma das DIRETORIAS. O que não bater fica vazio e o texto original vai para area_revisar. */
function migrarDiretorias_() {
  var mudar = [];
  lerObjetos_(ABAS.AVALIADORES).forEach(function (a) {
    var txt = String(a.area == null ? '' : a.area).trim();
    if (!txt) return;
    var valida = diretoriaValida(txt);
    if (valida) { if (valida !== a.area || a.area_revisar) { a.area = valida; a.area_revisar = ''; mudar.push(a); } return; }
    var m = mapearDiretoria(txt);
    if (m) { a.area = m; a.area_revisar = ''; } else { a.area_revisar = txt; a.area = ''; }
    mudar.push(a);
  });
  reescrever_(ABAS.AVALIADORES, mudar);
}

/** Diretoria obrigatória e só da lista. Devolve a forma oficial. */
function exigirDiretoria_(valor, nome) {
  var d = diretoriaValida(valor);
  if (!d) throw erroApi_('VALIDACAO', (String(valor || '').trim() ? 'Diretoria inválida para ' : 'Escolha a diretoria de ') + nome +
    '. Opções: ' + DIRETORIAS.join(', ') + '.');
  return d;
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
    em_votacao: listaIds_(cfg.em_votacao),
    dinamica_ativa: String(cfg.dinamica_ativa || ''),
    equipe: equipeAtiva_(cfg),
    equipes_construcao: equipesEmConstrucao_(),
    apresentacao_so_designados: ehSim_(cfg.apresentacao_so_designados),
    // Sem a chave na Config (planilha antiga ainda não migrada), vale o padrão SIM.
    avaliar_so_no_momento: cfg.avaliar_so_no_momento === undefined || ehSim_(cfg.avaliar_so_no_momento),
    // Quem é de qual equipe, com narrador e personas (só vai ao cache; cada avaliador recebe só o seu recorte).
    equipes_designacao: lerEquipes_().map(function (q) {
      return { id: q.id, nome: q.nome, etapa: q.etapa, membros: q.membros, avaliadores: q.avaliadores, narrador: q.narrador, personas: q.personas,
        apresentacao: q.apresentacao };
    }),
    nomes_avaliadores: nomesCurtosAvaliadores_(),
    etapas: lerObjetos_(ABAS.ETAPAS).map(etapaPublica_).sort(function (a, b) { return a.ordem - b.ordem; }),
    blocos: blocosAtivos(blocos, criterios).map(function (b) { return { id: b.id, nome: b.nome, nome_curto: b.nome_curto, ordem: b.ordem }; }),
    criterios: criterios,
    candidatos: cands.map(function (c) {
      return { id: String(c.id), nome: String(c.nome_exibicao), nome_curto: curtos[String(c.id)], foto_url: String(c.foto_url || '') };
    }),
  };
  cache.put('pub', JSON.stringify(pub), CACHE_SEG);
  return pub;
}

/** Etapa no formato do app: com o formato (PALCO ou SALAS) e o nome de cada momento. */
function etapaPublica_(e) {
  return { id: String(e.id), nome: String(e.nome), ordem: Number(e.ordem) || 0, aberta: ehSim_(e.aberta), formato: formatoEtapa_(e.formato),
    nome_construcao: String(e.nome_construcao || '').trim(), nome_apresentacao: String(e.nome_apresentacao || '').trim(), fases: String(e.fases || '').trim() };
}

function formatoEtapa_(v) {
  return String(v || '').trim().toUpperCase() === 'SALAS' ? 'SALAS' : 'PALCO';
}

/** Primeiro nome de cada avaliador (nome e sobrenome quando o primeiro se repete), para mostrar colegas e narrador. */
function nomesCurtosAvaliadores_() {
  var avs = lerObjetos_(ABAS.AVALIADORES).map(function (a) { return { id: String(a.id), nome: String(a.nome) }; });
  return nomesParaAvaliador(avs);
}

/** Na Apresentação desta dinâmica só os designados avaliam? Sempre em SALAS; em PALCO, só com a chave geral ligada. */
function soDesignados_(pub, etapaId) {
  var e = (pub.etapas || []).filter(function (x) { return x.id === etapaId; })[0];
  return !!pub.apresentacao_so_designados || !!(e && e.formato === 'SALAS');
}

function listaIds_(txt) {
  return String(txt || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

/** Equipe em avaliação agora: {id, nome, etapa, membros[]} ou null. */
function equipeAtiva_(cfg) {
  var id = String(cfg.equipe_ativa || '');
  if (!id) return null;
  var e = lerObjetos_(ABAS.EQUIPES).filter(function (x) { return String(x.id) === id; })[0];
  return e ? { id: id, nome: String(e.nome), etapa: String(e.etapa), membros: listaIds_(e.membros) } : null;
}

/** Equipes com a Construção em andamento (com os avaliadores designados). Só vai ao cache; cada avaliador recebe o seu recorte. */
function equipesEmConstrucao_() {
  return lerEquipes_().filter(function (q) { return q.construcao === 'ANDAMENTO'; });
}

/** Recorte para um avaliador: só as equipes em construção em que ele foi designado (sem a lista de designados). */
function construcaoDoAvaliador_(equipes, avId) {
  return (equipes || []).filter(function (q) { return q.avaliadores.indexOf(avId) >= 0; })
    .map(function (q) { return { id: q.id, nome: q.nome, etapa: q.etapa, membros: q.membros }; });
}

/** Dinâmicas em SALAS: equipes com a Apresentação em andamento em que este avaliador foi designado. */
function apresentacaoDoAvaliador_(pub, avId) {
  return (pub.equipes_designacao || []).filter(function (q) {
    var e = (pub.etapas || []).filter(function (x) { return x.id === q.etapa; })[0];
    return e && e.formato === 'SALAS' && q.apresentacao === 'ANDAMENTO' && q.avaliadores.indexOf(avId) >= 0;
  }).map(function (q) { return { id: q.id, nome: q.nome, etapa: q.etapa, membros: q.membros }; });
}

/**
 * Equipes em que este avaliador tem papel (avaliador designado ou narrador), em todas as dinâmicas, com o que o celular mostra:
 * colegas que avaliam junto, narrador da equipe e a persona que ele interpreta (Dinâmica 3).
 */
function papeisDoAvaliador_(pub, avId) {
  var nomes = pub.nomes_avaliadores || {};
  return (pub.equipes_designacao || []).filter(function (q) { return q.avaliadores.indexOf(avId) >= 0 || q.narrador === avId; })
    .map(function (q) {
      var p = PERSONAS_D3[(q.personas || {})[avId]];
      return { id: q.id, nome: q.nome, etapa: q.etapa, papel: q.narrador === avId ? 'narrador' : 'avaliador',
        colegas: q.avaliadores.filter(function (a) { return a !== avId; }).map(function (a) { return nomes[a] || ''; }).filter(Boolean),
        narrador: q.narrador && q.narrador !== avId ? (nomes[q.narrador] || '') : '',
        persona: p ? { nome: p.nome, resumo: p.resumo } : null };
    });
}

/**
 * Com "apresentacao_so_designados" ligado (ou em dinâmicas em SALAS): candidatos que este avaliador NÃO pode avaliar, por dinâmica
 * (os que estão em equipes às quais ele não foi designado). Candidato sem equipe fica livre. Sem a regra: {}.
 */
function foraDaEquipe_(pub, avId) {
  var r = {};
  var minhas = {};
  (pub.equipes_designacao || []).forEach(function (q) {
    if (q.avaliadores.indexOf(avId) >= 0) q.membros.forEach(function (c) { minhas[q.etapa + '|' + c] = true; });
  });
  (pub.equipes_designacao || []).forEach(function (q) {
    if (!soDesignados_(pub, q.etapa) || q.avaliadores.indexOf(avId) >= 0) return;
    q.membros.forEach(function (c) {
      if (minhas[q.etapa + '|' + c]) return;
      (r[q.etapa] = r[q.etapa] || []).push(c);
    });
  });
  return r;
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
      cliente_ts: Number(a.cliente_ts) || 0, momento: momentoDe_(a.momento),
    };
  });
}

/** Linhas antigas (sem a coluna momento) valem como Apresentação. */
function momentoDe_(v) {
  return String(v || '').trim().toLowerCase() === 'construcao' ? 'construcao' : 'apresentacao';
}

function lerObservacoes_(avaliadorId) {
  return lerObjetos_(ABAS.OBSERVACOES).filter(function (o) {
    return !avaliadorId || String(o.avaliador_id) === avaliadorId;
  }).map(function (o) {
    return { etapa: String(o.etapa), avaliador_id: String(o.avaliador_id), candidato_id: String(o.candidato_id), texto: String(o.texto || ''), cliente_ts: Number(o.cliente_ts) || 0, momento: momentoDe_(o.momento) };
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
  r.construcao = construcaoDoAvaliador_(pub.equipes_construcao, av.id);
  r.fora_da_equipe = foraDaEquipe_(pub, av.id);
  r.apresentacao = apresentacaoDoAvaliador_(pub, av.id);
  r.papeis = papeisDoAvaliador_(pub, av.id);
  delete r.equipes_construcao;
  delete r.equipes_designacao;
  delete r.nomes_avaliadores;
  r.eu = { id: av.id, nome: av.nome };
  r.minhas = { notas: lerAvaliacoes_(av.id), observacoes: lerObservacoes_(av.id) };
  if (pub.veem_outros) r.colegas = mediasDosColegas_(av.id);
  return r;
};

/** Consulta leve, feita de tempos em tempos: votação atual, etapas abertas e se algo mudou. */
ACOES_AVALIADOR['av.sincronizar'] = function (av) {
  var pub = pacotePublico_();
  return { versao: pub.versao, em_votacao: pub.em_votacao, avaliacao_aberta: pub.avaliacao_aberta, etapas: pub.etapas,
    dinamica_ativa: pub.dinamica_ativa, equipe: pub.equipe, construcao: construcaoDoAvaliador_(pub.equipes_construcao, av.id),
    apresentacao_so_designados: pub.apresentacao_so_designados, avaliar_so_no_momento: pub.avaliar_so_no_momento,
    fora_da_equipe: foraDaEquipe_(pub, av.id), apresentacao: apresentacaoDoAvaliador_(pub, av.id), papeis: papeisDoAvaliador_(pub, av.id) };
};

/** Média dos colegas por etapa|candidato|critério (só quando a configuração permite). */
function mediasDosColegas_(meuId) {
  var soma = {};
  lerAvaliacoes_().forEach(function (a) {
    if (a.avaliador_id === meuId || typeof a.nota !== 'number' || a.momento === 'construcao') return;
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
  var equipes = null;
  /**
   * Quem pode avaliar o candidato, pelas designações das equipes (não exige o momento aberto, para a fila offline poder enviar depois):
   *  - Construção: só quem foi designado à equipe do candidato;
   *  - Apresentação: todos, a menos que "apresentacao_so_designados" esteja ligado. Aí só os designados à equipe do candidato
   *    (candidato sem equipe nesta dinâmica continua livre, como nas dinâmicas sem equipe).
   */
  var podeAvaliar = function (item) {
    var construcao = item.momento === 'construcao';
    if (!construcao && !soDesignados_(pub, item.etapa)) return true;
    if (!equipes) equipes = lerEquipes_();
    var dele = equipes.filter(function (q) { return q.etapa === item.etapa && q.membros.indexOf(item.candidato_id) >= 0; });
    if (!construcao && !dele.length) return true;
    return dele.some(function (q) { return q.avaliadores.indexOf(av.id) >= 0; });
  };
  /**
   * Com "avaliar_so_no_momento" ligado (padrão): a nota só vale se o admin já liberou o momento da equipe do candidato
   * (Construção ou Apresentação em andamento ou concluída). Concluída também vale, para a fila offline enviar depois
   * o que foi dado durante o momento. Candidato sem equipe nesta dinâmica não tem momento: fica bloqueado.
   */
  var liberado = function (item) {
    if (!pub.avaliar_so_no_momento) return true;
    if (!equipes) equipes = lerEquipes_();
    var campo = item.momento === 'construcao' ? 'construcao' : 'apresentacao';
    return equipes.some(function (q) { return q.etapa === item.etapa && q.membros.indexOf(item.candidato_id) >= 0 && q[campo] !== ''; });
  };
  var validar = function (item, ehNota) {
    var e = etapas[item.etapa];
    if (!e) return 'Etapa inexistente.';
    if (!pub.avaliacao_aberta || !e.aberta) return 'A avaliação desta etapa está fechada.';
    if (!cands[item.candidato_id]) return 'Candidato não está ativo.';
    if (!liberado(item)) return 'A avaliação deste candidato ainda não foi liberada pelo admin.';
    if (!podeAvaliar(item)) return item.momento === 'construcao' ? 'Você não é avaliador desta equipe na construção.'
      : 'Só os avaliadores designados à equipe deste candidato podem avaliá-lo.';
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
    var chave = [n.etapa, av.id, n.candidato_id, n.criterio_id].concat(n.momento === 'construcao' ? ['construcao'] : []).join('|');
    var motivo = validar(n, true);
    if (motivo) recusados.push({ chave: chave, motivo: motivo });
    else notasOk.push({ chave: chave, etapa: n.etapa, avaliador_id: av.id, candidato_id: n.candidato_id, criterio_id: n.criterio_id,
      nota: n.nota === null ? '' : n.nota, cliente_ts: Number(n.cliente_ts) || Date.now(), momento: n.momento === 'construcao' ? 'construcao' : '' });
  });
  obs.forEach(function (o) {
    var chave = [o.etapa, av.id, o.candidato_id].concat(o.momento === 'construcao' ? ['construcao'] : []).join('|');
    var motivo = validar(o, false);
    if (motivo) recusados.push({ chave: 'obs:' + chave, motivo: motivo });
    else obsOk.push({ chave: chave, etapa: o.etapa, avaliador_id: av.id, candidato_id: o.candidato_id,
      texto: String(o.texto || '').slice(0, 2000), cliente_ts: Number(o.cliente_ts) || Date.now(), momento: o.momento === 'construcao' ? 'construcao' : '' });
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
    equipes: lerEquipes_(),
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
  peso_construcao: function (v) { return numeroOuVazio_(v, 0, 10); },
  peso_apresentacao: function (v) { return numeroOuVazio_(v, 0, 10); },
  apresentacao_so_designados: simNao_,
  avaliar_so_no_momento: simNao_,
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
  limparCache_(true);
  return { em_votacao: ids };
};

function lerEquipes_() {
  return lerObjetos_(ABAS.EQUIPES).map(function (e) {
    return { id: String(e.id), etapa: String(e.etapa), nome: String(e.nome), ordem: Number(e.ordem) || 0, membros: listaIds_(e.membros),
      avaliadores: listaIds_(e.avaliadores), construcao: estadoMomento_(e.construcao), apresentacao: estadoMomento_(e.apresentacao),
      narrador: String(e.narrador || '').trim(), personas: lerPersonas_(e.personas) };
  }).sort(function (a, b) { return a.ordem - b.ordem; });
}

/** {id do avaliador: chave da persona}. Texto inválido vira {}. */
function lerPersonas_(txt) {
  try { var o = JSON.parse(String(txt || '') || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}

/** '' (pendente), 'ANDAMENTO' ou 'CONCLUIDO'. */
function estadoMomento_(v) {
  var s = String(v || '').trim().toUpperCase();
  return s === 'ANDAMENTO' || s === 'CONCLUIDO' ? s : '';
}

/** Equipe no formato da planilha (membros e avaliadores viram texto). */
function linhaEquipe_(q) {
  return { id: q.id, etapa: q.etapa, nome: q.nome, ordem: q.ordem, membros: q.membros.join(','), avaliadores: q.avaliadores.join(','),
    construcao: q.construcao, apresentacao: q.apresentacao, narrador: q.narrador || '',
    personas: q.personas && Object.keys(q.personas).length ? JSON.stringify(q.personas) : '' };
}

/**
 * Substitui todas as equipes de uma dinâmica.
 * dados: {etapa, equipes: [{nome, membros: [ids], avaliadores?: [ids]}]}. Um candidato fica em no máximo uma equipe.
 * Sem "avaliadores" no item, mantém os designados atuais da equipe de mesma posição. Os estados dos momentos também são mantidos.
 */
ACOES_ADMIN['admin.salvarEquipes'] = function (dados) {
  var etapa = String(dados.etapa || '');
  return comTrava_(function () {
    if (!lerObjetos_(ABAS.ETAPAS).some(function (e) { return String(e.id) === etapa; })) throw erroApi_('VALIDACAO', 'Dinâmica inexistente.');
    var cands = {};
    lerObjetos_(ABAS.CANDIDATOS).forEach(function (c) { cands[String(c.id)] = true; });
    var avs = {};
    lerObjetos_(ABAS.AVALIADORES).forEach(function (a) { avs[String(a.id)] = true; });
    var atuais = {};
    lerEquipes_().forEach(function (q) { atuais[q.id] = q; });
    var usado = {};
    var novas = (dados.equipes || []).slice(0, 30).map(function (q, i) {
      var membros = (q.membros || []).map(String).filter(function (id) {
        if (!cands[id] || usado[id]) return false;
        usado[id] = true; return true;
      });
      var id = etapa + '_eq' + (i + 1);
      var antiga = atuais[id];
      var avaliadores = q.avaliadores === undefined ? (antiga ? antiga.avaliadores : [])
        : q.avaliadores.map(String).filter(function (a, k, arr) { return avs[a] && arr.indexOf(a) === k; });
      return { id: id, etapa: etapa, nome: String(q.nome || ('Equipe ' + (i + 1))).trim().slice(0, 40), ordem: i + 1, membros: membros,
        avaliadores: avaliadores, construcao: antiga ? antiga.construcao : '', apresentacao: antiga ? antiga.apresentacao : '',
        narrador: antiga ? antiga.narrador : '', personas: antiga ? antiga.personas : {} };
    });
    var outras = lerEquipes_().filter(function (e) { return e.etapa !== etapa; });
    limparDados_(ABAS.EQUIPES);
    acrescentar_(ABAS.EQUIPES, outras.concat(novas).map(linhaEquipe_));
    // Se a equipe ativa deixou de existir ou mudou, atualiza quem está em votação
    var cfg = lerConfig_();
    var ativa = novas.filter(function (q) { return q.id === String(cfg.equipe_ativa); })[0];
    if (ativa) gravarConfig_('em_votacao', ativa.membros.join(','));
    else if (String(cfg.equipe_ativa).indexOf(etapa + '_eq') === 0) { gravarConfig_('equipe_ativa', ''); gravarConfig_('em_votacao', ''); }
    limparCache_(true);
    return { equipes: lerEquipes_(), config: lerConfig_() };
  });
};

/**
 * Designa os avaliadores de UMA equipe (substitui a lista dela, sem tocar em membros, estados nem nas outras equipes).
 * dados: {etapa, equipe: id da equipe, avaliadores: [ids]}. Zero, um ou muitos: não há mínimo nem máximo.
 * Um avaliador pode estar em várias equipes. IDs repetidos contam uma vez; um avaliador inexistente recusa o pedido
 * inteiro (nada é gravado). A gravação é de uma linha só, sob a trava: ou grava tudo, ou nada.
 */
ACOES_ADMIN['admin.designarAvaliadores'] = function (dados) {
  var etapa = String(dados.etapa || '');
  var equipeId = String(dados.equipe || '');
  if (!Array.isArray(dados.avaliadores)) throw erroApi_('VALIDACAO', 'Envie a lista de avaliadores (pode ser vazia).');
  return comTrava_(function () {
    var linha = lerObjetos_(ABAS.EQUIPES).filter(function (e) { return String(e.id) === equipeId && String(e.etapa) === etapa; })[0];
    if (!linha) throw erroApi_('VALIDACAO', 'Equipe inexistente nesta dinâmica. Atualize a página e tente de novo.');
    var existe = {};
    lerObjetos_(ABAS.AVALIADORES).forEach(function (a) { existe[String(a.id)] = true; });
    var ids = [];
    dados.avaliadores.map(String).forEach(function (id) {
      if (!existe[id]) throw erroApi_('VALIDACAO', 'Avaliador não encontrado: ' + id);
      if (ids.indexOf(id) < 0) ids.push(id);
    });
    linha.avaliadores = ids.join(',');
    reescrever_(ABAS.EQUIPES, [linha]);
    limparCache_(true);
    return { equipes: lerEquipes_() };
  });
};

/** Abre a dinâmica (se estiver fechada) e a deixa como a dinâmica ao vivo dos celulares. */
function abrirDinamica_(etapa) {
  var et = lerObjetos_(ABAS.ETAPAS).filter(function (e) { return String(e.id) === etapa; })[0];
  if (!et) throw erroApi_('VALIDACAO', 'Dinâmica inexistente.');
  if (!ehSim_(et.aberta)) aba_(ABAS.ETAPAS).getRange(et._linha, CABECALHOS[ABAS.ETAPAS].indexOf('aberta') + 1).setValue('SIM');
  gravarConfig_('dinamica_ativa', etapa);
}

/** Muda um campo de estado (construcao/apresentacao) de uma equipe na planilha. */
function gravarEstadoEquipe_(equipeId, campo, valor) {
  var linha = lerObjetos_(ABAS.EQUIPES).filter(function (e) { return String(e.id) === equipeId; })[0];
  if (!linha) return;
  linha[campo] = valor;
  reescrever_(ABAS.EQUIPES, [linha]);
}

/**
 * Apresentação ao vivo, controlada pelo admin (uma equipe por vez; todos os avaliadores veem).
 * dados: {etapa, equipe}. etapa = dinâmica que os avaliadores veem (abre ela, se estiver fechada).
 * equipe = ID da equipe em avaliação agora ('' encerra). A equipe que sai fica "concluída" na Apresentação.
 */
ACOES_ADMIN['admin.aoVivo'] = function (dados) {
  var etapa = String(dados.etapa || '');
  var equipeId = String(dados.equipe || '');
  return comTrava_(function () {
    if (!lerObjetos_(ABAS.ETAPAS).some(function (e) { return String(e.id) === etapa; })) throw erroApi_('VALIDACAO', 'Dinâmica inexistente.');
    var membros = '';
    if (equipeId) {
      var q = lerEquipes_().filter(function (x) { return x.id === equipeId && x.etapa === etapa; })[0];
      if (!q) throw erroApi_('VALIDACAO', 'Equipe inexistente nesta dinâmica.');
      membros = q.membros.join(',');
    }
    var anterior = String(lerConfig_().equipe_ativa || '');
    if (anterior && anterior !== equipeId) gravarEstadoEquipe_(anterior, 'apresentacao', 'CONCLUIDO');
    if (equipeId) gravarEstadoEquipe_(equipeId, 'apresentacao', 'ANDAMENTO');
    abrirDinamica_(etapa);
    gravarConfig_('equipe_ativa', equipeId);
    gravarConfig_('em_votacao', membros);
    limparCache_(true);
    return { config: lerConfig_(), etapas: lerObjetos_(ABAS.ETAPAS).map(limparObj_), equipes: lerEquipes_() };
  });
};

/**
 * Construção: várias equipes podem estar em andamento ao mesmo tempo; só os avaliadores designados à equipe a veem.
 * dados: {etapa, equipe, estado: 'ANDAMENTO' | 'CONCLUIDO' | ''}. Para começar, a equipe precisa ter ao menos um avaliador.
 */
ACOES_ADMIN['admin.construcao'] = function (dados) {
  var etapa = String(dados.etapa || '');
  var equipeId = String(dados.equipe || '');
  var estado = estadoMomento_(dados.estado);
  return comTrava_(function () {
    var q = lerEquipes_().filter(function (x) { return x.id === equipeId && x.etapa === etapa; })[0];
    if (!q) throw erroApi_('VALIDACAO', 'Equipe inexistente nesta dinâmica.');
    if (estado === 'ANDAMENTO') {
      if (!q.avaliadores.length) throw erroApi_('VALIDACAO', 'Escolha ao menos um avaliador para acompanhar a construção desta equipe.');
      abrirDinamica_(etapa);
    }
    gravarEstadoEquipe_(equipeId, 'construcao', estado);
    limparCache_(true);
    return { config: lerConfig_(), etapas: lerObjetos_(ABAS.ETAPAS).map(limparObj_), equipes: lerEquipes_() };
  });
};

/**
 * Dinâmicas em SALAS: libera ou encerra a Apresentação de UMA equipe (várias podem estar em andamento ao mesmo tempo).
 * Só os avaliadores designados à equipe avaliam. Ao começar a Apresentação, a Construção da equipe fica concluída.
 * dados: {etapa, equipe, estado: 'ANDAMENTO' | 'CONCLUIDO' | ''}.
 */
ACOES_ADMIN['admin.apresentacao'] = function (dados) {
  var etapa = String(dados.etapa || '');
  var equipeId = String(dados.equipe || '');
  var estado = estadoMomento_(dados.estado);
  return comTrava_(function () {
    var q = lerEquipes_().filter(function (x) { return x.id === equipeId && x.etapa === etapa; })[0];
    if (!q) throw erroApi_('VALIDACAO', 'Equipe inexistente nesta dinâmica.');
    if (estado === 'ANDAMENTO') {
      if (!q.avaliadores.length) throw erroApi_('VALIDACAO', 'Escolha ao menos um avaliador para esta equipe antes de começar.');
      abrirDinamica_(etapa);
      if (q.construcao === 'ANDAMENTO') gravarEstadoEquipe_(equipeId, 'construcao', 'CONCLUIDO');
    }
    gravarEstadoEquipe_(equipeId, 'apresentacao', estado);
    limparCache_(true);
    return { config: lerConfig_(), etapas: lerObjetos_(ABAS.ETAPAS).map(limparObj_), equipes: lerEquipes_() };
  });
};

/**
 * Comanda todas as equipes de uma dinâmica de uma vez.
 * dados: {etapa, momento: 'construcao' | 'apresentacao', estado: 'ANDAMENTO' | 'CONCLUIDO'}.
 * Equipes sem candidatos ficam de fora. Para começar, a equipe precisa de avaliador: as que não têm são puladas e devolvidas
 * em "puladas". Começar a Apresentação conclui a Construção que estiver em andamento. Encerrar só mexe em quem estava em andamento.
 */
ACOES_ADMIN['admin.momentoTodas'] = function (dados) {
  var etapa = String(dados.etapa || '');
  var momento = dados.momento === 'construcao' ? 'construcao' : 'apresentacao';
  var estado = estadoMomento_(dados.estado);
  if (estado !== 'ANDAMENTO' && estado !== 'CONCLUIDO') throw erroApi_('VALIDACAO', 'Estado inválido.');
  return comTrava_(function () {
    if (!lerObjetos_(ABAS.ETAPAS).some(function (e) { return String(e.id) === etapa; })) throw erroApi_('VALIDACAO', 'Dinâmica inexistente.');
    var linhas = lerObjetos_(ABAS.EQUIPES).filter(function (e) { return String(e.etapa) === etapa; });
    var mudar = [], puladas = [];
    linhas.forEach(function (l) {
      if (!listaIds_(l.membros).length) return;
      var atual = estadoMomento_(l[momento]);
      if (estado === 'ANDAMENTO') {
        if (atual === 'ANDAMENTO') return;
        if (!listaIds_(l.avaliadores).length) { puladas.push(String(l.nome)); return; }
        l[momento] = 'ANDAMENTO';
        if (momento === 'apresentacao' && estadoMomento_(l.construcao) === 'ANDAMENTO') l.construcao = 'CONCLUIDO';
        mudar.push(l);
      } else if (atual === 'ANDAMENTO') { l[momento] = 'CONCLUIDO'; mudar.push(l); }
    });
    if (estado === 'ANDAMENTO' && mudar.length) abrirDinamica_(etapa);
    reescrever_(ABAS.EQUIPES, mudar);
    limparCache_(true);
    return { config: lerConfig_(), etapas: lerObjetos_(ABAS.ETAPAS).map(limparObj_), equipes: lerEquipes_(), mudadas: mudar.length, puladas: puladas };
  });
};

/**
 * Roteiro do Manual do Avaliador: as 5 dinâmicas, com grupos, avaliadores, narradores e personas.
 * dados.escolhas: {nome do manual: id do avaliador ou '' (deixar de fora)}. Sem "gravar", só devolve a prévia:
 * para cada nome do manual, quem casou no cadastro (ou as opções, quando não casou ou casou com mais de um).
 * Com "gravar": cria ou atualiza as dinâmicas (em SALAS, abertas) e substitui as equipes delas, mantendo os candidatos de
 * cada equipe pela posição e os estados dos momentos. Equipes a mais de antes deixam de existir (os candidatos ficam sem equipe).
 */
ACOES_ADMIN['admin.roteiroManual'] = function (dados) {
  var escolhas = dados.escolhas || {};
  var avs = lerObjetos_(ABAS.AVALIADORES).filter(function (a) { return ehSim_(a.ativo); })
    .map(function (a) { return { id: String(a.id), nome: String(a.nome) }; });
  var porId = {};
  avs.forEach(function (a) { porId[a.id] = a; });
  var casamento = nomesDoRoteiro().map(function (n) {
    var ids = casarNomeRoteiro(n, avs);
    var escolhido = escolhas[n] !== undefined ? String(escolhas[n] || '') : (ids.length === 1 ? ids[0] : '');
    if (escolhido && !porId[escolhido]) escolhido = '';
    return { nome: n, achados: ids, id: escolhido, cadastro: escolhido ? porId[escolhido].nome : '' };
  });
  var dinamicas = ROTEIRO_MANUAL.map(function (d) {
    return { id: d.id, nome: d.nome, grupos: d.grupos.length, grupo: d.grupo, nome_construcao: d.nome_construcao,
      nome_apresentacao: d.nome_apresentacao, fases: d.fases };
  });
  if (!dados.gravar) return { casamento: casamento, dinamicas: dinamicas };

  var idDe = {};
  casamento.forEach(function (c) { idDe[c.nome] = c.id; });
  return comTrava_(function () { return emTransacao_([ABAS.ETAPAS, ABAS.EQUIPES], ['equipe_ativa', 'em_votacao'], function () {
    var etapas = lerObjetos_(ABAS.ETAPAS);
    var etapaPorId = {};
    etapas.forEach(function (e) { etapaPorId[String(e.id)] = e; });
    var novasEt = [], mudarEt = [];
    ROTEIRO_MANUAL.forEach(function (d, i) {
      var o = { id: d.id, nome: d.nome, ordem: i + 1, aberta: 'SIM', formato: 'SALAS', nome_construcao: d.nome_construcao,
        nome_apresentacao: d.nome_apresentacao, fases: d.fases };
      var a = etapaPorId[d.id];
      if (a) { o._linha = a._linha; o.aberta = a.aberta || 'SIM'; mudarEt.push(o); } else novasEt.push(o);
    });
    reescrever_(ABAS.ETAPAS, mudarEt);
    acrescentar_(ABAS.ETAPAS, novasEt);

    var ids = ROTEIRO_MANUAL.map(function (d) { return d.id; });
    var antigas = {};
    var outras = lerEquipes_().filter(function (q) {
      if (ids.indexOf(q.etapa) < 0) return true;
      antigas[q.id] = q; return false;
    });
    var novas = [];
    ROTEIRO_MANUAL.forEach(function (d) {
      d.grupos.forEach(function (g, i) {
        var id = d.id + '_eq' + (i + 1);
        var a = antigas[id];
        var avIds = [], personas = {};
        g.avaliadores.forEach(function (n) {
          var av = idDe[n];
          if (!av || avIds.indexOf(av) >= 0) return;
          avIds.push(av);
          if (g.persona) personas[av] = g.persona;
        });
        novas.push({ id: id, etapa: d.id, nome: d.grupo + ' ' + (i + 1), ordem: i + 1, membros: a ? a.membros : [], avaliadores: avIds,
          construcao: a ? a.construcao : '', apresentacao: a ? a.apresentacao : '', narrador: g.narrador ? (idDe[g.narrador] || '') : '',
          personas: personas });
      });
    });
    limparDados_(ABAS.EQUIPES);
    acrescentar_(ABAS.EQUIPES, outras.concat(novas).map(linhaEquipe_));
    var cfg = lerConfig_();
    if (String(cfg.equipe_ativa) && !lerEquipes_().some(function (q) { return q.id === String(cfg.equipe_ativa); })) {
      gravarConfig_('equipe_ativa', ''); gravarConfig_('em_votacao', '');
    }
    limparCache_();
    return { casamento: casamento, dinamicas: dinamicas, etapas: lerObjetos_(ABAS.ETAPAS).map(limparObj_), equipes: lerEquipes_(), config: lerConfig_() };
  }); });
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
  var atuais = {};
  lerObjetos_(ABAS.ETAPAS).forEach(function (e) { atuais[String(e.id)] = e; });
  return { etapas: salvarListaConfig_(ABAS.ETAPAS, dados.lista || [], function (e) {
    var nome = String(e.nome || '').trim();
    if (!nome) throw erroApi_('VALIDACAO', 'Etapa sem nome.');
    var id = String(e.id || slug_(nome));
    var a = atuais[id] || {};
    // Campo ausente no pedido mantém o que está na planilha (telas antigas não conhecem formato nem nomes dos momentos).
    var manter = function (k) { return String((e[k] !== undefined ? e[k] : a[k]) || '').trim().slice(0, 120); };
    return { id: id, nome: nome, ordem: Number(e.ordem) || 1, aberta: simNao_(e.aberta === undefined ? 'SIM' : e.aberta),
      formato: e.formato !== undefined || a.formato ? formatoEtapa_(manter('formato')) : '',
      nome_construcao: manter('nome_construcao').slice(0, 40), nome_apresentacao: manter('nome_apresentacao').slice(0, 40), fases: manter('fases') };
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

/** Índice de avaliadores por nome normalizado e por email, para recusar repetidos. */
function indiceAvaliadores_(lista) {
  var ind = { nome: {}, email: {} };
  lista.forEach(function (a) { marcarAvaliador_(ind, a); });
  return ind;
}
function marcarAvaliador_(ind, a) {
  var n = normalizarNome(a.nome), e = normalizarEmail(a.email);
  if (n && !ind.nome[n]) ind.nome[n] = a;
  if (e && !ind.email[e]) ind.email[e] = a;
}
/** O avaliador já cadastrado (outro id) com o mesmo nome ou email, ou null. */
function avaliadorRepetido_(ind, nome, email, idProprio) {
  var n = normalizarNome(nome), e = normalizarEmail(email);
  var porNome = n && ind.nome[n], porEmail = e && ind.email[e];
  if (porNome && String(porNome.id) !== String(idProprio || '')) return { campo: 'nome', a: porNome };
  if (porEmail && String(porEmail.id) !== String(idProprio || '')) return { campo: 'email', a: porEmail };
  return null;
}
function mensagemRepetido_(r) {
  var a = r.a;
  return 'Já existe um avaliador com este ' + r.campo + ': ' + a.nome + (a.id ? ' (' + a.id + ')' : '') +
    (a.ativo && !ehSim_(a.ativo) ? '. Ele está desativado: use Reativar.' : '.');
}

/**
 * Cria ou atualiza avaliadores. Itens sem id são novos (ganham id e token).
 * Nome (sem acento e caixa) e email são únicos: um novo igual a um existente, ativo ou desativado, é recusado com
 * código CONFLITO e nada é gravado. Com dados.pularRepetidos (colar lista), os repetidos são pulados e devolvidos
 * em "repetidos", e o resto é gravado. Na edição, só o nome ou email que mudou é conferido, para não travar
 * a edição de duplicados antigos.
 */
ACOES_ADMIN['admin.salvarAvaliadores'] = function (dados) {
  var lista = dados.lista || [];
  var pular = !!dados.pularRepetidos;
  return comTrava_(function () {
    var existentes = lerObjetos_(ABAS.AVALIADORES);
    var porId = {};
    existentes.forEach(function (a) { porId[String(a.id)] = a; });
    var ind = indiceAvaliadores_(existentes);
    var repetidos = [];
    var atualizar = lista.filter(function (a) { return a.id; }).map(function (a) {
      var ex = porId[String(a.id)];
      if (!ex) throw erroApi_('VALIDACAO', 'Avaliador não encontrado: ' + a.id);
      var o = {};
      Object.keys(ex).forEach(function (k) { o[k] = ex[k]; });
      if (a.nome !== undefined) o.nome = String(a.nome).replace(/\s+/g, ' ').trim() || ex.nome;
      if (a.email !== undefined) o.email = normalizarEmail(a.email);
      if (a.area !== undefined) { o.area = exigirDiretoria_(a.area, o.nome); o.area_revisar = ''; }
      if (a.ativo !== undefined) o.ativo = simNao_(a.ativo);
      var mudouNome = normalizarNome(o.nome) !== normalizarNome(ex.nome);
      var mudouEmail = normalizarEmail(o.email) !== normalizarEmail(ex.email);
      var r = avaliadorRepetido_(ind, mudouNome ? o.nome : '', mudouEmail ? o.email : '', o.id);
      if (r) throw erroApi_('CONFLITO', mensagemRepetido_(r));
      return o;
    });
    var novosItens = [];
    lista.filter(function (a) { return !a.id; }).forEach(function (a) {
      var nome = String(a.nome || '').replace(/\s+/g, ' ').trim();
      if (!nome) throw erroApi_('VALIDACAO', 'Avaliador sem nome.');
      var r = avaliadorRepetido_(ind, nome, a.email, '');
      if (r) {
        if (!pular) throw erroApi_('CONFLITO', mensagemRepetido_(r));
        repetidos.push({ nome: nome, campo: r.campo, existente: { id: String(r.a.id || ''), nome: r.a.nome } });
        return;
      }
      var item = { nome: nome, email: normalizarEmail(a.email), area: exigirDiretoria_(a.area, nome) };
      marcarAvaliador_(ind, item); // o mesmo nome duas vezes no mesmo pedido também conta
      novosItens.push(item);
    });
    var ids = proximosIds_('a', ABAS.AVALIADORES, novosItens.length);
    var agora = new Date();
    var novos = novosItens.map(function (a, i) {
      return { id: ids[i], nome: a.nome, email: a.email, area: a.area, token: gerarToken_(),
        ativo: 'SIM', criado_em: agora, ultimo_acesso: '', area_revisar: '' };
    });
    reescrever_(ABAS.AVALIADORES, atualizar);
    acrescentar_(ABAS.AVALIADORES, novos);
    limparCache_();
    return { avaliadores: lerObjetos_(ABAS.AVALIADORES).map(limparObj_), criados: ids, repetidos: repetidos };
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

/** Cria (sem id) ou edita (com id) candidatos à mão. Email é único (CONFLITO se repetir); nome igual é permitido. */
ACOES_ADMIN['admin.salvarCandidatos'] = function (dados) {
  var lista = dados.lista || [];
  return comTrava_(function () {
    var existentes = lerObjetos_(ABAS.CANDIDATOS);
    var porId = {};
    existentes.forEach(function (c) { porId[String(c.id)] = c; });
    var agora = new Date();
    var novosItens = lista.filter(function (c) { return !c.id; });
    var ids = proximosIds_('c', ABAS.CANDIDATOS, novosItens.length);
    var porEmail = {};
    existentes.forEach(function (c) { var e = normalizarEmail(c.email); if (e && !porEmail[e]) porEmail[e] = c; });
    var emailRepetido = function (email, idProprio) {
      var c = email && porEmail[normalizarEmail(email)];
      if (c && String(c.id) !== String(idProprio || ''))
        throw erroApi_('CONFLITO', 'Já existe um candidato com este email: ' + c.nome_exibicao + ' (' + c.id + ').');
    };
    var novos = novosItens.map(function (c, i) {
      var d = dadosCandidato_(c);
      if (!d.nome_exibicao) throw erroApi_('VALIDACAO', 'Candidato sem nome.');
      if (d.email && !emailValido(d.email)) throw erroApi_('VALIDACAO', 'Email inválido: ' + d.email);
      emailRepetido(d.email, '');
      if (d.email) porEmail[d.email] = { id: ids[i], nome_exibicao: d.nome_exibicao }; // repetido no mesmo pedido
      d.id = ids[i]; d.nome_normalizado = normalizarNome(d.nome_exibicao); d.status = 'ATIVO'; d.origem = 'manual';
      d.criado_em = agora; d.atualizado_em = agora;
      return d;
    });
    var atualizar = lista.filter(function (c) { return c.id; }).map(function (c) {
      var ex = porId[String(c.id)];
      if (!ex) throw erroApi_('VALIDACAO', 'Candidato não encontrado: ' + c.id);
      var d = dadosCandidato_(c);
      if (d.email && !emailValido(d.email)) throw erroApi_('VALIDACAO', 'Email inválido: ' + d.email);
      if (d.email !== undefined && d.email !== normalizarEmail(ex.email)) emailRepetido(d.email, ex.id);
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
  var envio = String(dados.envio || '').slice(0, 64);
  return comTrava_(function () {
    // O mesmo envio chegando de novo (clique duplo, nova tentativa depois de erro de rede): devolve o primeiro resultado
    var jaFeito = envio && lerObjetos_(ABAS.IMPORTACOES).filter(function (i) { return String(i.envio) === envio; })[0];
    if (jaFeito) return resultadoImportacao_(String(jaFeito.lote_id), Number(jaFeito.criados) || 0, Number(jaFeito.atualizados) || 0, Number(jaFeito.ignorados) || 0, true);
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
      linhas: linhas.length, criados: novos.length, atualizados: atualizados.length, ignorados: ignoradas, envio: envio }]);
    limparCache_();
    return resultadoImportacao_(loteId, novos.length, atualizados.length, ignoradas, false);
  });
};

function resultadoImportacao_(loteId, criados, atualizados, ignorados, repetido) {
  return { lote_id: loteId, criados: criados, atualizados: atualizados, ignorados: ignorados, repetido: repetido,
    candidatos: lerObjetos_(ABAS.CANDIDATOS).map(limparObj_),
    inscricoes: lerObjetos_(ABAS.INSCRICOES).map(function (i) { return { candidato_id: String(i.candidato_id), hash: String(i.hash_linha) }; }) };
}

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
/** Avaliadores (mesmo nome ou email) e candidatos (mesmo email) repetidos. Só lista, não apaga nada. */
ACOES_ADMIN['admin.duplicados'] = function () {
  return listarDuplicados_();
};
function listarDuplicados_() {
  var avs = lerObjetos_(ABAS.AVALIADORES), cands = lerObjetos_(ABAS.CANDIDATOS);
  var g = duplicadosCadastro(avs, cands);
  var nomeAv = {}, nomeCand = {};
  avs.forEach(function (a) { nomeAv[String(a.id)] = a.nome + (ehSim_(a.ativo) ? '' : ' [desativado]'); });
  cands.forEach(function (c) { nomeCand[String(c.id)] = c.nome_exibicao; });
  var com = function (grupos, nomes) { return grupos.map(function (x) { return { campo: x.campo, valor: x.valor, ids: x.ids, nomes: x.ids.map(function (id) { return nomes[id] || id; }) }; }); };
  return { avaliadores: com(g.avaliadores, nomeAv), candidatos: com(g.candidatos, nomeCand) };
}

/** O que o reset apaga e mantém (para a confirmação). */
ACOES_ADMIN['admin.resumoReset'] = function () {
  return resumoReset_();
};
/** Reset do processo seletivo (ver resetarProcesso_). Exige dados.confirmacao = 'RESETAR'. */
ACOES_ADMIN['admin.resetarProcesso'] = function (dados) {
  if (String(dados.confirmacao || '').trim() !== 'RESETAR') throw erroApi_('VALIDACAO', 'Digite RESETAR para confirmar.');
  return resetarProcesso_();
};
ACOES_ADMIN['admin.conferir'] = function () {
  return conferirCalculos_();
};
ACOES_ADMIN['admin.backup'] = function () {
  var r = {};
  Object.keys(CABECALHOS).forEach(function (aba) { r[aba] = lerObjetos_(aba).map(limparObj_); });
  return { gerado_em: new Date().toISOString(), versao: VERSAO_SISTEMA, abas: r };
};
