import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Marca } from "@/components/marca";
import { SinalIcone } from "@/components/sinal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { buscarConvitePesquisa } from "@/lib/convites";
import { brandingDo, contextoAtual } from "@/lib/tenant";
import { dbDoTenant } from "@/lib/tenant-db";
import { naoQueroMais, responder } from "./actions";

export const metadata: Metadata = {
  title: "Avalie o atendimento",
  // O token está na URL: não vaza em Referer para outros sites. ("no-referrer"
  // faria o navegador enviar `Origin: null` e quebrar as Server Actions.)
  referrer: "same-origin",
  robots: { index: false, follow: false },
};

const ROTULOS = ["Péssimo", "Ruim", "Regular", "Bom", "Excelente"];

function Moldura({ marca, titulo, descricao, children }: {
  marca: React.ReactNode;
  titulo: string;
  descricao?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-4">
          <div className="bg-marca-secundaria text-marca-secundaria-texto -mx-6 -mt-6 rounded-t-xl px-6 py-4">
            {marca}
          </div>
          <div className="grid gap-1.5">
            <CardTitle className="text-xl">{titulo}</CardTitle>
            {descricao && <CardDescription>{descricao}</CardDescription>}
          </div>
        </CardHeader>
        {children && <CardContent className="grid gap-6">{children}</CardContent>}
      </Card>
    </main>
  );
}

export default async function PaginaAvaliar({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erro?: string; descadastrado?: string }>;
}) {
  const contexto = await contextoAtual();
  if (contexto.tipo !== "tenant") notFound();
  const [{ token }, { erro, descadastrado }] = await Promise.all([params, searchParams]);
  const convite = await buscarConvitePesquisa(dbDoTenant(contexto.tenant.id), token);
  const marca = <Marca branding={brandingDo(contexto)} />;

  if (descadastrado) {
    return (
      <Moldura
        marca={marca}
        titulo="Pronto, você não vai mais receber pesquisas"
        descricao={`O ${contexto.tenant.nomeExibicao} não vai mais enviar pesquisas de satisfação para você.`}
      />
    );
  }
  if (!convite) {
    return <Moldura marca={marca} titulo="Link inválido" descricao="Confira se o link foi copiado inteiro." />;
  }
  if (convite.respondidoEm) {
    return (
      <Moldura
        marca={marca}
        titulo="Obrigado pela avaliação!"
        descricao="Sua resposta ajuda a equipe a melhorar cada atendimento."
      />
    );
  }
  if (convite.expiraEm <= new Date()) {
    return <Moldura marca={marca} titulo="Este link expirou" descricao="O prazo para responder esta pesquisa acabou." />;
  }

  const primeiroNome = convite.atendimento.colaborador.nome.split(" ")[0];
  return (
    <Moldura
      marca={marca}
      titulo={`Como foi o atendimento de ${primeiroNome}?`}
      descricao="Escolha a força do sinal: quanto mais barras, melhor."
    >
      <form action={responder.bind(null, token)} className="grid gap-6">
        <fieldset className="grid grid-cols-5 gap-2">
          <legend className="sr-only">Nota de 1 a 5</legend>
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <label
              key={n}
              className="has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-ring/50 grid cursor-pointer justify-items-center gap-2 rounded-lg border p-2 text-center text-xs has-[:focus-visible]:ring-[3px]"
            >
              <input type="radio" name="nivelSinal" value={n} required className="sr-only" />
              <SinalIcone nivel={n} className="h-8" titulo={`${n} de 5: ${ROTULOS[n - 1]}`} />
              <span aria-hidden>{ROTULOS[n - 1]}</span>
            </label>
          ))}
        </fieldset>
        {erro && (
          <p role="alert" className="text-destructive text-sm">
            Escolha uma das opções de sinal.
          </p>
        )}
        <div className="grid gap-2">
          <label htmlFor="comentario" className="text-sm font-medium">
            Quer contar mais? <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <Textarea id="comentario" name="comentario" maxLength={2000} rows={3} />
        </div>
        <Button type="submit" size="lg">
          Enviar avaliação
        </Button>
      </form>
      <form action={naoQueroMais.bind(null, token)} className="border-t pt-4 text-center">
        <button type="submit" className="text-muted-foreground text-xs underline">
          Não quero mais receber pesquisas
        </button>
      </form>
    </Moldura>
  );
}
