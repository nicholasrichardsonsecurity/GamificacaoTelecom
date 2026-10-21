/** Cabeçalho padrão das páginas da área logada. */
export function Titulo({
  children,
  descricao,
  acoes,
}: {
  children: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{children}</h1>
        {descricao && <p className="text-muted-foreground text-sm">{descricao}</p>}
      </div>
      {acoes && <div className="flex gap-2">{acoes}</div>}
    </div>
  );
}
