"use server";

import { revalidatePath } from "next/cache";
import { campos, mensagemDe, voltar } from "@/lib/acoes";
import { ErroConectorERP } from "@/lib/erp-connectors";
import {
  integracaoSchema,
  lerCredenciais,
  salvarIntegracao,
  sincronizarAgora,
  testarIntegracao,
} from "@/lib/integracoes";
import { exigirSessaoDeTenant } from "@/lib/sessao";

const PAGINA = "/admin/integracao";

function mensagem(erro: unknown) {
  return erro instanceof ErroConectorERP ? erro.message : mensagemDe(erro);
}

export async function salvarIntegracaoAction(formData: FormData) {
  const { tenant, db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  try {
    const f = campos(formData);
    const dados = integracaoSchema.parse({ ...f, ativa: f.ativa === "on" });
    const { usuarioId = "", token = "", app = "" } = f;
    await salvarIntegracao(db, tenant.id, dados, lerCredenciais(dados.sistema, { usuarioId, token, app }));
  } catch (erro) {
    voltar(PAGINA, { erro: mensagem(erro) });
  }
  revalidatePath(PAGINA);
  voltar(PAGINA, { ok: "Integração salva." });
}

export async function testarIntegracaoAction(id: string) {
  const { db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  try {
    await testarIntegracao(db, id);
  } catch (erro) {
    voltar(PAGINA, { erro: mensagem(erro) });
  }
  voltar(PAGINA, { ok: "Conexão funcionando." });
}

export async function sincronizarAgoraAction(id: string) {
  const { tenant, db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  let ok: string;
  try {
    const r = await sincronizarAgora(db, tenant.id, id);
    ok =
      `Sincronizado: ${r.colaboradoresCriados} colaborador(es) novo(s), ${r.colaboradoresDesativados} desativado(s), ` +
      `${r.atendimentosImportados} atendimento(s) importado(s).` +
      (r.avisos.length ? ` Avisos: ${r.avisos.slice(0, 3).join(" ")}` : "");
  } catch (erro) {
    voltar(PAGINA, { erro: mensagem(erro) });
  }
  revalidatePath(PAGINA);
  voltar(PAGINA, { ok });
}
