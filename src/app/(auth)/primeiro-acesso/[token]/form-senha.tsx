"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EstadoSenha } from "./actions";

export function FormSenha({
  acao,
}: {
  acao: (estado: EstadoSenha, formData: FormData) => Promise<EstadoSenha>;
}) {
  const [estado, executar, pendente] = useActionState(acao, {});
  return (
    <form action={executar} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="senha">Nova senha</Label>
        <Input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} required />
        <p className="text-muted-foreground text-xs">Pelo menos 8 caracteres.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirmacao">Repita a senha</Label>
        <Input id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" required />
      </div>
      {estado.erro && (
        <p role="alert" className="text-destructive text-sm">
          {estado.erro}
        </p>
      )}
      <Button type="submit" disabled={pendente} className="w-full">
        {pendente ? "Salvando…" : "Definir senha"}
      </Button>
    </form>
  );
}
