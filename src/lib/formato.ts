/** Formatação pt-BR usada nas telas. */

const fusoBrasilia = { timeZone: "America/Sao_Paulo" } as const;

export function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", fusoBrasilia);
}

export function formatarDataHora(data: Date): string {
  return data.toLocaleString("pt-BR", { ...fusoBrasilia, dateStyle: "short", timeStyle: "short" });
}

export function formatarMedia(valor: number | null): string {
  return valor === null ? "—" : valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatarPercentual(valor: number | null): string {
  return valor === null ? "—" : valor.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 0 });
}

export function formatarPontos(pontos: number): string {
  return `${pontos > 0 ? "+" : ""}${pontos.toLocaleString("pt-BR")}`;
}
