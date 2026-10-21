import type { Prisma, Role, TipoAtendimento } from "@prisma/client";
import type { DbDoTenant } from "./tenant-db";

/**
 * Ranking e relatório de satisfação (CSAT). O gestor só enxerga as equipes
 * que gerencia; o admin do provedor enxerga o tenant inteiro.
 */

export type Visao = { id: string; role: Role };

/** Filtro de colaboradores visíveis para quem está olhando. */
export function colaboradoresVisiveis(visao: Visao): Prisma.UsuarioWhereInput {
  return visao.role === "GESTOR" ? { equipe: { gestorId: visao.id } } : {};
}

/** Fora da média: suspeitas ainda sem revisão e suspeitas descartadas. */
const AVALIACAO_VALIDA: Prisma.AvaliacaoWhereInput[] = [{ suspeita: false }, { suspeitaAceita: true }];

export type LinhaRanking = {
  colaboradorId: string;
  nome: string;
  equipe: string | null;
  pontos: number;
  avaliacoes: number;
  mediaSinal: number | null;
};

/**
 * Pontos ganhos no período (avaliações e ajustes; resgates não tiram ninguém
 * do ranking), com o número de avaliações e a média de sinal.
 */
export async function ranking(
  db: DbDoTenant,
  filtro: { desde: Date | null; equipeId?: string | null; colaboradores?: Prisma.UsuarioWhereInput },
): Promise<LinhaRanking[]> {
  const colaborador: Prisma.UsuarioWhereInput = {
    ativo: true,
    role: { in: ["COLABORADOR", "GESTOR"] },
    ...(filtro.equipeId ? { equipeId: filtro.equipeId } : {}),
    ...filtro.colaboradores,
  };
  const desde = filtro.desde ? { gte: filtro.desde } : undefined;

  const [pessoas, somas, avaliacoes] = await Promise.all([
    db.usuario.findMany({
      where: colaborador,
      select: { id: true, nome: true, equipe: { select: { nome: true } } },
    }),
    db.transacaoPontos.groupBy({
      by: ["colaboradorId"],
      where: { tipo: { not: "RESGATE" }, criadoEm: desde, colaborador },
      _sum: { pontos: true },
    }),
    db.avaliacao.findMany({
      where: { respondidaEm: desde, atendimento: { colaborador }, OR: AVALIACAO_VALIDA },
      select: { nivelSinal: true, atendimento: { select: { colaboradorId: true } } },
    }),
  ]);

  const pontos = new Map(somas.map((s) => [s.colaboradorId, s._sum.pontos ?? 0]));
  const notas = new Map<string, number[]>();
  for (const a of avaliacoes) {
    const lista = notas.get(a.atendimento.colaboradorId) ?? [];
    lista.push(a.nivelSinal);
    notas.set(a.atendimento.colaboradorId, lista);
  }

  return pessoas
    .map((p) => {
      const n = notas.get(p.id) ?? [];
      return {
        colaboradorId: p.id,
        nome: p.nome,
        equipe: p.equipe?.nome ?? null,
        pontos: pontos.get(p.id) ?? 0,
        avaliacoes: n.length,
        mediaSinal: n.length ? n.reduce((a, b) => a + b, 0) / n.length : null,
      };
    })
    .sort(
      (a, b) =>
        b.pontos - a.pontos ||
        (b.mediaSinal ?? 0) - (a.mediaSinal ?? 0) ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

export type GrupoCsat = {
  chave: string;
  convites: number;
  respostas: number;
  /** Respostas / convites enviados. */
  taxaResposta: number | null;
  mediaSinal: number | null;
  /** Quantidade de respostas por nível de sinal, índice 0 = 1 barra. */
  distribuicao: [number, number, number, number, number];
};

export type RelatorioCsat = {
  geral: GrupoCsat;
  porTipo: (GrupoCsat & { tipo: TipoAtendimento })[];
  porEquipe: GrupoCsat[];
};

function grupoVazio(chave: string): GrupoCsat {
  return { chave, convites: 0, respostas: 0, taxaResposta: null, mediaSinal: null, distribuicao: [0, 0, 0, 0, 0] };
}

function fechar<G extends GrupoCsat>(g: G): G {
  const soma = g.distribuicao.reduce((t, q, i) => t + q * (i + 1), 0);
  return {
    ...g,
    taxaResposta: g.convites ? g.respostas / g.convites : null,
    mediaSinal: g.respostas ? soma / g.respostas : null,
  };
}

/**
 * CSAT pelos convites criados no período. Avaliações suspeitas só entram
 * depois que o gestor as aceita.
 */
export async function relatorioCsat(
  db: DbDoTenant,
  filtro: { desde: Date | null; colaboradores?: Prisma.UsuarioWhereInput },
): Promise<RelatorioCsat> {
  const convites = await db.convitePesquisa.findMany({
    where: {
      criadoEm: filtro.desde ? { gte: filtro.desde } : undefined,
      atendimento: { colaborador: filtro.colaboradores ?? {} },
    },
    select: {
      atendimento: {
        select: { tipo: true, colaborador: { select: { equipe: { select: { nome: true } } } } },
      },
      avaliacao: { select: { nivelSinal: true, suspeita: true, suspeitaAceita: true } },
    },
  });

  const geral = grupoVazio("Geral");
  const porTipo = new Map<TipoAtendimento, GrupoCsat & { tipo: TipoAtendimento }>();
  const porEquipe = new Map<string, GrupoCsat>();

  for (const c of convites) {
    const tipo = c.atendimento.tipo;
    const equipe = c.atendimento.colaborador.equipe?.nome ?? "Sem equipe";
    if (!porTipo.has(tipo)) porTipo.set(tipo, { ...grupoVazio(tipo), tipo });
    if (!porEquipe.has(equipe)) porEquipe.set(equipe, grupoVazio(equipe));
    const valida = c.avaliacao && (!c.avaliacao.suspeita || c.avaliacao.suspeitaAceita === true);
    for (const g of [geral, porTipo.get(tipo)!, porEquipe.get(equipe)!]) {
      g.convites++;
      if (valida) {
        g.respostas++;
        g.distribuicao[c.avaliacao!.nivelSinal - 1]++;
      }
    }
  }

  return {
    geral: fechar(geral),
    porTipo: [...porTipo.values()].map(fechar),
    porEquipe: [...porEquipe.values()].map(fechar).sort((a, b) => a.chave.localeCompare(b.chave, "pt-BR")),
  };
}
