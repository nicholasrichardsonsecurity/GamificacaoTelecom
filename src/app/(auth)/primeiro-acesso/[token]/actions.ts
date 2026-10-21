"use server";

import { redirect } from "next/navigation";
import { consumirConviteAcesso } from "@/lib/convites";
import { mensagemDe } from "@/lib/acoes";
import { contextoAtual } from "@/lib/tenant";
import { dbDoTenant } from "@/lib/tenant-db";

export type EstadoSenha = { erro?: string };

export async function definirSenha(token: string, _estado: EstadoSenha, formData: FormData): Promise<EstadoSenha> {
  const contexto = await contextoAtual();
  if (contexto.tipo !== "tenant") return { erro: "Link inválido." };
  const senha = String(formData.get("senha") ?? "");
  if (senha !== String(formData.get("confirmacao") ?? "")) return { erro: "As senhas não conferem." };
  if (senha.length > 200) return { erro: "Senha longa demais." };

  let usuario;
  try {
    usuario = await consumirConviteAcesso(dbDoTenant(contexto.tenant.id), token, senha);
  } catch (erro) {
    return { erro: mensagemDe(erro) };
  }
  if (!usuario) return { erro: "Este link expirou ou já foi usado. Peça um novo ao administrador." };
  redirect("/login?senhaDefinida=1");
}
