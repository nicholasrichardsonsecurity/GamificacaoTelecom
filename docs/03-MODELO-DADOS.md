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
 │    └─ ConvitePesquisa (link enviado ao cliente, com expiração)
 │         └─ Avaliacao (criada quando o cliente responde; 1 por atendimento)
 │              ├─ TransacaoPontos (0 ou 1, gerada pela avaliação)
 │              └─ ContestacaoAvaliacao (0 ou 1, aberta pelo colaborador)
 ├─ ConfiguracaoPontuacao (limites, pendência, nível de risco, prazo — 1 por tenant)
 ├─ RegraPontuacao (pontos por nível de sinal, versionada no tempo)
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
- `id`, `tenantId` (nulo **apenas** para `SUPER_ADMIN`, garantido por CHECK
  no banco), `nome`, `email`, `senhaHash` (nullable — colaborador
  sincronizado via ERP ou cadastrado pelo admin começa sem senha e define a
  sua pelo convite de primeiro acesso, ver `ConviteAcesso`), `role`
  (`SUPER_ADMIN | ADMIN_PROVEDOR | GESTOR | COLABORADOR`), `equipeId`
  (nullable), `avatarUrl`, `ativo`, `criadoEm`.
- **Campos de sincronização com ERP**: `origemCadastro`
  (`MANUAL | IXC | SGP`), `idExternoERP` (nullable — id do colaborador no
  IXC/SGP, usado para *upsert* idempotente), `sincronizadoEm` (nullable).

### ConviteAcesso
- `id`, `tenantId`, `usuarioId`, `tokenHash` (só o hash do token vai para o
  banco; o token em si só existe no link enviado), `tipo`
  (`PRIMEIRO_ACESSO | REDEFINIR_SENHA`), `expiraEm`, `usadoEm` (nullable),
  `criadoEm`.
- Resolve o acesso de colaboradores que nunca tiveram senha (cadastro
  manual, importação por planilha ou sincronização com IXC/SGP).

### Equipe (filial/time)
- `id`, `tenantId`, `nome` (ex.: "Paulista", "Abreu e Lima"), `gestorId`.

### ClienteFinal
- `id`, `tenantId`, `nome`, `telefone`, `email`, `criadoEm`,
  `idExternoERP` (nullable, id do assinante no IXC/SGP), `naoPerturbe`
  (bool — o cliente pediu para não receber mais pesquisas; LGPD),
  `naoPerturbeEm` (nullable).
- Dado mínimo necessário só para disparar e identificar a pesquisa — não é
  um "usuário" do sistema (sem login).

### Atendimento
- `id`, `tenantId`, `tipo` (`INSTALACAO | SUPORTE | VENDA | RENEGOCIACAO`),
  `colaboradorId` (Usuario responsável), `clienteFinalId`,
  `origemExternaId` (id do chamado/O.S. no ERP do provedor, para
  idempotência), `status` (`CONCLUIDO`), `concluidoEm`.

### ConvitePesquisa
- `id`, `tenantId`, `atendimentoId` (único — 1 convite por atendimento),
  `tokenHash` (único; o token só existe no link enviado), `canal`
  (`WHATSAPP | SMS | EMAIL | MANUAL`), `criadoEm`, `enviadoEm` (nullable),
  `expiraEm`, `respondidoEm` (nullable).
- Existe antes da resposta do cliente — é ele que materializa o "link
  assinado com expiração". Também permite medir a taxa de resposta
  (convites enviados × respondidos).

### Avaliacao
- `id`, `tenantId`, `atendimentoId` (único — 1 avaliação por atendimento),
  `conviteId` (único), `nivelSinal` (1 a 5), `comentario` (nullable),
  `respondidaEm`.
- **Sinais antifraude** (registrados na resposta): `ipResposta`,
  `userAgentResposta`, `suspeita` (bool) e `motivoSuspeita` (nullable — ex.:
  resposta do mesmo IP/dispositivo de uma sessão do colaborador, ou
  respondida poucos segundos após o atendimento ser concluído, quando o
  convite foi enviado automaticamente). Avaliação
  suspeita não pontua automaticamente; vai para revisão do gestor.

### ConfiguracaoPontuacao (1 por tenant)
- `id`, `tenantId` (único), `diasPendencia` (padrão 7 — créditos ficam
  pendentes por esse período antes de virarem saldo gastável),
  `limiteDiario` (nullable), `limiteSemanal` (nullable) — teto de pontos
  **creditados** por colaborador no período, `nivelRisco` (padrão 2 — nota
  menor ou igual abre `CasoRecuperacao`), `prazoContatoHoras` (padrão 24),
  `atualizadoEm`.

### RegraPontuacao
- `id`, `tenantId`, `nivelSinal` (1-5), `pontos` (pode ser negativo),
  `ativaDesde`, `ativaAte` (nullable — permite versionar regras no tempo).

### CampanhaPontos
- `id`, `tenantId`, `nome`, `multiplicador` (ex.: 2.0), `inicio`, `fim`,
  `equipeId` (nullable, se for só para um time).

### TransacaoPontos
- `id`, `tenantId`, `colaboradorId`, `tipo`
  (`CREDITO_AVALIACAO | DEBITO_AVALIACAO | RESGATE | AJUSTE_MANUAL`),
  `pontos` (delta **efetivamente aplicado**, positivo ou negativo — já com
  limites e piso em zero, ver seção 4), `pontosCalculados` (delta bruto que
  a regra daria, para relatório), `disponivelEm` (a partir de quando o
  crédito vira saldo gastável; débitos são imediatos),
  `origemAvaliacaoId` (nullable), `origemResgateId` (nullable), `criadoEm`,
  `criadoPorId` (para ajustes manuais de admin), `motivo` (texto,
  **obrigatório** em `AJUSTE_MANUAL` — auditoria de "quem, quando e por
  quê").
- **Nunca editar/apagar** — saldo do colaborador é sempre a soma das
  transações (ledger imutável).

### ContestacaoAvaliacao
- `id`, `tenantId`, `avaliacaoId` (único), `colaboradorId`, `justificativa`,
  `status` (`ABERTA | ACEITA | RECUSADA`), `decididaPorId` (nullable),
  `decisao` (texto, nullable), `criadaEm`, `decididaEm` (nullable).
- O colaborador contesta uma nota que considera injusta; se o gestor aceitar,
  o estorno entra como `AJUSTE_MANUAL` com motivo apontando a contestação
  (o ledger continua imutável).

### CasoRecuperacao
- `id`, `tenantId`, `avaliacaoId`, `gestorResponsavelId`, `status`
  (`ABERTO | EM_ANDAMENTO | RESOLVIDO`), `prazoContato`, `acaoTomada`
  (texto), `resolvidoEm`.

### Nivel (catálogo de níveis do tenant)
- `id`, `tenantId`, `nome` (ex.: "Sinal Forte"), `pontosAcumuladosMinimo`,
  `icone`/`cor`.

### Selo (badge)
- `id`, `tenantId`, `nome`, `descricao`, `icone`, `criterioTipo` (enum:
  `SEQUENCIA_SINAL_MAXIMO | ZERO_RECLAMACOES_MES | PRIMEIRO_RESGATE | CUSTOM`).

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
  garantir idempotência da importação de O.S. (polling ou webhook).
- `ClienteFinal`: índice único composto `(tenantId, idExternoERP)`.
- `ConvitePesquisa` e `ConviteAcesso`: índice único em `tokenHash`.
- `Avaliacao`: índice único em `atendimentoId` (1 avaliação por atendimento).
- `TransacaoPontos`: índice em `(tenantId, colaboradorId, criadoEm)` para
  cálculo rápido de saldo e extrato.
- Todas as FKs de negócio incluem `tenantId` redundante na própria tabela
  (mesmo quando derivável via relação) para simplificar índices de
  isolamento e queries diretas por tenant.

## 4. Cálculo de saldo (view ou query, não campo fixo)

O saldo nunca é um campo gravado: é sempre a agregação de `TransacaoPontos`.

- `saldoTotal(colaboradorId)` = soma de todos os `pontos`.
- `saldoDisponivel(colaboradorId)` = soma dos `pontos` com
  `disponivelEm <= agora` (créditos ainda pendentes ficam de fora). É o
  valor usado para resgatar prêmios.
- `pontosAcumuladosHistorico(colaboradorId)` = soma apenas dos créditos
  positivos já disponíveis (usada para definir `Nivel`, que não deve cair
  quando o colaborador gasta pontos em um resgate).

**Piso em zero aplicado no débito, não na exibição.** Quando uma avaliação
negativa gera um débito maior que o `saldoTotal`, grava-se em `pontos` só o
que existe de saldo (o saldo nunca fica negativo) e em `pontosCalculados` o
débito cheio da regra, para relatório. Assim, um crédito posterior nunca é
"engolido" por uma dívida acumulada.

**Limites diário/semanal** valem para créditos: o crédito efetivo é cortado
para não passar do teto do período; `pontosCalculados` guarda o valor
original.
