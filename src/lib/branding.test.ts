import { describe, expect, it } from "vitest";
import { corDeTextoSobre, corSegura, variaveisCss } from "./branding";

describe("corSegura", () => {
  it("aceita apenas #rrggbb", () => {
    expect(corSegura("#2563EB", "#000000")).toBe("#2563eb");
    expect(corSegura("red", "#000000")).toBe("#000000");
    expect(corSegura("#fff", "#000000")).toBe("#000000");
    expect(corSegura(null, "#000000")).toBe("#000000");
  });

  it("bloqueia tentativa de injeção de CSS", () => {
    const css = variaveisCss({ corPrimaria: "#000;}body{display:none", corSecundaria: "#ffffff" });
    expect(css).not.toContain("display");
    expect(css).toContain("--marca-primaria:#16a34a");
  });
});

describe("corDeTextoSobre", () => {
  it("escolhe o texto com mais contraste", () => {
    expect(corDeTextoSobre("#0f172a")).toBe("#ffffff");
    expect(corDeTextoSobre("#facc15")).toBe("#0a0a0a");
    expect(corDeTextoSobre("#ffffff")).toBe("#0a0a0a");
  });
});
