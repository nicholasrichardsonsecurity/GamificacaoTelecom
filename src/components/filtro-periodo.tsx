import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { NOMES_PERIODO, type Periodo } from "@/lib/periodo";

/** Filtro por período (e equipe, se houver), via GET: funciona sem JS e gera URL compartilhável. */
export function FiltroPeriodo({
  periodo,
  equipes,
  equipeId,
}: {
  periodo: Periodo;
  equipes?: { id: string; nome: string }[];
  equipeId?: string;
}) {
  return (
    <form className="flex flex-wrap items-center gap-2">
      <Select name="periodo" defaultValue={periodo} aria-label="Período" className="w-auto">
        {Object.entries(NOMES_PERIODO).map(([valor, nome]) => (
          <option key={valor} value={valor}>
            {nome}
          </option>
        ))}
      </Select>
      {equipes && equipes.length > 1 && (
        <Select name="equipe" defaultValue={equipeId ?? ""} aria-label="Equipe" className="w-auto">
          <option value="">Todas as equipes</option>
          {equipes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      )}
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}
