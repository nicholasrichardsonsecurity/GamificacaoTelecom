"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importarPlanilha, type EstadoImportacao } from "../../actions";

export function FormImportar() {
  const [estado, executar, pendente] = useActionState<EstadoImportacao, FormData>(importarPlanilha, {});
  const r = estado.resultado;
  return (
    <form action={executar} className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Input name="arquivo" type="file" accept=".csv,text/csv" required className="max-w-sm" />
        <Button type="submit" disabled={pendente}>
          {pendente ? "Importando…" : "Importar"}
        </Button>
      </div>
      {estado.erro && (
        <p role="alert" className="text-destructive text-sm">
          {estado.erro}
        </p>
      )}
      {r && (
        <div role="status" className="grid gap-2 text-sm">
          <p>
            <strong>{r.criados}</strong> criados, <strong>{r.atualizados}</strong> atualizados,{" "}
            <strong>{r.erros.length}</strong> linhas com problema.
          </p>
          {r.erros.length > 0 && (
            <ul className="text-destructive list-disc pl-5">
              {r.erros.map((e) => (
                <li key={`${e.linha}-${e.mensagem}`}>
                  Linha {e.linha}: {e.mensagem}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
