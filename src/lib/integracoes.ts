import { z } from "zod";
import { cifrar } from "./crypto";
import {
  conectorDaIntegracao,
  credenciaisIxcSchema,
  credenciaisSgpSchema,
  ErroConectorERP,
} from "./erp-connectors";
import { normalizarUrlBase } from "./erp-connectors/http";
import { sincronizarIntegracao, type ResultadoSincronizacao } from "./sincronizacao";
import type { DbDoTenant } from "./tenant-db";

/** Configuração da `IntegracaoERP` do tenant (uma por sistema). */

export const integracaoSchema = z.object({
  sistema: z.enum(["IXC", "SGP"]),
  urlBase: z.string().trim().min(1, "Informe o endereço do sistema.").max(300),
  frequenciaSincronizacao: z.coerce.number().int().min(15, "Mínimo de 15 minutos.").max(1440),
  ativa: z.boolean(),
});

/** Credenciais vêm do formulário; em branco = manter as já gravadas. */
export function lerCredenciais(sistema: "IXC" | "SGP", f: Record<string, string>) {
  const preenchido = Object.values(f).some((v) => v.trim() !== "");
  if (!preenchido) return null;
  return sistema === "IXC"
    ? credenciaisIxcSchema.parse({ token: f.token })
    : credenciaisSgpSchema.parse({ token: f.token, app: f.app });
}

export async function salvarIntegracao(
  db: DbDoTenant,
  tenantId: string,
  dados: z.infer<typeof integracaoSchema>,
  credenciais: unknown | null,
) {
  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { plano: { select: { permiteIntegracaoERP: true } } },
  });
  if (!tenant.plano.permiteIntegracaoERP) throw new Error("O plano do provedor não inclui integração com ERP.");
  const urlBase = normalizarUrlBase(dados.urlBase);
  const existente = await db.integracaoERP.findFirst({ where: { sistema: dados.sistema } });
  if (!existente && !credenciais) throw new Error("Informe as credenciais de acesso.");
  const campos = {
    urlBase,
    ativa: dados.ativa,
    frequenciaSincronizacao: dados.frequenciaSincronizacao,
    ...(credenciais ? { credenciais: cifrar(JSON.stringify(credenciais)) } : {}),
  };
  if (existente) return db.integracaoERP.update({ where: { id: existente.id }, data: campos });
  return db.integracaoERP.create({
    data: { tenantId, sistema: dados.sistema, ...campos, credenciais: cifrar(JSON.stringify(credenciais)) },
  });
}

async function carregar(db: DbDoTenant, id: string) {
  const integracao = await db.integracaoERP.findFirst({ where: { id } });
  if (!integracao) throw new Error("Integração não encontrada.");
  return integracao;
}

export async function testarIntegracao(db: DbDoTenant, id: string) {
  await conectorDaIntegracao(await carregar(db, id)).testarConexao();
}

/** Sincronização imediata (botão do admin); o worker chama o mesmo caminho. */
export async function sincronizarAgora(db: DbDoTenant, tenantId: string, id: string): Promise<ResultadoSincronizacao> {
  const integracao = await carregar(db, id);
  return sincronizarIntegracao(db, tenantId, integracao, conectorDaIntegracao(integracao));
}

export { ErroConectorERP };
