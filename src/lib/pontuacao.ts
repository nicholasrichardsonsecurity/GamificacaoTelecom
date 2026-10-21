import { Prisma, type TipoTransacao } from "@prisma/client";
import { inicioDaSemana, inicioDoDia, somarDias } from "./periodo";
import type { DbDoTenant, TxDoTenant } from "./tenant-db";
import { hashToken, tokenValido } from "./tokens";

/**
 * Motor de pontuação (docs/02-ARQUITETURA-STACK.md, seção 6).
 *
 * - Créditos respeitam os limites diário/semanal e ficam pendentes por
 *   `diasPendencia` dias.
 * - Débitos respeitam o piso em zero no momento do débito.
 * - O valor bruto da regra vai em `pontosCalculados`; o efetivo em `pontos`.
 * - Avaliação suspeita não pontua até a revisão do gestor.
 */

/** Padrão de docs/01-FUNDACAO-PRODUTO.md, usado se o tenant não tiver regra. */
export const PONTOS_PADRAO: Record<number, number> = { 5: 10, 4: 5, 3: 0, 2: -5, 1: -10 };

export const CONFIGURACAO_PADRAO = {
  diasPendencia: 7,
  limiteDiario: null as number | null,
  limiteSemanal: null as number | null,
  nivelRisco: 2,
  prazoContatoHoras: 24,
};

/** Segundos mínimos entre a conclusão do atendimento e a resposta. */
export const RESPOSTA_RAPIDA_SEGUNDOS = 60;

/** Quantas avaliações de sinal máximo seguidas dão o selo de sequência. */
export const SEQUENCIA_SELO = 7;

export type EntradaDelta = {
  pontosRegra: number;
  multiplicador: number;
  saldoTotal: number;
  creditadoHoje: number;
  creditadoSemana: number;
  limiteDiario: number | null;
  limiteSemanal: number | null;
};

/** Cálculo puro do delta de pontos de uma avaliação. */
export function calcularDelta(e: EntradaDelta): { pontos: number; pontosCalculados: number } {
  if (e.pontosRegra > 0) {
    const pontosCalculados = Math.round(e.pontosRegra * Math.max(e.multiplicador, 0));
    let teto = pontosCalculados;
    if (e.limiteDiario !== null) teto = Math.min(teto, e.limiteDiario - e.creditadoHoje);
    if (e.limiteSemanal !== null) teto = Math.min(teto, e.limiteSemanal - e.creditadoSemana);
    return { pontos: Math.max(0, teto), pontosCalculados };
  }
  if (e.pontosRegra < 0) {
    const debito = Math.min(-e.pontosRegra, Math.max(0, e.saldoTotal));
    return { pontos: debito === 0 ? 0 : -debito, pontosCalculados: e.pontosRegra };
  }
  return { pontos: 0, pontosCalculados: 0 };
}

export async function configuracaoDo(tx: Pick<TxDoTenant, "configuracaoPontuacao">) {
  const c = await tx.configuracaoPontuacao.findFirst();
  return c ?? CONFIGURACAO_PADRAO;
}

/** Serializa operações de pontos do mesmo colaborador (limites e piso). */
async function travarColaborador(tx: TxDoTenant, colaboradorId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${colaboradorId} FOR UPDATE`;
}

async function somaPontos(tx: TxDoTenant, where: Prisma.TransacaoPontosWhereInput) {
  const r = await tx.transacaoPontos.aggregate({ where, _sum: { pontos: true } });
  return r._sum.pontos ?? 0;
}

/**
 * Grava a transação de pontos de uma avaliação. Idempotente: se a avaliação já
 * gerou transação, não faz nada. Retorna a transação criada (ou null).
 */
export async function aplicarPontuacao(
  tx: TxDoTenant,
  tenantId: string,
  avaliacaoId: string,
  agora = new Date(),
) {
  const avaliacao = await tx.avaliacao.findUniqueOrThrow({
    where: { id: avaliacaoId },
    include: {
      transacao: true,
      atendimento: { include: { colaborador: { select: { id: true, equipeId: true } } } },
    },
  });
  if (avaliacao.transacao) return null;
  const colaborador = avaliacao.atendimento.colaborador;
  await travarColaborador(tx, colaborador.id);

  const config = await configuracaoDo(tx);
  const regra = await tx.regraPontuacao.findFirst({
    where: {
      nivelSinal: avaliacao.nivelSinal,
      ativaDesde: { lte: agora },
      OR: [{ ativaAte: null }, { ativaAte: { gt: agora } }],
    },
    orderBy: { ativaDesde: "desc" },
  });
  const pontosRegra = regra?.pontos ?? PONTOS_PADRAO[avaliacao.nivelSinal] ?? 0;

  const campanhas = await tx.campanhaPontos.findMany({
    where: {
      inicio: { lte: agora },
      fim: { gt: agora },
      OR: [{ equipeId: null }, ...(colaborador.equipeId ? [{ equipeId: colaborador.equipeId }] : [])],
    },
    select: { multiplicador: true },
  });
  const multiplicador = campanhas.reduce((m, c) => Math.max(m, Number(c.multiplicador)), 1);

  const creditos = { colaboradorId: colaborador.id, tipo: "CREDITO_AVALIACAO" as TipoTransacao };
  const [saldoTotal, creditadoHoje, creditadoSemana] = await Promise.all([
    somaPontos(tx, { colaboradorId: colaborador.id }),
    somaPontos(tx, { ...creditos, criadoEm: { gte: inicioDoDia(agora) } }),
    somaPontos(tx, { ...creditos, criadoEm: { gte: inicioDaSemana(agora) } }),
  ]);

  const { pontos, pontosCalculados } = calcularDelta({
    pontosRegra,
    multiplicador,
    saldoTotal,
    creditadoHoje,
    creditadoSemana,
    limiteDiario: config.limiteDiario,
    limiteSemanal: config.limiteSemanal,
  });
  if (pontosCalculados === 0) return null;

  const credito = pontosCalculados > 0;
  return tx.transacaoPontos.create({
    data: {
      tenantId,
      colaboradorId: colaborador.id,
      tipo: credito ? "CREDITO_AVALIACAO" : "DEBITO_AVALIACAO",
      pontos,
      pontosCalculados,
      disponivelEm: credito ? somarDias(agora, config.diasPendencia) : agora,
      origemAvaliacaoId: avaliacao.id,
      criadoEm: agora,
    },
  });
}

/** Concede selos de sequência de sinal máximo, se o colaborador acabou de completá-la. */
export async function verificarSeloSequencia(
  tx: TxDoTenant,
  tenantId: string,
  colaboradorId: string,
  agora = new Date(),
) {
  const selos = await tx.selo.findMany({ where: { criterioTipo: "SEQUENCIA_SINAL_MAXIMO" } });
  if (selos.length === 0) return [];
  const ultimas = await tx.avaliacao.findMany({
    where: {
      atendimento: { colaboradorId },
      OR: [{ suspeita: false }, { suspeitaAceita: true }],
    },
    orderBy: { respondidaEm: "desc" },
    take: SEQUENCIA_SELO,
    select: { nivelSinal: true },
  });
  if (ultimas.length < SEQUENCIA_SELO || ultimas.some((a) => a.nivelSinal !== 5)) return [];

  const ja = await tx.seloConquistado.findMany({
    where: { colaboradorId, seloId: { in: selos.map((s) => s.id) } },
    select: { seloId: true },
  });
  const novos = selos.filter((s) => !ja.some((j) => j.seloId === s.id));
  for (const selo of novos) {
    await tx.seloConquistado.create({
      data: { tenantId, colaboradorId, seloId: selo.id, conquistadoEm: agora },
    });
  }
  return novos;
}

export type ResultadoResposta =
  | { ok: true; avaliacaoId: string; suspeita: boolean }
  | { ok: false; motivo: "invalido" | "expirado" | "respondido" };

/**
 * Registra a resposta do cliente a um convite de pesquisa: cria a Avaliacao,
 * pontua (se não for suspeita), abre caso de recuperação e verifica selos —
 * tudo numa transação.
 */
export async function registrarResposta(
  db: DbDoTenant,
  tenantId: string,
  entrada: {
    token: string;
    nivelSinal: number;
    comentario?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    /** O navegador que respondeu tem sessão de um usuário deste provedor. */
    respondenteLogado?: boolean;
  },
  agora = new Date(),
): Promise<ResultadoResposta> {
  if (!tokenValido(entrada.token)) return { ok: false, motivo: "invalido" };
  if (!Number.isInteger(entrada.nivelSinal) || entrada.nivelSinal < 1 || entrada.nivelSinal > 5) {
    return { ok: false, motivo: "invalido" };
  }

  try {
    return await db.$transaction(async (tx) => {
      const convite = await tx.convitePesquisa.findUnique({
        where: { tokenHash: hashToken(entrada.token) },
        include: {
          atendimento: {
            include: { colaborador: { select: { id: true, equipe: { select: { gestorId: true } } } } },
          },
        },
      });
      if (!convite) return { ok: false, motivo: "invalido" } as const;
      if (convite.respondidoEm) return { ok: false, motivo: "respondido" } as const;
      if (convite.expiraEm <= agora) return { ok: false, motivo: "expirado" } as const;

      const motivos: string[] = [];
      if (entrada.respondenteLogado) {
        motivos.push("Resposta enviada de um navegador com sessão de usuário do provedor");
      }
      // Só vale para convites enviados automaticamente (ERP + WhatsApp/SMS/e-mail):
      // no registro manual, quem gera e envia o link é o admin, e o cliente
      // responder logo em seguida é o esperado.
      const segundos = (agora.getTime() - convite.atendimento.concluidoEm.getTime()) / 1000;
      if (convite.canal !== "MANUAL" && segundos < RESPOSTA_RAPIDA_SEGUNDOS) {
        motivos.push("Respondida menos de 1 minuto após a conclusão do atendimento");
      }

      const avaliacao = await tx.avaliacao.create({
        data: {
          tenantId,
          atendimentoId: convite.atendimentoId,
          conviteId: convite.id,
          nivelSinal: entrada.nivelSinal,
          comentario: entrada.comentario?.trim().slice(0, 2000) || null,
          respondidaEm: agora,
          ipResposta: entrada.ip?.slice(0, 100) ?? null,
          userAgentResposta: entrada.userAgent?.slice(0, 500) ?? null,
          suspeita: motivos.length > 0,
          motivoSuspeita: motivos.join("; ") || null,
        },
      });
      await tx.convitePesquisa.update({ where: { id: convite.id }, data: { respondidoEm: agora } });

      const colaboradorId = convite.atendimento.colaboradorId;
      if (motivos.length === 0) {
        await aplicarPontuacao(tx, tenantId, avaliacao.id, agora);
      }

      const config = await configuracaoDo(tx);
      if (entrada.nivelSinal <= config.nivelRisco) {
        await tx.casoRecuperacao.create({
          data: {
            tenantId,
            avaliacaoId: avaliacao.id,
            gestorResponsavelId: convite.atendimento.colaborador.equipe?.gestorId ?? null,
            prazoContato: new Date(agora.getTime() + config.prazoContatoHoras * 3600_000),
            criadoEm: agora,
          },
        });
      }

      if (motivos.length === 0 && entrada.nivelSinal === 5) {
        await verificarSeloSequencia(tx, tenantId, colaboradorId, agora);
      }
      return { ok: true, avaliacaoId: avaliacao.id, suspeita: motivos.length > 0 } as const;
    });
  } catch (erro) {
    // Duas respostas simultâneas ao mesmo convite: a segunda cai no índice único.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { ok: false, motivo: "respondido" };
    }
    throw erro;
  }
}

/** Decisão do gestor sobre uma avaliação suspeita. Aceitar = pontuar agora. */
export async function revisarSuspeita(
  db: DbDoTenant,
  tenantId: string,
  avaliacaoId: string,
  revisorId: string,
  aceitar: boolean,
  agora = new Date(),
) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.avaliacao.updateMany({
      where: { id: avaliacaoId, suspeita: true, revisadaEm: null },
      data: { revisadaEm: agora, revisadaPorId: revisorId, suspeitaAceita: aceitar },
    });
    if (count === 0) return false;
    if (aceitar) {
      await aplicarPontuacao(tx, tenantId, avaliacaoId, agora);
      const a = await tx.avaliacao.findUniqueOrThrow({
        where: { id: avaliacaoId },
        select: { nivelSinal: true, atendimento: { select: { colaboradorId: true } } },
      });
      if (a.nivelSinal === 5) {
        await verificarSeloSequencia(tx, tenantId, a.atendimento.colaboradorId, agora);
      }
    }
    return true;
  });
}

/** Maior nota que ainda pode ser contestada. */
export const NOTA_MAXIMA_CONTESTAVEL = 3;

export async function abrirContestacao(
  db: DbDoTenant,
  tenantId: string,
  colaboradorId: string,
  avaliacaoId: string,
  justificativa: string,
) {
  const texto = justificativa.trim();
  if (texto.length < 10) throw new Error("Explique a contestação com pelo menos 10 caracteres.");
  const avaliacao = await db.avaliacao.findFirst({
    where: { id: avaliacaoId, atendimento: { colaboradorId } },
    include: { contestacao: true },
  });
  if (!avaliacao) throw new Error("Avaliação não encontrada.");
  if (avaliacao.nivelSinal > NOTA_MAXIMA_CONTESTAVEL) {
    throw new Error("Só avaliações de até 3 barras podem ser contestadas.");
  }
  if (avaliacao.contestacao) throw new Error("Esta avaliação já foi contestada.");
  if (avaliacao.suspeita && avaliacao.suspeitaAceita !== true) {
    throw new Error("Esta avaliação está em revisão e ainda não conta pontos.");
  }
  return db.contestacaoAvaliacao.create({
    data: { tenantId, avaliacaoId, colaboradorId, justificativa: texto.slice(0, 2000) },
  });
}

/**
 * Decisão do gestor sobre uma contestação. Se aceita e a avaliação debitou
 * pontos, o estorno entra como AJUSTE_MANUAL com motivo (o ledger não muda).
 */
export async function decidirContestacao(
  db: DbDoTenant,
  tenantId: string,
  contestacaoId: string,
  gestorId: string,
  aceitar: boolean,
  decisao: string,
  agora = new Date(),
) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.contestacaoAvaliacao.updateMany({
      where: { id: contestacaoId, status: "ABERTA" },
      data: {
        status: aceitar ? "ACEITA" : "RECUSADA",
        decididaPorId: gestorId,
        decisao: decisao.trim().slice(0, 2000) || null,
        decididaEm: agora,
      },
    });
    if (count === 0) return null;
    if (!aceitar) return null;

    const c = await tx.contestacaoAvaliacao.findUniqueOrThrow({
      where: { id: contestacaoId },
      include: { avaliacao: { include: { transacao: true } } },
    });
    const debito = c.avaliacao.transacao;
    if (!debito || debito.pontos >= 0) return null;
    await travarColaborador(tx, c.colaboradorId);
    return tx.transacaoPontos.create({
      data: {
        tenantId,
        colaboradorId: c.colaboradorId,
        tipo: "AJUSTE_MANUAL",
        pontos: -debito.pontos,
        pontosCalculados: -debito.pontos,
        disponivelEm: agora,
        criadoEm: agora,
        criadoPorId: gestorId,
        motivo: `Estorno de contestação aceita (avaliação ${c.avaliacaoId})`,
      },
    });
  });
}
