"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entrar, type EstadoLogin } from "./actions";

export function FormLogin({ callbackUrl }: { callbackUrl?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="grid gap-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="senha">Senha</Label>
        <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      {estado.erro && (
        <p role="alert" className="text-destructive text-sm">
          {estado.erro}
        </p>
      )}
      <Button type="submit" disabled={pendente} className="w-full">
        {pendente ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
