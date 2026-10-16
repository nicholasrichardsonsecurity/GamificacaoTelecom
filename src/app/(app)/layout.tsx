import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/marca";
import { exigirSessao } from "@/lib/sessao";
import { brandingDo } from "@/lib/tenant";

const NOMES_PAPEL = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_PROVEDOR: "Admin do provedor",
  GESTOR: "Gestor",
  COLABORADOR: "Colaborador",
} as const;

export default async function LayoutAreaLogada({ children }: { children: React.ReactNode }) {
  const { usuario, contexto } = await exigirSessao();
  const branding = brandingDo(contexto);

  async function sair() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-marca-secundaria text-marca-secundaria-texto flex items-center justify-between px-6 py-3">
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
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">{children}</main>
    </div>
  );
}
