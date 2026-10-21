import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { dominioPlataforma, resolverHost } from "./lib/host";
import { decidirAcesso, rotaInicial } from "./lib/rbac";

const { auth } = NextAuth(authConfig);

/**
 * 1. Resolve o tipo de host (plataforma, subdomínio de tenant ou domínio próprio).
 * 2. Aplica o RBAC por área (`/superadmin`, `/admin`, `/gestor`, `/colaborador`).
 * A existência do tenant e o branding são resolvidos no servidor (`lib/tenant.ts`).
 */
export default auth((req) => {
  const host = resolverHost(req.headers.get("host"), dominioPlataforma());
  const role = req.auth?.user?.role;
  const { pathname, search } = req.nextUrl;

  const decisao = decidirAcesso({ pathname, host, role });
  switch (decisao.tipo) {
    case "permitir":
      return NextResponse.next();
    case "login": {
      const url = new URL("/login", req.nextUrl);
      url.searchParams.set("callbackUrl", pathname + search);
      return NextResponse.redirect(url);
    }
    case "proibido":
      return NextResponse.redirect(new URL(role ? rotaInicial(role) : "/", req.nextUrl));
    case "nao-encontrado":
      return new NextResponse("Não encontrado", { status: 404 });
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|uploads/).*)"],
};
