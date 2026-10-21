/**
 * Branding white-label: nada de nome, cor ou logo fixos nos componentes.
 * Tudo vem do `Tenant` resolvido pelo domínio.
 */
export type Branding = {
  nomeExibicao: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  corPrimaria: string;
  corSecundaria: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export const COR_PRIMARIA_PADRAO = "#16a34a";
export const COR_SECUNDARIA_PADRAO = "#0f172a";

/** Aceita apenas `#rrggbb`; qualquer outra coisa cai no padrão (evita injeção de CSS). */
export function corSegura(cor: string | null | undefined, padrao: string): string {
  return cor && HEX.test(cor) ? cor.toLowerCase() : padrao;
}

/** Luminância relativa (WCAG 2.1) de uma cor `#rrggbb`. */
export function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cor de texto (preto ou branco) com mais contraste sobre o fundo dado. */
export function corDeTextoSobre(fundo: string): string {
  const l = luminancia(fundo);
  const contrasteBranco = 1.05 / (l + 0.05);
  const contrastePreto = (l + 0.05) / 0.05;
  return contrasteBranco >= contrastePreto ? "#ffffff" : "#0a0a0a";
}

/** Variáveis CSS injetadas no layout raiz a partir do branding do tenant. */
export function variaveisCss(branding: Pick<Branding, "corPrimaria" | "corSecundaria">): string {
  const primaria = corSegura(branding.corPrimaria, COR_PRIMARIA_PADRAO);
  const secundaria = corSegura(branding.corSecundaria, COR_SECUNDARIA_PADRAO);
  return [
    `--marca-primaria:${primaria}`,
    `--marca-primaria-texto:${corDeTextoSobre(primaria)}`,
    `--marca-secundaria:${secundaria}`,
    `--marca-secundaria-texto:${corDeTextoSobre(secundaria)}`,
  ].join(";");
}
