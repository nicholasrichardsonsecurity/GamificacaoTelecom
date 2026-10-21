import { afterAll, describe, expect, it } from "vitest";
import { clienteDeTeste, criarTenantDeTeste, URL_TESTE } from "@/test/banco";
import { lerCsv, lerPlanilhaColaboradores, upsertColaboradores } from "./colaboradores";
import { dbDoTenant } from "./tenant-db";

describe("lerCsv", () => {
  it("detecta ; do Excel pt-BR e respeita aspas", () => {
    expect(lerCsv('﻿nome;email\n"Silva; Ana";ana@x.com\r\n\nJoão;"j@x.com"')).toEqual([
      ["nome", "email"],
      ["Silva; Ana", "ana@x.com"],
      ["João", "j@x.com"],
    ]);
    expect(lerCsv('a,b\n"x ""y""",z')).toEqual([
      ["a", "b"],
      ['x "y"', "z"],
    ]);
  });
});

describe("lerPlanilhaColaboradores", () => {
  it("mapeia cabeçalhos em português e valida linhas", () => {
    const r = lerPlanilhaColaboradores(
      [
        "Nome;E-mail;Cargo;Equipe;ID Externo",
        "Ana;ANA@x.com;Técnico;Paulista;10",
        "Beto;;Gestor;;20",
        ";c@x.com;;;",
        "Dani;dani@;;;",
        "Edu;edu@x.com;Astronauta;;",
        "Fê;;;;",
      ].join("\n"),
    );
    expect(r.colaboradores).toEqual([
      { linha: 2, nome: "Ana", email: "ana@x.com", role: "COLABORADOR", equipe: "Paulista", idExternoERP: "10" },
      { linha: 3, nome: "Beto", email: null, role: "GESTOR", equipe: null, idExternoERP: "20" },
    ]);
    expect(r.erros.map((e) => e.linha)).toEqual([4, 5, 6, 7]);
  });

  it("exige a coluna nome", () => {
    expect(lerPlanilhaColaboradores("email\na@x.com").erros[0].mensagem).toMatch(/nome/);
  });
});

describe.skipIf(!URL_TESTE)("upsertColaboradores no banco", () => {
  const prisma = clienteDeTeste();
  afterAll(() => prisma.$disconnect());

  it("é idempotente: rodar duas vezes não duplica, e atualiza quem mudou", async () => {
    const tenant = await criarTenantDeTeste(prisma);
    const db = dbDoTenant(tenant.id, prisma);
    const lista = [
      { nome: "Ana", email: "ana@x.com", role: "COLABORADOR" as const, equipe: "Paulista", idExternoERP: "10" },
      { nome: "Beto", email: null, role: "GESTOR" as const, equipe: "Paulista", idExternoERP: "20" },
      { nome: "Caio", email: "caio@x.com", role: "COLABORADOR" as const, equipe: null, idExternoERP: null },
    ];
    expect(await upsertColaboradores(db, tenant.id, lista, "IXC")).toMatchObject({ criados: 3, atualizados: 0 });
    const r2 = await upsertColaboradores(
      db,
      tenant.id,
      lista.map((l) => (l.idExternoERP === "10" ? { ...l, nome: "Ana Souza", equipe: "Igarassu" } : l)),
      "IXC",
    );
    expect(r2).toMatchObject({ criados: 0, atualizados: 3, erros: [] });
    expect(await db.usuario.count()).toBe(3);
    expect(await db.equipe.count()).toBe(2);
    const ana = await db.usuario.findFirstOrThrow({ where: { idExternoERP: "10" }, include: { equipe: true } });
    expect(ana).toMatchObject({ nome: "Ana Souza", origemCadastro: "IXC" });
    expect(ana.equipe?.nome).toBe("Igarassu");
  });

  it("respeita o limite de usuários e de equipes do plano", async () => {
    const tenant = await criarTenantDeTeste(prisma, { limiteColaboradores: 2, limiteFiliais: 1 });
    const db = dbDoTenant(tenant.id, prisma);
    const r = await upsertColaboradores(db, tenant.id, [
      { nome: "A", email: "a@x.com", role: "COLABORADOR", equipe: "E1", idExternoERP: null },
      { nome: "B", email: "b@x.com", role: "COLABORADOR", equipe: "E2", idExternoERP: null },
      { nome: "C", email: "c@x.com", role: "COLABORADOR", equipe: null, idExternoERP: null },
      { nome: "D", email: "d@x.com", role: "COLABORADOR", equipe: null, idExternoERP: null },
    ]);
    expect(r.criados).toBe(2);
    expect(r.erros.map((e) => e.mensagem)).toEqual([
      expect.stringMatching(/equipes/),
      expect.stringMatching(/usuários/),
    ]);
  });

  it("e-mail já usado por outra pessoa vira erro da linha, sem derrubar o lote", async () => {
    const tenant = await criarTenantDeTeste(prisma);
    const db = dbDoTenant(tenant.id, prisma);
    const r = await upsertColaboradores(db, tenant.id, [
      { nome: "A", email: "a@x.com", role: "COLABORADOR", equipe: null, idExternoERP: "1" },
      { nome: "B", email: "a@x.com", role: "COLABORADOR", equipe: null, idExternoERP: "2" },
      { nome: "C", email: "c@x.com", role: "COLABORADOR", equipe: null, idExternoERP: "3" },
    ]);
    expect(r).toMatchObject({ criados: 2, erros: [{ linha: 2 }] });
  });
});
