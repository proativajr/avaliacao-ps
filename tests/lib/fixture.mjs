// Conjunto de dados FICTÍCIO e determinístico com casos difíceis:
// NA, candidatos parciais, só-NA, empate, status fora do ranking, peso 2, critério desligado,
// critério que só vale numa etapa e notas em critério inativo (devem ser ignoradas).

export function rng(semente) { // mulberry32
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function gerarFixture(gas, semente = 42, { reduzido = false } = {}) {
  const r = rng(semente);
  const obj = (cab, linha) => Object.fromEntries(cab.map((c, i) => [c, linha[i]]));
  const C = gas.CABECALHOS;
  const etapas = [['geral', 'Geral', 1, 'SIM'], ['dia2', 'Dia 2', 2, 'SIM']].map((l) => obj(C.Config_Etapas, l));
  const blocos = gas.BLOCOS_PADRAO.map((l) => obj(C.Config_Blocos, l));
  const criterios = gas.CRITERIOS_PADRAO.map((l) => obj(C.Config_Criterios, l));
  criterios.find((c) => c.id === 'valores_rede').peso = 2;          // peso 2
  criterios.find((c) => c.id === 'comport_criatividade').ativo = 'NÃO'; // desligado
  criterios.find((c) => c.id === 'comport_desafio').etapas = 'dia2';   // só no Dia 2
  // Versão reduzida (para a planilha de teste real): poucos critérios ativos e notas só neles
  const manter = ['valores_proatividade', 'valores_resultado', 'valores_rede', 'comport_comunicacao', 'comport_desafio', 'comport_criatividade'];
  if (reduzido) criterios.forEach((c) => { if (!manter.includes(c.id)) c.ativo = 'NÃO'; });
  const config = Object.fromEntries(gas.CONFIG_PADRAO.map((l) => [l[0], l[1]]));
  Object.assign(config, { nota_de_corte: 3, vagas: 4, min_avaliadores_por_candidato: 3, limite_divergencia: 0.8, modo: 'ENSAIO' });

  const nomes = ['Ana Teste Um', 'Ana Teste Dois', 'Bruno Ficção', 'Carla Exemplo', 'Davi Modelo', 'Elisa Só NA', 'Fábio Empate', 'Gabi Empate', 'Hugo Faltou', 'Íris Eliminada'];
  const candidatos = nomes.map((n, i) => ({ id: 'c' + String(i + 1).padStart(3, '0'), nome: n, status: i === 8 ? 'FALTOU' : i === 9 ? 'ELIMINADO' : 'ATIVO' }));
  const avaliadores = (reduzido ? [1, 2, 3, 4] : [1, 2, 3, 4, 5]).map((i) => ({ id: 'a00' + i, nome: 'Avaliador Fictício ' + i }));

  const avaliacoes = [];
  const add = (etapa, av, c, k, nota) => avaliacoes.push({ etapa, avaliador_id: av, candidato_id: c, criterio_id: k, nota });
  for (const et of etapas) {
    const ks = criterios.filter((k) => (!k.etapas || k.etapas === et.id) && (!reduzido || manter.includes(k.id))).map((k) => k.id); // inclui o critério desligado de propósito
    for (const av of avaliadores) {
      for (const c of candidatos) {
        if (c.id === 'c007' || c.id === 'c008') continue; // empate tratado abaixo
        const sorte = r();
        if (sorte < 0.12) continue;                       // pendente
        const parcial = sorte < 0.25;
        ks.forEach((k, j) => {
          if (parcial && j % 3 === 0) return;
          const nota = c.id === 'c006' || r() < 0.15 ? 'NA' : 1 + Math.floor(r() * 5);
          add(et.id, av.id, c.id, k, nota);
        });
      }
      // Empate exato: c007 e c008 recebem as mesmas notas
      ks.forEach((k) => { const n = 1 + Math.floor(r() * 5); add(et.id, av.id, 'c007', k, n); add(et.id, av.id, 'c008', k, n); });
    }
  }
  const observacoes = [
    { etapa: 'geral', avaliador_id: 'a001', candidato_id: 'c001', texto: 'Comunicação clara na dinâmica (texto fictício).' },
    { etapa: 'dia2', avaliador_id: 'a002', candidato_id: 'c001', texto: 'Boa liderança no desafio (texto fictício).' },
  ];
  return { etapas, blocos, criterios, config, candidatos, avaliadores, avaliacoes, observacoes };
}
