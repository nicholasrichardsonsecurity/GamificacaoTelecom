import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectarTipoImagem, TAMANHO_MAXIMO_IMAGEM } from "./imagens";

/**
 * Armazenamento local de uploads (docs/02-ARQUITETURA-STACK.md). Em produção,
 * `UPLOADS_DIR` aponta para a pasta incluída no backup.
 */
export function pastaUploads(): string {
  return path.resolve(process.env.UPLOADS_DIR ?? "uploads");
}

/** Grava a imagem do tenant e devolve a URL pública (`/uploads/...`). */
export async function salvarImagem(tenantId: string, arquivo: File, prefixo: string): Promise<string> {
  if (arquivo.size === 0) throw new Error("Escolha um arquivo.");
  if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) throw new Error("A imagem precisa ter no máximo 1 MB.");
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const ext = detectarTipoImagem(bytes);
  if (!ext) throw new Error("Formato não aceito. Use PNG, JPG, WEBP ou ICO.");

  const pasta = tenantId.toLowerCase();
  const nome = `${prefixo}-${randomBytes(8).toString("hex")}.${ext}`;
  await mkdir(path.join(pastaUploads(), pasta), { recursive: true });
  await writeFile(path.join(pastaUploads(), pasta, nome), bytes);
  return `/uploads/${pasta}/${nome}`;
}
