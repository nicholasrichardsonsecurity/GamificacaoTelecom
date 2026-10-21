"use server";

import { revalidatePath } from "next/cache";
import { mensagemDe, voltar } from "@/lib/acoes";
import { abrirContestacao } from "@/lib/pontuacao";
import { exigirSessaoDeTenant } from "@/lib/sessao";

export async function contestar(avaliacaoId: string, formData: FormData) {
  const { usuario, tenant, db } = await exigirSessaoDeTenant();
  try {
    await abrirContestacao(db, tenant.id, usuario.id, avaliacaoId, String(formData.get("justificativa") ?? ""));
  } catch (erro) {
    voltar("/colaborador", { erro: mensagemDe(erro) });
  }
  revalidatePath("/colaborador");
  voltar("/colaborador", { ok: "Contestação enviada. Seu gestor vai analisar." });
}
