import type { TxDoTenant } from "./tenant-db";

type ComTransacoes = Pick<TxDoTenant, "transacaoPontos">;

export type Saldo = {
  /** Soma de todas as transações (nunca negativa: o piso é aplicado no débito). */
  total: number;
  /** Parte já liberada (`disponivelEm` no passado): é o que pode ser resgatado. */
  disponivel: number;
  /** Créditos ainda dentro da janela de pendência. */
  pendente: number;
  /** Créditos positivos já liberados ao longo do tempo; define o nível. */
  acumulado: number;
};

/** Saldo por agregação do ledger (docs/03-MODELO-DADOS.md, seção 4). */
export async function saldoDoColaborador(
  db: ComTransacoes,
  colaboradorId: string,
  agora = new Date(),
): Promise<Saldo> {
  const [total, disponivel, acumulado] = await Promise.all([
    db.transacaoPontos.aggregate({ where: { colaboradorId }, _sum: { pontos: true } }),
    db.transacaoPontos.aggregate({
      where: { colaboradorId, disponivelEm: { lte: agora } },
      _sum: { pontos: true },
    }),
    db.transacaoPontos.aggregate({
      where: { colaboradorId, disponivelEm: { lte: agora }, pontos: { gt: 0 } },
      _sum: { pontos: true },
    }),
  ]);
  const t = total._sum.pontos ?? 0;
  const d = Math.max(0, disponivel._sum.pontos ?? 0);
  return {
    total: t,
    disponivel: Math.min(d, Math.max(0, t)),
    pendente: Math.max(0, t - d),
    acumulado: acumulado._sum.pontos ?? 0,
  };
}

export type NivelResumo = { id: string; nome: string; pontosAcumuladosMinimo: number; cor: string | null };

/** Nível atual e o próximo, a partir dos pontos acumulados (nunca cai ao gastar). */
export function nivelPorPontos<N extends NivelResumo>(niveis: N[], acumulado: number) {
  const ordenados = [...niveis].sort((a, b) => a.pontosAcumuladosMinimo - b.pontosAcumuladosMinimo);
  let atual: N | null = null;
  let proximo: N | null = null;
  for (const n of ordenados) {
    if (acumulado >= n.pontosAcumuladosMinimo) atual = n;
    else {
      proximo = n;
      break;
    }
  }
  const faltam = proximo ? proximo.pontosAcumuladosMinimo - acumulado : 0;
  const base = atual?.pontosAcumuladosMinimo ?? 0;
  const progresso = proximo
    ? Math.min(1, Math.max(0, (acumulado - base) / (proximo.pontosAcumuladosMinimo - base)))
    : 1;
  return { atual, proximo, faltam, progresso };
}
