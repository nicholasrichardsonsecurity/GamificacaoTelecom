import type { OrigemCadastro, Role } from "@prisma/client";
import { z } from "zod";
import type { DbDoTenant } from "./tenant-db";

/**
 * Cadastro de colaboradores em lote: importação por planilha (Fase 1) e,
 * na Fase 2, a sincronização com IXC/SGP usa o mesmo `upsertColaboradores`.
 */

export const PAPEIS_DO_TENANT = ["ADMIN_PROVEDOR", "GESTOR", "COLABORADOR"] as const;
export type PapelDoTenant = (typeof PAPEIS_DO_TENANT)[number];

export const NOMES_PAPEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_PROVEDOR: "Admin do provedor",
  GESTOR: "Gestor",
  COLABORADOR: "Colaborador",
};

export type ColaboradorEntrada = {
  nome: string;
  email: string | null;
  role: PapelDoTenant;
  equipe: string | null;
  idExternoERP: string | null;
};

// ─── CSV ────────────────────────────────────────────────────────────────────

/** Parser de CSV com aspas; separador `;` (Excel pt-BR) ou `,`, detectado no cabeçalho. */
export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "");
  const primeiraLinha = limpo.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeiraLinha.match(/;/g)?.length ?? 0) > (primeiraLinha.match(/,/g)?.length ?? 0) ? ";" : ",";

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((v) => v.trim() !== ""));
}

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const COLUNAS: Record<string, keyof ColaboradorEntrada> = {
  nome: "nome",
  email: "email",
  e_mail: "email",
  papel: "role",
  cargo: "role",
  funcao: "role",
  equipe: "equipe",
  filial: "equipe",
  id_externo: "idExternoERP",
  id_erp: "idExternoERP",
  idexternoerp: "idExternoERP",
};

const PAPEIS_CSV: Record<string, PapelDoTenant> = {
  colaborador: "COLABORADOR",
  tecnico: "COLABORADOR",
  atendente: "COLABORADOR",
  vendedor: "COLABORADOR",
  gestor: "GESTOR",
  supervisor: "GESTOR",
  admin: "ADMIN_PROVEDOR",
  administrador: "ADMIN_PROVEDOR",
};

export type ErroLinha = { linha: number; mensagem: string };

const emailSchema = z.email();

export function lerPlanilhaColaboradores(texto: string): {
  colaboradores: (ColaboradorEntrada & { linha: number })[];
  erros: ErroLinha[];
} {
  const linhas = lerCsv(texto);
  const erros: ErroLinha[] = [];
  if (linhas.length === 0) return { colaboradores: [], erros: [{ linha: 1, mensagem: "Planilha vazia." }] };

  const cabecalho = linhas[0].map((h) => COLUNAS[normalizar(h)]);
  if (!cabecalho.includes("nome")) {
    return { colaboradores: [], erros: [{ linha: 1, mensagem: 'A planilha precisa de uma coluna "nome".' }] };
  }

  const colaboradores: (ColaboradorEntrada & { linha: number })[] = [];
  linhas.slice(1).forEach((valores, i) => {
    const numero = i + 2;
    const r: Partial<Record<keyof ColaboradorEntrada, string>> = {};
    cabecalho.forEach((campo, j) => {
      if (campo) r[campo] = (valores[j] ?? "").trim();
    });
    if (!r.nome) return erros.push({ linha: numero, mensagem: "Nome vazio." });
    const email = r.email ? r.email.toLowerCase() : null;
    if (email && !emailSchema.safeParse(email).success) {
      return erros.push({ linha: numero, mensagem: `E-mail inválido: ${email}` });
    }
    const papelTexto = r.role ? normalizar(r.role) : "colaborador";
    const role = PAPEIS_CSV[papelTexto];
    if (!role) return erros.push({ linha: numero, mensagem: `Papel desconhecido: ${r.role}` });
    const idExternoERP = r.idExternoERP || null;
    if (!email && !idExternoERP) {
      return erros.push({ linha: numero, mensagem: "Informe e-mail ou id externo para identificar a pessoa." });
    }
    colaboradores.push({
      linha: numero,
      nome: r.nome.slice(0, 200),
      email,
      role,
      equipe: r.equipe || null,
      idExternoERP,
    });
  });
  return { colaboradores, erros };
}

// ─── Limites do plano ───────────────────────────────────────────────────────

export async function limitesDoPlano(db: DbDoTenant, tenantId: string) {
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { plano: { select: { limiteColaboradores: true, limiteFiliais: true } } },
  });
  const [usuarios, equipes] = await Promise.all([
    db.usuario.count({ where: { ativo: true } }),
    db.equipe.count(),
  ]);
  return {
    limiteColaboradores: tenant.plano.limiteColaboradores,
    limiteFiliais: tenant.plano.limiteFiliais,
    usuarios,
    equipes,
  };
}

// ─── Upsert idempotente ─────────────────────────────────────────────────────

export type ResultadoUpsert = { criados: number; atualizados: number; erros: ErroLinha[] };

/**
 * Cria ou atualiza colaboradores. A identidade é `idExternoERP` (quando há)
 * ou o e-mail, sempre dentro do tenant: rodar duas vezes não duplica ninguém.
 * Respeita os limites do plano.
 */
export async function upsertColaboradores(
  db: DbDoTenant,
  tenantId: string,
  entradas: (ColaboradorEntrada & { linha?: number })[],
  origem: OrigemCadastro = "MANUAL",
  agora = new Date(),
): Promise<ResultadoUpsert> {
  const resultado: ResultadoUpsert = { criados: 0, atualizados: 0, erros: [] };
  const limites = await limitesDoPlano(db, tenantId);
  let usuariosAtivos = limites.usuarios;
  let equipesExistentes = limites.equipes;
  const equipesPorNome = new Map(
    (await db.equipe.findMany({ select: { id: true, nome: true } })).map((e) => [e.nome.toLowerCase(), e.id]),
  );

  for (const [i, e] of entradas.entries()) {
    const linha = e.linha ?? i + 1;
    try {
      let equipeId: string | null = null;
      if (e.equipe) {
        equipeId = equipesPorNome.get(e.equipe.toLowerCase()) ?? null;
        if (!equipeId) {
          if (limites.limiteFiliais !== null && equipesExistentes >= limites.limiteFiliais) {
            throw new Error(`Limite de ${limites.limiteFiliais} equipes do plano atingido (${e.equipe}).`);
          }
          const nova = await db.equipe.create({ data: { tenantId, nome: e.equipe.slice(0, 100) } });
          equipesPorNome.set(e.equipe.toLowerCase(), nova.id);
          equipesExistentes++;
          equipeId = nova.id;
        }
      }

      const existente = await db.usuario.findFirst({
        where: e.idExternoERP ? { idExternoERP: e.idExternoERP } : { email: e.email },
      });
      const dados = {
        nome: e.nome,
        email: e.email,
        role: e.role,
        equipeId,
        idExternoERP: e.idExternoERP,
        origemCadastro: origem,
        sincronizadoEm: origem === "MANUAL" ? null : agora,
      };

      if (existente) {
        if (existente.role === "SUPER_ADMIN") throw new Error("Usuário reservado.");
        if (!existente.ativo && limites.limiteColaboradores !== null && usuariosAtivos >= limites.limiteColaboradores) {
          throw new Error(`Limite de ${limites.limiteColaboradores} usuários ativos do plano atingido.`);
        }
        await db.usuario.update({ where: { id: existente.id }, data: { ...dados, ativo: true } });
        if (!existente.ativo) usuariosAtivos++;
        resultado.atualizados++;
      } else {
        if (limites.limiteColaboradores !== null && usuariosAtivos >= limites.limiteColaboradores) {
          throw new Error(`Limite de ${limites.limiteColaboradores} usuários ativos do plano atingido.`);
        }
        await db.usuario.create({ data: { ...dados, tenantId } });
        usuariosAtivos++;
        resultado.criados++;
      }
    } catch (erro) {
      const mensagem =
        erro instanceof Error && !("code" in erro)
          ? erro.message
          : "Conflito: e-mail ou id externo já usado por outra pessoa.";
      resultado.erros.push({ linha, mensagem });
    }
  }
  return resultado;
}
