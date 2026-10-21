import type { Metadata } from "next";
import { Aviso } from "@/components/aviso";
import { Titulo } from "@/components/titulo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ParamsAviso } from "@/lib/acoes";
import { limitesDoPlano } from "@/lib/colaboradores";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { salvarEquipe } from "../actions";

export const metadata: Metadata = { title: "Equipes" };

type Opcao = { id: string; nome: string };

function CamposEquipe({ gestores, nome, gestorId }: { gestores: Opcao[]; nome?: string; gestorId?: string | null }) {
  return (
    <>
      <Input name="nome" defaultValue={nome} required aria-label="Nome da equipe" placeholder="Nome da equipe" />
      <Select name="gestorId" defaultValue={gestorId ?? ""} aria-label="Gestor">
        <option value="">Sem gestor</option>
        {gestores.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nome}
          </option>
        ))}
      </Select>
    </>
  );
}

export default async function PaginaEquipes({ searchParams }: { searchParams: ParamsAviso }) {
  const { tenant, db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  const [equipes, gestores, limites, aviso] = await Promise.all([
    db.equipe.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { membros: { where: { ativo: true } } } } },
    }),
    db.usuario.findMany({
      where: { ativo: true, role: { in: ["GESTOR", "ADMIN_PROVEDOR"] } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    limitesDoPlano(db, tenant.id),
    searchParams,
  ]);

  return (
    <>
      <Titulo
        descricao={`O gestor da equipe recebe os casos de recuperação e vê o ranking dela.${
          limites.limiteFiliais ? ` Plano: até ${limites.limiteFiliais} equipes.` : ""
        }`}
      >
        Equipes
      </Titulo>
      <Aviso {...aviso} />
      <Card>
        <CardHeader>
          <CardTitle>Nova equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={salvarEquipe.bind(null, null)} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <CamposEquipe gestores={gestores} />
            <Button type="submit">Criar</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Equipes cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {equipes.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma equipe ainda.</p>}
          {equipes.map((e) => (
            <form
              key={e.id}
              action={salvarEquipe.bind(null, e.id)}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center"
            >
              <CamposEquipe gestores={gestores} nome={e.nome} gestorId={e.gestorId} />
              <span className="text-muted-foreground text-xs">{e._count.membros} membros</span>
              <Button type="submit" variant="outline" size="sm">
                Salvar
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
