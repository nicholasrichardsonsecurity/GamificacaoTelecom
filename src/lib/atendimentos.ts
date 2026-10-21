import type { TipoAtendimento } from "@prisma/client";
import { z } from "zod";
import type { DbDoTenant } from "./tenant-db";

/** Atendimento registrado à mão pelo admin (o MVP funciona sem ERP). */

export const TIPOS_ATENDIMENTO: Record<TipoAtendimento, string> = {
  INSTALACAO: "Instalação",
  SUPORTE: "Suporte",
  VENDA: "Venda",
  RENEGOCIACAO: "Renegociação",
};

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const atendimentoManualSchema = z.object({
  colaboradorId: z.string().min(1, "Escolha o colaborador."),
  tipo: z.enum(["INSTALACAO", "SUPORTE", "VENDA", "RENEGOCIACAO"]),
  clienteNome: z.string().trim().min(2, "Informe o nome do cliente.").max(200),
  clienteTelefone: opcional(30),
  clienteEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .transform((v) => v || null)
    .pipe(z.email("E-mail do cliente inválido.").nullable()),
  clienteIdExterno: opcional(100),
});

export type AtendimentoManual = z.infer<typeof atendimentoManualSchema>;

export async function criarAtendimentoManual(
  db: DbDoTenant,
  tenantId: string,
  dados: AtendimentoManual,
  agora = new Date(),
) {
  const colaborador = await db.usuario.findFirst({
    where: { id: dados.colaboradorId, ativo: true },
    select: { id: true },
  });
  if (!colaborador) throw new Error("Colaborador não encontrado.");

  // Cliente com id do ERP é reaproveitado; sem id, cada atendimento cria o seu.
  const existente = dados.clienteIdExterno
    ? await db.clienteFinal.findFirst({ where: { idExternoERP: dados.clienteIdExterno } })
    : null;
  const cliente = existente
    ? await db.clienteFinal.update({
        where: { id: existente.id },
        data: {
          nome: dados.clienteNome,
          telefone: dados.clienteTelefone ?? existente.telefone,
          email: dados.clienteEmail ?? existente.email,
        },
      })
    : await db.clienteFinal.create({
        data: {
          tenantId,
          nome: dados.clienteNome,
          telefone: dados.clienteTelefone,
          email: dados.clienteEmail,
          idExternoERP: dados.clienteIdExterno,
        },
      });

  return db.atendimento.create({
    data: {
      tenantId,
      tipo: dados.tipo,
      colaboradorId: colaborador.id,
      clienteFinalId: cliente.id,
      concluidoEm: agora,
    },
  });
}
