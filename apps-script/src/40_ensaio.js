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
