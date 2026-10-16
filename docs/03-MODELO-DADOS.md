# Modelo de Dados

> Referência: `01-FUNDACAO-PRODUTO.md` (regras) e `02-ARQUITETURA-STACK.md`
> (Postgres + Prisma, multi-tenant por `tenant_id`). Este documento descreve
> as entidades; o Claude Code deve traduzir isto em `prisma/schema.prisma`.

## 1. Visão geral das entidades

```
Tenant (provedor — já carrega branding white-label e domínio customizado)
 ├─ Plano
 ├─ IntegracaoERP (config. de conexão com IXC ou SGP)
 ├─ Usuario (role: ADMIN_PROVEDOR | GESTOR | COLABORADOR; pode ter origem = IXC/SGP)
 │    └─ Equipe / Filial
 ├─ ClienteFinal
 ├─ Atendimento (ligado a Usuario responsável + ClienteFinal)
 │    └─ Avaliacao (1 avaliação por atendimento)
 │         └─ TransacaoPontos (0 ou 1, gerada pela avaliação)
 ├─ RegraPontuacao (configuração ativa do tenant)
 ├─ CampanhaPontos (multiplicadores temporários)
 ├─ CasoRecuperacao (aberto quando avaliação é baixa)
 ├─ Premio
 │    └─ Resgate (ligado a Usuario + Premio)
 ├─ Nivel / Selo (conquistas do colaborador)
 └─ TransacaoPontos (extrato: créditos e débitos do colaborador)
```

## 2. Entidades detalhadas

### Tenant
- `id`, `nome` (razão social/interna), `slug` (subdomínio), `planoId`,
  `status` (ativo/suspenso), `criadoEm`.
- **Campos de white-label (desde o MVP, não adicionados depois)**:
  `nomeExibicao` (nome comercial mostrado ao colaborador/cliente — pode ser
  diferente do nome interno), `logoUrl`, `faviconUrl`, `corPrimaria`,
  `corSecundaria`, `dominioCustomizado` (nullable, ex.:
  `pontos.giganetpe.com.br`), `dominioVerificado` (bool), `emailRemetente`
  (nullable — remetente das notificações com a marca do provedor).

### Plano
- `id`, `nome` (Starter/Pro/Enterprise), `limiteColaboradores`,
  `limiteFiliais`, `permiteDominioCustomizado` (bool),
  `permiteIntegracaoERP` (bool), `recursos` (JSON de feature flags).

### IntegracaoERP
- `id`, `tenantId`, `sistema` (`IXC | SGP`), `urlBase`, `credenciais`
  (armazenadas criptografadas — token/usuário+senha conforme o sistema),
  `ativa` (bool), `frequenciaSincronizacao` (ex.: a cada 60 min),
  `ultimaSincronizacaoEm`, `ultimoStatusSincronizacao`
  (`SUCESSO | ERRO | NUNCA_EXECUTADA`).
- Um tenant tem no máximo uma `IntegracaoERP` ativa por sistema; usada pelo
  conector plugável descrito em `02-ARQUITETURA-STACK.md` (seção 7).

### Usuario
- `id`, `tenantId`, `nome`, `email`, `senhaHash` (nullable — colaborador
  sincronizado via ERP pode nunca precisar logar com senha própria, se o
  acesso dele for apenas visualizar pontos via link), `role`
  (`SUPER_ADMIN | ADMIN_PROVEDOR | GESTOR | COLABORADOR`), `equipeId`
  (nullable), `avatarUrl`, `ativo`, `criadoEm`.
- **Campos de sincronização com ERP**: `origemCadastro`
  (`MANUAL | IXC | SGP`), `idExternoERP` (nullable — id do colaborador no
  IXC/SGP, usado para *upsert* idempotente), `sincronizadoEm` (nullable).

### Equipe (filial/time)
- `id`, `tenantId`, `nome` (ex.: "Paulista", "Abreu e Lima"), `gestorId`.

### ClienteFinal
- `id`, `tenantId`, `nome`, `telefone`, `email`, `criadoEm`.
- Dado mínimo necessário só para disparar e identificar a pesquisa — não é
  um "usuário" do sistema (sem login).

### Atendimento
- `id`, `tenantId`, `tipo` (`INSTALACAO | SUPORTE | VENDA | RENEGOCIACAO`),
  `colaboradorId` (Usuario responsável), `clienteFinalId`,
  `origemExternaId` (id do chamado/O.S. no ERP do provedor, para
  idempotência), `status` (`CONCLUIDO`), `concluidoEm`.

### Avaliacao
- `id`, `tenantId`, `atendimentoId` (único — 1 avaliação por atendimento),
  `nivelSinal` (1 a 5), `comentario` (nullable), `tokenAcesso` (link
  assinado consumido), `respondidaEm`.

### RegraPontuacao
- `id`, `tenantId`, `nivelSinal` (1-5), `pontos` (pode ser negativo),
  `ativaDesde`, `ativaAte` (nullable — permite versionar regras no tempo).

### CampanhaPontos
- `id`, `tenantId`, `nome`, `multiplicador` (ex.: 2.0), `inicio`, `fim`,
  `equipeId` (nullable, se for só para um time).

### TransacaoPontos
- `id`, `tenantId`, `colaboradorId`, `tipo`
  (`CREDITO_AVALIACAO | DEBITO_AVALIACAO | RESGATE | AJUSTE_MANUAL`),
  `pontos` (delta, positivo ou negativo), `origemAvaliacaoId` (nullable),
  `origemResgateId` (nullable), `criadoEm`, `criadoPorId` (para ajustes
  manuais de admin, sempre auditado).
- **Nunca editar/apagar** — saldo do colaborador é sempre a soma das
  transações (ledger imutável).

### CasoRecuperacao
- `id`, `tenantId`, `avaliacaoId`, `gestorResponsavelId`, `status`
  (`ABERTO | EM_ANDAMENTO | RESOLVIDO`), `prazoContato`, `acaoTomada`
  (texto), `resolvidoEm`.

### Nivel (catálogo de níveis do tenant)
- `id`, `tenantId`, `nome` (ex.: "Sinal Forte"), `pontosAcumuladosMinimo`,
  `icone`/`cor`.

### Selo (badge)
- `id`, `tenantId`, `nome`, `descricao`, `icone`, `criterioTipo` (enum:
  `SEQUENCIA_5_ESTRELAS | ZERO_RECLAMACOES_MES | PRIMEIRO_RESGATE | CUSTOM`).

### SeloConquistado
- `id`, `tenantId`, `colaboradorId`, `seloId`, `conquistadoEm`.

### Premio
- `id`, `tenantId`, `nome`, `descricao`, `custoPontos`, `categoria`,
  `estoque`, `ativo`, `fotos` (relação com `PremioFoto`).

### PremioFoto
- `id`, `premioId`, `url`, `ordem`.

### Resgate
- `id`, `tenantId`, `colaboradorId`, `premioId`, `pontosDebitados`,
  `status` (`SOLICITADO | APROVADO | ENTREGUE | NEGADO`), `aprovadoPorId`,
  `solicitadoEm`, `entregueEm`, `fotoComprovacaoUrl` (nullable).

## 3. Índices e restrições importantes

- `Usuario`: índice único composto `(tenantId, email)` (quando `email` não
  for nulo) e índice único composto `(tenantId, idExternoERP)` (quando
  `idExternoERP` não for nulo) para garantir *upsert* idempotente na
  sincronização com IXC/SGP.
- `Tenant`: índice único em `slug` e índice único em `dominioCustomizado`
  (quando não nulo) — resolução de tenant por domínio (ver
  `02-ARQUITETURA-STACK.md`, seção 4) depende desses dois.
- `Atendimento`: índice único composto `(tenantId, origemExternaId)` para
  garantir idempotência de webhooks externos.
- `Avaliacao`: índice único em `atendimentoId` (1 avaliação por atendimento).
- `TransacaoPontos`: índice em `(tenantId, colaboradorId, criadoEm)` para
  cálculo rápido de saldo e extrato.
- Todas as FKs de negócio incluem `tenantId` redundante na própria tabela
  (mesmo quando derivável via relação) para simplificar índices de
  isolamento e queries diretas por tenant.

## 4. Cálculo de saldo (view ou query, não campo fixo)

`saldoPontos(colaboradorId)` = soma de todos os `pontos` em
`TransacaoPontos` daquele colaborador, com piso em zero **apenas na
exibição** (o histórico bruto pode ficar negativo para fins de relatório,
mas o saldo "gastável" nunca é menor que zero).

`pontosAcumuladosHistorico(colaboradorId)` = soma apenas dos créditos
positivos de `TransacaoPontos` (usada para definir `Nivel`, que não deve
cair quando o colaborador gasta pontos em um resgate).
