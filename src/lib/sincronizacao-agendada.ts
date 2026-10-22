import type { PrismaClient } from "@prisma/client";
import { conectorDaIntegracao } from "./erp-connectors";
import { sincronizarIntegracao } from "./sincronizacao";
import { dbDoTenant } from "./tenant-db";

/**
 * Varredura do worker: roda as integrações ativas cuja última tentativa já
 * passou da frequência configurada. Usa a tentativa (não só o sucesso) para
 * não martelar o ERP quando as credenciais estão erradas.
 */

export type ResumoVarredura = { executadas: number; falhas: number };

export async function sincronizarVencidas(prisma: PrismaClient, agora = new Date()): Promise<ResumoVarredura> {
  // Leitura de plataforma, entre tenants; tudo que grava depois passa por dbDoTenant.
  const candidatas = await prisma.integracaoERP.findMany({
    where: { ativa: true, tenant: { status: "ATIVO" } },
    select: { id: true, tenantId: true, sistema: true, urlBase: true, credenciais: true, frequenciaSincronizacao: true, ultimaTentativaEm: true, ultimaSincronizacaoEm: true },
  });
  const vencidas = candidatas.filter(
    (i) => !i.ultimaTentativaEm || i.ultimaTentativaEm.getTime() + i.frequenciaSincronizacao * 60_000 <= agora.getTime(),
  );

  const resumo: ResumoVarredura = { executadas: 0, falhas: 0 };
  for (const i of vencidas) {
    const db = dbDoTenant(i.tenantId, prisma);
    try {
      await sincronizarIntegracao(db, i.tenantId, i, conectorDaIntegracao(i), agora);
      resumo.executadas++;
    } catch {
      // O status ERRO já foi gravado; credenciais ilegíveis caem aqui antes de gravar.
      await db.integracaoERP.update({
        where: { id: i.id },
        data: { ultimaTentativaEm: agora, ultimoStatusSincronizacao: "ERRO" },
      });
      resumo.falhas++;
    }
  }
  return resumo;
}
