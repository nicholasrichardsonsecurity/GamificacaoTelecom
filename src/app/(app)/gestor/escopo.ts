import "server-only";
import type { Prisma } from "@prisma/client";
import { colaboradoresVisiveis } from "@/lib/relatorios";
import { exigirSessaoDeTenant } from "@/lib/sessao";

/** Sessão de gestão (admin ou gestor) com os filtros do que ela pode ver. */
export async function exigirGestao() {
  const sessao = await exigirSessaoDeTenant(["ADMIN_PROVEDOR", "GESTOR"]);
  const colaboradores = colaboradoresVisiveis(sessao.usuario);
  const casos: Prisma.CasoRecuperacaoWhereInput =
    sessao.usuario.role === "GESTOR"
      ? {
          OR: [
            { gestorResponsavelId: sessao.usuario.id },
            { avaliacao: { atendimento: { colaborador: colaboradores } } },
          ],
        }
      : {};
  const avaliacoes: Prisma.AvaliacaoWhereInput = { atendimento: { colaborador: colaboradores } };
  return { ...sessao, colaboradores, casos, avaliacoes };
}
