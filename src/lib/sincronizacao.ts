import type { IntegracaoERP } from "@prisma/client";
import { upsertColaboradores } from "./colaboradores";
import { ErroConectorERP, type ConectorERP } from "./erp-connectors/types";
import type { DbDoTenant } from "./tenant-db";

/**
 * Sincronização de um tenant com o ERP: colaboradores (upsert por
 * `idExternoERP`, desativando quem saiu, sem apagar histórico de pontos) e O.S.
 * concluídas (idempotente por `origemExternaId`). Rodar duas vezes não duplica nada.
 */

export type ResultadoSincronizacao = {
  colaboradoresCriados: number;
  colaboradoresAtualizados: number;
  colaboradoresDesativados: number;
  atendimentosImportados: number;
  atendimentosJaExistentes: number;
  /** O.S. cujo técnico não está cadastrado (ainda) no SinalPlus. */
  atendimentosSemColaborador: number;
  avisos: string[];
};

/** Janela da primeira importação, e sobreposição nas seguintes (O.S. fechadas com atraso). */
export const DIAS_PRIMEIRA_IMPORTACAO = 30;
export const SOBREPOSICAO_MS = 24 * 3600_000;

export async function sincronizarIntegracao(
  db: DbDoTenant,
  tenantId: string,
  integracao: Pick<IntegracaoERP, "id" | "sistema" | "ultimaSincronizacaoEm">,
  conector: ConectorERP,
  agora = new Date(),
): Promise<ResultadoSincronizacao> {
  const r: ResultadoSincronizacao = {
    colaboradoresCriados: 0,
    colaboradoresAtualizados: 0,
    colaboradoresDesativados: 0,
    atendimentosImportados: 0,
    atendimentosJaExistentes: 0,
    atendimentosSemColaborador: 0,
    avisos: [],
  };
  const origem = integracao.sistema;

  try {
    const colaboradores = await conector.listarColaboradores();
    if (colaboradores) {
      const ativos = colaboradores.filter((c) => c.ativo);
      const up = await upsertColaboradores(
        db,
        tenantId,
        ativos.map((c) => ({
          nome: c.nome,
          email: c.email,
          role: "COLABORADOR" as const,
          equipe: c.equipe,
          idExternoERP: c.idExterno,
        })),
        origem,
        agora,
      );
      r.colaboradoresCriados = up.criados;
      r.colaboradoresAtualizados = up.atualizados;
      r.avisos.push(...up.erros.map((e) => `Colaborador ${e.linha}: ${e.mensagem}`));

      // Quem saiu do ERP (ou foi inativado lá) é desativado; pontos e histórico ficam.
      const vigentes = new Set(ativos.map((c) => c.idExterno));
      const desativar = await db.usuario.findMany({
        where: { origemCadastro: origem, ativo: true, idExternoERP: { not: null }, role: { not: "SUPER_ADMIN" } },
        select: { id: true, idExternoERP: true },
      });
      for (const u of desativar.filter((u) => !vigentes.has(u.idExternoERP!))) {
        await db.usuario.update({ where: { id: u.id }, data: { ativo: false } });
        r.colaboradoresDesativados++;
      }
    }

    const desde = integracao.ultimaSincronizacaoEm
      ? new Date(integracao.ultimaSincronizacaoEm.getTime() - SOBREPOSICAO_MS)
      : new Date(agora.getTime() - DIAS_PRIMEIRA_IMPORTACAO * 24 * 3600_000);
    const atendimentos = await conector.listarAtendimentosConcluidos(desde);

    for (const a of atendimentos) {
      if (await db.atendimento.findFirst({ where: { origemExternaId: a.idExterno }, select: { id: true } })) {
        r.atendimentosJaExistentes++;
        continue;
      }
      const colaborador = a.colaboradorIdExterno
        ? await db.usuario.findFirst({ where: { idExternoERP: a.colaboradorIdExterno }, select: { id: true } })
        : null;
      if (!colaborador) {
        r.atendimentosSemColaborador++;
        continue;
      }
      const existente = await db.clienteFinal.findFirst({ where: { idExternoERP: a.cliente.idExterno } });
      const cliente = existente
        ? await db.clienteFinal.update({
            where: { id: existente.id },
            data: {
              nome: a.cliente.nome,
              telefone: a.cliente.telefone ?? existente.telefone,
              email: a.cliente.email ?? existente.email,
            },
          })
        : await db.clienteFinal.create({
            data: {
              tenantId,
              nome: a.cliente.nome,
              telefone: a.cliente.telefone,
              email: a.cliente.email,
              idExternoERP: a.cliente.idExterno,
            },
          });
      await db.atendimento.create({
        data: {
          tenantId,
          tipo: a.tipo,
          colaboradorId: colaborador.id,
          clienteFinalId: cliente.id,
          origemExternaId: a.idExterno,
          concluidoEm: a.concluidoEm,
        },
      });
      r.atendimentosImportados++;
    }
    if (r.atendimentosSemColaborador > 0) {
      r.avisos.push(
        `${r.atendimentosSemColaborador} O.S. ignoradas: técnico sem cadastro no SinalPlus (importe a planilha com o id externo).`,
      );
    }

    await db.integracaoERP.update({
      where: { id: integracao.id },
      data: { ultimaSincronizacaoEm: agora, ultimoStatusSincronizacao: "SUCESSO" },
    });
    return r;
  } catch (erro) {
    await db.integracaoERP.update({
      where: { id: integracao.id },
      data: { ultimoStatusSincronizacao: "ERRO" },
    });
    throw erro instanceof ErroConectorERP ? erro : new ErroConectorERP("Falha na sincronização.", erro);
  }
}
