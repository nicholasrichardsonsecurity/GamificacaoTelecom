-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_PROVEDOR', 'GESTOR', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "StatusTenant" AS ENUM ('ATIVO', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "SistemaERP" AS ENUM ('IXC', 'SGP');

-- CreateEnum
CREATE TYPE "OrigemCadastro" AS ENUM ('MANUAL', 'IXC', 'SGP');

-- CreateEnum
CREATE TYPE "StatusSincronizacao" AS ENUM ('SUCESSO', 'ERRO', 'NUNCA_EXECUTADA');

-- CreateEnum
CREATE TYPE "TipoAtendimento" AS ENUM ('INSTALACAO', 'SUPORTE', 'VENDA', 'RENEGOCIACAO');

-- CreateEnum
CREATE TYPE "StatusAtendimento" AS ENUM ('CONCLUIDO');

-- CreateEnum
CREATE TYPE "TipoTransacao" AS ENUM ('CREDITO_AVALIACAO', 'DEBITO_AVALIACAO', 'RESGATE', 'AJUSTE_MANUAL');

-- CreateEnum
CREATE TYPE "StatusCaso" AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO');

-- CreateEnum
CREATE TYPE "CriterioSelo" AS ENUM ('SEQUENCIA_5_ESTRELAS', 'ZERO_RECLAMACOES_MES', 'PRIMEIRO_RESGATE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StatusResgate" AS ENUM ('SOLICITADO', 'APROVADO', 'ENTREGUE', 'NEGADO');

-- CreateTable
CREATE TABLE "Plano" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "limiteColaboradores" INTEGER,
    "limiteFiliais" INTEGER,
    "permiteDominioCustomizado" BOOLEAN NOT NULL DEFAULT false,
    "permiteIntegracaoERP" BOOLEAN NOT NULL DEFAULT false,
    "recursos" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "status" "StatusTenant" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nomeExibicao" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "corPrimaria" TEXT NOT NULL DEFAULT '#16a34a',
    "corSecundaria" TEXT NOT NULL DEFAULT '#0f172a',
    "dominioCustomizado" TEXT,
    "dominioVerificado" BOOLEAN NOT NULL DEFAULT false,
    "emailRemetente" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegracaoERP" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sistema" "SistemaERP" NOT NULL,
    "urlBase" TEXT NOT NULL,
    "credenciais" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "frequenciaSincronizacao" INTEGER NOT NULL DEFAULT 60,
    "ultimaSincronizacaoEm" TIMESTAMP(3),
    "ultimoStatusSincronizacao" "StatusSincronizacao" NOT NULL DEFAULT 'NUNCA_EXECUTADA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegracaoERP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "senhaHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'COLABORADOR',
    "equipeId" TEXT,
    "avatarUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origemCadastro" "OrigemCadastro" NOT NULL DEFAULT 'MANUAL',
    "idExternoERP" TEXT,
    "sincronizadoEm" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipe" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "gestorId" TEXT,

    CONSTRAINT "Equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteFinal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteFinal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atendimento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoAtendimento" NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "clienteFinalId" TEXT NOT NULL,
    "origemExternaId" TEXT,
    "status" "StatusAtendimento" NOT NULL DEFAULT 'CONCLUIDO',
    "concluidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "atendimentoId" TEXT NOT NULL,
    "nivelSinal" INTEGER NOT NULL,
    "comentario" TEXT,
    "tokenAcesso" TEXT NOT NULL,
    "respondidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegraPontuacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nivelSinal" INTEGER NOT NULL,
    "pontos" INTEGER NOT NULL,
    "ativaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativaAte" TIMESTAMP(3),

    CONSTRAINT "RegraPontuacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampanhaPontos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "multiplicador" DECIMAL(5,2) NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "equipeId" TEXT,

    CONSTRAINT "CampanhaPontos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransacaoPontos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" "TipoTransacao" NOT NULL,
    "pontos" INTEGER NOT NULL,
    "origemAvaliacaoId" TEXT,
    "origemResgateId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" TEXT,

    CONSTRAINT "TransacaoPontos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasoRecuperacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "gestorResponsavelId" TEXT,
    "status" "StatusCaso" NOT NULL DEFAULT 'ABERTO',
    "prazoContato" TIMESTAMP(3) NOT NULL,
    "acaoTomada" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" TIMESTAMP(3),

    CONSTRAINT "CasoRecuperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nivel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "pontosAcumuladosMinimo" INTEGER NOT NULL,
    "icone" TEXT,
    "cor" TEXT,

    CONSTRAINT "Nivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Selo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "icone" TEXT,
    "criterioTipo" "CriterioSelo" NOT NULL,

    CONSTRAINT "Selo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeloConquistado" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "seloId" TEXT NOT NULL,
    "conquistadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeloConquistado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Premio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "custoPontos" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "estoque" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Premio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremioFoto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "premioId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PremioFoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resgate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "premioId" TEXT NOT NULL,
    "pontosDebitados" INTEGER NOT NULL,
    "status" "StatusResgate" NOT NULL DEFAULT 'SOLICITADO',
    "aprovadoPorId" TEXT,
    "solicitadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregueEm" TIMESTAMP(3),
    "fotoComprovacaoUrl" TEXT,

    CONSTRAINT "Resgate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plano_nome_key" ON "Plano"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_dominioCustomizado_key" ON "Tenant"("dominioCustomizado");

-- CreateIndex
CREATE UNIQUE INDEX "IntegracaoERP_tenantId_sistema_key" ON "IntegracaoERP"("tenantId", "sistema");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_tenantId_email_key" ON "Usuario"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_tenantId_idExternoERP_key" ON "Usuario"("tenantId", "idExternoERP");

-- CreateIndex
CREATE UNIQUE INDEX "Equipe_tenantId_nome_key" ON "Equipe"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "ClienteFinal_tenantId_idx" ON "ClienteFinal"("tenantId");

-- CreateIndex
CREATE INDEX "Atendimento_tenantId_colaboradorId_idx" ON "Atendimento"("tenantId", "colaboradorId");

-- CreateIndex
CREATE UNIQUE INDEX "Atendimento_tenantId_origemExternaId_key" ON "Atendimento"("tenantId", "origemExternaId");

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_atendimentoId_key" ON "Avaliacao"("atendimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_tokenAcesso_key" ON "Avaliacao"("tokenAcesso");

-- CreateIndex
CREATE INDEX "Avaliacao_tenantId_respondidaEm_idx" ON "Avaliacao"("tenantId", "respondidaEm");

-- CreateIndex
CREATE INDEX "RegraPontuacao_tenantId_nivelSinal_ativaDesde_idx" ON "RegraPontuacao"("tenantId", "nivelSinal", "ativaDesde");

-- CreateIndex
CREATE INDEX "CampanhaPontos_tenantId_inicio_fim_idx" ON "CampanhaPontos"("tenantId", "inicio", "fim");

-- CreateIndex
CREATE UNIQUE INDEX "TransacaoPontos_origemAvaliacaoId_key" ON "TransacaoPontos"("origemAvaliacaoId");

-- CreateIndex
CREATE INDEX "TransacaoPontos_tenantId_colaboradorId_criadoEm_idx" ON "TransacaoPontos"("tenantId", "colaboradorId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "CasoRecuperacao_avaliacaoId_key" ON "CasoRecuperacao"("avaliacaoId");

-- CreateIndex
CREATE INDEX "CasoRecuperacao_tenantId_status_idx" ON "CasoRecuperacao"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Nivel_tenantId_pontosAcumuladosMinimo_key" ON "Nivel"("tenantId", "pontosAcumuladosMinimo");

-- CreateIndex
CREATE INDEX "SeloConquistado_tenantId_idx" ON "SeloConquistado"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SeloConquistado_colaboradorId_seloId_key" ON "SeloConquistado"("colaboradorId", "seloId");

-- CreateIndex
CREATE INDEX "Premio_tenantId_ativo_idx" ON "Premio"("tenantId", "ativo");

-- CreateIndex
CREATE INDEX "PremioFoto_premioId_ordem_idx" ON "PremioFoto"("premioId", "ordem");

-- CreateIndex
CREATE INDEX "Resgate_tenantId_status_idx" ON "Resgate"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Resgate_tenantId_colaboradorId_idx" ON "Resgate"("tenantId", "colaboradorId");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "Plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegracaoERP" ADD CONSTRAINT "IntegracaoERP_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipe" ADD CONSTRAINT "Equipe_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipe" ADD CONSTRAINT "Equipe_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteFinal" ADD CONSTRAINT "ClienteFinal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atendimento" ADD CONSTRAINT "Atendimento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atendimento" ADD CONSTRAINT "Atendimento_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atendimento" ADD CONSTRAINT "Atendimento_clienteFinalId_fkey" FOREIGN KEY ("clienteFinalId") REFERENCES "ClienteFinal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_atendimentoId_fkey" FOREIGN KEY ("atendimentoId") REFERENCES "Atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegraPontuacao" ADD CONSTRAINT "RegraPontuacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampanhaPontos" ADD CONSTRAINT "CampanhaPontos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampanhaPontos" ADD CONSTRAINT "CampanhaPontos_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoPontos" ADD CONSTRAINT "TransacaoPontos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoPontos" ADD CONSTRAINT "TransacaoPontos_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoPontos" ADD CONSTRAINT "TransacaoPontos_origemAvaliacaoId_fkey" FOREIGN KEY ("origemAvaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoPontos" ADD CONSTRAINT "TransacaoPontos_origemResgateId_fkey" FOREIGN KEY ("origemResgateId") REFERENCES "Resgate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoPontos" ADD CONSTRAINT "TransacaoPontos_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoRecuperacao" ADD CONSTRAINT "CasoRecuperacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoRecuperacao" ADD CONSTRAINT "CasoRecuperacao_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoRecuperacao" ADD CONSTRAINT "CasoRecuperacao_gestorResponsavelId_fkey" FOREIGN KEY ("gestorResponsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nivel" ADD CONSTRAINT "Nivel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selo" ADD CONSTRAINT "Selo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeloConquistado" ADD CONSTRAINT "SeloConquistado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeloConquistado" ADD CONSTRAINT "SeloConquistado_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeloConquistado" ADD CONSTRAINT "SeloConquistado_seloId_fkey" FOREIGN KEY ("seloId") REFERENCES "Selo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Premio" ADD CONSTRAINT "Premio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremioFoto" ADD CONSTRAINT "PremioFoto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremioFoto" ADD CONSTRAINT "PremioFoto_premioId_fkey" FOREIGN KEY ("premioId") REFERENCES "Premio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resgate" ADD CONSTRAINT "Resgate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resgate" ADD CONSTRAINT "Resgate_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resgate" ADD CONSTRAINT "Resgate_premioId_fkey" FOREIGN KEY ("premioId") REFERENCES "Premio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resgate" ADD CONSTRAINT "Resgate_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Restrições que o Prisma não expressa ───────────────────────────────────

-- Só o SUPER_ADMIN vive fora de um tenant.
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tenant_por_role_check"
  CHECK (("role" = 'SUPER_ADMIN') = ("tenantId" IS NULL));

-- E-mail único também entre os SUPER_ADMIN (tenantId nulo não colide no índice composto).
CREATE UNIQUE INDEX "Usuario_email_superadmin_key" ON "Usuario"("email") WHERE "tenantId" IS NULL;

-- Escala de sinal: 1 a 5 barras.
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_nivelSinal_check" CHECK ("nivelSinal" BETWEEN 1 AND 5);
ALTER TABLE "RegraPontuacao" ADD CONSTRAINT "RegraPontuacao_nivelSinal_check" CHECK ("nivelSinal" BETWEEN 1 AND 5);

-- Prêmios: custo positivo e estoque nunca negativo.
ALTER TABLE "Premio" ADD CONSTRAINT "Premio_custoPontos_check" CHECK ("custoPontos" > 0);
ALTER TABLE "Premio" ADD CONSTRAINT "Premio_estoque_check" CHECK ("estoque" >= 0);

ALTER TABLE "CampanhaPontos" ADD CONSTRAINT "CampanhaPontos_periodo_check" CHECK ("fim" > "inicio");
ALTER TABLE "CampanhaPontos" ADD CONSTRAINT "CampanhaPontos_multiplicador_check" CHECK ("multiplicador" > 0);

-- Ledger imutável: TransacaoPontos aceita apenas INSERT.
CREATE FUNCTION "transacao_pontos_imutavel"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TransacaoPontos é um ledger imutável: % não é permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TransacaoPontos_imutavel"
  BEFORE UPDATE OR DELETE ON "TransacaoPontos"
  FOR EACH ROW EXECUTE FUNCTION "transacao_pontos_imutavel"();
