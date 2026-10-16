import type { Metadata } from "next";
import { EmConstrucao } from "@/components/em-construcao";
import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/sessao";

export const metadata: Metadata = { title: "Super Admin" };

export default async function PaginaSuperAdmin() {
  await exigirSessao(["SUPER_ADMIN"]);
  const tenants = await prisma.tenant.findMany({
    orderBy: { criadoEm: "asc" },
    select: { id: true, nomeExibicao: true, slug: true, status: true, plano: { select: { nome: true } } },
  });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Provedores</h1>
      <ul className="divide-y rounded-lg border">
        {tenants.map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-medium">{t.nomeExibicao}</span>
            <span className="text-muted-foreground">
              {t.slug} · {t.plano.nome} · {t.status}
            </span>
          </li>
        ))}
        {tenants.length === 0 && (
          <li className="text-muted-foreground px-4 py-3 text-sm">Nenhum provedor cadastrado.</li>
        )}
      </ul>
      <EmConstrucao
        titulo="Gestão de tenants"
        itens={["Cadastro e edição de provedores com campos de marca", "Planos e status"]}
      />
    </div>
  );
}
