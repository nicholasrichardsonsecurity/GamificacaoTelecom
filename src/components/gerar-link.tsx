"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { LinkCopiavel } from "./link-copiavel";

export type EstadoLink = { link?: string; erro?: string };

/**
 * Botão que chama uma Server Action e mostra o link gerado (convite de
 * acesso ou de pesquisa). O token só existe nesta resposta: o banco guarda o hash.
 */
export function GerarLink({
  acao,
  rotulo,
  aviso,
}: {
  acao: (estado: EstadoLink, formData: FormData) => Promise<EstadoLink>;
  rotulo: string;
  aviso?: string;
}) {
  const [estado, executar, pendente] = useActionState(acao, {});
  return (
    <form action={executar} className="grid gap-3">
      <div>
        <Button type="submit" variant="outline" disabled={pendente}>
          {pendente ? "Gerando…" : rotulo}
        </Button>
      </div>
      {estado.erro && (
        <p role="alert" className="text-destructive text-sm">
          {estado.erro}
        </p>
      )}
      {estado.link && (
        <div className="grid gap-2">
          <LinkCopiavel link={estado.link} />
          {aviso && <p className="text-muted-foreground text-xs">{aviso}</p>}
        </div>
      )}
    </form>
  );
}
