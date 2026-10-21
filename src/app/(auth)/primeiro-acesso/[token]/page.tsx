import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Marca } from "@/components/marca";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buscarConviteAcesso } from "@/lib/convites";
import { brandingDo, contextoAtual } from "@/lib/tenant";
import { dbDoTenant } from "@/lib/tenant-db";
import { definirSenha } from "./actions";
import { FormSenha } from "./form-senha";

export const metadata: Metadata = {
  title: "Definir senha",
  // O token está na URL: não vaza em Referer para outros sites. ("no-referrer"
  // faria o navegador enviar `Origin: null` e quebrar as Server Actions.)
  referrer: "same-origin",
};

export default async function PaginaPrimeiroAcesso({ params }: { params: Promise<{ token: string }> }) {
  const contexto = await contextoAtual();
  if (contexto.tipo !== "tenant") notFound();
  const { token } = await params;
  const convite = await buscarConviteAcesso(dbDoTenant(contexto.tenant.id), token);

  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-4">
          <Marca branding={brandingDo(contexto)} />
          <div className="grid gap-1.5">
            <CardTitle className="text-xl">{convite ? `Olá, ${convite.usuario.nome}` : "Link inválido"}</CardTitle>
            <CardDescription>
              {convite
                ? `Defina sua senha para entrar com ${convite.usuario.email ?? "seu e-mail"}.`
                : "Este link expirou ou já foi usado. Peça um novo ao administrador do seu provedor."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {convite ? (
            <FormSenha acao={definirSenha.bind(null, token)} />
          ) : (
            <Link href="/login" className="text-sm underline">
              Ir para o login
            </Link>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
