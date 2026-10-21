import type { SistemaERP, TipoAtendimento } from "@prisma/client";

/**
 * Contrato comum dos conectores de ERP. Cada conector já nasce configurado
 * com a URL e as credenciais de um tenant, então não conhece o banco: só
 * conversa com o ERP e devolve dados normalizados. Quem grava (idempotente)
 * é `src/lib/sincronizacao.ts`, o que mantém o motor de pontuação intocado
 * ao adicionar um novo sistema.
 */

export type ColaboradorExterno = {
  idExterno: string;
  nome: string;
  email: string | null;
  ativo: boolean;
  /** Filial/setor de origem, usado como equipe. */
  equipe: string | null;
};

export type ClienteExterno = {
  idExterno: string;
  nome: string;
  telefone: string | null;
  email: string | null;
};

export type AtendimentoExterno = {
  /** Id da O.S./chamado no ERP (vira `origemExternaId`). */
  idExterno: string;
  tipo: TipoAtendimento;
  /** Id do técnico/atendente responsável no ERP (liga a `Usuario.idExternoERP`). */
  colaboradorIdExterno: string | null;
  cliente: ClienteExterno;
  concluidoEm: Date;
};

export interface ConectorERP {
  readonly sistema: SistemaERP;
  /** Faz uma chamada mínima autenticada; lança `ErroConectorERP` se falhar. */
  testarConexao(): Promise<void>;
  /** `null` quando o ERP não expõe colaboradores (aí vêm por planilha). */
  listarColaboradores(): Promise<ColaboradorExterno[] | null>;
  /** O.S. concluídas a partir de `desde` (caminho principal: consulta periódica). */
  listarAtendimentosConcluidos(desde: Date): Promise<AtendimentoExterno[]>;
}

export class ErroConectorERP extends Error {
  constructor(
    message: string,
    readonly causa?: unknown,
  ) {
    super(message);
    this.name = "ErroConectorERP";
  }
}

export type OpcoesConector = {
  urlBase: string;
  /** Injetável para testes. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};
