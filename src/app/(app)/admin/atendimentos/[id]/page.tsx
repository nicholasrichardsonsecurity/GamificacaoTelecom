import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/aviso";
import { GerarLink } from "@/components/gerar-link";
import { StatusPesquisa } from "@/components/status-pesquisa";
import { Titulo } from "@/components/titulo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParamsAviso } from "@/lib/acoes";
import { TIPOS_ATENDIMENTO } from "@/lib/atendimentos";
import { formatarDataHora } from "@/lib/formato";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { linkDePesquisa } from "../../actions";

export const metadata: Metadata = { title: "Atendimento" };

export default async function PaginaAtendimento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ParamsAviso;
}) {
  const { db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  const { id } = await params;
  const [a, aviso] = await Promise.all([
    db.atendimento.findFirst({
      where: { id },
      include: {
        colaborador: { select: { nome: true } },
        clienteFinal: true,
        convite: true,
        avaliacao: true,
      },
    }),
    searchParams,
  ]);
  if (!a) notFound();
  const podeGerar = !a.avaliacao && !a.clienteFinal.naoPerturbe;

  return (
    <>
      <Titulo descricao={`${TIPOS_ATENDIMENTO[a.tipo]} · ${formatarDataHora(a.concluidoEm)} · ${a.colaborador.nome}`}>
        {a.clienteFinal.nome}
      </Titulo>
      <Aviso {...aviso} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Pesquisa de satisfação <StatusPesquisa atendimento={a} />
          </CardTitle>
          <CardDescription>
            {a.avaliacao
              ? `Respondida em ${formatarDataHora(a.avaliacao.respondidaEm)}.`
              : a.clienteFinal.naoPerturbe
                ? "O cliente pediu para não receber pesquisas."
                : "Gere o link e envie ao cliente por WhatsApp, SMS ou e-mail. O envio automático chega na Fase 4."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {a.avaliacao?.comentario && <blockquote className="border-l-2 pl-3 italic">{a.avaliacao.comentario}</blockquote>}
          {a.avaliacao?.suspeita && (
            <p className="text-muted-foreground">Marcada como suspeita: {a.avaliacao.motivoSuspeita}</p>
          )}
          {podeGerar && (
            <GerarLink
              acao={linkDePesquisa.bind(null, a.id)}
              rotulo={a.convite ? "Gerar um novo link" : "Gerar link da pesquisa"}
              aviso="O link vale por 7 dias. Gerar outro invalida o anterior."
            />
          )}
          <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt>Telefone</dt>
            <dd>{a.clienteFinal.telefone ?? "—"}</dd>
            <dt>E-mail</dt>
            <dd>{a.clienteFinal.email ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
