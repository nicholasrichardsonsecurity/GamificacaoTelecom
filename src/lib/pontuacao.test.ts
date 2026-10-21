import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Tenant } from "@prisma/client";
import { clienteDeTeste, criarTenantDeTeste, URL_TESTE } from "@/test/banco";
import { criarConvitePesquisa } from "./convites";
import {
  abrirContestacao,
  calcularDelta,
  decidirContestacao,
  registrarResposta,
  revisarSuspeita,
  SEQUENCIA_SELO,
} from "./pontuacao";
import { saldoDoColaborador, nivelPorPontos } from "./saldo";
import { dbDoTenant } from "./tenant-db";

const base = {
  multiplicador: 1,
  saldoTotal: 100,
  creditadoHoje: 0,
  creditadoSemana: 0,
  limiteDiario: null,
  limiteSemanal: null,
};

describe("calcularDelta", () => {
  it("credita o valor da regra com multiplicador de campanha", () => {
    expect(calcularDelta({ ...base, pontosRegra: 10 })).toEqual({ pontos: 10, pontosCalculados: 10 });
    expect(calcularDelta({ ...base, pontosRegra: 10, multiplicador: 2 })).toEqual({
      pontos: 20,
      pontosCalculados: 20,
    });
  });

  it("corta o crédito nos limites diário e semanal", () => {
    expect(calcularDelta({ ...base, pontosRegra: 10, limiteDiario: 25, creditadoHoje: 20 })).toEqual({
      pontos: 5,
      pontosCalculados: 10,
    });
    expect(calcularDelta({ ...base, pontosRegra: 10, limiteSemanal: 50, creditadoSemana: 60 })).toEqual({
      pontos: 0,
      pontosCalculados: 10,
    });
  });

  it("aplica o piso em zero no débito", () => {
    expect(calcularDelta({ ...base, pontosRegra: -10, saldoTotal: 4 })).toEqual({
      pontos: -4,
      pontosCalculados: -10,
    });
    expect(calcularDelta({ ...base, pontosRegra: -10, saldoTotal: 0 })).toEqual({
      pontos: 0,
      pontosCalculados: -10,
    });
  });

  it("multiplicador não aumenta débito", () => {
    expect(calcularDelta({ ...base, pontosRegra: -5, multiplicador: 3 })).toEqual({
      pontos: -5,
      pontosCalculados: -5,
    });
  });

  it("nota neutra não gera pontos", () => {
    expect(calcularDelta({ ...base, pontosRegra: 0 })).toEqual({ pontos: 0, pontosCalculados: 0 });
  });
});

describe("nivelPorPontos", () => {
  const niveis = [
    { id: "a", nome: "A", pontosAcumuladosMinimo: 0, cor: null },
    { id: "b", nome: "B", pontosAcumuladosMinimo: 100, cor: null },
  ];
  it("indica o nível atual e quanto falta para o próximo", () => {
    const r = nivelPorPontos(niveis, 40);
    expect(r.atual?.nome).toBe("A");
    expect(r.proximo?.nome).toBe("B");
    expect(r.faltam).toBe(60);
    expect(r.progresso).toBeCloseTo(0.4);
    expect(nivelPorPontos(niveis, 150).proximo).toBeNull();
  });
});

describe.skipIf(!URL_TESTE)("fluxo de avaliação no banco", () => {
  const prisma = clienteDeTeste();
  let tenant: Tenant;
  let db: ReturnType<typeof dbDoTenant>;
  let colaboradorId: string;
  let gestorId: string;
  let clienteId: string;
  const inicio = new Date("2026-10-21T13:00:00Z");

  beforeAll(async () => {
    tenant = await criarTenantDeTeste(prisma);
    db = dbDoTenant(tenant.id, prisma);
    const gestor = await db.usuario.create({ data: { tenantId: tenant.id, nome: "Gestor", role: "GESTOR" } });
    gestorId = gestor.id;
    const equipe = await db.equipe.create({ data: { tenantId: tenant.id, nome: "Paulista", gestorId } });
    colaboradorId = (
      await db.usuario.create({ data: { tenantId: tenant.id, nome: "Técnico", equipeId: equipe.id } })
    ).id;
    clienteId = (await db.clienteFinal.create({ data: { tenantId: tenant.id, nome: "Cliente" } })).id;
  });

  afterAll(() => prisma.$disconnect());

  /** Cria atendimento concluído há 10 min e responde com a nota dada. */
  async function avaliar(nivelSinal: number, agora: Date, extra: { respondenteLogado?: boolean } = {}) {
    const atendimento = await db.atendimento.create({
      data: {
        tenantId: tenant.id,
        tipo: "INSTALACAO",
        colaboradorId,
        clienteFinalId: clienteId,
        concluidoEm: new Date(agora.getTime() - 10 * 60_000),
      },
    });
    const token = await criarConvitePesquisa(db, tenant.id, atendimento.id, "MANUAL", agora);
    const r = await registrarResposta(db, tenant.id, { token: token!, nivelSinal, ...extra }, agora);
    return { r, token: token!, atendimentoId: atendimento.id };
  }

  it("credita pendente, libera depois de 7 dias e não aceita resposta duplicada", async () => {
    const { r, token } = await avaliar(5, inicio);
    expect(r.ok).toBe(true);

    let saldo = await saldoDoColaborador(db, colaboradorId, inicio);
    expect(saldo).toMatchObject({ total: 10, disponivel: 0, pendente: 10 });
    saldo = await saldoDoColaborador(db, colaboradorId, new Date(inicio.getTime() + 8 * 86400_000));
    expect(saldo).toMatchObject({ total: 10, disponivel: 10, pendente: 0, acumulado: 10 });

    expect(await registrarResposta(db, tenant.id, { token, nivelSinal: 1 }, inicio)).toEqual({
      ok: false,
      motivo: "respondido",
    });
  });

  it("nota baixa debita no máximo o saldo e abre caso para o gestor da equipe", async () => {
    const { r } = await avaliar(1, inicio);
    expect(r.ok).toBe(true);
    const saldo = await saldoDoColaborador(db, colaboradorId, inicio);
    expect(saldo.total).toBe(0); // tinha 10, a regra pede -10
    const caso = await db.casoRecuperacao.findFirstOrThrow({
      where: { avaliacaoId: r.ok ? r.avaliacaoId : "" },
    });
    expect(caso.gestorResponsavelId).toBe(gestorId);
    expect(caso.prazoContato.getTime() - inicio.getTime()).toBe(24 * 3600_000);

    const { r: r2 } = await avaliar(2, inicio);
    const t = await db.transacaoPontos.findFirstOrThrow({ where: { origemAvaliacaoId: r2.ok ? r2.avaliacaoId : "" } });
    expect(t).toMatchObject({ pontos: 0, pontosCalculados: -5 }); // piso em zero
  });

  it("contestação aceita estorna o débito efetivo com motivo", async () => {
    const { r } = await avaliar(5, inicio);
    expect(r.ok).toBe(true);
    const { r: baixa } = await avaliar(1, inicio);
    if (!baixa.ok) throw new Error("falhou");
    const antes = await saldoDoColaborador(db, colaboradorId, inicio);
    const c = await abrirContestacao(db, tenant.id, colaboradorId, baixa.avaliacaoId, "Queda de energia na rua toda");
    await expect(
      abrirContestacao(db, tenant.id, colaboradorId, baixa.avaliacaoId, "Contestando de novo"),
    ).rejects.toThrow(/já foi contestada/);
    const estorno = await decidirContestacao(db, tenant.id, c.id, gestorId, true, "Procede", inicio);
    expect(estorno).toMatchObject({ tipo: "AJUSTE_MANUAL", pontos: 10 });
    expect(estorno?.motivo).toContain("contestação");
    const depois = await saldoDoColaborador(db, colaboradorId, inicio);
    expect(depois.total).toBe(antes.total + 10);
    expect(await decidirContestacao(db, tenant.id, c.id, gestorId, true, "de novo", inicio)).toBeNull();
  });

  it("resposta suspeita não pontua até o gestor aceitar", async () => {
    const antes = (await saldoDoColaborador(db, colaboradorId, inicio)).total;
    const { r } = await avaliar(5, inicio, { respondenteLogado: true });
    if (!r.ok) throw new Error("falhou");
    expect(r.suspeita).toBe(true);
    expect((await saldoDoColaborador(db, colaboradorId, inicio)).total).toBe(antes);

    expect(await revisarSuspeita(db, tenant.id, r.avaliacaoId, gestorId, true, inicio)).toBe(true);
    expect((await saldoDoColaborador(db, colaboradorId, inicio)).total).toBe(antes + 10);
    expect(await revisarSuspeita(db, tenant.id, r.avaliacaoId, gestorId, true, inicio)).toBe(false);
  });

  it("respeita o limite diário configurado", async () => {
    await db.configuracaoPontuacao.update({ where: { tenantId: tenant.id }, data: { limiteDiario: 15 } });
    const dia = new Date("2026-10-23T13:00:00Z");
    await avaliar(5, dia);
    const { r } = await avaliar(5, dia);
    if (!r.ok) throw new Error("falhou");
    const t = await db.transacaoPontos.findFirstOrThrow({ where: { origemAvaliacaoId: r.avaliacaoId } });
    expect(t).toMatchObject({ pontos: 5, pontosCalculados: 10 });
    await db.configuracaoPontuacao.update({ where: { tenantId: tenant.id }, data: { limiteDiario: null } });
  });

  it(`concede o selo após ${SEQUENCIA_SELO} avaliações de sinal máximo seguidas`, async () => {
    const dia = new Date("2026-10-28T13:00:00Z");
    for (let i = 0; i < SEQUENCIA_SELO; i++) await avaliar(5, new Date(dia.getTime() + i * 60_000));
    const selos = await db.seloConquistado.findMany({ where: { colaboradorId }, include: { selo: true } });
    expect(selos.map((s) => s.selo.criterioTipo)).toEqual(["SEQUENCIA_SINAL_MAXIMO"]);
  });

  it("convite expirado ou de outro tenant não é aceito", async () => {
    const { token } = await avaliar(4, inicio).then(async (x) => {
      // novo atendimento sem resposta
      const at = await db.atendimento.create({
        data: { tenantId: tenant.id, tipo: "SUPORTE", colaboradorId, clienteFinalId: clienteId, concluidoEm: inicio },
      });
      return { token: (await criarConvitePesquisa(db, tenant.id, at.id, "MANUAL", inicio))!, x };
    });
    const depois = new Date(inicio.getTime() + 8 * 86400_000);
    expect(await registrarResposta(db, tenant.id, { token, nivelSinal: 5 }, depois)).toEqual({
      ok: false,
      motivo: "expirado",
    });
    const outro = await criarTenantDeTeste(prisma);
    expect(
      await registrarResposta(dbDoTenant(outro.id, prisma), outro.id, { token, nivelSinal: 5 }, inicio),
    ).toEqual({ ok: false, motivo: "invalido" });
  });

  it("cliente que pediu para não ser perturbado não recebe convite", async () => {
    const cliente = await db.clienteFinal.create({
      data: { tenantId: tenant.id, nome: "Quieto", naoPerturbe: true },
    });
    const at = await db.atendimento.create({
      data: { tenantId: tenant.id, tipo: "SUPORTE", colaboradorId, clienteFinalId: cliente.id },
    });
    expect(await criarConvitePesquisa(db, tenant.id, at.id)).toBeNull();
  });
});
