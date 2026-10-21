/**
 * Datas no fuso de Brasília (UTC−3, sem horário de verão desde 2019), para
 * limites diários/semanais e relatórios por período.
 */
const OFFSET_MS = -3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Início (00:00 de Brasília) do dia que contém `data`. */
export function inicioDoDia(data: Date): Date {
  const local = data.getTime() + OFFSET_MS;
  return new Date(Math.floor(local / DIA_MS) * DIA_MS - OFFSET_MS);
}

/** Início da semana (segunda-feira 00:00 de Brasília) que contém `data`. */
export function inicioDaSemana(data: Date): Date {
  const dia = inicioDoDia(data);
  const diaDaSemana = new Date(dia.getTime() + OFFSET_MS).getUTCDay(); // 0 = domingo
  const desdeSegunda = (diaDaSemana + 6) % 7;
  return new Date(dia.getTime() - desdeSegunda * DIA_MS);
}

export function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * DIA_MS);
}

export type Periodo = "semana" | "mes" | "trimestre" | "tudo";

export const NOMES_PERIODO: Record<Periodo, string> = {
  semana: "Esta semana",
  mes: "Este mês",
  trimestre: "Últimos 3 meses",
  tudo: "Desde o início",
};

/** Data inicial de um período de relatório (null = sem limite). */
export function inicioDoPeriodo(periodo: Periodo, agora = new Date()): Date | null {
  switch (periodo) {
    case "semana":
      return inicioDaSemana(agora);
    case "mes": {
      const local = new Date(agora.getTime() + OFFSET_MS);
      return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET_MS);
    }
    case "trimestre":
      return somarDias(inicioDoDia(agora), -90);
    case "tudo":
      return null;
  }
}

export function periodoValido(valor: string | undefined): Periodo {
  return valor === "semana" || valor === "trimestre" || valor === "tudo" ? valor : "mes";
}
