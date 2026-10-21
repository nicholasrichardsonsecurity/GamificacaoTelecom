import "server-only";
import { headers } from "next/headers";
import { hostDaRequisicao } from "./host";

/** URL absoluta no domínio acessado (o do tenant), para links copiáveis. */
export async function urlAbsoluta(caminho: string): Promise<string> {
  const h = await headers();
  const host = hostDaRequisicao(h) ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
  return `${proto}://${host}${caminho}`;
}
