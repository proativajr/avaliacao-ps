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
  lerObjetos_(ABAS.CONFIG).forEach(function (o) { cfg[String(o.chave).trim()] = o.valor; });
  return cfg;
}

/** Grava um valor na aba Config (cria a chave se não existir). */
function gravarConfig_(chave, valor) {
  var linhas = lerObjetos_(ABAS.CONFIG);
  var achou = linhas.filter(function (o) { return o.chave === chave; })[0];
  if (achou) aba_(ABAS.CONFIG).getRange(achou._linha, 2).setValue(valor);
  else acrescentar_(ABAS.CONFIG, [{ chave: chave, valor: valor, descricao: '' }]);
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
