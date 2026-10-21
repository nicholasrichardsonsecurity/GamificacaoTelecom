import type { Metadata } from "next";
import { EmConstrucao } from "@/components/em-construcao";
import { exigirSessaoDeTenant } from "@/lib/sessao";

export const metadata: Metadata = { title: "Gestor" };

export default async function PaginaGestor() {
  await exigirSessaoDeTenant(["ADMIN_PROVEDOR", "GESTOR"]);
  return (
    <EmConstrucao
      titulo="Painel do gestor"
      itens={["Ranking da equipe", "Casos de recuperação abertos"]}
    />
  );
}
