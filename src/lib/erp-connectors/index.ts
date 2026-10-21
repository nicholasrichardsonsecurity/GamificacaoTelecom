import type { SistemaERP } from "@prisma/client";
import { z } from "zod";
import { decifrar } from "../crypto";
import { ConectorIxc } from "./ixc";
import { ConectorSgp } from "./sgp";
import { ErroConectorERP, type ConectorERP, type OpcoesConector } from "./types";

export * from "./types";

export const credenciaisIxcSchema = z.object({
  usuarioId: z.string().trim().min(1, "Informe o id do usuário da API."),
  token: z.string().trim().min(1, "Informe o token."),
});
export const credenciaisSgpSchema = z.object({
  token: z.string().trim().min(1, "Informe o token."),
  app: z.string().trim().min(1, "Informe o nome do app."),
});

export function criarConector(sistema: SistemaERP, opcoes: OpcoesConector, credenciais: unknown): ConectorERP {
  if (sistema === "IXC") return new ConectorIxc(opcoes, credenciaisIxcSchema.parse(credenciais));
  return new ConectorSgp(opcoes, credenciaisSgpSchema.parse(credenciais));
}

/** Monta o conector de uma `IntegracaoERP` (credenciais cifradas no banco). */
export function conectorDaIntegracao(
  integracao: { sistema: SistemaERP; urlBase: string; credenciais: string },
  opcoes: Omit<OpcoesConector, "urlBase"> = {},
): ConectorERP {
  let credenciais: unknown;
  try {
    credenciais = JSON.parse(decifrar(integracao.credenciais));
  } catch {
    throw new ErroConectorERP("Credenciais da integração ilegíveis; informe-as novamente.");
  }
  return criarConector(integracao.sistema, { ...opcoes, urlBase: integracao.urlBase }, credenciais);
}
