// Formatos dos dados que vêm da API.
export interface Etapa { id: string; nome: string; ordem: number; aberta: string | boolean; }
export interface Equipe { id: string; etapa: string; nome: string; ordem: number; membros: string[]; }
export interface Bloco { id: string; nome: string; nome_curto: string; ordem: number; ativo?: string; }
export interface Criterio { id: string; bloco: string; ordem: number; sigla: string; nome: string; descricao: string; peso?: number | string; ativo?: string; etapas: string; }
export interface Avaliador { id: string; nome: string; email: string; area: string; token: string; ativo: string; criado_em: string; ultimo_acesso: string; }
export interface Candidato {
  id: string; nome_exibicao: string; nome_normalizado?: string; email: string; telefone: string; curso: string; semestre: string | number;
  foto_url: string; status: string; origem: string; importado_em: string; chave_inscricao?: string; criado_em?: string; atualizado_em?: string;
}
export interface Nota { etapa: string; avaliador_id: string; candidato_id: string; criterio_id: string; nota: number | 'NA' | ''; cliente_ts: number; }
export interface Observacao { etapa: string; avaliador_id: string; candidato_id: string; texto: string; cliente_ts: number; }
export interface AdminDados {
  versao: string; planilha_url: string; config: Record<string, any>;
  etapas: Etapa[]; equipes: Equipe[]; blocos: Bloco[]; criterios: Criterio[]; avaliadores: Avaliador[]; candidatos: Candidato[];
  inscricoes: { candidato_id: string; hash: string }[]; importacoes: any[]; avaliacoes: Nota[]; observacoes: Observacao[];
}
export const STATUS = ['ATIVO', 'FALTOU', 'ELIMINADO', 'DESISTIU'];
