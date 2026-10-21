"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EstadoLink } from "@/components/gerar-link";
import { campos, mensagemDe, voltar } from "@/lib/acoes";
import { atendimentoManualSchema, criarAtendimentoManual } from "@/lib/atendimentos";
import {
  lerPlanilhaColaboradores,
  limitesDoPlano,
  salvarUsuario,
  upsertColaboradores,
  usuarioSchema,
  type ResultadoUpsert,
} from "@/lib/colaboradores";
import { criarConviteAcesso, criarConvitePesquisa } from "@/lib/convites";
import { prisma } from "@/lib/db";
import { configuracaoSchema, pontosSchema, salvarConfiguracao, salvarRegras } from "@/lib/regras";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { salvarImagem } from "@/lib/uploads";
import { urlAbsoluta } from "@/lib/url";

const exigirAdmin = () => exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);

// ─── Marca ──────────────────────────────────────────────────────────────────

const marcaSchema = z.object({
  nomeExibicao: z.string().trim().min(2, "Informe o nome de exibição.").max(80),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  corSecundaria: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
});

export async function salvarMarca(formData: FormData) {
  const { tenant } = await exigirAdmin();
  try {
    const d = marcaSchema.parse(campos(formData));
    const logo = formData.get("logo");
    const favicon = formData.get("favicon");
    const logoUrl =
      logo instanceof File && logo.size > 0
        ? await salvarImagem(tenant.id, logo, "logo")
        : formData.get("removerLogo")
          ? null
          : undefined;
    const faviconUrl =
      favicon instanceof File && favicon.size > 0
        ? await salvarImagem(tenant.id, favicon, "favicon")
        : formData.get("removerFavicon")
          ? null
          : undefined;
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        nomeExibicao: d.nomeExibicao,
        corPrimaria: d.corPrimaria.toLowerCase(),
        corSecundaria: d.corSecundaria.toLowerCase(),
        logoUrl,
        faviconUrl,
      },
    });
  } catch (erro) {
    voltar("/admin/marca", { erro: mensagemDe(erro) });
  }
  revalidatePath("/", "layout");
  voltar("/admin/marca", { ok: "Marca atualizada." });
}

// ─── Usuários ───────────────────────────────────────────────────────────────

export async function salvarUsuarioAction(id: string | null, formData: FormData) {
  const { usuario, tenant, db } = await exigirAdmin();
  const voltarPara = id ? `/admin/usuarios/${id}` : "/admin/usuarios";
  let salvoId: string;
  try {
    const dados = usuarioSchema.parse({
      ...campos(formData),
      ativo: id ? formData.get("ativo") === "on" : true,
    });
    if (id === usuario.id && (dados.role !== "ADMIN_PROVEDOR" || !dados.ativo)) {
      throw new Error("Você não pode tirar o seu próprio acesso de admin.");
    }
    salvoId = (await salvarUsuario(db, tenant.id, id, dados)).id;
  } catch (erro) {
    voltar(voltarPara, { erro: mensagemDe(erro) });
  }
  revalidatePath("/admin/usuarios");
  voltar(`/admin/usuarios/${salvoId}`, { ok: id ? "Usuário atualizado." : "Usuário criado." });
}

export async function linkDeAcesso(usuarioId: string): Promise<EstadoLink> {
  const { tenant, db } = await exigirAdmin();
  const alvo = await db.usuario.findFirst({ where: { id: usuarioId, ativo: true } });
  if (!alvo) return { erro: "Usuário não encontrado ou inativo." };
  if (!alvo.email) return { erro: "Cadastre um e-mail antes: é com ele que a pessoa entra." };
  const token = await criarConviteAcesso(
    db,
    tenant.id,
    alvo.id,
    alvo.senhaHash ? "REDEFINIR_SENHA" : "PRIMEIRO_ACESSO",
  );
  return { link: await urlAbsoluta(`/primeiro-acesso/${token}`) };
}

export type EstadoImportacao = { resultado?: ResultadoUpsert; erro?: string };

export async function importarPlanilha(_estado: EstadoImportacao, formData: FormData): Promise<EstadoImportacao> {
  const { tenant, db } = await exigirAdmin();
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha um arquivo CSV." };
  if (arquivo.size > 2 * 1024 * 1024) return { erro: "O arquivo precisa ter no máximo 2 MB." };
  try {
    const { colaboradores, erros } = lerPlanilhaColaboradores(await arquivo.text());
    const r = await upsertColaboradores(db, tenant.id, colaboradores);
    revalidatePath("/admin/usuarios");
    return { resultado: { ...r, erros: [...erros, ...r.erros].sort((a, b) => a.linha - b.linha) } };
  } catch (erro) {
    return { erro: mensagemDe(erro) };
  }
}

// ─── Equipes ────────────────────────────────────────────────────────────────

const equipeSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da equipe.").max(100),
  gestorId: z.string().transform((v) => v || null),
});

export async function salvarEquipe(id: string | null, formData: FormData) {
  const { tenant, db } = await exigirAdmin();
  try {
    const d = equipeSchema.parse(campos(formData));
    if (d.gestorId) {
      const gestor = await db.usuario.findFirst({
        where: { id: d.gestorId, ativo: true, role: { in: ["GESTOR", "ADMIN_PROVEDOR"] } },
      });
      if (!gestor) throw new Error("O gestor precisa ser um usuário ativo com papel de gestor ou admin.");
    }
    if (id) {
      const { count } = await db.equipe.updateMany({ where: { id }, data: d });
      if (count === 0) throw new Error("Equipe não encontrada.");
    } else {
      const limites = await limitesDoPlano(db, tenant.id);
      if (limites.limiteFiliais !== null && limites.equipes >= limites.limiteFiliais) {
        throw new Error(`Limite de ${limites.limiteFiliais} equipes do plano atingido.`);
      }
      await db.equipe.create({ data: { ...d, tenantId: tenant.id } });
    }
  } catch (erro) {
    const msg =
      erro && typeof erro === "object" && "code" in erro && erro.code === "P2002"
        ? "Já existe uma equipe com este nome."
        : mensagemDe(erro);
    voltar("/admin/equipes", { erro: msg });
  }
  revalidatePath("/admin/equipes");
  voltar("/admin/equipes", { ok: id ? "Equipe atualizada." : "Equipe criada." });
}

// ─── Pontuação ──────────────────────────────────────────────────────────────

const vazioComoNulo = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : v);

export async function salvarPontuacao(formData: FormData) {
  const { tenant, db } = await exigirAdmin();
  let alteradas = 0;
  try {
    const f = campos(formData);
    const pontos: Record<number, number> = {};
    for (const nivel of [1, 2, 3, 4, 5]) pontos[nivel] = pontosSchema.parse(f[`pontos${nivel}`]);
    if (pontos[5] < pontos[4] || pontos[4] < pontos[3] || pontos[3] < pontos[2] || pontos[2] < pontos[1]) {
      throw new Error("Mais barras de sinal não podem valer menos pontos.");
    }
    const config = configuracaoSchema.parse({
      diasPendencia: f.diasPendencia,
      limiteDiario: vazioComoNulo(f.limiteDiario),
      limiteSemanal: vazioComoNulo(f.limiteSemanal),
      nivelRisco: f.nivelRisco,
      prazoContatoHoras: f.prazoContatoHoras,
    });
    alteradas = await salvarRegras(db, tenant.id, pontos);
    await salvarConfiguracao(db, tenant.id, config);
  } catch (erro) {
    voltar("/admin/pontuacao", { erro: mensagemDe(erro) });
  }
  voltar("/admin/pontuacao", {
    ok: alteradas
      ? `Salvo. ${alteradas} regra(s) mudaram e valem a partir de agora; avaliações antigas não mudam.`
      : "Configuração salva.",
  });
}

// ─── Atendimentos ───────────────────────────────────────────────────────────

export async function criarAtendimento(formData: FormData) {
  const { tenant, db } = await exigirAdmin();
  let id: string;
  try {
    id = (await criarAtendimentoManual(db, tenant.id, atendimentoManualSchema.parse(campos(formData)))).id;
  } catch (erro) {
    voltar("/admin/atendimentos", { erro: mensagemDe(erro) });
  }
  revalidatePath("/admin/atendimentos");
  voltar(`/admin/atendimentos/${id}`, { ok: "Atendimento registrado. Gere o link da pesquisa abaixo." });
}

export async function linkDePesquisa(atendimentoId: string): Promise<EstadoLink> {
  const { tenant, db } = await exigirAdmin();
  const atendimento = await db.atendimento.findFirst({ where: { id: atendimentoId } });
  if (!atendimento) return { erro: "Atendimento não encontrado." };
  const token = await criarConvitePesquisa(db, tenant.id, atendimento.id);
  if (!token) return { erro: "O cliente pediu para não receber pesquisas, ou já respondeu." };
  revalidatePath(`/admin/atendimentos/${atendimentoId}`);
  return { link: await urlAbsoluta(`/avaliar/${token}`) };
}
