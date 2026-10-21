-- CreateEnum
CREATE TYPE "TipoConviteAcesso" AS ENUM ('PRIMEIRO_ACESSO', 'REDEFINIR_SENHA');

-- CreateEnum
CREATE TYPE "CanalPesquisa" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusContestacao" AS ENUM ('ABERTA', 'ACEITA', 'RECUSADA');

-- AlterEnum (renomeia preservando os selos existentes: o produto usa "sinal", não "estrela")
ALTER TYPE "CriterioSelo" RENAME VALUE 'SEQUENCIA_5_ESTRELAS' TO 'SEQUENCIA_SINAL_MAXIMO';

-- DropIndex
DROP INDEX "Avaliacao_tokenAcesso_key";

-- DropIndex
DROP INDEX "ClienteFinal_tenantId_idx";

-- AlterTable
ALTER TABLE "Avaliacao" DROP COLUMN "tokenAcesso",
ADD COLUMN     "conviteId" TEXT NOT NULL,
ADD COLUMN     "ipResposta" TEXT,
ADD COLUMN     "motivoSuspeita" TEXT,
ADD COLUMN     "suspeita" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userAgentResposta" TEXT;

-- AlterTable
ALTER TABLE "ClienteFinal" ADD COLUMN     "idExternoERP" TEXT,
ADD COLUMN     "naoPerturbe" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "naoPerturbeEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TransacaoPontos" ADD COLUMN     "disponivelEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "pontosCalculados" INTEGER;

-- Preenche pontosCalculados das transações já existentes. O trigger do ledger
-- é desligado só durante este preenchimento, dentro da transação da migration.
ALTER TABLE "TransacaoPontos" DISABLE TRIGGER "TransacaoPontos_imutavel";
UPDATE "TransacaoPontos" SET "pontosCalculados" = "pontos";
ALTER TABLE "TransacaoPontos" ENABLE TRIGGER "TransacaoPontos_imutavel";
ALTER TABLE "TransacaoPontos" ALTER COLUMN "pontosCalculados" SET NOT NULL;

-- CreateTable
CREATE TABLE "ConviteAcesso" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tipo" "TipoConviteAcesso" NOT NULL DEFAULT 'PRIMEIRO_ACESSO',
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConviteAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConvitePesquisa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "canal" "CanalPesquisa" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "respondidoEm" TIMESTAMP(3),

    CONSTRAINT "ConvitePesquisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestacaoAvaliacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "justificativa" TEXT NOT NULL,
    "status" "StatusContestacao" NOT NULL DEFAULT 'ABERTA',
    "decididaPorId" TEXT,
    "decisao" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididaEm" TIMESTAMP(3),

    CONSTRAINT "ContestacaoAvaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoPontuacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "diasPendencia" INTEGER NOT NULL DEFAULT 7,
    "limiteDiario" INTEGER,
    "limiteSemanal" INTEGER,
    "nivelRisco" INTEGER NOT NULL DEFAULT 2,
    "prazoContatoHoras" INTEGER NOT NULL DEFAULT 24,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracaoPontuacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConviteAcesso_tokenHash_key" ON "ConviteAcesso"("tokenHash");

-- CreateIndex
CREATE INDEX "ConviteAcesso_tenantId_usuarioId_idx" ON "ConviteAcesso"("tenantId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ConvitePesquisa_atendimentoId_key" ON "ConvitePesquisa"("atendimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "ConvitePesquisa_tokenHash_key" ON "ConvitePesquisa"("tokenHash");

-- CreateIndex
CREATE INDEX "ConvitePesquisa_tenantId_criadoEm_idx" ON "ConvitePesquisa"("tenantId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "ContestacaoAvaliacao_avaliacaoId_key" ON "ContestacaoAvaliacao"("avaliacaoId");

-- CreateIndex
CREATE INDEX "ContestacaoAvaliacao_tenantId_status_idx" ON "ContestacaoAvaliacao"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoPontuacao_tenantId_key" ON "ConfiguracaoPontuacao"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_conviteId_key" ON "Avaliacao"("conviteId");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteFinal_tenantId_idExternoERP_key" ON "ClienteFinal"("tenantId", "idExternoERP");

-- CreateIndex
CREATE INDEX "TransacaoPontos_tenantId_colaboradorId_disponivelEm_idx" ON "TransacaoPontos"("tenantId", "colaboradorId", "disponivelEm");

-- AddForeignKey
ALTER TABLE "ConviteAcesso" ADD CONSTRAINT "ConviteAcesso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteAcesso" ADD CONSTRAINT "ConviteAcesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvitePesquisa" ADD CONSTRAINT "ConvitePesquisa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConvitePesquisa" ADD CONSTRAINT "ConvitePesquisa_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "Atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_conviteId_fkey" FOREIGN KEY ("conviteId") REFERENCES "ConvitePesquisa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestacaoAvaliacao" ADD CONSTRAINT "ContestacaoAvaliacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestacaoAvaliacao" ADD CONSTRAINT "ContestacaoAvaliacao_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestacaoAvaliacao" ADD CONSTRAINT "ContestacaoAvaliacao_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestacaoAvaliacao" ADD CONSTRAINT "ContestacaoAvaliacao_decididaPorId_fkey" FOREIGN KEY ("decididaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfiguracaoPontuacao" ADD CONSTRAINT "ConfiguracaoPontuacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Restrições que o Prisma não expressa ───────────────────────────────────

-- Auditoria: ajuste manual sempre tem motivo. NOT VALID porque linhas antigas
-- do ledger não podem ser corrigidas (são imutáveis); vale para toda linha nova.
ALTER TABLE "TransacaoPontos" ADD CONSTRAINT "TransacaoPontos_motivo_ajuste_check"
  CHECK ("tipo" <> 'AJUSTE_MANUAL' OR length(trim(coalesce("motivo", ''))) > 0) NOT VALID;

ALTER TABLE "ConfiguracaoPontuacao" ADD CONSTRAINT "ConfiguracaoPontuacao_valores_check" CHECK (
  "nivelRisco" BETWEEN 1 AND 5
  AND "diasPendencia" >= 0
  AND "prazoContatoHoras" > 0
  AND ("limiteDiario" IS NULL OR "limiteDiario" > 0)
  AND ("limiteSemanal" IS NULL OR "limiteSemanal" > 0)
);
