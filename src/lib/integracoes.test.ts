import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Tenant } from "@prisma/client";
import { clienteDeTeste, criarTenantDeTeste, URL_TESTE } from "@/test/banco";
import { decifrar } from "./crypto";
import { integracaoSchema, lerCredenciais, salvarIntegracao } from "./integracoes";
import { sincronizarVencidas } from "./sincronizacao-agendada";
import { dbDoTenant } from "./tenant-db";

describe.skipIf(!URL_TESTE)("integração com ERP: configuração e varredura", () => {
  const prisma = clienteDeTeste();
  let tenant: Tenant;
  let db: ReturnType<typeof dbDoTenant>;
  const chave = Buffer.alloc(32, 7).toString("base64");
  const dados = integracaoSchema.parse({ sistema: "IXC", urlBase: "https://ixc.x.com/", frequenciaSincronizacao: "60", ativa: true });

  beforeAll(async () => {
    vi.stubEnv("CREDENCIAIS_CHAVE", chave);
    tenant = await criarTenantDeTeste(prisma, { limiteColaboradores: 5 });
    db = dbDoTenant(tenant.id, prisma);
    await prisma.plano.update({ where: { id: tenant.planoId }, data: { permiteIntegracaoERP: true } });
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await prisma.$disconnect();
  });

  it("grava credenciais cifradas e as mantém quando o campo vem em branco", async () => {
    const cred = lerCredenciais("IXC", { token: "7:segredo", app: "" });
    const i = await salvarIntegracao(db, tenant.id, dados, cred);
    expect(i.urlBase).toBe("https://ixc.x.com");
    expect(i.credenciais).not.toContain("segredo");
    expect(JSON.parse(decifrar(i.credenciais))).toEqual({ token: "7:segredo" });

    const antes = i.credenciais;
    const i2 = await salvarIntegracao(db, tenant.id, { ...dados, frequenciaSincronizacao: 30 }, lerCredenciais("IXC", { token: "", app: "" }));
    expect(i2.credenciais).toBe(antes);
    expect(i2.frequenciaSincronizacao).toBe(30);
    expect(await db.integracaoERP.count()).toBe(1);
  });

  it("exige credenciais na primeira vez e respeita o plano", async () => {
    await expect(salvarIntegracao(db, tenant.id, { ...dados, sistema: "SGP" }, null)).rejects.toThrow("credenciais");
    await prisma.plano.update({ where: { id: tenant.planoId }, data: { permiteIntegracaoERP: false } });
    await expect(salvarIntegracao(db, tenant.id, dados, { token: "t" })).rejects.toThrow("plano");
    await prisma.plano.update({ where: { id: tenant.planoId }, data: { permiteIntegracaoERP: true } });
  });

  it("a varredura só roda o que venceu e registra a tentativa mesmo com falha", async () => {
    const agora = new Date("2026-10-21T12:00:00Z");
    // A varredura é global: isola as integrações que outros testes deixaram no banco.
    await prisma.integracaoERP.updateMany({ where: { tenantId: { not: tenant.id } }, data: { ativa: false } });
    const integ = await db.integracaoERP.findFirstOrThrow();
    // URL inalcançável: falha rápida (host interno bloqueado), sem rede real.
    await db.integracaoERP.update({ where: { id: integ.id }, data: { urlBase: "http://127.0.0.1:9", ultimaTentativaEm: null } });
    expect(await sincronizarVencidas(prisma, agora)).toMatchObject({ falhas: 1, executadas: 0 });
    const depois = await db.integracaoERP.findFirstOrThrow();
    expect(depois).toMatchObject({ ultimoStatusSincronizacao: "ERRO", ultimaTentativaEm: agora });
    // ainda dentro da frequência (30 min): não tenta de novo
    expect(await sincronizarVencidas(prisma, new Date(agora.getTime() + 10 * 60_000))).toEqual({ executadas: 0, falhas: 0 });
    expect((await sincronizarVencidas(prisma, new Date(agora.getTime() + 31 * 60_000))).falhas).toBe(1);
  });
});
