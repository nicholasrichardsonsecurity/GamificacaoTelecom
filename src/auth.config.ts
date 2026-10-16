import type { NextAuthConfig } from "next-auth";

/**
 * Parte da configuração do Auth.js que roda no Edge (middleware): sem Prisma
 * e sem bcrypt. O provider de credenciais fica em `auth.ts`.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.tenantId = token.tenantId;
      return session;
    },
  },
} satisfies NextAuthConfig;
