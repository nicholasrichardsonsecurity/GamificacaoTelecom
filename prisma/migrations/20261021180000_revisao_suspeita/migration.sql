-- AlterTable
ALTER TABLE "Avaliacao" ADD COLUMN     "revisadaEm" TIMESTAMP(3),
ADD COLUMN     "revisadaPorId" TEXT,
ADD COLUMN     "suspeitaAceita" BOOLEAN;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_revisadaPorId_fkey" FOREIGN KEY ("revisadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

