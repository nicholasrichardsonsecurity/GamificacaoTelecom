import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Tenant } from "@prisma/client";
import { clienteDeTeste, criarTenantDeTeste, URL_TESTE } from "@/test/banco";
import type { AtendimentoExterno, ColaboradorExterno, ConectorERP } from "./erp-connectors/types";
import { sincronizarIntegracao } from "./sincronizacao";
import { dbDoTenant } from "./tenant-db";

describe.skipIf(!URL_TESTE)("sincronização com ERP", () => {
  const prisma = clienteDeTeste();
  let tenant: Tenant;
  let outro: Tenant;
  let db: ReturnType<typeof dbDoTenant>;
  let integracaoId: string;
  const agora = new Date("2026-10-21T12:00:00Z");

  let colaboradores: ColaboradorExterno[] | null = [];
  let os: AtendimentoExterno[] = [];
  const conector: ConectorERP = {
    sistema: "IXC",
    testarConexao: async () => {},
    listarColaboradores: async () => colaboradores,
    listarAtendimentosConcluidos: async () => os,
  };
  const ana = { idExterno: "1", nome: "Ana", email: "ana@x.com", ativo: true, equipe: "Paulista" };
  const bia = { idExterno: "2", nome: "Bia", email: null, ativo: true, equipe: null };
  const ordem = (id: string, tec: string | null): AtendimentoExterno => ({
    idExterno: id,
    tipo: "SUPORTE",
    colaboradorIdExterno: tec,
    cliente: { idExterno: "c1", nome: "Maria", telefone: null, email: null },
    concluidoEm: new Date("2026-10-20T10:00:00Z"),
  });

  beforeAll(async () => {
    tenant = await criarTenantDeTeste(prisma, { limiteColaboradores: 10 });
    outro = await criarTenantDeTeste(prisma, { limiteColaboradores: 10 });
    db = dbDoTenant(tenant.id, prisma);
    integracaoId = (
      await db.integracaoERP.create({
        data: { tenantId: tenant.id, sistema: "IXC", urlBase: "https://x.com", credenciais: "v1:x:y:z" },
      })
    ).id;
  });
  afterAll(() => prisma.$disconnect());

  const rodar = async () => {
    const integ = await db.integracaoERP.findFirstOrThrow({ where: { id: integracaoId } });
    return sincronizarIntegracao(db, tenant.id, integ, conector, agora);
  };

  it("é idempotente: a segunda rodada não duplica colaboradores nem O.S.", async () => {
    colaboradores = [ana, bia];
    os = [ordem("100", "1"), ordem("101", "2")];
    const r1 = await rodar();
    expect(r1).toMatchObject({ colaboradoresCriados: 2, atendimentosImportados: 2 });
    const r2 = await rodar();
    expect(r2).toMatchObject({ colaboradoresCriados: 0, colaboradoresAtualizados: 2, atendimentosImportados: 0, atendimentosJaExistentes: 2 });
    expect(await db.usuario.count({ where: { origemCadastro: "IXC" } })).toBe(2);
    expect(await db.atendimento.count()).toBe(2);
    expect(await db.clienteFinal.count()).toBe(1);
    const integ = await db.integracaoERP.findFirstOrThrow({ where: { id: integracaoId } });
    expect(integ).toMatchObject({ ultimoStatusSincronizacao: "SUCESSO", ultimaSincronizacaoEm: agora });
  });

  it("desativa quem saiu do ERP sem apagar o histórico", async () => {
    colaboradores = [ana];
    os = [];
    expect((await rodar()).colaboradoresDesativados).toBe(1);
    const bia2 = await db.usuario.findFirstOrThrow({ where: { idExternoERP: "2" } });
    expect(bia2.ativo).toBe(false);
    expect(await db.atendimento.count({ where: { colaboradorId: bia2.id } })).toBe(1);
  });

  it("ignora O.S. de técnico desconhecido e avisa", async () => {
    os = [ordem("200", "999"), ordem("201", null)];
    const r = await rodar();
    expect(r.atendimentosSemColaborador).toBe(2);
    expect(r.avisos.join()).toContain("2 O.S. ignoradas");
  });

  it("sem endpoint de colaboradores (null) só importa O.S. e não desativa ninguém", async () => {
    colaboradores = null;
    os = [ordem("300", "1")];
    const r = await rodar();
    expect(r).toMatchObject({ atendimentosImportados: 1, colaboradoresDesativados: 0 });
  });

  it("não vaza para outro tenant e registra ERRO quando o conector falha", async () => {
    expect(await dbDoTenant(outro.id, prisma).atendimento.count()).toBe(0);
    const quebrado: ConectorERP = { ...conector, listarAtendimentosConcluidos: async () => { throw new Error("boom"); } };
    const integ = await db.integracaoERP.findFirstOrThrow({ where: { id: integracaoId } });
    await expect(sincronizarIntegracao(db, tenant.id, integ, quebrado, agora)).rejects.toThrow();
    expect((await db.integracaoERP.findFirstOrThrow({ where: { id: integracaoId } })).ultimoStatusSincronizacao).toBe("ERRO");
  });
});
