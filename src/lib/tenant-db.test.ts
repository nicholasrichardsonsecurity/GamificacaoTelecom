import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbDoTenant, escoparArgs, MODELOS_COM_TENANT, ViolacaoTenantError } from "./tenant-db";

describe("escoparArgs", () => {
  it("cobre os modelos de negócio, mas não Plano e Tenant", () => {
    expect(MODELOS_COM_TENANT.has("Usuario")).toBe(true);
    expect(MODELOS_COM_TENANT.has("TransacaoPontos")).toBe(true);
    expect(MODELOS_COM_TENANT.has("Plano")).toBe(false);
    expect(MODELOS_COM_TENANT.has("Tenant")).toBe(false);
  });

  it("injeta o tenant em leituras e escritas", () => {
    expect(escoparArgs("Premio", "findMany", { where: { ativo: true } }, "t1")).toEqual({
      where: { ativo: true, tenantId: "t1" },
    });
    expect(escoparArgs("Premio", "create", { data: { nome: "x" } }, "t1")).toEqual({
      data: { nome: "x", tenantId: "t1" },
    });
    expect(escoparArgs("Premio", "count", undefined, "t1")).toEqual({ where: { tenantId: "t1" } });
  });

  it("recusa gravar em outro tenant", () => {
    expect(() => escoparArgs("Premio", "create", { data: { tenantId: "t2" } }, "t1")).toThrow(
      ViolacaoTenantError,
    );
    expect(() =>
      escoparArgs("Premio", "create", { data: { tenant: { connect: { id: "t2" } } } }, "t1"),
    ).toThrow(ViolacaoTenantError);
    expect(() => escoparArgs("Premio", "update", { where: { id: "p" }, data: { tenantId: "t2" } }, "t1")).toThrow(
      ViolacaoTenantError,
    );
    expect(() =>
      escoparArgs("Premio", "createMany", { data: [{ tenantId: "t1" }, { tenantId: "t2" }] }, "t1"),
    ).toThrow(ViolacaoTenantError);
  });
});

/**
 * Testes de integração com Postgres real. Rodam quando TEST_DATABASE_URL está
 * definida (o CI define); use um banco descartável, pois o ledger não permite
 * apagar transações.
 */
const URL_TESTE = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL_TESTE)("isolamento multi-tenant no banco", () => {
  const prisma = new PrismaClient({ datasourceUrl: URL_TESTE });
  const sufixo = randomUUID().slice(0, 8);
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    const plano = await prisma.plano.upsert({
      where: { nome: "Teste" },
      update: {},
      create: { nome: "Teste" },
    });
    const criar = (slug: string) =>
      prisma.tenant.create({
        data: { nome: slug, slug, nomeExibicao: slug, planoId: plano.id },
      });
    tenantA = (await criar(`a-${sufixo}`)).id;
    tenantB = (await criar(`b-${sufixo}`)).id;
  });

  afterAll(() => prisma.$disconnect());

  it("cada tenant só enxerga os próprios registros", async () => {
    const dbA = dbDoTenant(tenantA, prisma);
    const dbB = dbDoTenant(tenantB, prisma);
    const clienteA = await dbA.clienteFinal.create({ data: { nome: "Cliente A" } as never });
    await dbB.clienteFinal.create({ data: { nome: "Cliente B" } as never });

    expect(clienteA.tenantId).toBe(tenantA);
    expect((await dbA.clienteFinal.findMany()).map((c) => c.nome)).toEqual(["Cliente A"]);
    expect(await dbB.clienteFinal.findUnique({ where: { id: clienteA.id } })).toBeNull();
    expect(await dbB.clienteFinal.count({ where: { id: clienteA.id } })).toBe(0);
  });

  it("não altera nem apaga registro de outro tenant", async () => {
    const dbA = dbDoTenant(tenantA, prisma);
    const dbB = dbDoTenant(tenantB, prisma);
    const premio = await dbA.premio.create({
      data: { nome: "Fone", custoPontos: 100, categoria: "eletrônicos", estoque: 1 } as never,
    });

    await expect(
      dbB.premio.update({ where: { id: premio.id }, data: { estoque: 99 } }),
    ).rejects.toThrow();
    expect((await dbB.premio.updateMany({ data: { estoque: 99 } })).count).toBe(0);
    expect((await dbB.premio.deleteMany({ where: { id: premio.id } })).count).toBe(0);
    expect((await dbA.premio.findUniqueOrThrow({ where: { id: premio.id } })).estoque).toBe(1);
  });

  it("e-mail e idExternoERP são únicos por tenant, não globalmente", async () => {
    const dados = { nome: "Técnico", email: "tec@x.local", idExternoERP: "42", origemCadastro: "IXC" as const };
    await dbDoTenant(tenantA, prisma).usuario.create({ data: dados as never });
    await dbDoTenant(tenantB, prisma).usuario.create({ data: dados as never });
    await expect(dbDoTenant(tenantA, prisma).usuario.create({ data: dados as never })).rejects.toThrow();
  });

  it("o banco impede usuário de tenant sem tenantId e vice-versa", async () => {
    await expect(
      prisma.usuario.create({ data: { nome: "x", role: "COLABORADOR" } }),
    ).rejects.toThrow();
    await expect(
      prisma.usuario.create({ data: { nome: "x", role: "SUPER_ADMIN", tenantId: tenantA } }),
    ).rejects.toThrow();
  });

  it("TransacaoPontos é um ledger imutável", async () => {
    const db = dbDoTenant(tenantA, prisma);
    const colaborador = await db.usuario.create({ data: { nome: "Colab" } as never });
    const transacao = await db.transacaoPontos.create({
      data: {
        colaboradorId: colaborador.id,
        tipo: "AJUSTE_MANUAL",
        pontos: 10,
        pontosCalculados: 10,
        motivo: "Teste do ledger",
      } as never,
    });

    await expect(
      prisma.transacaoPontos.update({ where: { id: transacao.id }, data: { pontos: 1000 } }),
    ).rejects.toThrow(/imutável/);
    await expect(prisma.transacaoPontos.delete({ where: { id: transacao.id } })).rejects.toThrow(
      /imutável/,
    );
  });

  it("ajuste manual sem motivo é rejeitado", async () => {
    const db = dbDoTenant(tenantA, prisma);
    const colaborador = await db.usuario.create({ data: { nome: "Colab 2" } as never });
    const base = { colaboradorId: colaborador.id, tipo: "AJUSTE_MANUAL", pontos: 5, pontosCalculados: 5 };
    await expect(db.transacaoPontos.create({ data: base as never })).rejects.toThrow();
    await expect(db.transacaoPontos.create({ data: { ...base, motivo: "  " } as never })).rejects.toThrow();
  });

  it("ConfiguracaoPontuacao é única por tenant e valida os valores", async () => {
    const db = dbDoTenant(tenantB, prisma);
    const config = await db.configuracaoPontuacao.create({ data: {} as never });
    expect(config).toMatchObject({ diasPendencia: 7, nivelRisco: 2, prazoContatoHoras: 24 });
    await expect(db.configuracaoPontuacao.create({ data: {} as never })).rejects.toThrow();
    await expect(
      dbDoTenant(tenantA, prisma).configuracaoPontuacao.create({ data: { nivelRisco: 6 } as never }),
    ).rejects.toThrow();
  });

  it("nivelSinal fora de 1 a 5 é rejeitado", async () => {
    await expect(
      dbDoTenant(tenantA, prisma).regraPontuacao.create({ data: { nivelSinal: 6, pontos: 1 } as never }),
    ).rejects.toThrow();
  });
});
