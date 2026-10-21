import { describe, expect, it } from "vitest";
import { inicioDaSemana, inicioDoDia, inicioDoPeriodo } from "./periodo";

describe("períodos no horário de Brasília", () => {
  it("o dia começa às 03:00 UTC", () => {
    expect(inicioDoDia(new Date("2026-10-21T02:59:00Z")).toISOString()).toBe("2026-10-20T03:00:00.000Z");
    expect(inicioDoDia(new Date("2026-10-21T03:00:00Z")).toISOString()).toBe("2026-10-21T03:00:00.000Z");
  });

  it("a semana começa na segunda-feira", () => {
    // 21/10/2026 é quarta-feira
    expect(inicioDaSemana(new Date("2026-10-21T15:00:00Z")).toISOString()).toBe("2026-10-19T03:00:00.000Z");
    // domingo à noite em Brasília ainda é a semana anterior
    expect(inicioDaSemana(new Date("2026-10-26T02:00:00Z")).toISOString()).toBe("2026-10-19T03:00:00.000Z");
  });

  it("o mês começa no dia 1 de Brasília", () => {
    expect(inicioDoPeriodo("mes", new Date("2026-11-01T01:00:00Z"))?.toISOString()).toBe(
      "2026-10-01T03:00:00.000Z",
    );
    expect(inicioDoPeriodo("tudo")).toBeNull();
  });
});
