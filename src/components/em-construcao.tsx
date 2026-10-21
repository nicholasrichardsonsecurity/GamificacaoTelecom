import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmConstrucao({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>Chega na Fase 1 do roadmap:</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          {itens.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
