import { SinalIcone } from "@/components/sinal";

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <SinalIcone nivel={1} className="h-12" />
      <h1 className="text-2xl font-semibold">Sem sinal por aqui</h1>
      <p className="text-muted-foreground max-w-sm">
        A página ou o provedor que você procura não foi encontrado.
      </p>
    </main>
  );
}
