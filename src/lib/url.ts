import "server-only";
import { headers } from "next/headers";

/** URL absoluta no domínio acessado (o do tenant), para links copiáveis. */
export async function urlAbsoluta(caminho: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
  return `${proto}://${host}${caminho}`;
}
