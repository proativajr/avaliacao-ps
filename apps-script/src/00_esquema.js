/* =====================================================================
 * ESQUEMA DA PLANILHA: nomes das abas, cabeçalhos e valores iniciais.
 * Mexer aqui muda a estrutura criada pelo setup().
 * ===================================================================== */

var VERSAO_SISTEMA = '1.1.0';

var ABAS = {
  CONFIG: 'Config',
  ETAPAS: 'Config_Etapas',
  BLOCOS: 'Config_Blocos',
  CRITERIOS: 'Config_Criterios',
  EQUIPES: 'Equipes',
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
  ABAS.CONFIG, ABAS.ETAPAS, ABAS.BLOCOS, ABAS.CRITERIOS, ABAS.EQUIPES,
  ABAS.AVALIADORES, ABAS.CANDIDATOS, ABAS.AVALIACOES, ABAS.OBSERVACOES,
  ABAS.INSCRICOES, ABAS.IMPORTACOES, ABAS.AUX,
];

/** Cabeçalhos das abas de dados (linha 1). A ordem das colunas é usada pelo script. */
var CABECALHOS = {};
CABECALHOS[ABAS.CONFIG] = ['chave', 'valor', 'descricao'];
CABECALHOS[ABAS.ETAPAS] = ['id', 'nome', 'ordem', 'aberta'];
CABECALHOS[ABAS.BLOCOS] = ['id', 'nome', 'nome_curto', 'ordem', 'ativo'];
/** Equipes de cada dinâmica (etapa). membros e avaliadores = IDs separados por vírgula.
 *  avaliadores = quem acompanha a equipe na Construção. construcao/apresentacao = '', 'ANDAMENTO' ou 'CONCLUIDO'. */
CABECALHOS[ABAS.EQUIPES] = ['id', 'etapa', 'nome', 'ordem', 'membros', 'avaliadores', 'construcao', 'apresentacao'];
CABECALHOS[ABAS.CRITERIOS] = ['id', 'bloco', 'ordem', 'sigla', 'nome', 'descricao', 'peso', 'ativo', 'etapas'];
CABECALHOS[ABAS.AVALIADORES] = ['id', 'nome', 'email', 'area', 'token', 'ativo', 'criado_em', 'ultimo_acesso'];
CABECALHOS[ABAS.CANDIDATOS] = ['id', 'nome_exibicao', 'nome_normalizado', 'email', 'telefone', 'curso', 'semestre',
  'foto_url', 'status', 'origem', 'importado_em', 'chave_inscricao', 'criado_em', 'atualizado_em'];
CABECALHOS[ABAS.INSCRICOES] = ['candidato_id', 'lote_id', 'importado_em', 'hash_linha', 'dados_json'];
CABECALHOS[ABAS.IMPORTACOES] = ['lote_id', 'em', 'origem', 'nome_arquivo', 'linhas', 'criados', 'atualizados', 'ignorados'];
CABECALHOS[ABAS.AVALIACOES] = ['chave', 'etapa', 'avaliador_id', 'candidato_id', 'criterio_id', 'nota', 'atualizado_em', 'cliente_ts', 'momento'];
CABECALHOS[ABAS.OBSERVACOES] = ['chave', 'etapa', 'avaliador_id', 'candidato_id', 'texto', 'atualizado_em', 'cliente_ts', 'momento'];

/** Abas que só o script escreve (protegidas para todos, exceto o dono). */
var ABAS_DADOS = [ABAS.AVALIADORES, ABAS.CANDIDATOS, ABAS.INSCRICOES, ABAS.IMPORTACOES, ABAS.AVALIACOES, ABAS.OBSERVACOES];
/** Abas de configuração: editadas pelo app; na planilha mostram aviso antes de editar. */
var ABAS_CONFIG = [ABAS.CONFIG, ABAS.ETAPAS, ABAS.BLOCOS, ABAS.CRITERIOS, ABAS.EQUIPES];
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
  ['dinamica_ativa', '', 'Dinâmica (etapa) que os avaliadores veem agora (o app preenche)'],
  ['equipe_ativa', '', 'Equipe em avaliação agora (o app preenche)'],
  ['peso_construcao', 1, 'Peso da Construção na nota da dinâmica em equipe'],
  ['peso_apresentacao', 1, 'Peso da Apresentação na nota da dinâmica em equipe'],
];

var ETAPAS_PADRAO = [['geral', 'Dinâmica 1', 1, 'SIM']];

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
