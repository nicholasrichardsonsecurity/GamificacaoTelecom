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

## Projeto

**Nome provisório:** SinalPlus — SaaS de gamificação para provedores de
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
- **Idempotência** em qualquer endpoint de webhook externo (usar
  `origemExternaId` para atendimentos e `idExternoERP` para colaboradores,
  ambos únicos por tenant).
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
- [ ] Inicializar projeto Next.js 15 + TypeScript + Tailwind + shadcn/ui.
- [ ] Configurar Prisma + conexão com Postgres local (dev).
- [ ] Modelar `schema.prisma` a partir de `docs/03-MODELO-DADOS.md` (incluindo já
      os campos de branding do `Tenant` e a entidade `IntegracaoERP`) e
      rodar a primeira migration.
- [ ] Configurar Auth.js com login de e-mail/senha e middleware de RBAC
      (`SUPER_ADMIN`, `ADMIN_PROVEDOR`, `GESTOR`, `COLABORADOR`).
- [ ] Middleware de resolução de tenant por subdomínio **e** por domínio
      customizado (`dominioCustomizado`), já lendo logo/cores/nome de
      exibição para injetar no layout.

### Fase 1 — Núcleo de negócio (MVP)
- [ ] CRUD de `Tenant` (via Super Admin), incluindo campos de marca, e
      onboarding básico de um provedor.
- [ ] Tela de branding para o Admin do Provedor (upload de logo, escolha de
      cores, nome de exibição).
- [ ] CRUD de `Usuario`/`Equipe` dentro de um tenant (Admin do Provedor),
      com cadastro manual funcionando desde já (independente da integração
      de ERP da Fase 2).
- [ ] CRUD de `RegraPontuacao` configurável por tenant.
- [ ] Criação de `Atendimento` (manual, via formulário admin, para o MVP
      funcionar sem integração externa ainda).
- [ ] Geração de link assinado de avaliação (`tokenAcesso`) e página pública
      `/avaliar/[token]` com a UI de "sinal de Wi-Fi" (1 a 5 barras), já
      usando o branding do tenant.
- [ ] Motor de pontuação (`lib/pontuacao.ts`): calcular e gravar
      `TransacaoPontos` ao receber uma `Avaliacao`.
- [ ] Abertura automática de `CasoRecuperacao` para notas baixas.
- [ ] Painel do colaborador: saldo de pontos, extrato, nível atual, selos.
- [ ] Ranking por equipe/tenant/período.

### Fase 2 — Conectores de ERP: IXC e SGP (prioridade)
- [ ] Definir a interface `ConectorERP` (`src/lib/erp-connectors/types.ts`).
- [ ] Implementar `ixc.ts`: autenticação, `listarColaboradores`,
      `sincronizar` (levantar a documentação real da API do IXC junto ao
      provedor/fornecedor antes de implementar).
- [ ] Implementar `sgp.ts`: idem, para a API do SGP.
- [ ] Tela de configuração de `IntegracaoERP` para o Admin do Provedor
      (escolher sistema, informar credenciais, testar conexão).
- [ ] Worker BullMQ de sincronização periódica (*upsert* de `Usuario` por
      `idExternoERP`, nunca duplicando, desativando quem saiu do ERP sem
      apagar histórico de pontos).
- [ ] Endpoints de webhook `/api/webhooks/ixc` e `/api/webhooks/sgp` para
      criação de `Atendimento` em tempo real, com idempotência por
      `origemExternaId`.

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

## O que perguntar ao usuário antes de prosseguir (se não estiver claro)

- Nome final do produto/marca (este documento usa "SinalPlus" como
  provisório para a plataforma — cada tenant terá seu próprio nome de
  exibição).
- Documentação/credenciais de API do **IXC** e do **SGP** disponíveis para
  implementar os conectores da Fase 2 (endpoints reais, autenticação,
  limites de taxa).
- Provedor(es) de WhatsApp/SMS/e-mail que já estão disponíveis para uso
  (ex.: a mesma infraestrutura usada pelo cliente GigaNetPe/Opa!), para
  decidir a implementação de `NotificadorWhatsApp` já na Fase 4.
- Domínio que será usado em produção para a plataforma em si
  (`*.sinalplus.com.br` ou equivalente), para configurar subdomínios de
  tenant desde a Fase 0.

## Fora de escopo nesta primeira leva (ver seção 14 de `docs/01-FUNDACAO-PRODUTO.md`)

- Pagamento/folha de bônus em dinheiro.
- App mobile nativo (usar PWA).
- Conectores prontos para sistemas de gestão além de IXC e SGP (a
  arquitetura plugável deixa isso fácil de adicionar depois).
- Checkout/cobrança self-service automatizada.
