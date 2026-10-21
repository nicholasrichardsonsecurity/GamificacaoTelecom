import { cn } from "@/lib/utils";

/** Mensagem de retorno de uma ação (`?ok=` ou `?erro=` na URL). */
export function Aviso({ ok, erro }: { ok?: string; erro?: string }) {
  const texto = erro ?? ok;
  if (!texto) return null;
  return (
    <p
      role={erro ? "alert" : "status"}
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        erro ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-primary/40 bg-primary/5",
      )}
    >
      {texto}
    </p>
  );
}
