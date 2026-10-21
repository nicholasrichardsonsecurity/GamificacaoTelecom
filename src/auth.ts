import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/db";
import { dominioPlataforma, resolverHost } from "./lib/host";
import { buscarTenantPorHost } from "./lib/tenant";

const credenciaisSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  senha: z.string().min(1).max(200),
});

/** Hash fixo para comparar mesmo quando o usuário não existe (tempo constante). */
const HASH_FALSO = "$2b$12$tR6yTgWc4IfW1NB/yA8XjOdCGSkpkDBWuW87ems1n1DzDUGqz6jPm";

class CredenciaisInvalidas extends CredentialsSignin {
  code = "credenciais_invalidas";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      async authorize(credentials, request) {
        const dados = credenciaisSchema.safeParse(credentials);
        if (!dados.success) throw new CredenciaisInvalidas();
        const { email, senha } = dados.data;

        // O e-mail é único por tenant: o tenant vem do domínio acessado.
        const ref = resolverHost(request.headers.get("host"), dominioPlataforma());
        let tenantId: string | null;
        if (ref?.tipo === "plataforma") {
          tenantId = null;
        } else {
          const tenant = await buscarTenantPorHost(ref);
          if (!tenant) throw new CredenciaisInvalidas();
          tenantId = tenant.id;
        }

        const usuario = await prisma.usuario.findFirst({
          where: { tenantId, email, ativo: true },
        });
        const senhaOk = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_FALSO);
        if (!usuario || !usuario.senhaHash || !senhaOk) throw new CredenciaisInvalidas();
        // Na plataforma só entra SUPER_ADMIN; no tenant, nunca SUPER_ADMIN.
        if ((tenantId === null) !== (usuario.role === "SUPER_ADMIN")) {
          throw new CredenciaisInvalidas();
        }

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          image: usuario.avatarUrl,
          role: usuario.role,
          tenantId: usuario.tenantId,
        };
      },
    }),
  ],
});
