import { z } from "zod";
import type { DbDoTenant } from "./tenant-db";

/**
 * Regras de pontuação e configuração do motor, editadas pelo Admin do Provedor.
 * Regras são versionadas: mudar o valor encerra a regra vigente (`ativaAte`) e
 * cria outra, para que avaliações antigas continuem explicáveis.
 */

export const configuracaoSchema = z
  .object({
    diasPendencia: z.coerce.number().int().min(0).max(90),
    limiteDiario: z.coerce.number().int().min(1).max(100_000).nullable(),
    limiteSemanal: z.coerce.number().int().min(1).max(100_000).nullable(),
    nivelRisco: z.coerce.number().int().min(1).max(5),
    prazoContatoHoras: z.coerce.number().int().min(1).max(720),
  })
  .refine(
    (c) => c.limiteDiario === null || c.limiteSemanal === null || c.limiteDiario <= c.limiteSemanal,
    { message: "O limite diário não pode ser maior que o semanal.", path: ["limiteDiario"] },
  );

export type Configuracao = z.infer<typeof configuracaoSchema>;

export const pontosSchema = z.coerce.number().int().min(-1000).max(1000);

/** Regras vigentes por nível de sinal (1 a 5). */
export async function regrasVigentes(db: DbDoTenant, agora = new Date()) {
  const regras = await db.regraPontuacao.findMany({
    where: { ativaDesde: { lte: agora }, OR: [{ ativaAte: null }, { ativaAte: { gt: agora } }] },
    orderBy: { ativaDesde: "desc" },
  });
  const porNivel = new Map<number, (typeof regras)[number]>();
  for (const r of regras) if (!porNivel.has(r.nivelSinal)) porNivel.set(r.nivelSinal, r);
  return porNivel;
}

/** Grava só as regras que mudaram; devolve quantas mudaram. */
export async function salvarRegras(
  db: DbDoTenant,
  tenantId: string,
  pontosPorNivel: Record<number, number>,
  agora = new Date(),
) {
  return db.$transaction(async (tx) => {
    let alteradas = 0;
    for (const nivel of [1, 2, 3, 4, 5]) {
      const pontos = pontosPorNivel[nivel];
      if (pontos === undefined) continue;
      const vigente = await tx.regraPontuacao.findFirst({
        where: { nivelSinal: nivel, ativaAte: null },
        orderBy: { ativaDesde: "desc" },
      });
      if (vigente?.pontos === pontos) continue;
      if (vigente) {
        await tx.regraPontuacao.updateMany({ where: { id: vigente.id }, data: { ativaAte: agora } });
      }
      await tx.regraPontuacao.create({ data: { tenantId, nivelSinal: nivel, pontos, ativaDesde: agora } });
      alteradas++;
    }
    return alteradas;
  });
}

export async function salvarConfiguracao(db: DbDoTenant, tenantId: string, config: Configuracao) {
  const atual = await db.configuracaoPontuacao.findFirst();
  if (atual) {
    await db.configuracaoPontuacao.update({ where: { id: atual.id }, data: config });
  } else {
    await db.configuracaoPontuacao.create({ data: { tenantId, ...config } });
  }
}
