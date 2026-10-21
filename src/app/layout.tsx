import type { Metadata } from "next";
import { brandingDo, contextoAtual } from "@/lib/tenant";
import { variaveisCss } from "@/lib/branding";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const branding = brandingDo(await contextoAtual());
  return {
    title: { default: branding.nomeExibicao, template: `%s · ${branding.nomeExibicao}` },
    icons: branding.faviconUrl ? { icon: branding.faviconUrl } : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = brandingDo(await contextoAtual());

  return (
    <html lang="pt-BR">
      <head>
        {/* Cores de marca do tenant; `variaveisCss` só aceita #rrggbb. */}
        <style>{`:root{${variaveisCss(branding)}}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
