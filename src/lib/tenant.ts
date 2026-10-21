import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { dominioPlataforma, resolverHost, type ReferenciaHost } from "./host";
import {
  COR_PRIMARIA_PADRAO,
  COR_SECUNDARIA_PADRAO,
  corSegura,
  type Branding,
} from "./branding";

export type ContextoHost =
  | { tipo: "plataforma"; tenant: null }
  | { tipo: "tenant"; tenant: Tenant }
  | { tipo: "desconhecido"; tenant: null };

export async function buscarTenantPorHost(ref: ReferenciaHost | null): Promise<Tenant | null> {
  if (!ref || ref.tipo === "plataforma") return null;
  const tenant =
    ref.tipo === "subdominio"
      ? await prisma.tenant.findUnique({ where: { slug: ref.slug } })
      : await prisma.tenant.findFirst({
          where: { dominioCustomizado: ref.dominio, dominioVerificado: true },
        });
  return tenant?.status === "ATIVO" ? tenant : null;
}

/** Tenant da requisição atual, resolvido pelo `Host` (uma consulta por request). */
export const contextoAtual = cache(async (): Promise<ContextoHost> => {
  const h = await headers();
  const ref = resolverHost(h.get("host"), dominioPlataforma());
  if (ref?.tipo === "plataforma") return { tipo: "plataforma", tenant: null };
  const tenant = await buscarTenantPorHost(ref);
  return tenant ? { tipo: "tenant", tenant } : { tipo: "desconhecido", tenant: null };
});

export function nomePlataforma(): string {
  return process.env.PLATAFORMA_NOME ?? "SinalPlus";
}

export function brandingDo(contexto: ContextoHost): Branding {
  if (contexto.tipo === "tenant") {
    const t = contexto.tenant;
    return {
      nomeExibicao: t.nomeExibicao,
      logoUrl: t.logoUrl,
      faviconUrl: t.faviconUrl,
      corPrimaria: corSegura(t.corPrimaria, COR_PRIMARIA_PADRAO),
      corSecundaria: corSegura(t.corSecundaria, COR_SECUNDARIA_PADRAO),
    };
  }
  return {
    nomeExibicao: nomePlataforma(),
    logoUrl: null,
    faviconUrl: null,
    corPrimaria: COR_PRIMARIA_PADRAO,
    corSecundaria: COR_SECUNDARIA_PADRAO,
  };
}
