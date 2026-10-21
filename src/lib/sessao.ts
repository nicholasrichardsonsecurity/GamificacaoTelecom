import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import { contextoAtual } from "./tenant";
import { dbDoTenant } from "./tenant-db";

/**
 * Garante sessão válida para o domínio atual e, opcionalmente, um dos papéis.
 * Complementa o middleware: aqui conferimos no banco que o tenant da sessão é
 * o mesmo tenant do domínio acessado.
 */
export async function exigirSessao(roles?: readonly Role[]) {
  const [sessao, contexto] = await Promise.all([auth(), contextoAtual()]);
  if (contexto.tipo === "desconhecido") notFound();
  if (!sessao?.user) redirect("/login");

  const tenantDoHost = contexto.tipo === "tenant" ? contexto.tenant.id : null;
  if (sessao.user.tenantId !== tenantDoHost) redirect("/login");
  if (roles && !roles.includes(sessao.user.role)) redirect("/");

  return { usuario: sessao.user, contexto };
}

/** Sessão + client Prisma já escopado ao tenant do usuário. */
export async function exigirSessaoDeTenant(roles?: readonly Role[]) {
  const { usuario, contexto } = await exigirSessao(roles);
  if (contexto.tipo !== "tenant") notFound();
  return { usuario, tenant: contexto.tenant, db: dbDoTenant(contexto.tenant.id) };
}
