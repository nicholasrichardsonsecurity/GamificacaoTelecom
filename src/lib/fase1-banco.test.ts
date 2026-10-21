import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Tenant } from "@prisma/client";
import { clienteDeTeste, criarTenantDeTeste, URL_TESTE } from "@/test/banco";
import { criarAtendimentoManual } from "./atendimentos";
import { salvarUsuario } from "./colaboradores";
import { criarConvitePesquisa, descadastrarPesquisas } from "./convites";
import { registrarResposta, revisarSuspeita } from "./pontuacao";
import { regrasVigentes, salvarRegras } from "./regras";
import { colaboradoresVisiveis, ranking, relatorioCsat } from "./relatorios";
import { dbDoTenant } from "./tenant-db";

/** Regras, atendimento manual, opt-out, cadastro manual, ranking e CSAT. */
describe.skipIf(!URL_TESTE)("Fase 1 no banco", () => {
  const prisma = clienteDeTeste();
  let tenant: Tenant;
  let db: ReturnType<typeof dbDoTenant>;
  let gestorId: string;
  let paulista: string;
  let ana: string;
  let bruno: string;
  let t0: Date;

  beforeAll(async () => {
    tenant = await criarTenantDeTeste(prisma, { limiteColaboradores: 4 });
    // Depois do template: as regras padrão já valem em t0.
    t0 = new Date(Date.now() + 1000);
    db = dbDoTenant(tenant.id, prisma);
    gestorId = (await db.usuario.create({ data: { tenantId: tenant.id, nome: "Gestor", role: "GESTOR" } })).id;
    paulista = (await db.equipe.create({ data: { tenantId: tenant.id, nome: "Paulista", gestorId } })).id;
    const olinda = (await db.equipe.create({ data: { tenantId: tenant.id, nome: "Olinda" } })).id;
    ana = (await db.usuario.create({ data: { tenantId: tenant.id, nome: "Ana", equipeId: paulista } })).id;
    bruno = (await db.usuario.create({ data: { tenantId: tenant.id, nome: "Bruno", equipeId: olinda } })).id;
  });

  afterAll(() => prisma.$disconnect());

  async function atenderEAvaliar(colaboradorId: string, nota: number | null, tipo: "SUPORTE" | "VENDA" = "SUPORTE") {
    const a = await criarAtendimentoManual(
      db,
      tenant.id,
      { colaboradorId, tipo, clienteNome: "Cliente", clienteTelefone: null, clienteEmail: null, clienteIdExterno: null },
      t0,
    );
    const token = await criarConvitePesquisa(db, tenant.id, a.id, "MANUAL", t0);
    if (nota !== null) {
      await registrarResposta(db, tenant.id, { token: token!, nivelSinal: nota }, new Date(t0.getTime() + 3600_000));
    }
    return { atendimentoId: a.id, token: token! };
  }

  it("versiona regras: a antiga ganha ativaAte e só o que mudou é gravado", async () => {
    const antes = await regrasVigentes(db, t0);
    expect(await salvarRegras(db, tenant.id, { 5: 10, 4: 8, 3: 0, 2: -5, 1: -10 }, t0)).toBe(1);
    const depois = await regrasVigentes(db, new Date(t0.getTime() + 1));
    expect(depois.get(4)?.pontos).toBe(8);
    const antiga = await db.regraPontuacao.findFirstOrThrow({ where: { id: antes.get(4)!.id } });
    expect(antiga.ativaAte).toEqual(t0);
    expect(await salvarRegras(db, tenant.id, { 5: 10, 4: 8 }, t0)).toBe(0);
  });

  it("atendimento manual não aceita colaborador de outro tenant", async () => {
    const outro = await criarTenantDeTeste(prisma);
    const estranho = await prisma.usuario.create({ data: { tenantId: outro.id, nome: "X" } });
    await expect(
      criarAtendimentoManual(db, tenant.id, {
        colaboradorId: estranho.id,
        tipo: "SUPORTE",
        clienteNome: "C",
        clienteTelefone: null,
        clienteEmail: null,
        clienteIdExterno: null,
      }),
    ).rejects.toThrow("Colaborador não encontrado.");
  });

  it("opt-out: o cliente descadastrado não recebe novos convites", async () => {
    const { atendimentoId, token } = await atenderEAvaliar(bruno, null);
    expect(await descadastrarPesquisas(db, token)).toBe(true);
    expect(await criarConvitePesquisa(db, tenant.id, atendimentoId)).toBeNull();
  });

  it("cadastro manual respeita o limite do plano e e-mail único", async () => {
    // Já há 3 ativos (gestor, Ana, Bruno); o limite é 4.
    const novo = await salvarUsuario(db, tenant.id, null, {
      nome: "Carla",
      email: "carla@x.com",
      role: "COLABORADOR",
      equipeId: paulista,
      ativo: true,
    });
    await expect(
      salvarUsuario(db, tenant.id, null, { nome: "Davi", email: "davi@x.com", role: "COLABORADOR", equipeId: null, ativo: true }),
    ).rejects.toThrow(/Limite de 4/);
    await salvarUsuario(db, tenant.id, novo.id, {
      nome: novo.nome,
      email: novo.email,
      role: "COLABORADOR",
      equipeId: paulista,
      ativo: false,
    });
    await expect(
      salvarUsuario(db, tenant.id, null, { nome: "Davi", email: "carla@x.com", role: "COLABORADOR", equipeId: null, ativo: true }),
    ).rejects.toThrow("Já existe um usuário com este e-mail.");
  });

  it("ranking e CSAT respeitam a visão do gestor e ignoram suspeitas não aceitas", async () => {
    await atenderEAvaliar(ana, 5);
    await atenderEAvaliar(ana, 4, "VENDA");
    await atenderEAvaliar(bruno, 2);
    // Resposta suspeita (respondente logado) de Bruno: não conta até ser aceita.
    const suspeito = await criarAtendimentoManual(
      db,
      tenant.id,
      { colaboradorId: bruno, tipo: "SUPORTE", clienteNome: "C", clienteTelefone: null, clienteEmail: null, clienteIdExterno: null },
      t0,
    );
    const token = await criarConvitePesquisa(db, tenant.id, suspeito.id, "MANUAL", t0);
    const r = await registrarResposta(
      db,
      tenant.id,
      { token: token!, nivelSinal: 5, respondenteLogado: true },
      new Date(t0.getTime() + 3600_000),
    );

    const todos = await ranking(db, { desde: null });
    expect(todos.map((l) => [l.nome, l.pontos, l.avaliacoes])).toEqual([
      ["Ana", 18, 2],
      ["Bruno", 0, 1],
      ["Gestor", 0, 0],
    ]);

    const visao = colaboradoresVisiveis({ id: gestorId, role: "GESTOR" });
    expect((await ranking(db, { desde: null, colaboradores: visao })).map((l) => l.nome)).toEqual(["Ana"]);

    let csat = await relatorioCsat(db, { desde: null });
    // 5 convites (inclui o do opt-out e o suspeito), 3 respostas válidas: 5, 4 e 2.
    expect(csat.geral).toMatchObject({ convites: 5, respostas: 3, distribuicao: [0, 1, 0, 1, 1] });
    expect(csat.geral.mediaSinal).toBeCloseTo(11 / 3);
    expect(csat.porTipo.find((g) => g.tipo === "VENDA")).toMatchObject({ convites: 1, mediaSinal: 4 });

    if (!r.ok) throw new Error("resposta deveria ter sido registrada");
    await revisarSuspeita(db, tenant.id, r.avaliacaoId, gestorId, true);
    csat = await relatorioCsat(db, { desde: null });
    expect(csat.geral.respostas).toBe(4);
    const equipes = (await relatorioCsat(db, { desde: null, colaboradores: visao })).porEquipe;
    expect(equipes.map((g) => g.chave)).toEqual(["Paulista"]);
  });
});
