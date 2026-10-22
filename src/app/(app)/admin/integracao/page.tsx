import type { Metadata } from "next";
import { Aviso } from "@/components/aviso";
import { Campo } from "@/components/campo";
import { Titulo } from "@/components/titulo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ParamsAviso } from "@/lib/acoes";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { salvarIntegracaoAction, sincronizarAgoraAction, testarIntegracaoAction } from "./actions";

export const metadata: Metadata = { title: "Integração com ERP" };

const SISTEMAS = [
  {
    sistema: "IXC",
    nome: "IXC Provedor",
    dica: "No IXC, gere o token do usuário da API (ele vem como id:hash; cole inteiro). A URL é a do seu IXC, ex.: https://ixc.seuprovedor.com.br",
  },
  {
    sistema: "SGP",
    nome: "SGP",
    dica: "No SGP: gere o token e o nome do app nas ferramentas do painel. A URL é a do seu SGP.",
  },
] as const;

const STATUS = { SUCESSO: "Sucesso", ERRO: "Erro", NUNCA_EXECUTADA: "Nunca executada" } as const;

export default async function PaginaIntegracao({ searchParams }: { searchParams: ParamsAviso }) {
  const { db, tenant } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  const [integracoes, aviso, plano] = await Promise.all([
    db.integracaoERP.findMany(),
    searchParams,
    db.tenant.findUniqueOrThrow({ where: { id: tenant.id }, select: { plano: { select: { permiteIntegracaoERP: true } } } }),
  ]);

  if (!plano.plano.permiteIntegracaoERP) {
    return (
      <>
        <Titulo>Integração com ERP</Titulo>
        <Aviso erro="O plano atual não inclui integração com IXC/SGP. Você ainda pode importar colaboradores por planilha." />
      </>
    );
  }

  return (
    <>
      <Titulo descricao="Importa colaboradores e O.S. concluídas automaticamente. As credenciais ficam criptografadas e nunca são exibidas.">
        Integração com ERP
      </Titulo>
      <Aviso {...aviso} />
      <div className="grid gap-6">
        {SISTEMAS.map((s) => {
          const atual = integracoes.find((i) => i.sistema === s.sistema);
          return (
            <Card key={s.sistema}>
              <CardHeader>
                <CardTitle>{s.nome}</CardTitle>
                <CardDescription>
                  {atual
                    ? `Última sincronização: ${atual.ultimaSincronizacaoEm?.toLocaleString("pt-BR") ?? "nunca"} (${STATUS[atual.ultimoStatusSincronizacao]})`
                    : "Não configurado."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <form action={salvarIntegracaoAction} className="grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="sistema" value={s.sistema} />
                  <div className="sm:col-span-2">
                    <Campo id={`url-${s.sistema}`} rotulo="Endereço do sistema" dica={s.dica}>
                      <Input id={`url-${s.sistema}`} name="urlBase" type="url" required defaultValue={atual?.urlBase ?? ""} />
                    </Campo>
                  </div>
                  {s.sistema === "SGP" && (
                    <Campo id="sgp-app" rotulo="Nome do app">
                      <Input id="sgp-app" name="app" autoComplete="off" placeholder={atual ? "•••• (mantido)" : ""} />
                    </Campo>
                  )}
                  <Campo id={`token-${s.sistema}`} rotulo="Token" dica={atual ? "Deixe em branco para manter o atual." : undefined}>
                    <Input id={`token-${s.sistema}`} name="token" type="password" autoComplete="off" placeholder={atual ? "•••• (mantido)" : ""} />
                  </Campo>
                  <Campo id={`freq-${s.sistema}`} rotulo="Sincronizar a cada (minutos)">
                    <Input id={`freq-${s.sistema}`} name="frequenciaSincronizacao" type="number" min={15} max={1440} defaultValue={atual?.frequenciaSincronizacao ?? 60} />
                  </Campo>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" name="ativa" defaultChecked={atual?.ativa ?? true} /> Sincronização automática ativa
                  </label>
                  <div className="sm:col-span-2">
                    <Button type="submit">Salvar</Button>
                  </div>
                </form>
                {atual && (
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <form action={testarIntegracaoAction.bind(null, atual.id)}>
                      <Button type="submit" variant="outline">Testar conexão</Button>
                    </form>
                    <form action={sincronizarAgoraAction.bind(null, atual.id)}>
                      <Button type="submit" variant="outline">Sincronizar agora</Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
