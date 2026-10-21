import { classificarAssunto } from "./ixc";
import { chamarJson, normalizarUrlBase, texto } from "./http";
import {
  ErroConectorERP,
  type AtendimentoExterno,
  type ColaboradorExterno,
  type ConectorERP,
  type OpcoesConector,
} from "./types";

/**
 * Conector do SGP (TSMX).
 *
 * ATENÇÃO: autenticação por token + app e `/api/os/list/` vêm da página de
 * desenvolvedores; o formato exato da resposta ainda NÃO foi validado no
 * sandbox (demo.sgp.net.br), então a leitura é tolerante a variações de nomes
 * de campo. O SGP não tem endpoint de colaboradores confirmado: aqui os
 * técnicos vêm só das O.S., e o cadastro é por planilha (ligado pelo id externo).
 */

export type CredenciaisSgp = { token: string; app: string };

type Registro = Record<string, unknown>;

const primeiro = (r: Registro, ...chaves: string[]) => {
  for (const c of chaves) {
    const v = texto(r[c]);
    if (v) return v;
  }
  return null;
};

export class ConectorSgp implements ConectorERP {
  readonly sistema = "SGP" as const;
  private readonly base: string;

  constructor(
    private readonly opcoes: OpcoesConector,
    private readonly credenciais: CredenciaisSgp,
  ) {
    this.base = normalizarUrlBase(opcoes.urlBase);
  }

  private async listarOs(filtro: Record<string, string>): Promise<Registro[]> {
    const corpo = await chamarJson(
      `${this.base}/api/os/list/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: this.credenciais.token, app: this.credenciais.app, ...filtro }),
      },
      this.opcoes,
    );
    const lista = Array.isArray(corpo) ? corpo : (corpo as { ordens?: unknown; data?: unknown; results?: unknown });
    const itens = Array.isArray(lista) ? lista : (lista.ordens ?? lista.data ?? lista.results);
    if (!Array.isArray(itens)) throw new ErroConectorERP("SGP: resposta sem lista de O.S.");
    return itens as Registro[];
  }

  async testarConexao() {
    await this.listarOs({ limit: "1" });
  }

  async listarColaboradores(): Promise<ColaboradorExterno[] | null> {
    return null;
  }

  async listarAtendimentosConcluidos(desde: Date): Promise<AtendimentoExterno[]> {
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    const os = await this.listarOs({ status: "1", data_fim_inicio: dia(desde), data_fim_fim: dia(new Date()) });
    return os.flatMap((o) => {
      const id = primeiro(o, "id", "os_id");
      const fim = new Date(primeiro(o, "data_fechamento", "data_finalizacao", "data_fim") ?? "");
      const cliente = (o.cliente ?? {}) as Registro;
      const idCliente = primeiro(o, "cliente_id", "id_cliente") ?? primeiro(cliente, "id");
      if (!id || !idCliente || Number.isNaN(fim.getTime()) || fim < desde) return [];
      return [
        {
          idExterno: id,
          tipo: classificarAssunto(primeiro(o, "motivo", "tipo", "assunto")),
          colaboradorIdExterno: primeiro(o, "tecnico_id", "responsavel_id", "usuario_id"),
          cliente: {
            idExterno: idCliente,
            nome: primeiro(o, "cliente_nome") ?? primeiro(cliente, "nome", "razaosocial") ?? `Cliente ${idCliente}`,
            telefone: primeiro(o, "cliente_telefone") ?? primeiro(cliente, "celular", "telefone"),
            email: (primeiro(o, "cliente_email") ?? primeiro(cliente, "email"))?.toLowerCase() ?? null,
          },
          concluidoEm: fim,
        },
      ];
    });
  }
}
