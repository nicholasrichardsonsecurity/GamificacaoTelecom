"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type ItemNav = { href: string; rotulo: string };

/** Menu da área logada; o item ativo é o de prefixo mais longo que casa. */
export function Navegacao({ itens }: { itens: ItemNav[] }) {
  const pathname = usePathname();
  const ativo = itens
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="border-b">
      <ul className="mx-auto flex max-w-5xl flex-wrap gap-1 px-4 py-2 text-sm">
        {itens.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={i.href === ativo ? "page" : undefined}
              className={cn(
                "hover:bg-accent block rounded-md px-3 py-1.5",
                i.href === ativo && "bg-accent font-medium",
              )}
            >
              {i.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
