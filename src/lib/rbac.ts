import type { Role } from "@prisma/client";
import type { ReferenciaHost } from "./host";

/**
 * Áreas protegidas e os papéis que podem acessá-las. A área do Super Admin só
 * existe no domínio da plataforma; as demais só existem no domínio de um tenant.
 */
export const AREAS = [
  { prefixo: "/superadmin", roles: ["SUPER_ADMIN"], escopo: "plataforma" },
  { prefixo: "/admin", roles: ["ADMIN_PROVEDOR"], escopo: "tenant" },
  { prefixo: "/gestor", roles: ["ADMIN_PROVEDOR", "GESTOR"], escopo: "tenant" },
  {
    prefixo: "/colaborador",
    roles: ["ADMIN_PROVEDOR", "GESTOR", "COLABORADOR"],
    escopo: "tenant",
  },
] as const satisfies ReadonlyArray<{
  prefixo: string;
  roles: readonly Role[];
  escopo: "plataforma" | "tenant";
}>;

export type DecisaoAcesso =
  | { tipo: "permitir" }
  | { tipo: "login" }
  | { tipo: "proibido" }
  | { tipo: "nao-encontrado" };

function areaDe(pathname: string) {
  return AREAS.find(
    (a) => pathname === a.prefixo || pathname.startsWith(`${a.prefixo}/`),
  );
}

export function decidirAcesso(params: {
  pathname: string;
  host: ReferenciaHost | null;
  role: Role | undefined;
}): DecisaoAcesso {
  const { pathname, host, role } = params;
  if (!host) return { tipo: "nao-encontrado" };

  const area = areaDe(pathname);
  if (!area) return { tipo: "permitir" };

  const escopoHost = host.tipo === "plataforma" ? "plataforma" : "tenant";
  if (area.escopo !== escopoHost) return { tipo: "nao-encontrado" };

  if (!role) return { tipo: "login" };
  if (!(area.roles as readonly Role[]).includes(role)) return { tipo: "proibido" };
  return { tipo: "permitir" };
}

/** Para onde mandar o usuário logo após o login. */
export function rotaInicial(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/superadmin";
    case "ADMIN_PROVEDOR":
      return "/admin";
    case "GESTOR":
      return "/gestor";
    case "COLABORADOR":
      return "/colaborador";
  }
}
