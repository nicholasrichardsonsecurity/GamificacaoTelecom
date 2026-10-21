import type { Metadata } from "next";
import Link from "next/link";
import { TabelaRanking } from "@/components/tabela-ranking";
import { Titulo } from "@/components/titulo";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { inicioDoPeriodo } from "@/lib/periodo";
import { ranking } from "@/lib/relatorios";
import { exigirGestao } from "./escopo";

export const metadata: Metadata = { title: "Gestão" };

export default async function PaginaGestor() {
  const { db, casos, avaliacoes, colaboradores } = await exigirGestao();
  const [casosAbertos, contestacoes, suspeitas, top] = await Promise.all([
    db.casoRecuperacao.count({ where: { AND: [casos, { status: { not: "RESOLVIDO" } }] } }),
    db.contestacaoAvaliacao.count({ where: { status: "ABERTA", colaborador: colaboradores } }),
    db.avaliacao.count({ where: { AND: [{ suspeita: true, revisadaEm: null }, avaliacoes] } }),
    ranking(db, { desde: inicioDoPeriodo("mes"), colaboradores }),
  ]);

  const pendencias = [
    { titulo: "Casos de recuperação", valor: casosAbertos, href: "/gestor/casos" },
    { titulo: "Contestações", valor: contestacoes, href: "/gestor/contestacoes" },
    { titulo: "Avaliações suspeitas", valor: suspeitas, href: "/gestor/suspeitas" },
  ];

  return (
    <>
      <Titulo descricao="O que precisa da sua atenção.">Gestão</Titulo>
      <div className="grid gap-4 sm:grid-cols-3">
        {pendencias.map((p) => (
          <Link key={p.href} href={p.href} className="rounded-xl focus-visible:outline-2">
            <Card className="hover:border-primary h-full">
              <CardHeader>
                <CardDescription>{p.titulo}</CardDescription>
                <CardTitle className="text-3xl">{p.valor}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <h2 className="text-lg font-semibold">Top 5 do mês</h2>
      <TabelaRanking linhas={top.slice(0, 5)} />
    </>
  );
}
