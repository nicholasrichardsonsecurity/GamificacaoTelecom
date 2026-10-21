import { readFile } from "node:fs/promises";
import path from "node:path";
import { NOME_ARQUIVO_SEGURO, PASTA_SEGURA, TIPOS_IMAGEM, type ExtensaoImagem } from "@/lib/imagens";
import { pastaUploads } from "@/lib/uploads";

/**
 * Serve as imagens gravadas em `UPLOADS_DIR`. Em produção o Nginx pode servir
 * `/uploads` direto do disco (docs/04-DEPLOY-DEBIAN.md), sem passar por aqui.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ pasta: string; arquivo: string }> }) {
  const { pasta, arquivo } = await params;
  if (!PASTA_SEGURA.test(pasta) || !NOME_ARQUIVO_SEGURO.test(arquivo)) {
    return new Response("Não encontrado", { status: 404 });
  }
  try {
    const conteudo = await readFile(path.join(pastaUploads(), pasta, arquivo));
    const ext = arquivo.split(".").pop() as ExtensaoImagem;
    return new Response(conteudo, {
      headers: {
        "Content-Type": TIPOS_IMAGEM[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}
