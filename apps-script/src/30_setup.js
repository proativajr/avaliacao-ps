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
    sh.getRange(d[1]).setDataValidation(regra).setValue(escolhas[d[0] + d[1]])
      .setBackground('#fff8e1').setFontWeight('bold');
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
