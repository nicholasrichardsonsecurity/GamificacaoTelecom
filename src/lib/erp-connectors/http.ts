import { ErroConectorERP } from "./types";

/** Valida a URL base: só http(s), sem credenciais embutidas, sem barra final. */
export function normalizarUrlBase(url: string): string {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new ErroConectorERP("URL do sistema inválida.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new ErroConectorERP("Use uma URL http(s).");
  if (u.username || u.password) throw new ErroConectorERP("Não coloque usuário e senha na URL.");
  return u.origin + u.pathname.replace(/\/+$/, "");
}

/** Chamada JSON com timeout; nunca inclui credenciais nas mensagens de erro. */
export async function chamarJson(
  url: string,
  init: RequestInit,
  { fetch: f = fetch, timeoutMs = 20_000 }: { fetch?: typeof fetch; timeoutMs?: number },
): Promise<unknown> {
  let resposta: Response;
  try {
    resposta = await f(url, { ...init, redirect: "error", signal: AbortSignal.timeout(timeoutMs) });
  } catch (erro) {
    throw new ErroConectorERP("Não foi possível conectar ao sistema (rede ou tempo esgotado).", erro);
  }
  if (resposta.status === 401 || resposta.status === 403) {
    throw new ErroConectorERP("O sistema recusou as credenciais.");
  }
  if (!resposta.ok) throw new ErroConectorERP(`O sistema respondeu com erro HTTP ${resposta.status}.`);
  try {
    return await resposta.json();
  } catch (erro) {
    throw new ErroConectorERP("Resposta inesperada do sistema (não é JSON).", erro);
  }
}

export const texto = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
