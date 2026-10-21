import type { Metadata } from "next";
import { Aviso } from "@/components/aviso";
import { Campo } from "@/components/campo";
import { Marca } from "@/components/marca";
import { Titulo } from "@/components/titulo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ParamsAviso } from "@/lib/acoes";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { brandingDo } from "@/lib/tenant";
import { salvarMarca } from "../actions";

export const metadata: Metadata = { title: "Marca" };

const TIPOS = "image/png,image/jpeg,image/webp";

export default async function PaginaMarca({ searchParams }: { searchParams: ParamsAviso }) {
  const { tenant } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  const branding = brandingDo({ tipo: "tenant", tenant });
  const aviso = await searchParams;

  return (
    <>
      <Titulo descricao="É o que colaboradores e clientes veem no painel e na pesquisa de satisfação.">
        Marca
      </Titulo>
      <Aviso {...aviso} />
      <form action={salvarMarca} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Identidade</CardTitle>
            <CardDescription>Imagens em PNG, JPG ou WEBP, até 1 MB.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo id="nomeExibicao" rotulo="Nome de exibição">
              <Input id="nomeExibicao" name="nomeExibicao" defaultValue={tenant.nomeExibicao} required />
            </Campo>
            <div />
            <Campo id="corPrimaria" rotulo="Cor primária" dica="Botões e destaques.">
              <Input id="corPrimaria" name="corPrimaria" type="color" defaultValue={branding.corPrimaria} />
            </Campo>
            <Campo id="corSecundaria" rotulo="Cor secundária" dica="Barra do topo.">
              <Input id="corSecundaria" name="corSecundaria" type="color" defaultValue={branding.corSecundaria} />
            </Campo>
            <Campo id="logo" rotulo="Logo" dica="Ideal: fundo transparente, cerca de 4:1.">
              <Input id="logo" name="logo" type="file" accept={TIPOS} />
              {tenant.logoUrl && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="removerLogo" /> Remover a logo atual
                </label>
              )}
            </Campo>
            <Campo id="favicon" rotulo="Ícone da aba (favicon)" dica="Quadrado, 64×64 ou maior. Aceita ICO.">
              <Input id="favicon" name="favicon" type="file" accept={`${TIPOS},image/x-icon`} />
              {tenant.faviconUrl && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="removerFavicon" /> Remover o ícone atual
                </label>
              )}
            </Campo>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Como está hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-marca-secundaria text-marca-secundaria-texto flex items-center justify-between rounded-md px-4 py-3">
              <Marca branding={branding} />
              <span className="bg-primary text-primary-foreground rounded-md px-3 py-1 text-sm">Botão</span>
            </div>
          </CardContent>
        </Card>
        <div>
          <Button type="submit">Salvar marca</Button>
        </div>
      </form>
    </>
  );
}
