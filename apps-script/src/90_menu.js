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
