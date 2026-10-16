import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifra credenciais de terceiros (IXC/SGP) em repouso com AES-256-GCM.
 * Formato: `v1:<iv>:<tag>:<dados>` em base64url. A chave vem de
 * `CREDENCIAIS_CHAVE` (32 bytes em base64; gere com `openssl rand -base64 32`).
 */
const VERSAO = "v1";

function chave(chaveBase64 = process.env.CREDENCIAIS_CHAVE): Buffer {
  if (!chaveBase64) throw new Error("CREDENCIAIS_CHAVE não configurada");
  const k = Buffer.from(chaveBase64, "base64");
  if (k.length !== 32) throw new Error("CREDENCIAIS_CHAVE deve ter 32 bytes (base64)");
  return k;
}

export function cifrar(texto: string, chaveBase64?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(chaveBase64), iv);
  const dados = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSAO, iv, tag, dados]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(":");
}

export function decifrar(cifrado: string, chaveBase64?: string): string {
  const [versao, iv, tag, dados] = cifrado.split(":");
  if (versao !== VERSAO || !iv || !tag || dados === undefined) {
    throw new Error("Formato de credencial cifrada inválido");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    chave(chaveBase64),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dados, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
