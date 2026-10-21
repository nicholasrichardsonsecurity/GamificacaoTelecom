import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./db";

/**
 * Camada central de isolamento multi-tenant: toda operação nos modelos que
 * têm `tenantId` recebe o tenant da sessão, sem depender de quem chama.
 *
 * Limite conhecido: escritas aninhadas (`create: { relacao: { create } }`) não
 * passam por aqui; crie registros relacionados com chamadas separadas.
 */
export const MODELOS_COM_TENANT: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "tenantId"))
    .map((m) => m.name),
);

type Args = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
};

export class ViolacaoTenantError extends Error {
  constructor(model: string, tenantInformado: unknown) {
    super(`Tentativa de gravar ${model} com tenantId ${String(tenantInformado)} fora do tenant da sessão`);
    this.name = "ViolacaoTenantError";
  }
}

function comTenantNoDado(model: string, tenantId: string, data: unknown) {
  const registro = (data ?? {}) as Record<string, unknown>;
  if ("tenantId" in registro && registro.tenantId !== tenantId) {
    throw new ViolacaoTenantError(model, registro.tenantId);
  }
  if ("tenant" in registro) {
    // `tenant: { connect }` permitiria apontar para outro tenant.
    throw new ViolacaoTenantError(model, "relação tenant");
  }
  return { ...registro, tenantId };
}

export function escoparArgs(
  model: string,
  operation: string,
  args: Args | undefined,
  tenantId: string,
): Args {
  const a: Args = { ...(args ?? {}) };
  switch (operation) {
    case "create":
      a.data = comTenantNoDado(model, tenantId, a.data);
      break;
    case "createMany":
    case "createManyAndReturn":
      a.data = Array.isArray(a.data)
        ? a.data.map((d) => comTenantNoDado(model, tenantId, d))
        : comTenantNoDado(model, tenantId, a.data);
      break;
    case "upsert":
      a.where = { ...(a.where ?? {}), tenantId };
      a.create = comTenantNoDado(model, tenantId, a.create);
      if (a.update && "tenantId" in (a.update as object)) {
        throw new ViolacaoTenantError(model, (a.update as Record<string, unknown>).tenantId);
      }
      break;
    case "update":
    case "updateMany":
    case "updateManyAndReturn":
      if (a.data && typeof a.data === "object" && ("tenantId" in a.data || "tenant" in a.data)) {
        throw new ViolacaoTenantError(model, (a.data as Record<string, unknown>).tenantId);
      }
      a.where = { ...(a.where ?? {}), tenantId };
      break;
    default:
      // find*, count, aggregate, groupBy, delete, deleteMany
      a.where = { ...(a.where ?? {}), tenantId };
  }
  return a;
}

export function dbDoTenant(tenantId: string, client: PrismaClient = prisma) {
  if (!tenantId) throw new Error("dbDoTenant exige um tenantId");
  return client.$extends({
    name: "isolamento-tenant",
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!MODELOS_COM_TENANT.has(model)) return query(args);
          return query(escoparArgs(model, operation, args as Args, tenantId) as typeof args);
        },
      },
    },
  });
}

export type DbDoTenant = ReturnType<typeof dbDoTenant>;

type Funcao<T> = Extract<T, (...args: never[]) => unknown>;
/** Client de uma transação interativa aberta com `dbDoTenant(...).$transaction`. */
export type TxDoTenant = Parameters<Funcao<Parameters<DbDoTenant["$transaction"]>[0]>>[0];
