// Fila de envio: toda nota vai primeiro para o aparelho (localStorage) e depois para o servidor.
// Nunca perde nota: se a internet cair, a fila fica guardada e é reenviada quando voltar.
// Nunca duplica: o servidor faz upsert pela chave e "vale a mais recente" (cliente_ts).
import { chamar, ErroApi, ErroRede, gravar, ler, Sessao } from '../api';

/** Momento da dinâmica em equipe. Ausente = Apresentação (a chave antiga continua a mesma). */
export type Momento = 'construcao';
export interface ItemNota { tipo: 'nota'; etapa: string; candidato_id: string; criterio_id: string; nota: number | 'NA' | ''; cliente_ts: number; momento?: Momento; }
export interface ItemObs { tipo: 'obs'; etapa: string; candidato_id: string; texto: string; cliente_ts: number; momento?: Momento; }
export type Item = ItemNota | ItemObs;
export type EstadoFila = 'salvo' | 'salvando' | 'pendente' | 'offline' | 'erro';

const sufixo = (m?: string) => (m === 'construcao' ? '|construcao' : '');
export function chaveNota(etapa: string, cand: string, crit: string, momento?: string) { return `${etapa}|${cand}|${crit}${sufixo(momento)}`; }
export function chaveObs(etapa: string, cand: string, momento?: string) { return `obs:${etapa}|${cand}${sufixo(momento)}`; }
function chaveItem(i: Item) { return i.tipo === 'nota' ? chaveNota(i.etapa, i.candidato_id, i.criterio_id, i.momento) : chaveObs(i.etapa, i.candidato_id, i.momento); }

/** Relógio que nunca anda para trás (dois toques no mesmo milissegundo ganham ts diferentes). */
let ultimoTs = 0;
export function agoraTs() { ultimoTs = Math.max(Date.now(), ultimoTs + 1); return ultimoTs; }

export class Fila {
  private itens: Record<string, Item> = {};
  private enviando = false;
  private timer: any = null;
  private espera = 1000;
  private chaveArmaz: string;
  estado: EstadoFila = 'salvo';
  aoMudar: (e: EstadoFila, pendentes: number) => void = () => {};
  aoRecusar: (motivo: string, item: Item) => void = () => {};
  aoTokenInvalido: () => void = () => {};

  constructor(private sessao: Sessao, avaliadorId: string) {
    this.chaveArmaz = `${sessao.amb}:fila:${avaliadorId}`;
    try { this.itens = JSON.parse(ler(this.chaveArmaz) || '{}'); } catch { this.itens = {}; }
    addEventListener('online', () => this.enviarJa());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.enviarJa(); });
    if (this.pendentes()) this.agendar(300);
  }

  pendentes() { return Object.keys(this.itens).length; }
  todos(): Item[] { return Object.values(this.itens); }

  private persistir() { gravar(this.chaveArmaz, JSON.stringify(this.itens)); }

  private mudar(e: EstadoFila) { this.estado = e; this.aoMudar(e, this.pendentes()); }

  /** Guarda no aparelho na hora e agenda o envio (junta vários toques num envio só). */
  adicionar(item: Item) {
    this.itens[chaveItem(item)] = item;
    this.persistir();
    if (this.estado !== 'offline') this.mudar('pendente'); else this.aoMudar('offline', this.pendentes());
    this.agendar(700);
  }

  private agendar(ms: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.enviar(), ms);
  }

  enviarJa() { this.agendar(0); }

  private async enviar() {
    if (this.enviando) { this.agendar(500); return; }
    const lote = this.todos().slice(0, 200);
    if (!lote.length) { this.mudar('salvo'); return; }
    this.enviando = true;
    this.mudar('salvando');
    try {
      const r = await chamar<{ salvos: string[]; recusados: { chave: string; motivo: string }[] }>(this.sessao, 'av.salvar', {
        notas: lote.filter((i) => i.tipo === 'nota').map(({ tipo, ...n }) => n),
        observacoes: lote.filter((i) => i.tipo === 'obs').map(({ tipo, ...o }) => o),
      }, 25000);
      // O servidor devolve a chave com o id do avaliador no meio: "etapa|aNNN|cand|crit" (+ "|construcao")
      const tirarAvaliador = (k: string) => {
        const obs = k.startsWith('obs:');
        const p = (obs ? k.slice(4) : k).split('|');
        p.splice(1, 1);
        return (obs ? 'obs:' : '') + p.join('|');
      };
      const enviados: Record<string, number> = {};
      lote.forEach((i) => { enviados[chaveItem(i)] = i.cliente_ts; });
      const remover = (k: string) => {
        // só remove se ninguém mexeu nesse item depois que o lote saiu
        if (this.itens[k] && this.itens[k].cliente_ts === enviados[k]) delete this.itens[k];
      };
      r.salvos.forEach((k) => remover(tirarAvaliador(k)));
      r.recusados.forEach((x) => {
        const k = tirarAvaliador(x.chave);
        const it = this.itens[k];
        if (it && it.cliente_ts === enviados[k]) { delete this.itens[k]; this.aoRecusar(x.motivo, it); }
      });
      this.persistir();
      this.espera = 1000;
      this.enviando = false;
      if (this.pendentes()) this.agendar(200); else this.mudar('salvo');
    } catch (e) {
      this.enviando = false;
      if (e instanceof ErroApi && e.codigo === 'TOKEN_INVALIDO') { this.mudar('erro'); this.aoTokenInvalido(); return; }
      this.mudar(e instanceof ErroRede || !navigator.onLine ? 'offline' : 'erro');
      this.espera = Math.min(this.espera * 2, 30000);
      this.agendar(this.espera);
    }
  }
}
