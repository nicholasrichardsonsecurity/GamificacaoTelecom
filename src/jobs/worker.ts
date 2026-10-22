import { Queue, Worker } from "bullmq";
import { prisma } from "../lib/db";
import { sincronizarVencidas } from "../lib/sincronizacao-agendada";

/**
 * Worker BullMQ (processo separado: `npm run worker`, ver docs/04-DEPLOY-DEBIAN.md).
 * Um job repetível a cada 5 minutos varre as integrações vencidas.
 */
const FILA = "sinalplus-erp";
const INTERVALO_MS = 5 * 60_000;

const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const conexao = {
  host: url.hostname,
  port: Number(url.port || 6379),
  username: url.username || undefined,
  password: url.password ? decodeURIComponent(url.password) : undefined,
  maxRetriesPerRequest: null as null,
};

async function main() {
  const fila = new Queue(FILA, { connection: conexao });
  await fila.upsertJobScheduler("varrer-integracoes", { every: INTERVALO_MS }, { name: "varrer" });

  const worker = new Worker(
    FILA,
    async () => {
      const r = await sincronizarVencidas(prisma);
      if (r.executadas || r.falhas) console.log(`[erp] sincronizações: ${r.executadas} ok, ${r.falhas} com falha`);
    },
    { connection: conexao, concurrency: 1 },
  );
  worker.on("failed", (_job, erro) => console.error("[erp] varredura falhou:", erro.message));

  const parar = async () => {
    await worker.close();
    await fila.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", parar);
  process.on("SIGTERM", parar);
  console.log("[erp] worker de sincronização iniciado");
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
