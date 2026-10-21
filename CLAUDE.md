# CLAUDE.md — Instruções mestras para construir o SinalPlus

Este arquivo é o ponto de entrada para o Claude Code. Leia-o primeiro;
ele referencia os demais documentos deste pacote, que devem ser lidos
nesta ordem antes de qualquer código ser escrito (todos ficam em `docs/`):

1. `docs/01-FUNDACAO-PRODUTO.md` — o quê e por quê (regras de negócio, personas,
   fluxos, regras de pontuação, white-label e integrações IXC/SGP).
2. `docs/02-ARQUITETURA-STACK.md` — com quê construir (stack, estrutura de pastas,
   multi-tenancy, RBAC, conectores de ERP).
3. `docs/03-MODELO-DADOS.md` — modelo de dados (vira `prisma/schema.prisma`).
4. `docs/04-DEPLOY-DEBIAN.md` — como colocar em produção em um servidor Debian.
5. `docs/REFERENCIA-IXC-SGP.md` — o que já se sabe das APIs do IXC e do SGP
   (leitura obrigatória antes da Fase 2).

## Projeto

**Nome do produto:** SinalPlus Telecom (código e identificadores técnicos
continuam como `sinalplus`) — SaaS de gamificação para provedores de
internet, começando pela bonificação de colaboradores por feedback de
pós-venda (escala de "sinal de Wi-Fi" de 1 a 5, pontos, níveis, selos e
resgate de prêmios com foto). **White-label desde o MVP**: cada provedor
(tenant) tem sua própria marca, e a integração com os sistemas de gestão
**IXC** e **SGP** (para sincronizar colaboradores automaticamente, essencial
em contas grandes) é uma prioridade do produto, não um extra de fase
avançada.

## Convenções de engenharia

- **Stack**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui +
  Prisma + PostgreSQL + Redis/BullMQ + PM2 + Nginx (ou Caddy para domínios
  customizados), conforme `docs/02-ARQUITETURA-STACK.md`. Não trocar de stack sem
  justificar.
- **Multi-tenant por `tenant_id`** em todas as tabelas de negócio — nunca
  escrever uma query que não filtre por tenant da sessão autenticada.
- **White-label desde o schema**: o modelo de `Tenant` já nasce com campos de
  marca (`nomeExibicao`, `logoUrl`, `faviconUrl`, `corPrimaria`,
  `corSecundaria`, `dominioCustomizado`) — nunca hardcode nome, cor ou logo
  da plataforma em componentes de UI voltados ao colaborador/cliente final.
- **Conectores de ERP plugáveis**: IXC e SGP implementam a mesma interface
  `ConectorERP` (`src/lib/erp-connectors/`). Adicionar um novo sistema no
  futuro não deve exigir alterar o motor de pontuação ou o restante do
  produto.
- **Ledger imutável de pontos**: nunca fazer `UPDATE` em saldo de pontos;
  sempre inserir uma nova linha em `TransacaoPontos` e calcular o saldo por
  agregação (ver seção 4 de `docs/03-MODELO-DADOS.md`).
- **Idempotência** em qualquer importação externa — consulta periódica ou
  webhook (usar `origemExternaId` para atendimentos e `idExternoERP` para
  colaboradores e clientes, todos únicos por tenant).
- **Saldo com piso em zero no débito**: uma avaliação negativa nunca debita
  além do saldo; o valor bruto da regra fica em `pontosCalculados`. Créditos
  ficam pendentes até `disponivelEm` (ver seção 4 de
  `docs/03-MODELO-DADOS.md`).
- **Credenciais de terceiros** (tokens de IXC/SGP) sempre criptografadas em
  repouso — nunca em texto puro no banco ou em log.
- Commits pequenos e objetivos; preferir Server Actions do Next.js para
  mutações simples e Route Handlers (`/api/...`) para integrações externas
  (webhooks, APIs públicas).
- Testes automatizados pelo menos para: motor de pontuação
  (`lib/pontuacao.ts`), isolamento multi-tenant, *upsert* idempotente de
  colaboradores sincronizados via ERP, e fluxo de resgate (evitar resgatar
  prêmio sem saldo/estoque suficiente).
- Internacionalização: a aplicação é em **português do Brasil** — textos de
  UI, nomes de variáveis de domínio e mensagens de commit podem ser em
  português; nomes de arquivos/código técnico podem ficar em inglês quando
  for mais natural (ex.: `Order`, `Webhook`), mas os termos de negócio
  (Tenant, Avaliação, Resgate) devem manter os nomes já definidos em
  `docs/03-MODELO-DADOS.md` para rastreabilidade entre os documentos.

## Ordem de implementação sugerida (roadmap de fases)

### Fase 0 — Fundação técnica (já com white-label no schema)
- [x] Inicializar projeto Next.js 15 + TypeScript + Tailwind + shadcn/ui.
- [x] Configurar Prisma + conexão com Postgres local (dev).
- [x] Modelar `schema.prisma` a partir de `docs/03-MODELO-DADOS.md` (incluindo já
      os campos de branding do `Tenant` e a entidade `IntegracaoERP`) e
      rodar a primeira migration.
- [x] Configurar Auth.js com login de e-mail/senha e middleware de RBAC
      (`SUPER_ADMIN`, `ADMIN_PROVEDOR`, `GESTOR`, `COLABORADOR`).
- [x] Middleware de resolução de tenant por subdomínio **e** por domínio
      customizado (`dominioCustomizado`), já lendo logo/cores/nome de
      exibição para injetar no layout.

> **Decisões tomadas na Fase 0** (valem para as próximas fases):
> - `SUPER_ADMIN` é o único `Usuario` com `tenantId` nulo (CHECK no banco) e só
>   faz login no domínio da plataforma; o e-mail é único por tenant, então o
>   login descobre o tenant pelo domínio acessado.
> - Dados de negócio são lidos e gravados via `dbDoTenant(tenantId)`
>   (`src/lib/tenant-db.ts`) ou `exigirSessaoDeTenant()` (`src/lib/sessao.ts`),
>   nunca com o client Prisma cru. Escritas aninhadas não são escopadas: crie
>   registros relacionados em chamadas separadas.
> - O ledger `TransacaoPontos` é protegido por trigger contra `UPDATE`/`DELETE`.
> - Prisma fixado na linha 6 e Auth.js em `5.0.0-beta.32` (versão exata).
>
> **Decisões da revisão de coerência (out/2026)**, já refletidas nos docs e
> no schema (migration `revisao_coerencia`):
> - Configurações do motor por tenant em `ConfiguracaoPontuacao`
>   (`diasPendencia`, `limiteDiario`, `limiteSemanal`, `nivelRisco`,
>   `prazoContatoHoras`).
> - O link de avaliação é um `ConvitePesquisa` (token só como hash, com
>   expiração); a `Avaliacao` só nasce quando o cliente responde e guarda
>   sinais antifraude.
> - Colaborador sem senha entra por `ConviteAcesso` (primeiro acesso).
> - Contestação de avaliação (`ContestacaoAvaliacao`) com estorno via
>   `AJUSTE_MANUAL`, que exige `motivo` (CHECK no banco).
> - Na Fase 2, a consulta periódica é o caminho principal; webhook é opcional.

### Fase 1 — Núcleo de negócio (MVP)
- [x] CRUD de `Tenant` (via Super Admin), incluindo campos de marca, e
      onboarding básico de um provedor, já copiando o template padrão de
      regras, níveis, selos e `ConfiguracaoPontuacao`.
- [x] Script para criar o primeiro `SUPER_ADMIN` de produção com senha
      própria (o seed é só para desenvolvimento).
- [x] Tela de branding para o Admin do Provedor (upload de logo, escolha de
      cores, nome de exibição).
- [x] CRUD de `Usuario`/`Equipe` dentro de um tenant (Admin do Provedor),
      com cadastro manual funcionando desde já (independente da integração
      de ERP da Fase 2), respeitando os limites do plano.
- [x] Importação de colaboradores por planilha (CSV), com *upsert* por
      e-mail ou `idExternoERP` — garantia para provedores sem integração.
- [x] Convite de primeiro acesso (`ConviteAcesso`) para colaboradores sem
      senha.
- [x] CRUD de `RegraPontuacao` e tela de `ConfiguracaoPontuacao` por tenant.
- [x] Criação de `Atendimento` (manual, via formulário admin, para o MVP
      funcionar sem integração externa ainda).
- [x] Geração do `ConvitePesquisa` (link com token e expiração) e página
      pública `/avaliar/[token]` com a UI de "sinal de Wi-Fi" (1 a 5
      barras), já usando o branding do tenant, registrando os sinais
      antifraude e com opção "não quero mais receber pesquisas".
- [x] Motor de pontuação (`lib/pontuacao.ts`): calcular e gravar
      `TransacaoPontos` ao receber uma `Avaliacao`, com pendência, limites,
      piso no débito e avaliação suspeita indo para revisão.
- [x] Abertura automática de `CasoRecuperacao` para notas baixas.
- [x] Contestação de avaliação pelo colaborador e decisão do gestor.
- [x] Painel do colaborador: saldo disponível e pendente, extrato, nível
      atual, selos.
- [x] Ranking por equipe/tenant/período.
- [x] Relatório de satisfação (CSAT) para o provedor: média de sinal e taxa
      de resposta por tipo de atendimento, equipe e período.

> **Decisões tomadas na Fase 1**:
> - Mutações de tela usam Server Actions que voltam com `?ok=`/`?erro=`
>   (`src/lib/acoes.ts`). O host vem de `hostDaRequisicao` (X-Forwarded-Host
>   primeiro): depois de um `redirect()` em Server Action o Next renderiza o
>   destino com um fetch interno que perde o `Host`. O Nginx precisa sobrescrever
>   `X-Forwarded-Host` (docs/04).
> - Regras de pontuação são versionadas (`ativaAte` na antiga + nova linha).
> - A resposta "rápida demais" só marca suspeita em convite automático; no
>   registro manual quem envia o link é o admin.
> - Avaliação suspeita não pode ser contestada antes da revisão do gestor.
> - Uploads ficam em `UPLOADS_DIR`; o tipo é checado pelos bytes e SVG é recusado.

### Fase 2 — Conectores de ERP: IXC e SGP (prioridade)
- [ ] Definir a interface `ConectorERP` (`src/lib/erp-connectors/types.ts`).
- [ ] Validar as APIs antes de codar: SGP no sandbox `demo.sgp.net.br` e
      IXC com acesso de teste de um provedor (ex.: GigaNetPe), confirmando
      autenticação, endpoint de O.S. concluídas e se existe endpoint de
      colaboradores (checklists em `docs/REFERENCIA-IXC-SGP.md`).
- [ ] Implementar `ixc.ts`: autenticação, `listarAtendimentosConcluidos`,
      `listarColaboradores` (se a API permitir) e `sincronizar`.
- [ ] Implementar `sgp.ts`: idem, para a API do SGP.
- [ ] Tela de configuração de `IntegracaoERP` para o Admin do Provedor
      (escolher sistema, informar credenciais, testar conexão).
- [ ] Worker BullMQ de sincronização periódica — caminho principal:
      importa O.S. concluídas como `Atendimento` (idempotente por
      `origemExternaId`) e faz *upsert* de `Usuario` por `idExternoERP`,
      nunca duplicando, desativando quem saiu do ERP sem apagar histórico
      de pontos.
- [ ] (Opcional, se o ERP oferecer) Endpoints de webhook `/api/webhooks/ixc`
      e `/api/webhooks/sgp` para criação de `Atendimento` em tempo real,
      com a mesma idempotência.

### Fase 3 — Prêmios e resgate
- [ ] CRUD de `Premio` com upload de múltiplas fotos (`sharp` para resize).
- [ ] Fluxo de `Resgate`: solicitar → aprovar (gestor/admin) → marcar como
      entregue, com baixa de estoque e débito em `TransacaoPontos`.
- [ ] Extrato completo de pontos por colaborador (créditos, débitos,
      resgates).

### Fase 4 — Notificações e automação
- [ ] Worker BullMQ para disparo assíncrono da pesquisa de satisfação
      (abstração `NotificadorWhatsApp` + fallback e-mail/SMS, remetente
      configurável por tenant).
- [ ] Notificação ao gestor quando um `CasoRecuperacao` é aberto.
- [ ] LGPD: link de descadastro em toda mensagem e anonimização de
      telefone/e-mail de clientes após o prazo de retenção.
- [ ] Campanhas de pontos (`CampanhaPontos`) com multiplicador temporário.

### Fase 5 — White-label avançado e comercialização nacional
- [ ] Onboarding self-service de novo tenant (sem depender de Nicholas
      configurar manualmente cada cliente).
- [ ] Verificação de domínio customizado (DNS) e automação de emissão de
      certificado HTTPS por domínio (avaliar Caddy, ver
      `docs/02-ARQUITETURA-STACK.md`).
- [ ] Painel do Super Admin: visão consolidada de todos os tenants, status
      de plano, uso.

### Fase 6 — Deploy
- [ ] Seguir `docs/04-DEPLOY-DEBIAN.md` para subir em produção.
- [ ] Configurar backups automáticos (Postgres + uploads).

## Respostas do usuário às pendências (21/10/2026)

- **Nome do produto**: SinalPlus Telecom. É o nome da plataforma
  (`PLATAFORMA_NOME`); cada tenant continua com seu próprio nome de exibição.
- **Domínio de produção**: um domínio do hub **Aplivora** (endereço exato a
  confirmar). Tenants ficam em `{slug}.<PLATAFORMA_DOMINIO>`; nada no código
  assume `sinalplus.com.br`.
- **E-mail**: Resend, usando a conta/domínio do Aplivora.
- **SMS**: KingSMS.
- **WhatsApp**: ainda sem API oficial. A abstração `NotificadorWhatsApp`
  entra na Fase 4 com e-mail/SMS como canais ativos; o WhatsApp fica
  plugável para quando houver provedor.
- **APIs de ERP**: o usuário gera os acessos de teste do IXC (via GigaNetPe)
  e do SGP seguindo a seção 6 de `docs/REFERENCIA-IXC-SGP.md`.

## O que ainda perguntar ao usuário (se não estiver claro)

- Endereço exato do domínio do Aplivora para a plataforma.
- Provedor oficial de WhatsApp, quando houver.

## Fora de escopo nesta primeira leva (ver seção 14 de `docs/01-FUNDACAO-PRODUTO.md`)

- Pagamento/folha de bônus em dinheiro.
- App mobile nativo (usar PWA).
- Conectores prontos para sistemas de gestão além de IXC e SGP (a
  arquitetura plugável deixa isso fácil de adicionar depois).
- Checkout/cobrança self-service automatizada.
