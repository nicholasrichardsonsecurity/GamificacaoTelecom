import type { Metadata } from "next";
import { EmConstrucao } from "@/components/em-construcao";
import { exigirSessaoDeTenant } from "@/lib/sessao";

export const metadata: Metadata = { title: "Meus pontos" };

export default async function PaginaColaborador() {
  await exigirSessaoDeTenant(["ADMIN_PROVEDOR", "GESTOR", "COLABORADOR"]);
  return (
    <EmConstrucao
      titulo="Meus pontos"
      itens={["Saldo e extrato", "Nível atual e selos", "Ranking"]}
    />
  );
}
