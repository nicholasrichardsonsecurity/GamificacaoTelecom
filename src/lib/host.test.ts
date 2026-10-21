import { describe, expect, it } from "vitest";
import { hostDaRequisicao, normalizarHost, resolverHost } from "./host";

const BASE = "sinalplus.com.br";

describe("resolverHost", () => {
  it("reconhece o domínio da plataforma, com e sem www", () => {
    expect(resolverHost("sinalplus.com.br", BASE)).toEqual({ tipo: "plataforma" });
    expect(resolverHost("www.sinalplus.com.br", BASE)).toEqual({ tipo: "plataforma" });
  });

  it("resolve subdomínio de tenant por slug", () => {
    expect(resolverHost("giganetpe.sinalplus.com.br", BASE)).toEqual({
      tipo: "subdominio",
      slug: "giganetpe",
    });
  });

  it("ignora porta, maiúsculas e ponto final", () => {
    expect(resolverHost("GigaNetPe.SinalPlus.com.br.:443", BASE)).toEqual({
      tipo: "subdominio",
      slug: "giganetpe",
    });
    expect(resolverHost("demo.localhost:3000", "localhost")).toEqual({
      tipo: "subdominio",
      slug: "demo",
    });
  });

  it("trata outros domínios como domínio customizado", () => {
    expect(resolverHost("pontos.giganetpe.com.br", BASE)).toEqual({
      tipo: "customizado",
      dominio: "pontos.giganetpe.com.br",
    });
  });

  it("não aceita subdomínio aninhado nem slug inválido", () => {
    expect(resolverHost("a.b.sinalplus.com.br", BASE)).toBeNull();
    expect(resolverHost("-x.sinalplus.com.br", BASE)).toBeNull();
  });

  it("não confunde domínio que apenas termina com o nome da plataforma", () => {
    expect(resolverHost("evilsinalplus.com.br", BASE)).toEqual({
      tipo: "customizado",
      dominio: "evilsinalplus.com.br",
    });
  });

  it("retorna null sem host", () => {
    expect(resolverHost(null, BASE)).toBeNull();
    expect(resolverHost("", BASE)).toBeNull();
  });
});

describe("normalizarHost", () => {
  it("preserva IPv6 literal", () => {
    expect(normalizarHost("[::1]:3000")).toBe("[::1]");
  });
});

describe("hostDaRequisicao", () => {
  it("prefere o X-Forwarded-Host (render interno do Next após redirect de Server Action)", () => {
    const h = new Headers({ host: "localhost:3000", "x-forwarded-host": "demo.sinalplus.com.br, proxy" });
    expect(hostDaRequisicao(h)).toBe("demo.sinalplus.com.br");
    expect(hostDaRequisicao(new Headers({ host: "demo.localhost:3000" }))).toBe("demo.localhost:3000");
  });
});
