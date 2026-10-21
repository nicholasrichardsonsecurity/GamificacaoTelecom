import type { Metadata } from "next";
import { Aviso } from "@/components/aviso";
import { Campo } from "@/components/campo";
import { Titulo } from "@/components/titulo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ParamsAviso } from "@/lib/acoes";
import { COR_PRIMARIA_PADRAO, COR_SECUNDARIA_PADRAO } from "@/lib/branding";
import { prisma } from "@/lib/db";
import { dominioPlataforma } from "@/lib/host";
import { exigirSessao } from "@/lib/sessao";
import { criarProvedor } from "../actions";

export const metadata: Metadata = { title: "Novo provedor" };

export default async function PaginaNovoProvedor({ searchParams }: { searchParams: ParamsAviso }) {
  await exigirSessao(["SUPER_ADMIN"]);
  const [planos, aviso] = await Promise.all([prisma.plano.findMany({ orderBy: { nome: "asc" } }), searchParams]);

  return (
    <>
      <Titulo descricao="O provedor nasce com o template padrão de regras, níveis, selos e configuração do motor.">
        Novo provedor
      </Titulo>
      <Aviso {...aviso} />
      <form action={criarProvedor} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Empresa e marca</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo id="nome" rotulo="Razão social">
              <Input id="nome" name="nome" required />
            </Campo>
            <Campo id="nomeExibicao" rotulo="Nome de exibição" dica="O que os colaboradores e clientes veem.">
              <Input id="nomeExibicao" name="nomeExibicao" required />
            </Campo>
            <Campo id="slug" rotulo="Endereço" dica={`Vira {endereço}.${dominioPlataforma()}`}>
              <Input id="slug" name="slug" required pattern="[a-z0-9][a-z0-9\-]*[a-z0-9]" maxLength={40} />
            </Campo>
            <Campo id="planoId" rotulo="Plano">
              <Select id="planoId" name="planoId" required>
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="corPrimaria" rotulo="Cor primária">
              <Input id="corPrimaria" name="corPrimaria" type="color" defaultValue={COR_PRIMARIA_PADRAO} />
            </Campo>
            <Campo id="corSecundaria" rotulo="Cor secundária">
              <Input id="corSecundaria" name="corSecundaria" type="color" defaultValue={COR_SECUNDARIA_PADRAO} />
            </Campo>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Primeiro administrador</CardTitle>
            <CardDescription>Ele define a própria senha pelo link de primeiro acesso.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo id="adminNome" rotulo="Nome">
              <Input id="adminNome" name="adminNome" required />
            </Campo>
            <Campo id="adminEmail" rotulo="E-mail">
              <Input id="adminEmail" name="adminEmail" type="email" required />
            </Campo>
          </CardContent>
        </Card>
        <div>
          <Button type="submit">Criar provedor</Button>
        </div>
      </form>
    </>
  );
}
