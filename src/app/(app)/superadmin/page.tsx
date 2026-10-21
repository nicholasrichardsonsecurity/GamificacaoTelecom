import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/aviso";
import { Titulo } from "@/components/titulo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ParamsAviso } from "@/lib/acoes";
import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/sessao";
import { urlDoTenant } from "@/lib/tenants";

export const metadata: Metadata = { title: "Provedores" };

export default async function PaginaSuperAdmin({ searchParams }: { searchParams: ParamsAviso }) {
  await exigirSessao(["SUPER_ADMIN"]);
  const [tenants, aviso] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { criadoEm: "desc" },
      include: { plano: { select: { nome: true } }, _count: { select: { usuarios: { where: { ativo: true } } } } },
    }),
    searchParams,
  ]);

  return (
    <>
      <Titulo
        descricao={`${tenants.length} provedores cadastrados.`}
        acoes={
          <Button asChild>
            <Link href="/superadmin/novo">Novo provedor</Link>
          </Button>
        }
      >
        Provedores
      </Titulo>
      <Aviso {...aviso} />
      <Card className="py-0">
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Provedor</th>
                <th className="px-4 py-3 font-medium">Endereço</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Usuários ativos</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/superadmin/${t.id}`} className="font-medium hover:underline">
                      {t.nomeExibicao}
                    </Link>
                    <div className="text-muted-foreground text-xs">{t.nome}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{urlDoTenant(t)}</td>
                  <td className="px-4 py-3">{t.plano.nome}</td>
                  <td className="px-4 py-3">{t._count.usuarios}</td>
                  <td className="px-4 py-3">
                    <Badge variant={t.status === "ATIVO" ? "secondary" : "destructive"}>
                      {t.status === "ATIVO" ? "Ativo" : "Suspenso"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
