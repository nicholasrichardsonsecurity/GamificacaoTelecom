"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EstadoLink } from "@/components/gerar-link";
import { campos, mensagemDe, voltar } from "@/lib/acoes";
import { criarConviteAcesso } from "@/lib/convites";
import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/sessao";
import { dbDoTenant } from "@/lib/tenant-db";
import { criarTenant, novoTenantSchema, urlDoTenant } from "@/lib/tenants";

export async function criarProvedor(formData: FormData) {
  await exigirSessao(["SUPER_ADMIN"]);
  let id: string;
  try {
    const { tenant } = await criarTenant(prisma, novoTenantSchema.parse(campos(formData)));
    id = tenant.id;
  } catch (erro) {
    voltar("/superadmin/novo", { erro: mensagemDe(erro) });
  }
  revalidatePath("/superadmin");
  voltar(`/superadmin/${id}`, {
    ok: "Provedor criado com regras, níveis e selos padrão. Gere o link de acesso do administrador abaixo.",
  });
}

const edicaoSchema = z.object({
  nome: z.string().trim().min(2, "Informe a razão social.").max(200),
  nomeExibicao: z.string().trim().min(2, "Informe o nome de exibição.").max(80),
  planoId: z.string().min(1),
  status: z.enum(["ATIVO", "SUSPENSO"]),
  dominioCustomizado: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .transform((v) => v || null)
    .pipe(
      z
        .string()
        .regex(/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/, "Domínio inválido.")
        .nullable(),
    ),
  dominioVerificado: z.literal("on").optional(),
});

export async function editarProvedor(id: string, formData: FormData) {
  await exigirSessao(["SUPER_ADMIN"]);
  const caminho = `/superadmin/${id}`;
  try {
    const d = edicaoSchema.parse(campos(formData));
    await prisma.tenant.update({
      where: { id },
      data: {
        nome: d.nome,
        nomeExibicao: d.nomeExibicao,
        planoId: d.planoId,
        status: d.status,
        dominioCustomizado: d.dominioCustomizado,
        // Até a Fase 5 (verificação por DNS), o Super Admin confirma à mão.
        dominioVerificado: Boolean(d.dominioCustomizado && d.dominioVerificado),
      },
    });
  } catch (erro) {
    const msg =
      erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002"
        ? "Este domínio já está em uso por outro provedor."
        : mensagemDe(erro);
    voltar(caminho, { erro: msg });
  }
  revalidatePath("/superadmin");
  voltar(caminho, { ok: "Provedor atualizado." });
}

export async function linkDoAdmin(tenantId: string, usuarioId: string): Promise<EstadoLink> {
  await exigirSessao(["SUPER_ADMIN"]);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { erro: "Provedor não encontrado." };
  const db = dbDoTenant(tenant.id);
  const admin = await db.usuario.findFirst({ where: { id: usuarioId, role: "ADMIN_PROVEDOR", ativo: true } });
  if (!admin) return { erro: "Administrador não encontrado." };
  const token = await criarConviteAcesso(db, tenant.id, admin.id, admin.senhaHash ? "REDEFINIR_SENHA" : "PRIMEIRO_ACESSO");
  return { link: urlDoTenant(tenant, `/primeiro-acesso/${token}`) };
}
