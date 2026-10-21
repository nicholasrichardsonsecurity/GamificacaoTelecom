import type { Metadata } from "next";
import { Titulo } from "@/components/titulo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { FormImportar } from "./form-importar";

export const metadata: Metadata = { title: "Importar usuários" };

const EXEMPLO = `nome;email;cargo;equipe;id_externo
Ana Souza;ana@provedor.com.br;técnico;Paulista;123
Bruno Lima;bruno@provedor.com.br;supervisor;Paulista;124`;

export default async function PaginaImportar() {
  await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  return (
    <>
      <Titulo descricao="Para provedores sem integração com IXC ou SGP, ou para a carga inicial.">
        Importar usuários
      </Titulo>
      <Card>
        <CardHeader>
          <CardTitle>Planilha CSV</CardTitle>
          <CardDescription>
            Salve no Excel como &quot;CSV (separado por ponto e vírgula)&quot;. Pode importar de novo sem
            duplicar ninguém: a pessoa é reconhecida pelo id externo ou, sem ele, pelo e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">{EXEMPLO}</pre>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
            <li>Obrigatório: nome, e e-mail ou id externo.</li>
            <li>Cargo: técnico, atendente, vendedor e colaborador viram Colaborador; gestor e supervisor viram Gestor; admin vira Admin.</li>
            <li>Equipes que ainda não existem são criadas (respeitando o limite do plano).</li>
          </ul>
          <FormImportar />
        </CardContent>
      </Card>
    </>
  );
}
