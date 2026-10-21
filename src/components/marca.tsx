import type { Branding } from "@/lib/branding";
import { SinalIcone } from "./sinal";

/** Logo do tenant, ou o nome de exibição quando não houver logo. */
export function Marca({ branding }: { branding: Branding }) {
  if (branding.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- URL do tenant, domínio arbitrário
    return <img src={branding.logoUrl} alt={branding.nomeExibicao} className="h-8 w-auto" />;
  }
  return (
    <span className="flex items-center gap-2 font-semibold">
      <SinalIcone nivel={5} className="h-5" titulo="" />
      {branding.nomeExibicao}
    </span>
  );
}
