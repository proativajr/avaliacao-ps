/* =====================================================================
 * MENU da planilha ("PS Proativa"), aparece ao abrir a planilha.
 * ===================================================================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('PS Proativa')
    .addItem('Configurar planilha (setup)', 'setup')
    .addItem('Mostrar link do admin', 'mostrarLinkAdmin')
    .addItem('Conferir cálculos', 'menuConferirCalculos')
    .addItem('Verificar duplicados', 'menuVerificarDuplicados')
    .addSeparator()
    .addItem('Ensaio: gerar dados fictícios', 'menuGerarDadosFicticios')
    .addItem('Ensaio: zerar dados', 'menuZerarEnsaio')
    .addSeparator()
    .addItem('Resetar processo seletivo…', 'menuResetarProcesso')
    .addItem('Regerar token do admin', 'regerarTokenAdmin')
    .addItem('Apagar dados do processo…', 'menuApagarDadosDoProcesso')
    .addToUi();
}

/** Lista avaliadores (mesmo nome ou email) e candidatos (mesmo email) repetidos. Não apaga nada. */
function menuVerificarDuplicados() {
  var r = listarDuplicados_();
  var linha = function (g) { return '• ' + g.campo + ' "' + g.valor + '": ' + g.ids.map(function (id, i) { return g.nomes[i] + ' (' + id + ')'; }).join(', '); };
  var partes = [];
  if (r.avaliadores.length) partes.push('AVALIADORES\n' + r.avaliadores.map(linha).join('\n'));
  if (r.candidatos.length) partes.push('CANDIDATOS\n' + r.candidatos.map(linha).join('\n'));
  avisar_(partes.length ? 'Duplicados encontrados' : 'Nenhum duplicado',
    partes.length ? partes.join('\n\n') + '\n\nNada foi apagado. Para tirar um avaliador repetido, desative-o no painel do admin.' :
    'Nenhum avaliador com nome ou email repetido e nenhum candidato com email repetido.');
}
