/**
 * Resolução de tenant a partir do header `Host` (sem acesso ao banco, roda no
 * middleware em Edge). A busca do `Tenant` em si fica em `lib/tenant.ts`.
 *
 * - `sinalplus.com.br` (ou `www.`)      → plataforma (Super Admin)
 * - `{slug}.sinalplus.com.br`           → tenant por subdomínio
 * - qualquer outro domínio              → tenant por `dominioCustomizado`
 */
export type ReferenciaHost =
  | { tipo: "plataforma" }
  | { tipo: "subdominio"; slug: string }
  | { tipo: "customizado"; dominio: string };

const SLUG_VALIDO = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Remove porta, ponto final e normaliza para minúsculas. */
export function normalizarHost(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith("[")) {
    // IPv6 literal: [::1]:3000
    const fim = h.indexOf("]");
    return fim === -1 ? h : h.slice(0, fim + 1);
  }
  h = h.replace(/:\d+$/, "");
  return h.replace(/\.$/, "");
}

export function resolverHost(
  host: string | null | undefined,
  dominioPlataforma: string,
): ReferenciaHost | null {
  if (!host) return null;
  const h = normalizarHost(host);
  const base = normalizarHost(dominioPlataforma);
  if (!h) return null;

  if (h === base || h === `www.${base}`) return { tipo: "plataforma" };

  if (h.endsWith(`.${base}`)) {
    const slug = h.slice(0, -(base.length + 1));
    // Apenas um nível de subdomínio: `a.b.sinalplus.com.br` não é tenant.
    if (!SLUG_VALIDO.test(slug)) return null;
    return { tipo: "subdominio", slug };
  }

  return { tipo: "customizado", dominio: h };
}

export function dominioPlataforma(): string {
  return process.env.PLATAFORMA_DOMINIO ?? "localhost";
}
