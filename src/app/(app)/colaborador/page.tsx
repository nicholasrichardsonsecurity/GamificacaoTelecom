import type { Metadata } from "next";
import { Aviso } from "@/components/aviso";
import { SinalIcone } from "@/components/sinal";
import { Titulo } from "@/components/titulo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ParamsAviso } from "@/lib/acoes";
import { TIPOS_ATENDIMENTO } from "@/lib/atendimentos";
import { formatarData, formatarDataHora, formatarPontos } from "@/lib/formato";
import { NOTA_MAXIMA_CONTESTAVEL } from "@/lib/pontuacao";
import { nivelPorPontos, saldoDoColaborador } from "@/lib/saldo";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { contestar } from "./actions";

export const metadata: Metadata = { title: "Meus pontos" };

const TIPOS_TRANSACAO = {
  CREDITO_AVALIACAO: "Avaliação",
  DEBITO_AVALIACAO: "Avaliação",
  RESGATE: "Resgate de prêmio",
  AJUSTE_MANUAL: "Ajuste",
} as const;

const CONTESTACAO = { ABERTA: "Contestação em análise", ACEITA: "Contestação aceita", RECUSADA: "Contestação recusada" } as const;

export default async function PaginaColaborador({ searchParams }: { searchParams: ParamsAviso }) {
  const { usuario, db } = await exigirSessaoDeTenant();
  const agora = new Date();
  const [saldo, niveis, selos, conquistas, transacoes, avaliacoes, aviso] = await Promise.all([
    saldoDoColaborador(db, usuario.id, agora),
    db.nivel.findMany({ orderBy: { pontosAcumuladosMinimo: "asc" } }),
    db.selo.findMany({ orderBy: { nome: "asc" } }),
    db.seloConquistado.findMany({ where: { colaboradorId: usuario.id } }),
    db.transacaoPontos.findMany({
      where: { colaboradorId: usuario.id },
      orderBy: { criadoEm: "desc" },
      take: 30,
    }),
    db.avaliacao.findMany({
      where: { atendimento: { colaboradorId: usuario.id } },
      orderBy: { respondidaEm: "desc" },
      take: 20,
      include: {
        contestacao: { select: { status: true, decisao: true } },
        transacao: { select: { pontos: true } },
        atendimento: { select: { tipo: true } },
      },
    }),
    searchParams,
  ]);
  const nivel = nivelPorPontos(niveis, saldo.acumulado);
  const conquistados = new Map(conquistas.map((c) => [c.seloId, c.conquistadoEm]));

  return (
    <>
      <Titulo descricao="Cada atendimento bem avaliado vira pontos para trocar por prêmios.">
        Olá, {usuario.name?.split(" ")[0]}!
      </Titulo>
      <Aviso {...aviso} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-2">
          <CardHeader>
            <CardDescription>Saldo disponível</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{saldo.disponivel.toLocaleString("pt-BR")}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">Já pode ser trocado por prêmios.</CardContent>
        </Card>
        <Card className="gap-2">
          <CardHeader>
            <CardDescription>Pendente</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{saldo.pendente.toLocaleString("pt-BR")}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">Libera alguns dias após a avaliação.</CardContent>
        </Card>
        <Card className="gap-2">
          <CardHeader>
            <CardDescription>Nível</CardDescription>
            <CardTitle className="text-2xl" style={{ color: nivel.atual?.cor ?? undefined }}>
              {nivel.atual?.nome ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-xs">
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div className="bg-primary h-full" style={{ width: `${Math.round(nivel.progresso * 100)}%` }} />
            </div>
            <span className="text-muted-foreground">
              {nivel.proximo ? `Faltam ${nivel.faltam} pontos para ${nivel.proximo.nome}` : "Nível máximo!"}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {selos.map((s) => {
            const em = conquistados.get(s.id);
            return (
              <div key={s.id} className={`rounded-lg border p-3 ${em ? "border-primary bg-primary/5" : "opacity-60"}`}>
                <p className="font-medium">
                  {em ? "🏅 " : "🔒 "}
                  {s.nome}
                </p>
                <p className="text-muted-foreground text-xs">
                  {em ? `Conquistado em ${formatarData(em)}` : s.descricao}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Minhas avaliações</CardTitle>
          <CardDescription>
            Achou uma nota de até {NOTA_MAXIMA_CONTESTAVEL} barras injusta? Conteste e seu gestor analisa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {avaliacoes.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma avaliação ainda.</p>}
          {avaliacoes.map((a) => (
            <div key={a.id} className="grid gap-2 border-b pb-3 text-sm last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-3">
                <SinalIcone nivel={a.nivelSinal as 1 | 2 | 3 | 4 | 5} className="h-5" />
                <span>{TIPOS_ATENDIMENTO[a.atendimento.tipo]}</span>
                <span className="text-muted-foreground">{formatarDataHora(a.respondidaEm)}</span>
                {a.transacao && <span className="tabular-nums">{formatarPontos(a.transacao.pontos)} pts</span>}
                {a.suspeita && a.revisadaEm === null && <Badge variant="outline">Em revisão</Badge>}
                {a.suspeitaAceita === false && <Badge variant="outline">Descartada</Badge>}
                {a.contestacao && <Badge variant="secondary">{CONTESTACAO[a.contestacao.status]}</Badge>}
              </div>
              {a.comentario && <p className="text-muted-foreground italic">“{a.comentario}”</p>}
              {a.contestacao?.decisao && a.contestacao.status !== "ABERTA" && (
                <p className="text-muted-foreground text-xs">Resposta do gestor: {a.contestacao.decisao}</p>
              )}
              {!a.contestacao && a.nivelSinal <= NOTA_MAXIMA_CONTESTAVEL && (!a.suspeita || a.suspeitaAceita) && (
                <details>
                  <summary className="cursor-pointer text-xs underline">Contestar esta avaliação</summary>
                  <form action={contestar.bind(null, a.id)} className="mt-2 grid gap-2">
                    <Textarea
                      name="justificativa"
                      required
                      minLength={10}
                      maxLength={2000}
                      rows={2}
                      placeholder="Conte o que aconteceu no atendimento"
                      aria-label="Justificativa"
                    />
                    <div>
                      <Button type="submit" size="sm" variant="outline">
                        Enviar contestação
                      </Button>
                    </div>
                  </form>
                </details>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Extrato</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full text-sm">
            <tbody>
              {transacoes.length === 0 && (
                <tr>
                  <td className="text-muted-foreground px-6 py-4">Nenhuma movimentação ainda.</td>
                </tr>
              )}
              {transacoes.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-6 py-3 whitespace-nowrap">{formatarData(t.criadoEm)}</td>
                  <td className="px-2 py-3">
                    {TIPOS_TRANSACAO[t.tipo]}
                    {t.motivo && <div className="text-muted-foreground text-xs">{t.motivo}</div>}
                    {t.pontos !== t.pontosCalculados && (
                      <div className="text-muted-foreground text-xs">
                        Regra: {formatarPontos(t.pontosCalculados)} (ajustado por teto ou saldo zero)
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3 text-xs">
                    {t.disponivelEm > agora && (
                      <Badge variant="outline">Libera em {formatarData(t.disponivelEm)}</Badge>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right font-medium tabular-nums">{formatarPontos(t.pontos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
