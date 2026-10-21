import type { Metadata } from "next";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { CORES_SINAL } from "@/components/sinal";
import { Titulo } from "@/components/titulo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TIPOS_ATENDIMENTO } from "@/lib/atendimentos";
import { formatarMedia, formatarPercentual } from "@/lib/formato";
import { inicioDoPeriodo, periodoValido } from "@/lib/periodo";
import { relatorioCsat, type GrupoCsat } from "@/lib/relatorios";
import { exigirGestao } from "../escopo";

export const metadata: Metadata = { title: "Satisfação" };

function Distribuicao({ grupo }: { grupo: GrupoCsat }) {
  if (!grupo.respostas) return <div className="bg-muted h-2 rounded-full" />;
  return (
    <div className="flex h-2 overflow-hidden rounded-full" role="img" aria-label={`Distribuição: ${grupo.distribuicao.join(", ")} respostas de 1 a 5 barras`}>
      {grupo.distribuicao.map((q, i) => (
        <div key={i} style={{ width: `${(q / grupo.respostas) * 100}%`, background: CORES_SINAL[i] }} />
      ))}
    </div>
  );
}

function Tabela({ titulo, grupos }: { titulo: string; grupos: (GrupoCsat & { nome: string })[] }) {
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-y text-left">
            <tr>
              <th className="px-4 py-3 font-medium"></th>
              <th className="px-4 py-3 text-right font-medium">Pesquisas</th>
              <th className="px-4 py-3 text-right font-medium">Respostas</th>
              <th className="px-4 py-3 text-right font-medium">Taxa</th>
              <th className="px-4 py-3 text-right font-medium">Sinal médio</th>
              <th className="w-40 px-4 py-3 font-medium">Distribuição</th>
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted-foreground px-4 py-6 text-center">
                  Sem pesquisas no período.
                </td>
              </tr>
            )}
            {grupos.map((g) => (
              <tr key={g.chave} className="border-b last:border-0">
                <td className="px-4 py-3">{g.nome}</td>
                <td className="px-4 py-3 text-right tabular-nums">{g.convites}</td>
                <td className="px-4 py-3 text-right tabular-nums">{g.respostas}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatarPercentual(g.taxaResposta)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatarMedia(g.mediaSinal)}</td>
                <td className="px-4 py-3">
                  <Distribuicao grupo={g} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default async function PaginaSatisfacao({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { db, colaboradores } = await exigirGestao();
  const periodo = periodoValido((await searchParams).periodo);
  const r = await relatorioCsat(db, { desde: inicioDoPeriodo(periodo), colaboradores });

  const resumo = [
    { titulo: "Sinal médio", valor: formatarMedia(r.geral.mediaSinal), detalhe: "de 1 a 5 barras" },
    { titulo: "Taxa de resposta", valor: formatarPercentual(r.geral.taxaResposta), detalhe: `${r.geral.respostas} de ${r.geral.convites} pesquisas` },
    {
      titulo: "Sinal forte (4 ou 5)",
      valor: formatarPercentual(r.geral.respostas ? (r.geral.distribuicao[3] + r.geral.distribuicao[4]) / r.geral.respostas : null),
      detalhe: "das respostas",
    },
  ];

  return (
    <>
      <Titulo
        descricao="Pelas pesquisas enviadas no período. Avaliações suspeitas só contam depois de aceitas."
        acoes={<FiltroPeriodo periodo={periodo} />}
      >
        Satisfação dos clientes
      </Titulo>
      <div className="grid gap-4 sm:grid-cols-3">
        {resumo.map((c) => (
          <Card key={c.titulo} className="gap-2">
            <CardHeader>
              <CardDescription>{c.titulo}</CardDescription>
              <CardTitle className="text-3xl">{c.valor}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">{c.detalhe}</CardContent>
          </Card>
        ))}
      </div>
      <Tabela titulo="Por tipo de atendimento" grupos={r.porTipo.map((g) => ({ ...g, nome: TIPOS_ATENDIMENTO[g.tipo] }))} />
      <Tabela titulo="Por equipe" grupos={r.porEquipe.map((g) => ({ ...g, nome: g.chave }))} />
    </>
  );
}
