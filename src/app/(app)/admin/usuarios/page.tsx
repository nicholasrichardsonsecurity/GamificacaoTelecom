import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/aviso";
import { Titulo } from "@/components/titulo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParamsAviso } from "@/lib/acoes";
import { limitesDoPlano, NOMES_PAPEL } from "@/lib/colaboradores";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { salvarUsuarioAction } from "../actions";
import { FormUsuario } from "./form-usuario";

export const metadata: Metadata = { title: "Usuários" };

const ORIGEM = { MANUAL: "Manual", IXC: "IXC", SGP: "SGP" } as const;

export default async function PaginaUsuarios({ searchParams }: { searchParams: ParamsAviso }) {
  const { tenant, db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  const [usuarios, equipes, limites, aviso] = await Promise.all([
    db.usuario.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: { equipe: { select: { nome: true } } },
    }),
    db.equipe.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    limitesDoPlano(db, tenant.id),
    searchParams,
  ]);

  return (
    <>
      <Titulo
        descricao={`${limites.usuarios} ativos${limites.limiteColaboradores ? ` de ${limites.limiteColaboradores} do plano` : ""}.`}
        acoes={
          <Button asChild variant="outline">
            <Link href="/admin/usuarios/importar">Importar planilha</Link>
          </Button>
        }
      >
        Usuários
      </Titulo>
      <Aviso {...aviso} />
      <Card>
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <FormUsuario acao={salvarUsuarioAction.bind(null, null)} equipes={equipes} />
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Equipe</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Acesso</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={`border-b last:border-0 ${u.ativo ? "" : "opacity-50"}`}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/usuarios/${u.id}`} className="font-medium hover:underline">
                      {u.nome}
                    </Link>
                    <div className="text-muted-foreground text-xs">{u.email ?? "sem e-mail"}</div>
                  </td>
                  <td className="px-4 py-3">{NOMES_PAPEL[u.role]}</td>
                  <td className="px-4 py-3">{u.equipe?.nome ?? "—"}</td>
                  <td className="px-4 py-3">{ORIGEM[u.origemCadastro]}</td>
                  <td className="px-4 py-3">
                    {!u.ativo ? (
                      <Badge variant="outline">Inativo</Badge>
                    ) : u.senhaHash ? (
                      <Badge variant="secondary">Com senha</Badge>
                    ) : (
                      <Badge variant="outline">Sem senha</Badge>
                    )}
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
