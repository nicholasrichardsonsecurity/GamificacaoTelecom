import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { decidirAcesso, rotaInicial } from "./rbac";
import type { ReferenciaHost } from "./host";

const PLATAFORMA: ReferenciaHost = { tipo: "plataforma" };
const TENANT: ReferenciaHost = { tipo: "subdominio", slug: "demo" };

const decidir = (pathname: string, host: ReferenciaHost | null, role?: Role) =>
  decidirAcesso({ pathname, host, role }).tipo;

describe("decidirAcesso", () => {
  it("libera rotas públicas sem login", () => {
    expect(decidir("/", TENANT)).toBe("permitir");
    expect(decidir("/login", TENANT)).toBe("permitir");
    expect(decidir("/avaliar/abc", TENANT)).toBe("permitir");
  });

  it("pede login nas áreas protegidas", () => {
    expect(decidir("/admin", TENANT)).toBe("login");
    expect(decidir("/colaborador/extrato", TENANT)).toBe("login");
    expect(decidir("/superadmin", PLATAFORMA)).toBe("login");
  });

  it("aplica a matriz de papéis", () => {
    const matriz: [string, Role, string][] = [
      ["/admin", "ADMIN_PROVEDOR", "permitir"],
      ["/admin", "GESTOR", "proibido"],
      ["/admin", "COLABORADOR", "proibido"],
      ["/gestor", "ADMIN_PROVEDOR", "permitir"],
      ["/gestor", "GESTOR", "permitir"],
      ["/gestor", "COLABORADOR", "proibido"],
      ["/colaborador", "COLABORADOR", "permitir"],
      ["/colaborador", "GESTOR", "permitir"],
    ];
    for (const [rota, role, esperado] of matriz) {
      expect(decidir(rota, TENANT, role), `${role} em ${rota}`).toBe(esperado);
    }
    expect(decidir("/superadmin/tenants", PLATAFORMA, "SUPER_ADMIN")).toBe("permitir");
  });

  it("não confunde prefixos parecidos", () => {
    expect(decidir("/administracao-publica", TENANT)).toBe("permitir");
  });

  it("esconde áreas fora do escopo do domínio", () => {
    expect(decidir("/superadmin", TENANT, "SUPER_ADMIN")).toBe("nao-encontrado");
    expect(decidir("/admin", PLATAFORMA, "ADMIN_PROVEDOR")).toBe("nao-encontrado");
    expect(decidir("/", null)).toBe("nao-encontrado");
  });
});

describe("rotaInicial", () => {
  it("leva cada papel ao seu painel, que ele mesmo pode acessar", () => {
    const roles: Role[] = ["SUPER_ADMIN", "ADMIN_PROVEDOR", "GESTOR", "COLABORADOR"];
    for (const role of roles) {
      const host = role === "SUPER_ADMIN" ? PLATAFORMA : TENANT;
      expect(decidir(rotaInicial(role), host, role)).toBe("permitir");
    }
  });
});
