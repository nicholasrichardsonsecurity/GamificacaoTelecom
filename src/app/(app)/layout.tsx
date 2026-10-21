import type { Role } from "@prisma/client";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/marca";
import { Navegacao, type ItemNav } from "@/components/navegacao";
import { NOMES_PAPEL } from "@/lib/colaboradores";
import { exigirSessao } from "@/lib/sessao";
import { brandingDo } from "@/lib/tenant";

const GESTAO: ItemNav[] = [
  { href: "/gestor/casos", rotulo: "Casos" },
  { href: "/gestor/contestacoes", rotulo: "Contestações" },
  { href: "/gestor/suspeitas", rotulo: "Suspeitas" },
  { href: "/gestor/ranking", rotulo: "Ranking" },
  { href: "/gestor/satisfacao", rotulo: "Satisfação" },
];

const MENU: Record<Role, ItemNav[]> = {
  SUPER_ADMIN: [{ href: "/superadmin", rotulo: "Provedores" }],
  ADMIN_PROVEDOR: [
    { href: "/admin", rotulo: "Início" },
    { href: "/admin/usuarios", rotulo: "Usuários" },
    { href: "/admin/equipes", rotulo: "Equipes" },
    { href: "/admin/atendimentos", rotulo: "Atendimentos" },
    { href: "/admin/pontuacao", rotulo: "Pontuação" },
    { href: "/admin/marca", rotulo: "Marca" },
    ...GESTAO,
  ],
  GESTOR: [{ href: "/gestor", rotulo: "Início" }, ...GESTAO, { href: "/colaborador", rotulo: "Meus pontos" }],
  COLABORADOR: [
    { href: "/colaborador", rotulo: "Meus pontos" },
    { href: "/colaborador/ranking", rotulo: "Ranking" },
  ],
};

export default async function LayoutAreaLogada({ children }: { children: React.ReactNode }) {
  const { usuario, contexto } = await exigirSessao();
  const branding = brandingDo(contexto);

  async function sair() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-marca-secundaria text-marca-secundaria-texto flex items-center justify-between gap-4 px-6 py-3">
        <Marca branding={branding} />
        <div className="flex items-center gap-4 text-sm">
          <span>
            {usuario.name} · <span className="opacity-75">{NOMES_PAPEL[usuario.role]}</span>
          </span>
          <form action={sair}>
            <Button type="submit" variant="secondary" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <Navegacao itens={MENU[usuario.role]} />
      <main className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-6 p-6">{children}</main>
    </div>
  );
}
