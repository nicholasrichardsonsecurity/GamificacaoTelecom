import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * Apoio às Server Actions de formulário: devolvem o usuário para a página com
 * `?ok=` ou `?erro=`, mostrados pelo componente `Aviso`.
 */
export function voltar(caminho: string, retorno: { ok: string } | { erro: string }): never {
  const params = new URLSearchParams(retorno);
  redirect(`${caminho}${caminho.includes("?") ? "&" : "?"}${params}`);
}

/** Mensagem legível de um erro de validação ou de regra de negócio. */
export function mensagemDe(erro: unknown): string {
  if (erro instanceof z.ZodError) return erro.issues[0]?.message ?? "Dados inválidos.";
  // Só erros de regra de negócio (`new Error("...")`); os do Prisma não vão para a tela.
  if (erro instanceof Error && erro.name === "Error" && !("code" in erro)) return erro.message;
  return "Não foi possível concluir. Tente de novo.";
}

/** Campos de texto de um FormData (arquivos ficam de fora). */
export function campos(formData: FormData): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string") r[k] = v;
  return r;
}

/** `?ok=`/`?erro=` das páginas que usam `voltar`. */
export type ParamsAviso = Promise<{ ok?: string; erro?: string }>;
