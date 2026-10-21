import type { Metadata } from "next";
import { Aviso } from "@/components/aviso";
import { SinalIcone } from "@/components/sinal";
import { Titulo } from "@/components/titulo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ParamsAviso } from "@/lib/acoes";
import { TIPOS_ATENDIMENTO } from "@/lib/atendimentos";
import { formatarDataHora } from "@/lib/formato";
import { atualizarCaso } from "../actions";
import { exigirGestao } from "../escopo";

export const metadata: Metadata = { title: "Casos de recuperação" };

const STATUS = { ABERTO: "Aberto", EM_ANDAMENTO: "Em andamento", RESOLVIDO: "Resolvido" } as const;

export default async function PaginaCasos({ searchParams }: { searchParams: ParamsAviso }) {
  const { db, casos } = await exigirGestao();
  const agora = new Date();
  const [lista, aviso] = await Promise.all([
    db.casoRecuperacao.findMany({
      where: { AND: [casos, { OR: [{ status: { not: "RESOLVIDO" } }, { resolvidoEm: { gte: new Date(agora.getTime() - 30 * 86400_000) } }] }] },
      orderBy: [{ status: "asc" }, { prazoContato: "asc" }],
      take: 100,
      include: {
        gestorResponsavel: { select: { nome: true } },
        avaliacao: {
          select: {
            nivelSinal: true,
            comentario: true,
            respondidaEm: true,
            atendimento: {
              select: {
                tipo: true,
                colaborador: { select: { nome: true } },
                clienteFinal: { select: { nome: true, telefone: true, email: true } },
              },
            },
          },
        },
      },
    }),
    searchParams,
  ]);

  return (
    <>
      <Titulo descricao="Clientes que deram nota baixa. Entre em contato dentro do prazo para recuperar a relação.">
        Casos de recuperação
      </Titulo>
      <Aviso {...aviso} />
      {lista.length === 0 && <p className="text-muted-foreground text-sm">Nenhum caso aberto. Bom sinal!</p>}
      {lista.map((c) => {
        const a = c.avaliacao;
        const atrasado = c.status !== "RESOLVIDO" && c.prazoContato < agora;
        return (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-3">
                <SinalIcone nivel={a.nivelSinal as 1 | 2 | 3 | 4 | 5} className="h-5" />
                {a.atendimento.clienteFinal.nome}
                <Badge variant={c.status === "RESOLVIDO" ? "secondary" : "outline"}>{STATUS[c.status]}</Badge>
                {atrasado && <Badge variant="destructive">Prazo vencido</Badge>}
              </CardTitle>
              <CardDescription>
                {TIPOS_ATENDIMENTO[a.atendimento.tipo]} com {a.atendimento.colaborador.nome} · respondida{" "}
                {formatarDataHora(a.respondidaEm)} · contatar até {formatarDataHora(c.prazoContato)}
                {c.gestorResponsavel && ` · responsável: ${c.gestorResponsavel.nome}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              {a.comentario && <blockquote className="border-l-2 pl-3 italic">{a.comentario}</blockquote>}
              <p className="text-muted-foreground">
                Contato: {a.atendimento.clienteFinal.telefone ?? "sem telefone"} ·{" "}
                {a.atendimento.clienteFinal.email ?? "sem e-mail"}
              </p>
              <form action={atualizarCaso.bind(null, c.id)} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-start">
                <Textarea name="acaoTomada" defaultValue={c.acaoTomada ?? ""} placeholder="O que foi feito?" aria-label="Ação tomada" rows={2} />
                <Select name="status" defaultValue={c.status} aria-label="Status" className="w-auto">
                  {Object.entries(STATUS).map(([v, n]) => (
                    <option key={v} value={v}>
                      {n}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="outline">
                  Salvar
                </Button>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
