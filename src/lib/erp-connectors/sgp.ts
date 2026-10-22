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
 * Validado em 22/10/2026 contra um SGP real (docs/REFERENCIA-IXC-SGP.md, seção
 * 2.1): POST com `token` e `app`; O.S. encerradas em
 * `/api/ura/ordemservico/list/` (não `/api/os/list/`, que só traz abertas e
 * devolve senhas de Wi-Fi/PPPoE); técnicos em `/api/ura/tecnicos/`. Só lemos os
 * campos necessários: o resto (senhas, dados de ONU) nunca é copiado nem logado.
 */

export type CredenciaisSgp = { token: string; app: string };

type Registro = Record<string, unknown>;

const POR_PAGINA = 1000;
const MAX_PAGINAS = 200;

/** O SGP não tem fuso na O.S.; o provedor opera no horário de Brasília. */
const FUSO = "-03:00";

export class ConectorSgp implements ConectorERP {
  readonly sistema = "SGP" as const;
  private readonly base: string;

  constructor(
    private readonly opcoes: OpcoesConector,
    private readonly credenciais: CredenciaisSgp,
  ) {
    this.base = normalizarUrlBase(opcoes.urlBase);
  }

  private chamar(caminho: string, campos: Record<string, string> = {}): Promise<unknown> {
    return chamarJson(
      `${this.base}${caminho}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: this.credenciais.token, app: this.credenciais.app, ...campos }),
      },
      this.opcoes,
    );
  }

  private async listarOs(filtro: Record<string, string>): Promise<Registro[]> {
    const todas: Registro[] = [];
    for (let p = 0; p < MAX_PAGINAS; p++) {
      const corpo = (await this.chamar("/api/ura/ordemservico/list/", {
        ...filtro,
        offset: String(p * POR_PAGINA),
        limit: String(POR_PAGINA),
      })) as { ordens_servicos?: unknown };
      if (!Array.isArray(corpo.ordens_servicos)) throw new ErroConectorERP("SGP: resposta sem lista de O.S.");
      todas.push(...(corpo.ordens_servicos as Registro[]));
      if (corpo.ordens_servicos.length < POR_PAGINA) break;
    }
    return todas;
  }

  async testarConexao() {
    await this.chamar("/api/ura/tecnicos/");
  }

  private async tecnicos() {
    const corpo = await this.chamar("/api/ura/tecnicos/");
    if (!Array.isArray(corpo)) throw new ErroConectorERP("SGP: resposta sem lista de técnicos.");
    return (corpo as Registro[]).flatMap((t) => {
      const id = texto(t.id);
      const nome = texto(t.nome);
      return id && nome ? [{ id, nome, username: texto(t.username) }] : [];
    });
  }

  /** Quem sai do SGP some da lista (não há flag de ativo nem e-mail). */
  async listarColaboradores(): Promise<ColaboradorExterno[]> {
    return (await this.tecnicos()).map((t) => ({ idExterno: t.id, nome: t.nome, email: null, ativo: true, equipe: null }));
  }

  private async contatoDoContrato(contrato: string) {
    try {
      const corpo = await this.chamar("/api/ura/clientes/", { contrato, limit: "1" });
      // O invólucro da lista não está documentado: aceita lista pura ou `clientes`.
      const lista = Array.isArray(corpo) ? corpo : (corpo as { clientes?: unknown }).clientes;
      const c = Array.isArray(lista) ? (lista[0] as Registro | undefined) : undefined;
      const contatos = (c?.contatos ?? {}) as { celulares?: unknown[]; telefones?: unknown[]; emails?: unknown[] };
      return {
        telefone: texto(contatos.celulares?.[0]) ?? texto(contatos.telefones?.[0]),
        email: texto(contatos.emails?.[0])?.toLowerCase() ?? null,
      };
    } catch {
      // Sem contato a O.S. ainda é importada; só não dá para enviar a pesquisa.
      return { telefone: null, email: null };
    }
  }

  async listarAtendimentosConcluidos(desde: Date): Promise<AtendimentoExterno[]> {
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    // Um dia antes: a data da O.S. é local (-03:00) e `desde` está em UTC.
    const inicio = new Date(desde.getTime() - 24 * 3600_000);
    const [tecnicos, os] = await Promise.all([
      this.tecnicos(),
      this.listarOs({ status: "1", data_finalizacao_inicio: dia(inicio), data_finalizacao_fim: dia(new Date(Date.now() + 24 * 3600_000)) }),
    ]);
    const porNome = new Map(tecnicos.map((t) => [t.nome.toLowerCase(), t.id]));
    const porUsername = new Map(tecnicos.flatMap((t) => (t.username ? [[t.username.toLowerCase(), t.id] as const] : [])));
    const tecnicoDe = (o: Registro) => {
      const resp = texto(o.responsavel)?.toLowerCase();
      const fim = texto(o.usuario_finalizacao)?.toLowerCase();
      return (resp && (porNome.get(resp) ?? porUsername.get(resp))) || (fim && porUsername.get(fim)) || null;
    };

    const contatos = new Map<string, Awaited<ReturnType<ConectorSgp["contatoDoContrato"]>>>();
    const resultado: AtendimentoExterno[] = [];
    for (const o of os) {
      const id = texto(o.id);
      const data = texto(o.data_finalizacao);
      const contrato = texto(o.contrato);
      const fim = data ? new Date(`${data}T${texto(o.hora_finalizacao) ?? "00:00:00"}${FUSO}`) : null;
      if (!id || !contrato || !fim || Number.isNaN(fim.getTime()) || fim < desde) continue;
      if (!contatos.has(contrato)) contatos.set(contrato, await this.contatoDoContrato(contrato));
      const contato = contatos.get(contrato)!;
      resultado.push({
        idExterno: id,
        tipo: classificarAssunto(texto(o.motivo)),
        colaboradorIdExterno: tecnicoDe(o),
        // O SGP identifica o cliente da O.S. só pelo contrato e pelo nome.
        cliente: { idExterno: `contrato-${contrato}`, nome: texto(o.cliente) ?? `Contrato ${contrato}`, ...contato },
        concluidoEm: fim,
      });
    }
    return resultado;
  }
}
