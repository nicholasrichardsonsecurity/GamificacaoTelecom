import type { Equipe, Usuario } from "@prisma/client";
import { Campo } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { NOMES_PAPEL, PAPEIS_DO_TENANT } from "@/lib/colaboradores";

/** Campos de criação/edição de usuário (Server Component, sem JS). */
export function FormUsuario({
  acao,
  equipes,
  usuario,
}: {
  acao: (formData: FormData) => Promise<void>;
  equipes: Pick<Equipe, "id" | "nome">[];
  usuario?: Pick<Usuario, "nome" | "email" | "role" | "equipeId" | "ativo">;
}) {
  return (
    <form action={acao} className="grid gap-4 sm:grid-cols-2">
      <Campo id="nome" rotulo="Nome">
        <Input id="nome" name="nome" defaultValue={usuario?.nome} required />
      </Campo>
      <Campo id="email" rotulo="E-mail" dica="Usado para entrar. Pode ficar vazio para quem não vai acessar.">
        <Input id="email" name="email" type="email" defaultValue={usuario?.email ?? ""} />
      </Campo>
      <Campo id="role" rotulo="Papel">
        <Select id="role" name="role" defaultValue={usuario?.role ?? "COLABORADOR"}>
          {PAPEIS_DO_TENANT.map((p) => (
            <option key={p} value={p}>
              {NOMES_PAPEL[p]}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo id="equipeId" rotulo="Equipe">
        <Select id="equipeId" name="equipeId" defaultValue={usuario?.equipeId ?? ""}>
          <option value="">Sem equipe</option>
          {equipes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </Campo>
      {usuario && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={usuario.ativo} />
          Ativo (desativar mantém o histórico de pontos)
        </label>
      )}
      <div className="sm:col-span-2">
        <Button type="submit">{usuario ? "Salvar" : "Cadastrar"}</Button>
      </div>
    </form>
  );
}
