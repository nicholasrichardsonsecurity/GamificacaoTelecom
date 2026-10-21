import { SinalIcone } from "@/components/sinal";
import { Badge } from "@/components/ui/badge";

type Dados = {
  clienteFinal: { naoPerturbe: boolean };
  convite: { expiraEm: Date; respondidoEm: Date | null } | null;
  avaliacao: { nivelSinal: number; suspeita: boolean } | null;
};

/** Situação da pesquisa de satisfação de um atendimento. */
export function StatusPesquisa({ atendimento, agora = new Date() }: { atendimento: Dados; agora?: Date }) {
  const { avaliacao, convite, clienteFinal } = atendimento;
  if (avaliacao) {
    return (
      <span className="inline-flex items-center gap-2">
        <SinalIcone nivel={avaliacao.nivelSinal as 1 | 2 | 3 | 4 | 5} className="h-4" />
        {avaliacao.suspeita && <Badge variant="outline">Suspeita</Badge>}
      </span>
    );
  }
  if (clienteFinal.naoPerturbe) return <Badge variant="outline">Não quer pesquisas</Badge>;
  if (!convite) return <Badge variant="outline">Sem link</Badge>;
  if (convite.expiraEm <= agora) return <Badge variant="outline">Link expirado</Badge>;
  return <Badge variant="secondary">Aguardando resposta</Badge>;
}
