import { Prisma, type PrismaClient, type Tenant } from "@prisma/client";
import { z } from "zod";
import { dominioPlataforma, SLUG_VALIDO } from "./host";
import { COR_PRIMARIA_PADRAO, COR_SECUNDARIA_PADRAO } from "./branding";
import { aplicarTemplatePadrao } from "./onboarding";

/**
 * Operações de plataforma sobre tenants (Super Admin). Usam o client Prisma
 * sem escopo porque atuam *sobre* o tenant, não dentro dele.
 */

/** Subdomínios que nunca podem virar tenant. */
export const SLUGS_RESERVADOS = new Set(["www", "app", "api", "admin", "painel", "static", "mail"]);

const cor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #rrggbb).")
  .transform((c) => c.toLowerCase());

export const novoTenantSchema = z.object({
  nome: z.string().trim().min(2, "Informe a razão social.").max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_VALIDO, "Use letras minúsculas, números e hífen.")
    .max(40)
    .refine((s) => !SLUGS_RESERVADOS.has(s), "Este endereço é reservado."),
  nomeExibicao: z.string().trim().min(2, "Informe o nome de exibição.").max(80),
  planoId: z.string().min(1, "Escolha um plano."),
  corPrimaria: cor.default(COR_PRIMARIA_PADRAO),
  corSecundaria: cor.default(COR_SECUNDARIA_PADRAO),
  adminNome: z.string().trim().min(2, "Informe o nome do administrador.").max(120),
  adminEmail: z.string().trim().toLowerCase().pipe(z.email("E-mail do administrador inválido.")),
});

export type NovoTenant = z.infer<typeof novoTenantSchema>;

export class SlugEmUsoError extends Error {
  constructor() {
    super("Já existe um provedor com este endereço.");
  }
}

/**
 * Cria o tenant, copia o template padrão (regras, níveis, selos e
 * configuração) e cadastra o primeiro ADMIN_PROVEDOR, ainda sem senha.
 */
export async function criarTenant(prisma: PrismaClient, dados: NovoTenant) {
  try {
    return await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nome: dados.nome,
          slug: dados.slug,
          nomeExibicao: dados.nomeExibicao,
          planoId: dados.planoId,
          corPrimaria: dados.corPrimaria,
          corSecundaria: dados.corSecundaria,
        },
      });
      await aplicarTemplatePadrao(tx, tenant.id);
      const admin = await tx.usuario.create({
        data: {
          tenantId: tenant.id,
          nome: dados.adminNome,
          email: dados.adminEmail,
          role: "ADMIN_PROVEDOR",
        },
      });
      return { tenant, admin };
    });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      throw new SlugEmUsoError();
    }
    throw erro;
  }
}

/** Endereço público do tenant: domínio próprio verificado ou subdomínio da plataforma. */
export function urlDoTenant(
  tenant: Pick<Tenant, "slug" | "dominioCustomizado" | "dominioVerificado">,
  caminho = "/",
  plataforma = dominioPlataforma(),
): string {
  if (tenant.dominioCustomizado && tenant.dominioVerificado) {
    return `https://${tenant.dominioCustomizado}${caminho}`;
  }
  const local = plataforma === "localhost" || plataforma.endsWith(".localhost");
  const porta = local ? `:${process.env.PORT ?? 3000}` : "";
  return `${local ? "http" : "https"}://${tenant.slug}.${plataforma}${porta}${caminho}`;
}

