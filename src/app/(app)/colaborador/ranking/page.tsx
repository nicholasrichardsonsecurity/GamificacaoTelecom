import type { Metadata } from "next";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { TabelaRanking } from "@/components/tabela-ranking";
import { Titulo } from "@/components/titulo";
import { inicioDoPeriodo, periodoValido } from "@/lib/periodo";
import { ranking } from "@/lib/relatorios";
import { exigirSessaoDeTenant } from "@/lib/sessao";

export const metadata: Metadata = { title: "Ranking" };

export default async function PaginaRankingColaborador({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; equipe?: string }>;
}) {
  const { usuario, db } = await exigirSessaoDeTenant();
  const filtros = await searchParams;
  const periodo = periodoValido(filtros.periodo);
  const equipes = await db.equipe.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } });
  const equipeId = equipes.some((e) => e.id === filtros.equipe) ? filtros.equipe : undefined;
  const linhas = await ranking(db, { desde: inicioDoPeriodo(periodo), equipeId });

  return (
    <>
      <Titulo
        descricao="Quem mais pontuou com avaliações no período."
        acoes={<FiltroPeriodo periodo={periodo} equipes={equipes} equipeId={equipeId} />}
      >
        Ranking
      </Titulo>
      <TabelaRanking linhas={linhas} destaqueId={usuario.id} />
    </>
  );
}
