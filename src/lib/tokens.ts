import { createHash, randomBytes } from "node:crypto";

/**
 * Tokens de link (pesquisa e primeiro acesso). Só o hash vai para o banco;
 * o token em si existe apenas no link enviado.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function gerarToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/** Formato aceito na URL; evita consultas com lixo. */
export function tokenValido(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
