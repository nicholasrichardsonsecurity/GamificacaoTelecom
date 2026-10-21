"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type EstadoLogin = { erro?: string };

/** Só aceita caminhos relativos ao próprio domínio (evita open redirect). */
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const destino = typeof valor === "string" ? valor : "";
  return destino.startsWith("/") && !destino.startsWith("//") && !destino.startsWith("/\\")
    ? destino
    : "/";
}

export async function entrar(_estado: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      senha: formData.get("senha"),
      redirectTo: destinoSeguro(formData.get("callbackUrl")),
    });
    return {};
  } catch (erro) {
    if (erro instanceof AuthError) {
      return { erro: "E-mail ou senha inválidos." };
    }
    throw erro; // inclui o redirect de sucesso do Next.js
  }
}
