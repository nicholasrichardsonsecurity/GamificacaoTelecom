/**
 * Validação de imagens enviadas (logo, favicon e, na Fase 3, fotos de prêmio).
 * O tipo vem dos bytes do arquivo, nunca do nome nem do Content-Type enviado.
 * SVG fica de fora de propósito: pode carregar script.
 */

export const TAMANHO_MAXIMO_IMAGEM = 1024 * 1024;

export const TIPOS_IMAGEM = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
} as const;

export type ExtensaoImagem = keyof typeof TIPOS_IMAGEM;

const comeca = (b: Uint8Array, assinatura: number[], deslocamento = 0) =>
  assinatura.every((byte, i) => b[deslocamento + i] === byte);

export function detectarTipoImagem(bytes: Uint8Array): ExtensaoImagem | null {
  if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (comeca(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (comeca(bytes, [0x52, 0x49, 0x46, 0x46]) && comeca(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (comeca(bytes, [0x00, 0x00, 0x01, 0x00])) return "ico";
  return null;
}

/** Nome de arquivo seguro para servir (sem barras, pontos duplos etc.). */
export const NOME_ARQUIVO_SEGURO = /^[a-z0-9-]+\.(png|jpg|webp|ico)$/;
export const PASTA_SEGURA = /^[a-z0-9]+$/;
