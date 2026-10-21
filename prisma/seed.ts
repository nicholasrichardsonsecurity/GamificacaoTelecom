/**
 * Dados de desenvolvimento: planos, um Super Admin, um tenant de demonstração
 * com regras de pontuação e níveis padrão, e um usuário por papel.
 * Idempotente: pode rodar várias vezes. Não use em produção.
 */
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const SENHA = process.env.SEED_SENHA ?? "sinalplus123";

// Padrão de docs/01-FUNDACAO-PRODUTO.md, seções 6 e 7.
const REGRAS_PADRAO = [
  { nivelSinal: 5, pontos: 10 },
  { nivelSinal: 4, pontos: 5 },
  { nivelSinal: 3, pontos: 0 },
  { nivelSinal: 2, pontos: -5 },
  { nivelSinal: 1, pontos: -10 },
];

const NIVEIS_PADRAO = [
  { nome: "Sinal Fraco", pontosAcumuladosMinimo: 0, cor: "#ef4444" },
  { nome: "Sinal Médio", pontosAcumuladosMinimo: 100, cor: "#eab308" },
  { nome: "Sinal Forte", pontosAcumuladosMinimo: 300, cor: "#84cc16" },
  { nome: "Fibra Pura", pontosAcumuladosMinimo: 700, cor: "#22c55e" },
  { nome: "Lenda da Rede", pontosAcumuladosMinimo: 1500, cor: "#0ea5e9" },
];

async function main() {
  const senhaHash = await bcrypt.hash(SENHA, 12);

  const planos = await Promise.all(
    [
      { nome: "Starter", limiteColaboradores: 30, limiteFiliais: 1 },
      { nome: "Pro", limiteColaboradores: 150, limiteFiliais: null, permiteDominioCustomizado: true },
      {
        nome: "Enterprise",
        limiteColaboradores: null,
        limiteFiliais: null,
        permiteDominioCustomizado: true,
        permiteIntegracaoERP: true,
      },
    ].map((p) => prisma.plano.upsert({ where: { nome: p.nome }, update: p, create: p })),
  );

  const superAdmin = await prisma.usuario.findFirst({
    where: { tenantId: null, email: "admin@sinalplus.local" },
  });
  if (!superAdmin) {
    await prisma.usuario.create({
      data: { nome: "Super Admin", email: "admin@sinalplus.local", senhaHash, role: "SUPER_ADMIN" },
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      nome: "Provedor Demonstração LTDA",
      slug: "demo",
      nomeExibicao: "Clube Fibra+",
      corPrimaria: "#2563eb",
      corSecundaria: "#0f172a",
      planoId: planos[2].id,
    },
  });

  const equipe = await prisma.equipe.upsert({
    where: { tenantId_nome: { tenantId: tenant.id, nome: "Paulista" } },
    update: {},
    create: { tenantId: tenant.id, nome: "Paulista" },
  });

  const usuarios: { nome: string; email: string; role: Role }[] = [
    { nome: "Ana Admin", email: "admin@demo.local", role: "ADMIN_PROVEDOR" },
    { nome: "Gabriel Gestor", email: "gestor@demo.local", role: "GESTOR" },
    { nome: "Carla Colaboradora", email: "colaborador@demo.local", role: "COLABORADOR" },
  ];
  for (const u of usuarios) {
    const usuario = await prisma.usuario.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: u.email } },
      update: {},
      create: { ...u, tenantId: tenant.id, senhaHash, equipeId: equipe.id },
    });
    if (u.role === "GESTOR") {
      await prisma.equipe.update({ where: { id: equipe.id }, data: { gestorId: usuario.id } });
    }
  }

  if ((await prisma.regraPontuacao.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.regraPontuacao.createMany({
      data: REGRAS_PADRAO.map((r) => ({ ...r, tenantId: tenant.id })),
    });
  }
  // Padrões de docs/03-MODELO-DADOS.md (ConfiguracaoPontuacao).
  await prisma.configuracaoPontuacao.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  });

  for (const n of NIVEIS_PADRAO) {
    await prisma.nivel.upsert({
      where: {
        tenantId_pontosAcumuladosMinimo: {
          tenantId: tenant.id,
          pontosAcumuladosMinimo: n.pontosAcumuladosMinimo,
        },
      },
      update: {},
      create: { ...n, tenantId: tenant.id },
    });
  }

  console.log("Seed concluído. Senha de todos os usuários de exemplo:", SENHA);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
