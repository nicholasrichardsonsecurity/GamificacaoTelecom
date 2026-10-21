import type { Metadata } from "next";
import { Aviso } from "@/components/aviso";
import { SinalIcone } from "@/components/sinal";
import { Titulo } from "@/components/titulo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ParamsAviso } from "@/lib/acoes";
import { TIPOS_ATENDIMENTO } from "@/lib/atendimentos";
import { formatarDataHora, formatarPontos } from "@/lib/formato";
import { decidirContestacaoAction } from "../actions";
import { exigirGestao } from "../escopo";

export const metadata: Metadata = { title: "Contestações" };

export default async function PaginaContestacoes({ searchParams }: { searchParams: ParamsAviso }) {
  const { db, colaboradores } = await exigirGestao();
  const [lista, aviso] = await Promise.all([
    db.contestacaoAvaliacao.findMany({
      where: { status: "ABERTA", colaborador: colaboradores },
      orderBy: { criadaEm: "asc" },
      include: {
        colaborador: { select: { nome: true } },
        avaliacao: {
          select: {
            nivelSinal: true,
            comentario: true,
            respondidaEm: true,
            transacao: { select: { pontos: true } },
            atendimento: { select: { tipo: true, clienteFinal: { select: { nome: true } } } },
          },
        },
      },
    }),
    searchParams,
  ]);

  return (
    <>
      <Titulo descricao="Se aceitar, os pontos que a avaliação tirou voltam para o colaborador.">Contestações</Titulo>
      <Aviso {...aviso} />
      {lista.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma contestação aguardando decisão.</p>}
      {lista.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <SinalIcone nivel={c.avaliacao.nivelSinal as 1 | 2 | 3 | 4 | 5} className="h-5" />
              {c.colaborador.nome}
            </CardTitle>
            <CardDescription>
              {TIPOS_ATENDIMENTO[c.avaliacao.atendimento.tipo]} para {c.avaliacao.atendimento.clienteFinal.nome} ·{" "}
              {formatarDataHora(c.avaliacao.respondidaEm)}
              {c.avaliacao.transacao && ` · ${formatarPontos(c.avaliacao.transacao.pontos)} pontos`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {c.avaliacao.comentario && (
              <p>
                <span className="text-muted-foreground">Cliente:</span> “{c.avaliacao.comentario}”
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Colaborador:</span> “{c.justificativa}”
            </p>
            <form action={decidirContestacaoAction.bind(null, c.id)} className="grid gap-2">
              <Textarea name="justificativa" required minLength={5} placeholder="Explique a decisão ao colaborador" aria-label="Justificativa" rows={2} />
              <div className="flex gap-2">
                <Button type="submit" name="decisao" value="aceitar">
                  Aceitar e devolver pontos
                </Button>
                <Button type="submit" name="decisao" value="recusar" variant="outline">
                  Recusar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
