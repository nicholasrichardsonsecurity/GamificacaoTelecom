"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { campos, mensagemDe, voltar } from "@/lib/acoes";
import { decidirContestacao, revisarSuspeita } from "@/lib/pontuacao";
import { exigirGestao } from "./escopo";

const casoSchema = z.object({
  status: z.enum(["ABERTO", "EM_ANDAMENTO", "RESOLVIDO"]),
  acaoTomada: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => v || null),
});

export async function atualizarCaso(id: string, formData: FormData) {
  const { db, casos } = await exigirGestao();
  try {
    const d = casoSchema.parse(campos(formData));
    if (d.status === "RESOLVIDO" && !d.acaoTomada) throw new Error("Conte o que foi feito antes de resolver.");
    const { count } = await db.casoRecuperacao.updateMany({
      where: { AND: [{ id }, casos] },
      data: { ...d, resolvidoEm: d.status === "RESOLVIDO" ? new Date() : null },
    });
    if (count === 0) throw new Error("Caso não encontrado.");
  } catch (erro) {
    voltar("/gestor/casos", { erro: mensagemDe(erro) });
  }
  revalidatePath("/gestor", "layout");
  voltar("/gestor/casos", { ok: "Caso atualizado." });
}

export async function decidirContestacaoAction(id: string, formData: FormData) {
  const { db, tenant, usuario, colaboradores } = await exigirGestao();
  try {
    const aceitar = formData.get("decisao") === "aceitar";
    const texto = String(formData.get("justificativa") ?? "").trim();
    if (texto.length < 5) throw new Error("Explique a decisão para o colaborador.");
    const visivel = await db.contestacaoAvaliacao.findFirst({
      where: { id, status: "ABERTA", colaborador: colaboradores },
      select: { colaboradorId: true },
    });
    if (!visivel) throw new Error("Contestação não encontrada ou já decidida.");
    if (visivel.colaboradorId === usuario.id) throw new Error("Você não pode decidir a sua própria contestação.");
    await decidirContestacao(db, tenant.id, id, usuario.id, aceitar, texto);
  } catch (erro) {
    voltar("/gestor/contestacoes", { erro: mensagemDe(erro) });
  }
  revalidatePath("/gestor", "layout");
  voltar("/gestor/contestacoes", { ok: "Decisão registrada." });
}

export async function revisarSuspeitaAction(id: string, aceitar: boolean) {
  const { db, tenant, usuario, avaliacoes } = await exigirGestao();
  try {
    const visivel = await db.avaliacao.findFirst({
      where: { AND: [{ id, suspeita: true, revisadaEm: null }, avaliacoes] },
      select: { atendimento: { select: { colaboradorId: true } } },
    });
    if (!visivel) throw new Error("Avaliação não encontrada ou já revisada.");
    if (visivel.atendimento.colaboradorId === usuario.id) {
      throw new Error("Você não pode revisar uma avaliação sua.");
    }
    await revisarSuspeita(db, tenant.id, id, usuario.id, aceitar);
  } catch (erro) {
    voltar("/gestor/suspeitas", { erro: mensagemDe(erro) });
  }
  revalidatePath("/gestor", "layout");
  voltar("/gestor/suspeitas", { ok: aceitar ? "Avaliação aceita e pontuada." : "Avaliação descartada." });
}
