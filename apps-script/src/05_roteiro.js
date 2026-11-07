/* =====================================================================
 * ROTEIRO DO MANUAL DO AVALIADOR (PS 2026.2): as 5 dinâmicas, os grupos e quem avalia cada um.
 * Fonte: "Manual do Avaliador Processo Seletivo 2026.2", seções Dinâmicas e alocações e Material de apoio.
 * Os nomes dos avaliadores são os do manual. O admin confere o casamento com o cadastro antes de gravar.
 * ===================================================================== */

/* As personas da Dinâmica 3 (PERSONAS_D3) ficam em shared/texto.js: o app e o script usam as mesmas. */

/**
 * Cada dinâmica: id (a 1ª reaproveita a "geral" criada pelo setup), nome, nomes dos dois momentos avaliados,
 * fases do manual (só informativo) e grupos. Grupo: [avaliadores], narrador opcional, persona opcional (por avaliador).
 */
var ROTEIRO_MANUAL = [
  {
    id: 'geral', nome: 'Mapeamento às cegas', nome_construcao: 'Mapeamento', nome_apresentacao: 'Apresentação e perguntas',
    fases: 'Visão geral 3 min, Mapeamento 12 min, Apresentação 5 min, Perguntas 4 min', grupo: 'Grupo',
    grupos: [
      { avaliadores: ['Lyara', 'Gabriella', 'Samuel'], narrador: 'Nilo' },
      { avaliadores: ['João Pedro', 'Lucca', 'Gisele'], narrador: 'Levi' },
      { avaliadores: ['Luiza', 'Cibele', 'Samira'], narrador: 'Eduarda' },
      { avaliadores: ['José Carlos', 'Mário', 'Maria Alice'], narrador: 'João Gabriel' },
    ],
  },
  {
    id: 'd2', nome: 'Gestão da qualidade na prática', nome_construcao: 'Construção', nome_apresentacao: 'Apresentação e perguntas',
    fases: 'Construção 15 min, Apresentação 6 min, Perguntas 8 min', grupo: 'Grupo',
    grupos: [
      { avaliadores: ['Samira', 'Gabriella', 'Matheus S.'] },
      { avaliadores: ['Luiza', 'Mário', 'João Gabriel'] },
      { avaliadores: ['Cibele', 'Maria Alice', 'Nilo'] },
      { avaliadores: ['João Pedro', 'Gisele', 'Eduarda'] },
      { avaliadores: ['José Carlos', 'Samuel', 'Lyara'] },
      { avaliadores: ['Lucca', 'Levi', 'Ana Tereza'] },
    ],
  },
  {
    id: 'd3', nome: 'Lidando com clientes', nome_construcao: 'Preparação', nome_apresentacao: 'Reunião com o cliente',
    fases: 'Construção 7 min, Apresentação 10 min, Feedbacks 5 min', grupo: 'Trio',
    grupos: [
      { avaliadores: ['Gabriella'], persona: 'sabe_tudo' },
      { avaliadores: ['Maria Alice'], persona: 'comparativo' },
      { avaliadores: ['João Pedro'], persona: 'cancelar' },
      { avaliadores: ['José Carlos'], persona: 'culpa' },
      { avaliadores: ['Cibele'], persona: 'cancelar' },
      { avaliadores: ['Samira'], persona: 'comparativo' },
      { avaliadores: ['Lucca'], persona: 'nao_sabe' },
      { avaliadores: ['Gisele'], persona: 'testa' },
      { avaliadores: ['Mário'], persona: 'nao_sabe' },
    ],
  },
  {
    id: 'd4', nome: 'Laranjas Ugli', nome_construcao: 'Construção e reformulação', nome_apresentacao: 'Negociações',
    fases: 'Construção 15 min, Negociação 15 min, Reformulação 5 min, Negociação final 10 min, Feedbacks 5 min', grupo: 'Grupo',
    grupos: [
      { avaliadores: ['Cibele', 'Samuel', 'João Gabriel'] },
      { avaliadores: ['Maria Alice', 'Samira', 'Matheus S.'] },
      { avaliadores: ['Gabriella', 'Lucca', 'Eduarda'] },
      { avaliadores: ['Luiza', 'Gisele', 'Levi'] },
      { avaliadores: ['José Carlos', 'João Pedro', 'Nilo'] },
    ],
  },
  {
    id: 'd5', nome: 'Feedbacks', nome_construcao: 'Feedback da equipe', nome_apresentacao: 'Feedback do avaliador',
    fases: 'Feedback da equipe 7 min, Feedback do avaliador 10 min', grupo: 'Trio',
    grupos: [
      { avaliadores: ['Samuel', 'Maria Alice'] },
      { avaliadores: ['Cibele', 'Samira'] },
      { avaliadores: ['Gabriella', 'Luiza'] },
      { avaliadores: ['Lucca', 'José Carlos'] },
      { avaliadores: ['Gisele', 'Mário'] },
      { avaliadores: ['João Pedro', 'Levi'] },
      { avaliadores: ['Eduarda', 'Lyara'] },
      { avaliadores: ['Nilo', 'João Gabriel'] },
      { avaliadores: ['Matheus S.', 'Ana Tereza'] },
    ],
  },
];

/** Todos os nomes do manual (avaliadores e narradores), sem repetição, na ordem em que aparecem. */
function nomesDoRoteiro() {
  var vistos = {}, r = [];
  ROTEIRO_MANUAL.forEach(function (d) {
    d.grupos.forEach(function (g) {
      g.avaliadores.concat(g.narrador ? [g.narrador] : []).forEach(function (n) { if (!vistos[n]) { vistos[n] = true; r.push(n); } });
    });
  });
  return r;
}

/**
 * Acha no cadastro os avaliadores com este nome do manual. O primeiro nome tem de ser igual e cada palavra seguinte
 * do manual tem de começar uma palavra seguinte do cadastro ("Matheus S." casa com "Matheus Sales").
 * Assim "Nilo" não casa com "Lucca Nilo". Devolve os IDs (0, 1 ou mais).
 */
function casarNomeRoteiro(nomeManual, avaliadores) {
  var partes = function (t) { return normalizarNome(t).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean); };
  var m = partes(nomeManual);
  return avaliadores.filter(function (a) {
    var c = partes(a.nome);
    if (!m.length || c[0] !== m[0]) return false;
    var j = 1;
    for (var i = 1; i < m.length; i++) {
      while (j < c.length && c[j].indexOf(m[i]) !== 0) j++;
      if (j >= c.length) return false;
      j++;
    }
    return true;
  }).map(function (a) { return String(a.id); });
}
