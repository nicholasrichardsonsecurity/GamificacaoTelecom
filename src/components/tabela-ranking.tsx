import { Card, CardContent } from "@/components/ui/card";
import { formatarMedia, formatarPontos } from "@/lib/formato";
import type { LinhaRanking } from "@/lib/relatorios";
import { cn } from "@/lib/utils";

export function TabelaRanking({ linhas, destaqueId }: { linhas: LinhaRanking[]; destaqueId?: string }) {
  return (
    <Card className="py-0">
      <CardContent className="overflow-x-auto px-0">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-left">
            <tr>
              <th className="w-12 px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Colaborador</th>
              <th className="px-4 py-3 text-right font-medium">Pontos</th>
              <th className="px-4 py-3 text-right font-medium">Avaliações</th>
              <th className="px-4 py-3 text-right font-medium">Sinal médio</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted-foreground px-4 py-6 text-center">
                  Ninguém pontuou neste período ainda.
                </td>
              </tr>
            )}
            {linhas.map((l, i) => (
              <tr
                key={l.colaboradorId}
                className={cn("border-b last:border-0", l.colaboradorId === destaqueId && "bg-primary/10 font-medium")}
              >
                <td className="px-4 py-3">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                <td className="px-4 py-3">
                  {l.nome}
                  {l.equipe && <div className="text-muted-foreground text-xs font-normal">{l.equipe}</div>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatarPontos(l.pontos)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{l.avaliacoes}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatarMedia(l.mediaSinal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
