import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/aviso";
import { Campo } from "@/components/campo";
import { GerarLink } from "@/components/gerar-link";
import { Titulo } from "@/components/titulo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ParamsAviso } from "@/lib/acoes";
import { prisma } from "@/lib/db";
import { exigirSessao } from "@/lib/sessao";
import { urlDoTenant } from "@/lib/tenants";
import { editarProvedor, linkDoAdmin } from "../actions";

export const metadata: Metadata = { title: "Provedor" };

export default async function PaginaProvedor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ParamsAviso;
}) {
  await exigirSessao(["SUPER_ADMIN"]);
  const { id } = await params;
  const [tenant, planos, aviso] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id },
      include: {
        usuarios: {
          where: { role: "ADMIN_PROVEDOR", ativo: true },
          select: { id: true, nome: true, email: true, senhaHash: true },
          orderBy: { nome: "asc" },
        },
      },
    }),
    prisma.plano.findMany({ orderBy: { nome: "asc" } }),
    searchParams,
  ]);
  if (!tenant) notFound();

  return (
    <>
      <Titulo descricao={urlDoTenant(tenant)}>{tenant.nomeExibicao}</Titulo>
      <Aviso {...aviso} />
      <Card>
        <CardHeader>
          <CardTitle>Administradores</CardTitle>
          <CardDescription>
            O link vale por 7 dias e só pode ser usado uma vez. Envie direto para a pessoa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {tenant.usuarios.map((u) => (
            <div key={u.id} className="grid gap-2">
              <p className="text-sm">
                <span className="font-medium">{u.nome}</span> · {u.email}{" "}
                <span className="text-muted-foreground">
                  ({u.senhaHash ? "já tem senha" : "ainda não acessou"})
                </span>
              </p>
              <GerarLink
                acao={linkDoAdmin.bind(null, tenant.id, u.id)}
                rotulo={u.senhaHash ? "Gerar link para redefinir a senha" : "Gerar link de primeiro acesso"}
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <form action={editarProvedor.bind(null, tenant.id)}>
        <Card>
          <CardHeader>
            <CardTitle>Dados do provedor</CardTitle>
            <CardDescription>Logo e cores ficam com o próprio admin do provedor.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo id="nome" rotulo="Razão social">
              <Input id="nome" name="nome" defaultValue={tenant.nome} required />
            </Campo>
            <Campo id="nomeExibicao" rotulo="Nome de exibição">
              <Input id="nomeExibicao" name="nomeExibicao" defaultValue={tenant.nomeExibicao} required />
            </Campo>
            <Campo id="planoId" rotulo="Plano">
              <Select id="planoId" name="planoId" defaultValue={tenant.planoId}>
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="status" rotulo="Status" dica="Suspenso: ninguém do provedor consegue entrar.">
              <Select id="status" name="status" defaultValue={tenant.status}>
                <option value="ATIVO">Ativo</option>
                <option value="SUSPENSO">Suspenso</option>
              </Select>
            </Campo>
            <Campo
              id="dominioCustomizado"
              rotulo="Domínio próprio"
              dica="Opcional, ex.: pontos.provedor.com.br. O DNS precisa apontar para o servidor."
            >
              <Input id="dominioCustomizado" name="dominioCustomizado" defaultValue={tenant.dominioCustomizado ?? ""} />
            </Campo>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="dominioVerificado" defaultChecked={tenant.dominioVerificado} />
              Domínio verificado (DNS e HTTPS prontos)
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Salvar</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </>
  );
}
