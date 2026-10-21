import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { clienteDeTeste, URL_TESTE } from "@/test/banco";
import { criarTenant, novoTenantSchema, SlugEmUsoError, urlDoTenant } from "./tenants";

describe("urlDoTenant", () => {
  const base = { slug: "giganet", dominioCustomizado: null, dominioVerificado: false };

  it("usa o subdomínio da plataforma, com http e porta em desenvolvimento", () => {
    expect(urlDoTenant(base, "/x", "sinalplus.com.br")).toBe("https://giganet.sinalplus.com.br/x");
    expect(urlDoTenant(base, "/x", "localhost")).toBe("http://giganet.localhost:3000/x");
  });

  it("usa o domínio próprio só depois de verificado", () => {
    const proprio = { ...base, dominioCustomizado: "pontos.giganet.com.br" };
    expect(urlDoTenant(proprio, "/", "sinalplus.com.br")).toBe("https://giganet.sinalplus.com.br/");
    expect(urlDoTenant({ ...proprio, dominioVerificado: true }, "/", "sinalplus.com.br")).toBe(
      "https://pontos.giganet.com.br/",
    );
  });
});

describe("novoTenantSchema", () => {
  const valido = {
    nome: "GigaNet LTDA",
    slug: "GigaNet",
    nomeExibicao: "Clube Giga",
    planoId: "p1",
    adminNome: "Ana",
    adminEmail: "Ana@GigaNet.com.br",
  };

  it("normaliza slug e e-mail e preenche cores padrão", () => {
    expect(novoTenantSchema.parse(valido)).toMatchObject({
      slug: "giganet",
      adminEmail: "ana@giganet.com.br",
      corPrimaria: "#16a34a",
    });
  });

  it("recusa slug reservado ou inválido", () => {
    expect(novoTenantSchema.safeParse({ ...valido, slug: "www" }).success).toBe(false);
    expect(novoTenantSchema.safeParse({ ...valido, slug: "giga.net" }).success).toBe(false);
  });
});

describe.skipIf(!URL_TESTE)("criarTenant no banco", () => {
  const prisma = clienteDeTeste();
  afterAll(() => prisma.$disconnect());

  it("cria o tenant com template padrão e admin sem senha; slug repetido vira erro legível", async () => {
    const plano = await prisma.plano.create({ data: { nome: `Plano ${randomUUID()}` } });
    const slug = `t-${randomUUID().slice(0, 8)}`;
    const dados = novoTenantSchema.parse({
      nome: "Provedor",
      slug,
      nomeExibicao: "Provedor+",
      planoId: plano.id,
      adminNome: "Admin",
      adminEmail: "admin@provedor.com.br",
    });
    const { tenant, admin } = await criarTenant(prisma, dados);
    expect(admin).toMatchObject({ role: "ADMIN_PROVEDOR", senhaHash: null, tenantId: tenant.id });
    const [regras, niveis, selos, config] = await Promise.all([
      prisma.regraPontuacao.count({ where: { tenantId: tenant.id } }),
      prisma.nivel.count({ where: { tenantId: tenant.id } }),
      prisma.selo.count({ where: { tenantId: tenant.id } }),
      prisma.configuracaoPontuacao.count({ where: { tenantId: tenant.id } }),
    ]);
    expect({ regras, niveis, selos, config }).toEqual({ regras: 5, niveis: 5, selos: 3, config: 1 });

    await expect(criarTenant(prisma, dados)).rejects.toBeInstanceOf(SlugEmUsoError);
  });
});
