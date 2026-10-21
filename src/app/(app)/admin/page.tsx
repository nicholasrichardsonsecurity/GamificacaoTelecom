import type { Metadata } from "next";
import Link from "next/link";
import { Titulo } from "@/components/titulo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { limitesDoPlano } from "@/lib/colaboradores";
import { inicioDoPeriodo } from "@/lib/periodo";
import { relatorioCsat } from "@/lib/relatorios";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { formatarMedia, formatarPercentual } from "@/lib/formato";

export const metadata: Metadata = { title: "Administração" };

export default async function PaginaAdmin() {
  const { tenant, db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  const [limites, semSenha, csat, casosAbertos] = await Promise.all([
    limitesDoPlano(db, tenant.id),
    db.usuario.count({ where: { ativo: true, senhaHash: null } }),
    relatorioCsat(db, { desde: inicioDoPeriodo("mes") }),
    db.casoRecuperacao.count({ where: { status: { not: "RESOLVIDO" } } }),
  ]);

  const cartoes = [
    {
      titulo: "Usuários ativos",
      valor: `${limites.usuarios}${limites.limiteColaboradores ? ` de ${limites.limiteColaboradores}` : ""}`,
      detalhe: semSenha ? `${semSenha} ainda sem senha` : "Todos já acessaram",
      href: "/admin/usuarios",
    },
    {
      titulo: "Equipes",
      valor: `${limites.equipes}${limites.limiteFiliais ? ` de ${limites.limiteFiliais}` : ""}`,
      detalhe: "Filiais ou times",
      href: "/admin/equipes",
    },
    {
      titulo: "Sinal médio no mês",
      valor: formatarMedia(csat.geral.mediaSinal),
      detalhe: `Taxa de resposta: ${formatarPercentual(csat.geral.taxaResposta)}`,
      href: "/gestor/satisfacao",
    },
    {
      titulo: "Casos de recuperação",
      valor: String(casosAbertos),
      detalhe: "Abertos ou em andamento",
      href: "/gestor/casos",
    },
  ];

  return (
    <>
      <Titulo descricao="Visão geral do provedor.">{tenant.nomeExibicao}</Titulo>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cartoes.map((c) => (
          <Link key={c.titulo} href={c.href} className="rounded-xl focus-visible:outline-2">
            <Card className="hover:border-primary h-full gap-2">
              <CardHeader>
                <CardDescription>{c.titulo}</CardDescription>
                <CardTitle className="text-3xl">{c.valor}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-xs">{c.detalhe}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Primeiros passos</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              Ajuste <Link className="underline" href="/admin/marca">logo e cores</Link>.
            </li>
            <li>
              Cadastre as <Link className="underline" href="/admin/equipes">equipes</Link> e os{" "}
              <Link className="underline" href="/admin/usuarios">usuários</Link> (ou importe uma planilha).
            </li>
            <li>
              Revise as <Link className="underline" href="/admin/pontuacao">regras de pontuação</Link>.
            </li>
            <li>
              Registre um <Link className="underline" href="/admin/atendimentos">atendimento</Link> e envie o
              link da pesquisa ao cliente.
            </li>
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
