import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { SinalIcone } from "@/components/sinal";
import { Marca } from "@/components/marca";
import { rotaInicial } from "@/lib/rbac";
import { brandingDo, contextoAtual } from "@/lib/tenant";

export default async function Inicio() {
  const contexto = await contextoAtual();
  if (contexto.tipo === "desconhecido") notFound();

  const sessao = await auth();
  if (sessao?.user) redirect(rotaInicial(sessao.user.role));

  const branding = brandingDo(contexto);
  const plataforma = contexto.tipo === "plataforma";

  return (
    <main className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Marca branding={branding} />
        <Button asChild>
          <Link href="/login">Entrar</Link>
        </Button>
      </header>
      <section className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex items-end gap-3">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <SinalIcone key={n} nivel={n} className="h-10" />
          ))}
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {plataforma
            ? "Gamificação para provedores de internet"
            : `Bem-vindo ao ${branding.nomeExibicao}`}
        </h1>
        <p className="text-muted-foreground text-lg">
          {plataforma
            ? "Área de administração da plataforma."
            : "Cada atendimento bem avaliado vira pontos, níveis e prêmios para a equipe."}
        </p>
      </section>
    </main>
  );
}
