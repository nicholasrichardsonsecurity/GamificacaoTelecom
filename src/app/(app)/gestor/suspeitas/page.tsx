import type { Metadata } from "next";
import { Aviso } from "@/components/aviso";
import { SinalIcone } from "@/components/sinal";
import { Titulo } from "@/components/titulo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParamsAviso } from "@/lib/acoes";
import { TIPOS_ATENDIMENTO } from "@/lib/atendimentos";
import { formatarDataHora } from "@/lib/formato";
import { revisarSuspeitaAction } from "../actions";
import { exigirGestao } from "../escopo";

export const metadata: Metadata = { title: "Avaliações suspeitas" };

export default async function PaginaSuspeitas({ searchParams }: { searchParams: ParamsAviso }) {
  const { db, avaliacoes } = await exigirGestao();
  const [lista, aviso] = await Promise.all([
    db.avaliacao.findMany({
      where: { AND: [{ suspeita: true, revisadaEm: null }, avaliacoes] },
      orderBy: { respondidaEm: "asc" },
      include: {
        atendimento: {
          select: {
            tipo: true,
            concluidoEm: true,
            colaborador: { select: { nome: true } },
            clienteFinal: { select: { nome: true } },
          },
        },
      },
    }),
    searchParams,
  ]);

  return (
    <>
      <Titulo descricao="Respostas com sinal de fraude não pontuam até alguém revisar. Aceite se a resposta é legítima.">
        Avaliações suspeitas
      </Titulo>
      <Aviso {...aviso} />
      {lista.length === 0 && <p className="text-muted-foreground text-sm">Nada para revisar.</p>}
      {lista.map((a) => (
        <Card key={a.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <SinalIcone nivel={a.nivelSinal as 1 | 2 | 3 | 4 | 5} className="h-5" />
              {a.atendimento.colaborador.nome}
            </CardTitle>
            <CardDescription>
              {TIPOS_ATENDIMENTO[a.atendimento.tipo]} para {a.atendimento.clienteFinal.nome} · concluído{" "}
              {formatarDataHora(a.atendimento.concluidoEm)} · respondido {formatarDataHora(a.respondidaEm)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-destructive">{a.motivoSuspeita}</p>
            {a.comentario && <blockquote className="border-l-2 pl-3 italic">{a.comentario}</blockquote>}
            <p className="text-muted-foreground text-xs">
              IP {a.ipResposta ?? "desconhecido"} · {a.userAgentResposta ?? "navegador desconhecido"}
            </p>
            <div className="flex gap-2">
              <form action={revisarSuspeitaAction.bind(null, a.id, true)}>
                <Button type="submit">Aceitar e pontuar</Button>
              </form>
              <form action={revisarSuspeitaAction.bind(null, a.id, false)}>
                <Button type="submit" variant="outline">
                  Descartar
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
