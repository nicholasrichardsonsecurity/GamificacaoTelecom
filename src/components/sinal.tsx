import { cn } from "@/lib/utils";

/** Cores da escala: de sinal fraco (vermelho) a sinal forte (verde). */
export const CORES_SINAL = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"] as const;

/**
 * Ícone de "sinal de Wi-Fi" de 1 a 5 barras, a métrica central do produto.
 * Barras acima do nível ficam apagadas.
 */
export function SinalIcone({
  nivel,
  className,
  titulo,
}: {
  nivel: 1 | 2 | 3 | 4 | 5;
  className?: string;
  titulo?: string;
}) {
  const cor = CORES_SINAL[nivel - 1];
  return (
    <svg
      viewBox="0 0 54 40"
      className={cn("h-6 w-auto", className)}
      role="img"
      aria-label={titulo ?? `Sinal ${nivel} de 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const altura = 8 + i * 8;
        return (
          <rect
            key={i}
            x={i * 11}
            y={40 - altura}
            width={8}
            height={altura}
            rx={2}
            fill={i < nivel ? cor : "currentColor"}
            fillOpacity={i < nivel ? 1 : 0.15}
          />
        );
      })}
    </svg>
  );
}
