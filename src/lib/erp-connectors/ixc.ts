import type { TipoAtendimento } from "@prisma/client";
import { chamarJson, normalizarUrlBase, texto } from "./http";
import {
  ErroConectorERP,
  type AtendimentoExterno,
  type ColaboradorExterno,
  type ConectorERP,
  type OpcoesConector,
} from "./types";

/**
 * Conector do IXC Provedor.
 *
 * Validado em 22/10/2026 contra o IXC da GigaNetPe (docs/REFERENCIA-IXC-SGP.md,
 * seção 2.1): `Authorization: Basic base64(<token>)` com o token inteiro no
 * formato `<id>:<hash>`, POST com header `ixcsoft: listar` e grid
 * qtype/query/oper/page/rp. Só lemos os campos de que precisamos: o usuário de
 * teste enxerga salário, dados bancários e senhas, que nunca são copiados.
 */

export type CredenciaisIxc = { token: string };

const POR_PAGINA = 200;
const MAX_PAGINAS = 500;

type Registro = Record<string, unknown>;

export function classificarAssunto(assunto: string | null): TipoAtendimento {
  const a = (assunto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (a.includes("instal") || a.includes("ativacao")) return "INSTALACAO";
  if (a.includes("renegoc")) return "RENEGOCIACAO";
  if (a.includes("venda") || a.includes("comercial")) return "VENDA";
  return "SUPORTE";
}

/** O IXC usa `0000-00-00` para "sem data". */
const dataValida = (v: unknown) => {
  const t = texto(v);
  return !!t && !t.startsWith("0000") && !Number.isNaN(new Date(t.replace(" ", "T")).getTime());
};

export class ConectorIxc implements ConectorERP {
  readonly sistema = "IXC" as const;
  private readonly base: string;
  private readonly auth: string;

  constructor(
    private readonly opcoes: OpcoesConector,
    credenciais: CredenciaisIxc,
  ) {
    this.base = normalizarUrlBase(opcoes.urlBase) + "/webservice/v1";
    this.auth = "Basic " + Buffer.from(credenciais.token).toString("base64");
  }

  private async listar(recurso: string, filtro: Record<string, string>, pagina: number): Promise<Registro[]> {
    const corpo = await chamarJson(
      `${this.base}/${recurso}`,
      {
        method: "POST",
        headers: { Authorization: this.auth, ixcsoft: "listar", "Content-Type": "application/json" },
        body: JSON.stringify({
          ...filtro,
          page: String(pagina),
          rp: String(POR_PAGINA),
          sortname: `${recurso}.id`,
          sortorder: "asc",
        }),
      },
      this.opcoes,
    );
    const r = corpo as { type?: string; message?: string; registros?: unknown };
    if (r.type === "error") throw new ErroConectorERP(`IXC: ${texto(r.message) ?? "erro na consulta"}`);
    return Array.isArray(r.registros) ? (r.registros as Registro[]) : [];
  }

  private async listarTudo(recurso: string, filtro: Record<string, string>): Promise<Registro[]> {
    const todos: Registro[] = [];
    for (let p = 1; p <= MAX_PAGINAS; p++) {
      const lote = await this.listar(recurso, filtro, p);
      todos.push(...lote);
      if (lote.length < POR_PAGINA) break;
    }
    return todos;
  }

  async testarConexao() {
    await this.listar("funcionarios", { qtype: "funcionarios.id", query: "0", oper: ">" }, 1);
  }

  async listarColaboradores(): Promise<ColaboradorExterno[]> {
    const registros = await this.listarTudo("funcionarios", { qtype: "funcionarios.id", query: "0", oper: ">" });
    return registros.flatMap((r) => {
      const id = texto(r.id);
      const nome = texto(r.funcionario);
      if (!id || !nome) return [];
      return [{ idExterno: id, nome, email: texto(r.email)?.toLowerCase() ?? null, ativo: r.ativo !== "N" && !dataValida(r.data_demissao), equipe: null }];
    });
  }

  async listarAtendimentosConcluidos(desde: Date): Promise<AtendimentoExterno[]> {
    const data = desde.toISOString().slice(0, 19).replace("T", " ");
    const os = await this.listarTudo("su_oss_chamado", {
      qtype: "su_oss_chamado.data_fechamento",
      query: data,
      oper: ">=",
    });
    const assuntos = new Map(
      (await this.listarTudo("su_oss_assunto", { qtype: "su_oss_assunto.id", query: "0", oper: ">" })).flatMap((a) => {
        const id = texto(a.id);
        const nome = texto(a.assunto);
        return id && nome ? [[id, nome] as const] : [];
      }),
    );
    const concluidas = os.filter((o) => o.status === "F" && texto(o.data_fechamento));
    const clientes = new Map<string, Registro>();
    const ids = [...new Set(concluidas.map((o) => texto(o.id_cliente)).filter((i): i is string => !!i))];
    for (const id of ids) {
      const [c] = await this.listar("cliente", { qtype: "cliente.id", query: id, oper: "=" }, 1);
      if (c) clientes.set(id, c);
    }
    return concluidas.flatMap((o) => {
      const id = texto(o.id);
      const idCliente = texto(o.id_cliente);
      const fim = new Date(String(o.data_fechamento).replace(" ", "T") + "Z");
      if (!id || !idCliente || Number.isNaN(fim.getTime())) return [];
      const c = clientes.get(idCliente);
      return [
        {
          idExterno: id,
          tipo: classificarAssunto(assuntos.get(texto(o.id_assunto) ?? "") ?? null),
          colaboradorIdExterno: texto(o.id_tecnico) === "0" ? null : texto(o.id_tecnico),
          cliente: {
            idExterno: idCliente,
            nome: texto(c?.razao) ?? `Cliente ${idCliente}`,
            telefone: texto(c?.telefone_celular) ?? texto(c?.whatsapp) ?? texto(c?.fone),
            email: texto(c?.email)?.toLowerCase() ?? null,
          },
          concluidoEm: fim,
        },
      ];
    });
  }
}
