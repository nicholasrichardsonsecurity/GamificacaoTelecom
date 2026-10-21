import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { aplicarTemplatePadrao } from "@/lib/onboarding";

/**
 * Apoio aos testes de integração. Rodam só com TEST_DATABASE_URL apontando
 * para um banco descartável (o CI define).
 */
export const URL_TESTE = process.env.TEST_DATABASE_URL;

export function clienteDeTeste() {
  return new PrismaClient({ datasourceUrl: URL_TESTE });
}

export async function criarTenantDeTeste(
  prisma: PrismaClient,
  opcoes: { limiteColaboradores?: number | null; limiteFiliais?: number | null } = {},
) {
  const sufixo = randomUUID().slice(0, 8);
  const plano = await prisma.plano.create({
    data: {
      nome: `Teste ${sufixo}`,
      limiteColaboradores: opcoes.limiteColaboradores ?? null,
      limiteFiliais: opcoes.limiteFiliais ?? null,
    },
  });
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { nome: sufixo, slug: `t-${sufixo}`, nomeExibicao: sufixo, planoId: plano.id },
    });
    await aplicarTemplatePadrao(tx, tenant.id);
    return tenant;
  });
}
