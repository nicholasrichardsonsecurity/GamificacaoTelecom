import bcrypt from "bcryptjs";
import type { CanalPesquisa, TipoConviteAcesso } from "@prisma/client";
import { somarDias } from "./periodo";
import type { DbDoTenant } from "./tenant-db";
import { gerarToken, hashToken, tokenValido } from "./tokens";

export const VALIDADE_CONVITE_ACESSO_DIAS = 7;
export const VALIDADE_PESQUISA_DIAS = 7;
export const SENHA_MINIMA = 8;

/** Gera um link de primeiro acesso (ou redefinição) e invalida os anteriores. */
export async function criarConviteAcesso(
  db: DbDoTenant,
  tenantId: string,
  usuarioId: string,
  tipo: TipoConviteAcesso = "PRIMEIRO_ACESSO",
  agora = new Date(),
) {
  const { token, tokenHash } = gerarToken();
  await db.$transaction(async (tx) => {
    await tx.conviteAcesso.updateMany({
      where: { usuarioId, usadoEm: null, expiraEm: { gt: agora } },
      data: { expiraEm: agora },
    });
    await tx.conviteAcesso.create({
      data: {
        tenantId,
        usuarioId,
        tokenHash,
        tipo,
        expiraEm: somarDias(agora, VALIDADE_CONVITE_ACESSO_DIAS),
      },
    });
  });
  return token;
}

export async function buscarConviteAcesso(db: DbDoTenant, token: string, agora = new Date()) {
  if (!tokenValido(token)) return null;
  const convite = await db.conviteAcesso.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { select: { id: true, nome: true, email: true, ativo: true } } },
  });
  if (!convite || convite.usadoEm || convite.expiraEm <= agora || !convite.usuario.ativo) return null;
  return convite;
}

/** Define a senha e consome o convite (uso único). */
export async function consumirConviteAcesso(
  db: DbDoTenant,
  token: string,
  senha: string,
  agora = new Date(),
) {
  if (senha.length < SENHA_MINIMA) throw new Error(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
  const convite = await buscarConviteAcesso(db, token, agora);
  if (!convite) return null;
  const senhaHash = await bcrypt.hash(senha, 12);
  return db.$transaction(async (tx) => {
    const { count } = await tx.conviteAcesso.updateMany({
      where: { id: convite.id, usadoEm: null },
      data: { usadoEm: agora },
    });
    if (count === 0) return null;
    await tx.usuario.update({ where: { id: convite.usuarioId }, data: { senhaHash } });
    return convite.usuario;
  });
}

/**
 * Cria (ou renova, se ainda não respondido) o convite de pesquisa de um
 * atendimento. Retorna null se o cliente pediu para não receber pesquisas.
 */
export async function criarConvitePesquisa(
  db: DbDoTenant,
  tenantId: string,
  atendimentoId: string,
  canal: CanalPesquisa = "MANUAL",
  agora = new Date(),
) {
  const atendimento = await db.atendimento.findUniqueOrThrow({
    where: { id: atendimentoId },
    include: { clienteFinal: { select: { naoPerturbe: true } }, convite: true },
  });
  if (atendimento.clienteFinal.naoPerturbe) return null;
  if (atendimento.convite?.respondidoEm) return null;

  const { token, tokenHash } = gerarToken();
  const expiraEm = somarDias(agora, VALIDADE_PESQUISA_DIAS);
  if (atendimento.convite) {
    await db.convitePesquisa.update({
      where: { id: atendimento.convite.id },
      data: { tokenHash, expiraEm, canal, criadoEm: agora },
    });
  } else {
    await db.convitePesquisa.create({
      data: { tenantId, atendimentoId, tokenHash, canal, expiraEm, criadoEm: agora },
    });
  }
  return token;
}

/** Página pública: dados do convite de pesquisa para exibir o formulário. */
export async function buscarConvitePesquisa(db: DbDoTenant, token: string) {
  if (!tokenValido(token)) return null;
  return db.convitePesquisa.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      atendimento: {
        select: {
          tipo: true,
          colaborador: { select: { nome: true } },
          clienteFinal: { select: { naoPerturbe: true } },
        },
      },
    },
  });
}

/** LGPD: o cliente pede para não receber mais pesquisas deste provedor. */
export async function descadastrarPesquisas(db: DbDoTenant, token: string, agora = new Date()) {
  if (!tokenValido(token)) return false;
  const convite = await db.convitePesquisa.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { atendimento: { select: { clienteFinalId: true } } },
  });
  if (!convite) return false;
  await db.clienteFinal.updateMany({
    where: { id: convite.atendimento.clienteFinalId, naoPerturbe: false },
    data: { naoPerturbe: true, naoPerturbeEm: agora },
  });
  return true;
}
