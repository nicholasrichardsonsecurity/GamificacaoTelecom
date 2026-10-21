import type { Metadata } from "next";
import { Aviso } from "@/components/aviso";
import { Campo } from "@/components/campo";
import { SinalIcone } from "@/components/sinal";
import { Titulo } from "@/components/titulo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ParamsAviso } from "@/lib/acoes";
import { CONFIGURACAO_PADRAO, PONTOS_PADRAO } from "@/lib/pontuacao";
import { regrasVigentes } from "@/lib/regras";
import { exigirSessaoDeTenant } from "@/lib/sessao";
import { salvarPontuacao } from "../actions";

export const metadata: Metadata = { title: "Pontuação" };

const NIVEIS = [5, 4, 3, 2, 1] as const;

export default async function PaginaPontuacao({ searchParams }: { searchParams: ParamsAviso }) {
  const { db } = await exigirSessaoDeTenant(["ADMIN_PROVEDOR"]);
  const [regras, salva, aviso] = await Promise.all([
    regrasVigentes(db),
    db.configuracaoPontuacao.findFirst(),
    searchParams,
  ]);
  const config = salva ?? CONFIGURACAO_PADRAO;

  return (
    <>
      <Titulo descricao="Mudanças valem para as próximas avaliações; o que já foi pontuado não muda.">
        Pontuação
      </Titulo>
      <Aviso {...aviso} />
      <form action={salvarPontuacao} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pontos por avaliação</CardTitle>
            <CardDescription>Valores negativos tiram pontos, mas o saldo nunca fica abaixo de zero.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            {NIVEIS.map((n) => (
              <div key={n} className="grid justify-items-center gap-2">
                <SinalIcone nivel={n} className="h-8" />
                <Input
                  name={`pontos${n}`}
                  type="number"
                  min={-1000}
                  max={1000}
                  required
                  defaultValue={regras.get(n)?.pontos ?? PONTOS_PADRAO[n]}
                  aria-label={`Pontos para ${n} barras`}
                  className="text-center"
                />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Regras do motor</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="diasPendencia"
              rotulo="Dias de pendência"
              dica="Créditos ficam pendentes por esse prazo antes de poderem ser trocados por prêmios."
            >
              <Input id="diasPendencia" name="diasPendencia" type="number" min={0} max={90} defaultValue={config.diasPendencia} />
            </Campo>
            <Campo id="nivelRisco" rotulo="Nota de risco" dica="Notas até este nível abrem um caso de recuperação.">
              <Select id="nivelRisco" name="nivelRisco" defaultValue={String(config.nivelRisco)}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    Até {n} {n === 1 ? "barra" : "barras"}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo id="limiteDiario" rotulo="Teto diário de pontos" dica="Por colaborador. Vazio = sem teto.">
              <Input id="limiteDiario" name="limiteDiario" type="number" min={1} defaultValue={config.limiteDiario ?? ""} />
            </Campo>
            <Campo id="limiteSemanal" rotulo="Teto semanal de pontos" dica="Por colaborador. Vazio = sem teto.">
              <Input id="limiteSemanal" name="limiteSemanal" type="number" min={1} defaultValue={config.limiteSemanal ?? ""} />
            </Campo>
            <Campo id="prazoContatoHoras" rotulo="Prazo para contatar o cliente (horas)" dica="Prazo do caso de recuperação.">
              <Input
                id="prazoContatoHoras"
                name="prazoContatoHoras"
                type="number"
                min={1}
                max={720}
                defaultValue={config.prazoContatoHoras}
              />
            </Campo>
          </CardContent>
        </Card>
        <div>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </>
  );
}
