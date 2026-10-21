import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/aviso";
import { Campo } from "@/components/campo";
import { StatusPesquisa } from "@/components/status-pesquisa";
import { Titulo } from "@/components/titulo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ParamsAviso } from "@/lib/acoes";
import { TIPOS_ATENDIMENTO } from "@/lib/atendimentos";
import { formatarDataHora } from "@/lib/formato";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { criarAtendimento } from "../actions";

export const metadata: Metadata = { title: "Atendimentos" };

export default async function PaginaAtendimentos({ searchParams }: { searchParams: ParamsAviso }) {
  const { db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  const [atendimentos, colaboradores, aviso] = await Promise.all([
    db.atendimento.findMany({
      orderBy: { concluidoEm: "desc" },
      take: 50,
      include: {
        colaborador: { select: { nome: true } },
        clienteFinal: { select: { nome: true, naoPerturbe: true } },
        convite: { select: { expiraEm: true, respondidoEm: true } },
        avaliacao: { select: { nivelSinal: true, suspeita: true } },
      },
    }),
    db.usuario.findMany({
      where: { ativo: true, role: { in: ["COLABORADOR", "GESTOR"] } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    searchParams,
  ]);

  return (
    <>
      <Titulo descricao="Com integração IXC/SGP (Fase 2) eles chegam sozinhos; por enquanto, registre aqui.">
        Atendimentos
      </Titulo>
      <Aviso {...aviso} />
      <Card>
        <CardHeader>
          <CardTitle>Registrar atendimento concluído</CardTitle>
          <CardDescription>Depois você gera o link da pesquisa para enviar ao cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={criarAtendimento} className="grid gap-4 sm:grid-cols-2">
            <Campo id="colaboradorId" rotulo="Quem atendeu">
              <Select id="colaboradorId" name="colaboradorId" required defaultValue="">
                <option value="" disabled>
                  Escolha…
                </option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="tipo" rotulo="Tipo">
              <Select id="tipo" name="tipo" defaultValue="SUPORTE">
                {Object.entries(TIPOS_ATENDIMENTO).map(([valor, nome]) => (
                  <option key={valor} value={valor}>
                    {nome}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="clienteNome" rotulo="Cliente">
              <Input id="clienteNome" name="clienteNome" required />
            </Campo>
            <Campo id="clienteIdExterno" rotulo="Código do cliente no ERP" dica="Opcional; evita cadastrar o mesmo cliente duas vezes.">
              <Input id="clienteIdExterno" name="clienteIdExterno" />
            </Campo>
            <Campo id="clienteTelefone" rotulo="Telefone do cliente">
              <Input id="clienteTelefone" name="clienteTelefone" type="tel" />
            </Campo>
            <Campo id="clienteEmail" rotulo="E-mail do cliente">
              <Input id="clienteEmail" name="clienteEmail" type="email" />
            </Campo>
            <div className="sm:col-span-2">
              <Button type="submit">Registrar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="py-0">
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-b text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Concluído em</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Pesquisa</th>
              </tr>
            </thead>
            <tbody>
              {atendimentos.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-4 py-6 text-center">
                    Nenhum atendimento ainda.
                  </td>
                </tr>
              )}
              {atendimentos.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/atendimentos/${a.id}`} className="hover:underline">
                      {formatarDataHora(a.concluidoEm)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{a.clienteFinal.nome}</td>
                  <td className="px-4 py-3">{TIPOS_ATENDIMENTO[a.tipo]}</td>
                  <td className="px-4 py-3">{a.colaborador.nome}</td>
                  <td className="px-4 py-3">
                    <StatusPesquisa atendimento={a} />
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
