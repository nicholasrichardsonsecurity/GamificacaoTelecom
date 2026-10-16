import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cifrar, decifrar } from "./crypto";

const CHAVE = randomBytes(32).toString("base64");

describe("credenciais cifradas", () => {
  it("faz ida e volta sem guardar texto puro", () => {
    const segredo = JSON.stringify({ token: "ixc-123:abc" });
    const cifrado = cifrar(segredo, CHAVE);
    expect(cifrado).not.toContain("ixc-123");
    expect(decifrar(cifrado, CHAVE)).toBe(segredo);
  });

  it("usa IV aleatório", () => {
    expect(cifrar("x", CHAVE)).not.toBe(cifrar("x", CHAVE));
  });

  it("rejeita dado adulterado ou chave errada", () => {
    const cifrado = cifrar("segredo", CHAVE);
    const partes = cifrado.split(":");
    partes[3] = Buffer.from("outra coisa").toString("base64url");
    expect(() => decifrar(partes.join(":"), CHAVE)).toThrow();
    expect(() => decifrar(cifrado, randomBytes(32).toString("base64"))).toThrow();
  });

  it("exige chave de 32 bytes", () => {
    expect(() => cifrar("x", Buffer.from("curta").toString("base64"))).toThrow(/32 bytes/);
  });
});
