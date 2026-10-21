import type { Metadata } from "next";
import { EmConstrucao } from "@/components/em-construcao";
import { exigirSessaoDeTenant } from "@/lib/sessao";

export const metadata: Metadata = { title: "Administração" };

export default async function PaginaAdmin() {
  const { tenant, db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  const [colaboradores, equipes] = await Promise.all([
    db.usuario.count({ where: { ativo: true } }),
    db.equipe.count(),
  ]);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{tenant.nomeExibicao}</h1>
      <p className="text-muted-foreground text-sm">
        {colaboradores} usuários ativos em {equipes} equipes.
      </p>
      <EmConstrucao
        titulo="Administração do provedor"
        itens={[
          "Branding: logo, cores e nome de exibição",
          "Usuários e equipes",
          "Regras de pontuação",
          "Atendimentos manuais",
        ]}
      />
    </div>
  );
}
