import type { Metadata } from "next";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { TabelaRanking } from "@/components/tabela-ranking";
import { Titulo } from "@/components/titulo";
import { inicioDoPeriodo, periodoValido } from "@/lib/periodo";
import { ranking } from "@/lib/relatorios";
import { exigirGestao } from "../escopo";

export const metadata: Metadata = { title: "Ranking" };

export default async function PaginaRankingGestor({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; equipe?: string }>;
}) {
  const { db, colaboradores, usuario } = await exigirGestao();
  const filtros = await searchParams;
  const periodo = periodoValido(filtros.periodo);
  const equipes = await db.equipe.findMany({
    where: usuario.role === "GESTOR" ? { gestorId: usuario.id } : {},
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
  const equipeId = equipes.some((e) => e.id === filtros.equipe) ? filtros.equipe : undefined;
  const linhas = await ranking(db, { desde: inicioDoPeriodo(periodo), equipeId, colaboradores });

  return (
    <>
      <Titulo
        descricao="Pontos de avaliações e ajustes no período; resgates não descontam."
        acoes={<FiltroPeriodo periodo={periodo} equipes={equipes} equipeId={equipeId} />}
      >
        Ranking
      </Titulo>
      <TabelaRanking linhas={linhas} />
    </>
  );
}
