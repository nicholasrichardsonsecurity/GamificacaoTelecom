import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/aviso";
import { GerarLink } from "@/components/gerar-link";
import { Titulo } from "@/components/titulo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParamsAviso } from "@/lib/acoes";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { linkDeAcesso, salvarUsuarioAction } from "../../actions";
import { FormUsuario } from "../form-usuario";

export const metadata: Metadata = { title: "Usuário" };

export default async function PaginaUsuario({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ParamsAviso;
}) {
  const { db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  const { id } = await params;
  const [usuario, equipes, aviso] = await Promise.all([
    db.usuario.findFirst({ where: { id } }),
    db.equipe.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    searchParams,
  ]);
  if (!usuario) notFound();

  return (
    <>
      <Titulo descricao={usuario.idExternoERP ? `Id no ERP: ${usuario.idExternoERP}` : undefined}>
        {usuario.nome}
      </Titulo>
      <Aviso {...aviso} />
      {usuario.ativo && (
        <Card>
          <CardHeader>
            <CardTitle>Acesso</CardTitle>
            <CardDescription>
              {usuario.senhaHash
                ? "Já tem senha. Gere um link se a pessoa esqueceu a senha."
                : "Ainda não tem senha. Envie o link de primeiro acesso para a pessoa definir a dela."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GerarLink
              acao={linkDeAcesso.bind(null, usuario.id)}
              rotulo={usuario.senhaHash ? "Gerar link de nova senha" : "Gerar link de primeiro acesso"}
              aviso="Vale por 7 dias e só funciona uma vez. Gerar outro invalida este."
            />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <FormUsuario acao={salvarUsuarioAction.bind(null, usuario.id)} equipes={equipes} usuario={usuario} />
        </CardContent>
      </Card>
    </>
  );
}
