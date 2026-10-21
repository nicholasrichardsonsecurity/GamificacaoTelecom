"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { descadastrarPesquisas } from "@/lib/convites";
import { registrarResposta } from "@/lib/pontuacao";
import { contextoAtual } from "@/lib/tenant";
import { dbDoTenant } from "@/lib/tenant-db";

/** IP do cliente atrás do Nginx (`X-Real-IP`) ou o último salto do X-Forwarded-For. */
function ipDe(h: Headers): string | null {
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",").pop()?.trim() ?? null;
}

export async function responder(token: string, formData: FormData) {
  const contexto = await contextoAtual();
  if (contexto.tipo !== "tenant") redirect("/");
  const [h, sessao] = await Promise.all([headers(), auth()]);

  const resultado = await registrarResposta(dbDoTenant(contexto.tenant.id), contexto.tenant.id, {
    token,
    nivelSinal: Number(formData.get("nivelSinal")),
    comentario: String(formData.get("comentario") ?? ""),
    ip: ipDe(h),
    userAgent: h.get("user-agent"),
    respondenteLogado: sessao?.user?.tenantId === contexto.tenant.id,
  });
  if (!resultado.ok && resultado.motivo === "invalido" && formData.get("nivelSinal") === null) {
    redirect(`/avaliar/${token}?erro=escolha`);
  }
  redirect(`/avaliar/${token}`);
}

export async function naoQueroMais(token: string) {
  const contexto = await contextoAtual();
  if (contexto.tipo !== "tenant") redirect("/");
  await descadastrarPesquisas(dbDoTenant(contexto.tenant.id), token);
  redirect(`/avaliar/${token}?descadastrado=1`);
}
