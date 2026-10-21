import type { Prisma } from "@prisma/client";
import { CONFIGURACAO_PADRAO, PONTOS_PADRAO } from "./pontuacao";

/**
 * Template padrão copiado para todo tenant novo (docs/01-FUNDACAO-PRODUTO.md,
 * seções 6 e 7). Depois de criado, cada provedor ajusta o seu.
 */
export const NIVEIS_PADRAO = [
  { nome: "Sinal Fraco", pontosAcumuladosMinimo: 0, cor: "#ef4444" },
  { nome: "Sinal Médio", pontosAcumuladosMinimo: 100, cor: "#eab308" },
  { nome: "Sinal Forte", pontosAcumuladosMinimo: 300, cor: "#84cc16" },
  { nome: "Fibra Pura", pontosAcumuladosMinimo: 700, cor: "#22c55e" },
  { nome: "Lenda da Rede", pontosAcumuladosMinimo: 1500, cor: "#0ea5e9" },
];

export const SELOS_PADRAO = [
  {
    nome: "Sinal máximo em sequência",
    descricao: "7 avaliações seguidas com 5 barras",
    criterioTipo: "SEQUENCIA_SINAL_MAXIMO" as const,
  },
  {
    nome: "Zero reclamações no mês",
    descricao: "Um mês inteiro sem nenhuma avaliação de 1 ou 2 barras",
    criterioTipo: "ZERO_RECLAMACOES_MES" as const,
  },
  {
    nome: "Primeiro resgate",
    descricao: "Trocou pontos por um prêmio pela primeira vez",
    criterioTipo: "PRIMEIRO_RESGATE" as const,
  },
];

/** Aplica o template a um tenant recém-criado. Operação de plataforma (Super Admin). */
export async function aplicarTemplatePadrao(tx: Prisma.TransactionClient, tenantId: string) {
  await tx.configuracaoPontuacao.create({ data: { tenantId, ...CONFIGURACAO_PADRAO } });
  await tx.regraPontuacao.createMany({
    data: Object.entries(PONTOS_PADRAO).map(([nivel, pontos]) => ({
      tenantId,
      nivelSinal: Number(nivel),
      pontos,
    })),
  });
  await tx.nivel.createMany({ data: NIVEIS_PADRAO.map((n) => ({ ...n, tenantId })) });
  await tx.selo.createMany({ data: SELOS_PADRAO.map((s) => ({ ...s, tenantId })) });
}
