import { describe, expect, it } from "vitest";
import { detectarTipoImagem, NOME_ARQUIVO_SEGURO } from "./imagens";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("detectarTipoImagem", () => {
  it("reconhece PNG, JPG, WEBP e ICO pelos bytes", () => {
    expect(detectarTipoImagem(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(detectarTipoImagem(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(detectarTipoImagem(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe("webp");
    expect(detectarTipoImagem(bytes(0x00, 0x00, 0x01, 0x00))).toBe("ico");
  });

  it("recusa SVG e qualquer outra coisa", () => {
    expect(detectarTipoImagem(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull();
    expect(detectarTipoImagem(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});

describe("NOME_ARQUIVO_SEGURO", () => {
  it("só aceita nomes gerados pelo upload", () => {
    expect(NOME_ARQUIVO_SEGURO.test("logo-0a1b2c3d4e5f6a7b.png")).toBe(true);
    expect(NOME_ARQUIVO_SEGURO.test("../.env")).toBe(false);
    expect(NOME_ARQUIVO_SEGURO.test("logo.svg")).toBe(false);
  });
});
