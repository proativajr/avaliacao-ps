// Configuração sem mexer em código: processo, etapas, blocos, critérios (descrição, peso, ativo).
import { useEffect, useState } from 'preact/hooks';
import type { Bloco, Criterio, Etapa } from '../tipos';
import type { PropsAba } from './Admin';

function SimNao({ valor, aoMudar, rotulo }: { valor: string; aoMudar: (v: string) => void; rotulo: string }) {
  const sim = String(valor).toUpperCase() === 'SIM';
  return (
    <label class="check">
      <input type="checkbox" checked={sim} onChange={() => aoMudar(sim ? 'NÃO' : 'SIM')} /> {rotulo}
    </label>
  );
}

export function Configuracao({ d, setD, acao }: PropsAba) {
  const [cfg, setCfg] = useState<Record<string, any>>({ ...d.config });
  const [etapas, setEtapas] = useState<Etapa[]>(d.etapas.map((e) => ({ ...e })));
  const [blocos, setBlocos] = useState<Bloco[]>(d.blocos.map((b) => ({ ...b })));
  const [crits, setCrits] = useState<Criterio[]>(d.criterios.map((c) => ({ ...c })));
  useEffect(() => { setCfg({ ...d.config }); }, [d.config]);

  const salvarConfig = async () => {
    const chaves = ['nome_processo', 'data_inicio', 'data_fim', 'avaliacao_aberta', 'avaliadores_veem_notas_dos_outros', 'nota_de_corte', 'vagas',
      'min_avaliadores_por_candidato', 'limite_divergencia', 'modo', 'url_app'];
    if (String(cfg.modo).toUpperCase() !== String(d.config.modo).toUpperCase() &&
      !confirm(`Mudar o modo desta planilha para ${cfg.modo}? O modo ENSAIO permite gerar e zerar dados fictícios.`)) return;
    const r = await acao<{ config: any }>('admin.salvarConfig', { config: Object.fromEntries(chaves.map((k) => [k, cfg[k] ?? ''])) }, 'Configuração salva');
    if (r) setD((x) => ({ ...x, config: r.config }));
  };
  const salvarEtapas = async () => {
    const r = await acao<{ etapas: Etapa[] }>('admin.salvarEtapas', { lista: etapas }, 'Dinâmicas salvas');
    if (r) { setD((x) => ({ ...x, etapas: r.etapas })); setEtapas(r.etapas.map((e) => ({ ...e }))); }
  };
  const salvarBlocos = async () => {
    const r = await acao<{ blocos: Bloco[] }>('admin.salvarBlocos', { lista: blocos }, 'Blocos salvos');
    if (r) { setD((x) => ({ ...x, blocos: r.blocos })); setBlocos(r.blocos.map((b) => ({ ...b }))); }
  };
  const salvarCriterios = async () => {
    const r = await acao<{ criterios: Criterio[] }>('admin.salvarCriterios', { lista: crits }, 'Critérios salvos');
    if (r) { setD((x) => ({ ...x, criterios: r.criterios })); setCrits(r.criterios.map((c) => ({ ...c }))); }
  };
  const removerCriterio = async (c: Criterio) => {
    if (!d.criterios.find((x) => x.id === c.id)) { setCrits((l) => l.filter((x) => x !== c)); return; }
    if (!confirm(`Apagar o critério "${c.nome}"? Só é possível se ninguém deu nota nele; senão, desative.`)) return;
    const r = await acao<{ criterios: Criterio[] }>('admin.removerCriterios', { ids: [c.id] }, 'Critério apagado');
    if (r) { setD((x) => ({ ...x, criterios: r.criterios })); setCrits(r.criterios.map((k) => ({ ...k }))); }
  };
  const removerEtapa = async (e: Etapa) => {
    if (!d.etapas.find((x) => x.id === e.id)) { setEtapas((l) => l.filter((x) => x !== e)); return; }
    if (!confirm(`Apagar "${e.nome}"? Só é possível se não houver notas nela; senão, feche a dinâmica.`)) return;
    const r = await acao<{ etapas: Etapa[] }>('admin.removerEtapas', { ids: [e.id] }, 'Dinâmica apagada');
    if (r) { setD((x) => ({ ...x, etapas: r.etapas })); setEtapas(r.etapas.map((k) => ({ ...k }))); }
  };
  const mudarCrit = (c: Criterio, campo: keyof Criterio, v: any) => setCrits((l) => l.map((x) => (x === c ? { ...x, [campo]: v } : x)));
  const mover = (c: Criterio, dir: -1 | 1) => setCrits((l) => {
    const doBloco = l.filter((x) => x.bloco === c.bloco).sort((a, b) => Number(a.ordem) - Number(b.ordem));
    const i = doBloco.indexOf(c), j = i + dir;
    if (j < 0 || j >= doBloco.length) return l;
    [doBloco[i], doBloco[j]] = [doBloco[j], doBloco[i]];
    const novaOrdem = new Map(doBloco.map((x, k) => [x, k + 1]));
    return l.map((x) => (novaOrdem.has(x) ? { ...x, ordem: novaOrdem.get(x)! } : x));
  });
  const campo = (k: string, rot: string, tipo = 'text', ajuda = '') => (
    <label class="campo"><span>{rot}</span>
      <input type={tipo} step={tipo === 'number' ? 'any' : undefined} value={cfg[k] ?? ''} onInput={(e) => setCfg({ ...cfg, [k]: (e.target as HTMLInputElement).value })} />
      {ajuda && <small class="ajuda">{ajuda}</small>}
    </label>
  );

  return (
    <section>
      <h2>Configuração</h2>
      <p class="subtitulo">As mudanças valem na hora para a planilha e, em até 5 minutos, para o app dos avaliadores.</p>

      <div class="bloco">
        <div class="bloco-topo"><h2>Processo</h2></div>
        <div class="form-grade">
          {campo('nome_processo', 'Nome do processo')}
          {campo('url_app', 'Endereço do site', 'url', 'Usado no link do admin mostrado na planilha.')}
          {campo('data_inicio', 'Data de início', 'date')}
          {campo('data_fim', 'Data de fim', 'date')}
          {campo('nota_de_corte', 'Nota de corte', 'number', 'De 1 a 5. Vazio = sem corte.')}
          {campo('vagas', 'Vagas', 'number', 'Vazio = sem limite.')}
          {campo('min_avaliadores_por_candidato', 'Mínimo de avaliadores por candidato', 'number', 'Abaixo disso aparece "dados insuficientes".')}
          {campo('limite_divergencia', 'Limite de divergência', 'number', 'Desvio padrão entre avaliadores acima disso marca "divergência".')}
          <label class="campo"><span>Modo desta planilha</span>
            <select value={String(cfg.modo).toUpperCase()} onChange={(e) => setCfg({ ...cfg, modo: (e.target as HTMLSelectElement).value })}>
              <option value="ENSAIO">ENSAIO (dados fictícios)</option><option value="PRODUCAO">PRODUCAO (processo real)</option>
            </select></label>
          <div style={{ display: 'grid', alignContent: 'start' }}>
            <SimNao rotulo="Avaliação aberta" valor={cfg.avaliacao_aberta} aoMudar={(v) => setCfg({ ...cfg, avaliacao_aberta: v })} />
            <SimNao rotulo="Avaliadores veem a média dos colegas" valor={cfg.avaliadores_veem_notas_dos_outros} aoMudar={(v) => setCfg({ ...cfg, avaliadores_veem_notas_dos_outros: v })} />
          </div>
        </div>
        <div class="barra-acoes fim"><button class="botao principal" onClick={salvarConfig}>Salvar processo</button></div>
      </div>

      <div class="grade-blocos duas" style={{ marginTop: 16 }}>
        <div class="bloco">
          <div class="bloco-topo"><h2>Dinâmicas</h2></div>
          <p class="ajuda">Cada dinâmica tem suas próprias notas. Durante o PS, a dinâmica que os avaliadores veem é escolhida em Ao vivo.</p>
          {etapas.map((e) => (
            <div class="linha-form duas">
              <label class="campo"><span>Nome <small class="ajuda">({e.id || 'nova'})</small></span><input value={e.nome} onInput={(ev) => setEtapas((l) => l.map((x) => (x === e ? { ...x, nome: (ev.target as HTMLInputElement).value } : x)))} /></label>
              <label class="campo"><span>Ordem</span><input type="number" value={e.ordem} onInput={(ev) => setEtapas((l) => l.map((x) => (x === e ? { ...x, ordem: Number((ev.target as HTMLInputElement).value) } : x)))} /></label>
              <div class="linha-fim">
                <SimNao rotulo="Aberta" valor={String(e.aberta)} aoMudar={(v) => setEtapas((l) => l.map((x) => (x === e ? { ...x, aberta: v } : x)))} />
                <button class="botao pequeno perigo" onClick={() => removerEtapa(e)} aria-label={`Apagar ${e.nome}`}>Apagar</button>
              </div>
            </div>
          ))}
          <div class="barra-acoes fim">
            <button class="botao" onClick={() => setEtapas((l) => [...l, { id: '', nome: `Dinâmica ${l.length + 1}`, ordem: l.length + 1, aberta: 'NÃO' }])}>Adicionar dinâmica</button>
            <button class="botao principal" onClick={salvarEtapas}>Salvar dinâmicas</button>
          </div>
        </div>

        <div class="bloco">
          <div class="bloco-topo"><h2>Blocos</h2></div>
          <p class="ajuda">Grupos de critérios. O nome curto aparece nas abas do avaliador.</p>
          {blocos.map((b) => (
            <div class="linha-form">
              <label class="campo"><span>Nome</span><input value={b.nome} onInput={(ev) => setBlocos((l) => l.map((x) => (x === b ? { ...x, nome: (ev.target as HTMLInputElement).value } : x)))} /></label>
              <label class="campo"><span>Nome curto</span><input value={b.nome_curto} onInput={(ev) => setBlocos((l) => l.map((x) => (x === b ? { ...x, nome_curto: (ev.target as HTMLInputElement).value } : x)))} /></label>
              <label class="campo"><span>Ordem</span><input type="number" value={b.ordem} onInput={(ev) => setBlocos((l) => l.map((x) => (x === b ? { ...x, ordem: Number((ev.target as HTMLInputElement).value) } : x)))} /></label>
              <div class="linha-fim"><SimNao rotulo="Ativo" valor={String(b.ativo)} aoMudar={(v) => setBlocos((l) => l.map((x) => (x === b ? { ...x, ativo: v } : x)))} /></div>
            </div>
          ))}
          <div class="barra-acoes fim">
            <button class="botao" onClick={() => setBlocos((l) => [...l, { id: '', nome: 'Novo bloco', nome_curto: 'Novo', ordem: l.length + 1, ativo: 'SIM' }])}>Adicionar bloco</button>
            <button class="botao principal" onClick={salvarBlocos}>Salvar blocos</button>
          </div>
        </div>
      </div>

      <div class="bloco" style={{ marginTop: 16 }}>
        <div class="bloco-topo"><h2>Critérios</h2><div class="acoes-topo"><button class="botao principal" onClick={salvarCriterios}>Salvar critérios</button></div></div>
        <p class="ajuda">O avaliador vê a descrição ao tocar no critério. Peso padrão 1 (com todos 1, a média é simples). Sem nenhuma dinâmica desmarcada, o critério vale em todas.</p>
        {d.blocos.map((b) => (
          <div>
            <h3 class="grupo">{b.nome}</h3>
            {crits.filter((c) => c.bloco === b.id).sort((x, y) => Number(x.ordem) - Number(y.ordem)).map((c) => (
              <div class={'crit-form' + (String(c.ativo).toUpperCase() === 'SIM' ? '' : ' inativo')}>
                <div class="topo">
                  <label class="campo"><span>Sigla</span><input value={c.sigla} maxLength={3} onInput={(e) => mudarCrit(c, 'sigla', (e.target as HTMLInputElement).value)} /></label>
                  <label class="campo"><span>Nome</span><input value={c.nome} onInput={(e) => mudarCrit(c, 'nome', (e.target as HTMLInputElement).value)} /></label>
                  <label class="campo"><span>Peso</span><input type="number" step="any" min="0" value={c.peso as any} onInput={(e) => mudarCrit(c, 'peso', (e.target as HTMLInputElement).value)} /></label>
                </div>
                <label class="campo"><span>Descrição</span><textarea value={c.descricao} onInput={(e) => mudarCrit(c, 'descricao', (e.target as HTMLTextAreaElement).value)} /></label>
                <fieldset class="dinamicas" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend class="ajuda" style={{ padding: 0 }}>Vale nas dinâmicas</legend>
                  {d.etapas.map((e) => {
                    const lista = String(c.etapas || '').split(',').map((s) => s.trim()).filter(Boolean);
                    const marcado = !lista.length || lista.includes(e.id);
                    return <label class="check"><input type="checkbox" checked={marcado} onChange={() => {
                      let nova = lista.length ? lista : d.etapas.map((x) => x.id);
                      nova = marcado ? nova.filter((x) => x !== e.id) : [...nova, e.id];
                      mudarCrit(c, 'etapas', nova.length === d.etapas.length ? '' : nova.join(','));
                    }} />{e.nome}</label>;
                  })}
                </fieldset>
                <div class="rodape">
                  <SimNao rotulo="Ativo" valor={String(c.ativo)} aoMudar={(v) => mudarCrit(c, 'ativo', v)} />
                  <span class="ajuda">ID: {c.id || '(gerado ao salvar)'}</span>
                  <span class="espaco" />
                  <span class="mover">
                    <button class="botao" onClick={() => mover(c, -1)} aria-label={`Subir ${c.nome}`}>↑</button>
                    <button class="botao" onClick={() => mover(c, 1)} aria-label={`Descer ${c.nome}`}>↓</button>
                  </span>
                  <button class="botao perigo" onClick={() => removerCriterio(c)}>Apagar</button>
                </div>
              </div>
            ))}
            <button class="botao" onClick={() => setCrits((l) => [...l, { id: '', bloco: b.id, ordem: l.filter((x) => x.bloco === b.id).length + 1, sigla: '', nome: 'Novo critério', descricao: '', peso: 1, ativo: 'SIM', etapas: '' }])}>Adicionar critério em {b.nome_curto}</button>
          </div>
        ))}
        <div class="barra-acoes fim"><button class="botao principal" onClick={salvarCriterios}>Salvar critérios</button></div>
      </div>
    </section>
  );
}
