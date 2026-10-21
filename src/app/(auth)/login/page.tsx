import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Marca } from "@/components/marca";
import { brandingDo, contextoAtual } from "@/lib/tenant";
import { FormLogin } from "./form-login";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; senhaDefinida?: string }>;
}) {
  const contexto = await contextoAtual();
  if (contexto.tipo === "desconhecido") notFound();
  const branding = brandingDo(contexto);
  const { callbackUrl, senhaDefinida } = await searchParams;

  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-4">
          <Marca branding={branding} />
          <div className="grid gap-1.5">
            <CardTitle className="text-xl">Entrar</CardTitle>
            <CardDescription>
              {contexto.tipo === "plataforma"
                ? "Acesso da administração da plataforma."
                : "Use o e-mail e a senha cadastrados pelo seu provedor."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {senhaDefinida && (
            <p role="status" className="border-primary/40 bg-primary/5 rounded-md border px-3 py-2 text-sm">
              Senha definida. Agora é só entrar.
            </p>
          )}
          <FormLogin callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
    </main>
  );
}
