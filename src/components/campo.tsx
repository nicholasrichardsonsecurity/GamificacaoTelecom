import { Label } from "@/components/ui/label";

/** Rótulo + controle + dica, para formulários simples. */
export function Campo({
  id,
  rotulo,
  dica,
  children,
}: {
  id: string;
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
      {dica && <p className="text-muted-foreground text-xs">{dica}</p>}
    </div>
  );
}
