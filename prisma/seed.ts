/**
 * Dados de desenvolvimento: planos, um Super Admin, um tenant de demonstração
 * com o template padrão, um usuário por papel e algumas avaliações.
 * Idempotente: pode rodar várias vezes. Não use em produção.
 */
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { criarConvitePesquisa } from "../src/lib/convites";
import { aplicarTemplatePadrao, SELOS_PADRAO } from "../src/lib/onboarding";
import { registrarResposta } from "../src/lib/pontuacao";
import { dbDoTenant } from "../src/lib/tenant-db";

const prisma = new PrismaClient();
const SENHA = process.env.SEED_SENHA ?? "sinalplus123";

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

  // Template padrão (regras, níveis, selos e configuração), como no onboarding.
  if (!(await prisma.configuracaoPontuacao.findUnique({ where: { tenantId: tenant.id } }))) {
    await prisma.$transaction((tx) => aplicarTemplatePadrao(tx, tenant.id));
  } else if ((await prisma.selo.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.selo.createMany({ data: SELOS_PADRAO.map((s) => ({ ...s, tenantId: tenant.id })) });
  }

  await atendimentosDeExemplo(tenant.id);

  console.log("Seed concluído. Senha de todos os usuários de exemplo:", SENHA);
}

/** Algumas avaliações para o painel não nascer vazio. */
async function atendimentosDeExemplo(tenantId: string) {
  const db = dbDoTenant(tenantId, prisma);
  if ((await db.atendimento.count()) > 0) return;
  const carla = await db.usuario.findFirstOrThrow({ where: { email: "colaborador@demo.local" } });
  const notas = [5, 5, 4, 5, 2, 5, null];
  const agora = Date.now();
  for (const [i, nota] of notas.entries()) {
    const concluidoEm = new Date(agora - (notas.length - i) * 86400_000);
    const cliente = await db.clienteFinal.create({
      data: { tenantId, nome: `Cliente exemplo ${i + 1}`, telefone: `(81) 90000-00${10 + i}` },
    });
    const atendimento = await db.atendimento.create({
      data: {
        tenantId,
        tipo: i % 3 === 0 ? "INSTALACAO" : "SUPORTE",
        colaboradorId: carla.id,
        clienteFinalId: cliente.id,
        concluidoEm,
      },
    });
    const token = await criarConvitePesquisa(db, tenantId, atendimento.id, "MANUAL", concluidoEm);
    if (token && nota) {
      const respondidaEm = new Date(concluidoEm.getTime() + 2 * 3600_000);
      await registrarResposta(db, tenantId, { token, nivelSinal: nota, comentario: nota < 3 ? "Demorou para resolver." : null }, respondidaEm);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
