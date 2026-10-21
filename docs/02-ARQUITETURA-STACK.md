# Arquitetura e Stack Técnica

> Referência: `01-FUNDACAO-PRODUTO.md` (regras de negócio, incluindo white-label
> e integração com IXC/SGP como prioridades). Este documento define COMO
> construir, para o Claude Code seguir durante a implementação.

Premissas do contexto: instalação em **um único servidor Debian** (VPS ou
máquina própria), orçamento enxuto, Nicholas atua sozinho/com apoio pontual,
já tem experiência com **Next.js** em projetos anteriores (reaproveitar
conhecimento reduz risco), e o produto será **vendido como white-label para
provedores em todo o Brasil** — isso influencia decisões de domínio/branding
desde o MVP.

---

## 1. Stack recomendada (MVP)

| Camada | Escolha | Por quê |
|---|---|---|
| Frontend + Backend | **Next.js 15 (App Router)**, TypeScript | Um único projeto full-stack (API Routes/Server Actions), já é o stack que Nicholas domina |
| UI | Tailwind CSS + shadcn/ui, com tokens de tema por tenant | Produtividade, componentes acessíveis prontos, fácil de customizar por tenant (cores/logo da marca do provedor) |
| ORM | **Prisma** | Migrations versionadas, type-safety, fácil de ler/alterar schema |
| Banco de dados | **PostgreSQL 16** | Multi-tenant com `tenant_id`, relações bem definidas, maduro para self-host em Debian |
| Autenticação | **Auth.js (NextAuth v5)** com credenciais (e-mail/senha) + sessão JWT | Simples, sem dependência de serviço externo; cliente final não precisa de login (link assinado) |
| Fila/jobs assíncronos | **BullMQ + Redis** | Envio de pesquisas (WhatsApp/SMS/e-mail), cálculo de pontos, notificações, sincronização com IXC/SGP — fora do ciclo de request |
| Upload de imagens (prêmios/logos) | Armazenamento local em disco (`/var/www/sinalplus/uploads`) com `sharp` para resize/otimização | Evita custo de S3 no MVP; pode migrar para MinIO/S3-compatible depois sem mudar o schema |
| Envio de mensagens | E-mail via Resend (conta do Aplivora) e SMS via KingSMS; WhatsApp plugável quando houver API oficial; configurável por tenant | Pesquisa de satisfação chega onde o cliente já está, com a cara do provedor |
| Processo em produção | **PM2** (process manager para Node) | Reinício automático, logs, zero-downtime reload |
| Proxy reverso / TLS | **Nginx** + **Certbot (Let's Encrypt)**, ou **Caddy** como alternativa | Nginx é o padrão de mercado; **Caddy** emite e renova HTTPS automaticamente por domínio (inclusive domínios próprios de cada tenant), o que simplifica bastante o white-label com domínio customizado — ver seção 4 |
| Monitoramento básico | PM2 logs + `logrotate`; opcional: Uptime Kuma (self-host) | Observabilidade mínima viável sem custo extra |

### Por que não containers (Docker) no MVP?
Para um servidor único e equipe pequena, rodar **PM2 + Postgres + Redis +
Nginx/Caddy nativos no Debian** é mais simples de depurar e tem menos
overhead de memória que orquestrar containers. Fica documentado em
`04-DEPLOY-DEBIAN.md` como usar Docker Compose como alternativa, caso o
projeto cresça e precise de múltiplos ambientes (staging/prod) ou migrar de
servidor com mais facilidade.

### Nginx vs. Caddy para o cenário white-label
Como cada tenant pode ter um **domínio próprio** (ex.:
`pontos.giganetpe.com.br`), o servidor web precisa emitir/renovar certificado
HTTPS para um número crescente de domínios, sem intervenção manual a cada
novo cliente. **Caddy** faz isso nativamente (on-demand TLS), enquanto com
Nginx + Certbot isso exigiria automação própria (script que gera
`server_block` + roda `certbot` a cada novo domínio cadastrado). Recomendação:
**começar com Nginx + Certbot** (mais familiar, documentado em
`04-DEPLOY-DEBIAN.md`) enquanto os tenants usam só subdomínio
(`*.sinalplus.com.br`, coberto por um único certificado wildcard), e
**migrar/adicionar Caddy** no momento em que o primeiro tenant pedir domínio
próprio — não é necessário resolver isso antes de haver demanda real.

## 2. Estrutura de pastas sugerida (monorepo simples)

```
sinalplus/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (public)/          # páginas públicas: pesquisa de satisfação (sem login)
│   │   │   └── avaliar/[token]/page.tsx
│   │   ├── (auth)/            # login
│   │   ├── (app)/             # área logada, com layout por papel (role) e tema do tenant
│   │   │   ├── superadmin/    # Super Admin: gestão de tenants, planos
│   │   │   ├── admin/         # Admin do provedor: branding, regras, integrações
│   │   │   ├── gestor/        # Gestor de equipe
│   │   │   └── colaborador/   # Painel do colaborador
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   ├── ixc/       # endpoint de recepção de eventos do IXC
│   │   │   │   └── sgp/       # endpoint de recepção de eventos do SGP
│   │   │   ├── avaliacoes/
│   │   │   ├── premios/
│   │   │   └── resgates/
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts              # client Prisma
│   │   ├── pontuacao.ts       # motor de regras de pontuação
│   │   ├── notificacoes.ts    # WhatsApp/SMS/e-mail (por tenant)
│   │   ├── tenant.ts          # resolução/isolamento de tenant + branding (logo, cores, domínio)
│   │   └── erp-connectors/    # integração com sistemas de gestão de provedores
│   │       ├── types.ts       # interface comum ConectorERP
│   │       ├── ixc.ts         # implementação para IXC Provedor
│   │       └── sgp.ts         # implementação para SGP
│   ├── components/
│   └── jobs/                  # workers BullMQ (pesquisa, pontuação assíncrona, sync IXC/SGP)
├── public/
├── .env.example
├── package.json
└── README.md
```

## 3. Estratégia de multi-tenancy

**Modelo escolhido: banco único, coluna `tenant_id`** (shared database,
row-level isolation). Mais simples de operar em um único servidor Debian do
que "um banco por tenant", e suficiente para a escala inicial (dezenas de
provedores, não milhares) — mesmo vendendo nacionalmente, o gargalo de
clientes pequenos/médios não deve pressionar esse modelo tão cedo.

Regras:
- Toda tabela de dados de negócio tem `tenant_id` (exceto tabelas globais como
  `plano`).
- Toda query passa por uma camada central (`lib/tenant.ts`) que injeta o
  `tenant_id` da sessão autenticada — nunca confiar em `tenant_id` vindo do
  client sem validação.
- Se o projeto crescer muito (centenas de provedores grandes), a migração
  natural é separar por *schema* do Postgres — mas não é necessário no MVP.

## 4. White-label: resolução de domínio e branding por tenant

Isso faz parte do MVP, não é um "extra" — é o que permite vender a mesma
plataforma para provedores diferentes em todo o Brasil.

- **Resolução de tenant por domínio**: middleware do Next.js lê o header
  `Host` da requisição e resolve o tenant de duas formas:
  1. Subdomínio padrão: `{slug}.sinalplus.com.br` → busca `Tenant` por
     `slug`.
  2. Domínio próprio: `pontos.giganetpe.com.br` → busca `Tenant` por
     `dominioCustomizado` (ver `03-MODELO-DADOS.md`).
- **Branding carregado dinamicamente**: logo, favicon, cor primária/
  secundária e nome de exibição do tenant resolvido são injetados no
  layout raiz (CSS variables do Tailwind + `<link rel="icon">` dinâmico) —
  nenhuma marca fica hardcoded no código.
- **Onboarding de novo tenant**: fluxo (no mínimo assistido pelo Super
  Admin, self-service na Fase 5 do roadmap do `CLAUDE.md`) que cria o `Tenant`, define
  slug, permite upload de logo/cores e convida o primeiro `ADMIN_PROVEDOR`.
- **Verificação de domínio próprio**: quando o tenant cadastra um domínio
  customizado, a plataforma deve expor um registro DNS (CNAME ou TXT) a ser
  configurado pelo provedor, e validar antes de ativar o domínio.

## 5. Autenticação e papéis (RBAC)

Papéis (`role` no modelo de usuário): `SUPER_ADMIN`, `ADMIN_PROVEDOR`,
`GESTOR`, `COLABORADOR`.

- Middleware do Next.js protege rotas por papel.
- O **cliente final** nunca autentica: recebe um **link com token único e
  expiração** (`ConvitePesquisa`) por WhatsApp/SMS/e-mail para avaliar um
  atendimento específico — evita necessidade de conta e reduz fricção. Só o
  hash do token fica no banco.
- **Colaboradores sem senha** (cadastrados pelo admin, importados por
  planilha ou sincronizados do ERP) recebem um **convite de primeiro acesso**
  (`ConviteAcesso`, link de uso único com expiração) para definir a senha.
- `SUPER_ADMIN` só existe no domínio da plataforma; os demais papéis só no
  domínio do seu tenant. O login descobre o tenant pelo domínio acessado,
  porque o e-mail é único por tenant.

## 6. Motor de pontuação (desenho)

Módulo isolado (`lib/pontuacao.ts`) responsável por:
1. Receber uma avaliação (`nivelSinal`: 1-5) + `tenantId` + `colaboradorId`.
   Avaliação marcada como **suspeita** (sinais antifraude) não pontua
   automaticamente: fica para revisão do gestor.
2. Buscar a **regra de pontuação ativa** do tenant (`RegraPontuacao`) e a
   `ConfiguracaoPontuacao` (limites, dias de pendência, nível de risco,
   prazo de contato), aplicando o multiplicador de campanha vigente.
3. Calcular o delta de pontos: créditos respeitam os limites diário/semanal;
   débitos respeitam o piso em zero **no momento do débito** (nunca
   debitar além do saldo total). O valor bruto da regra vai em
   `pontosCalculados`, o efetivo em `pontos`.
4. Gravar um registro em `TransacaoPontos` (auditoria imutável — nunca
   fazer `UPDATE` direto no saldo, sempre somar transações), com
   `disponivelEm` = agora + `diasPendencia` para créditos.
5. Se nota <= `nivelRisco` (padrão 2 barras), criar `CasoRecuperacao` com
   prazo de `prazoContatoHoras` e enfileirar notificação ao gestor.

Tudo numa única transação do banco, para que duas avaliações simultâneas do
mesmo colaborador não furem limites nem o piso.

Essa separação permite trocar as regras por tenant sem alterar código —
apenas dados.

## 7. Conectores de ERP: integração com IXC e SGP (prioridade)

Arquitetura em **padrão adaptador (adapter pattern)**: uma interface comum
`ConectorERP`, implementada separadamente para cada sistema externo.

```ts
// src/lib/erp-connectors/types.ts
interface ConectorERP {
  listarColaboradores(tenantId: string): Promise<ColaboradorExterno[]>;
  buscarAtendimentoPorId(tenantId: string, idExterno: string): Promise<AtendimentoExterno | null>;
  // caminho principal para O.S.: consulta periódica (nenhum dos dois ERPs
  // tem webhook nativo confirmado — ver docs/REFERENCIA-IXC-SGP.md)
  listarAtendimentosConcluidos(tenantId: string, desde: Date): Promise<AtendimentoExterno[]>;
  // chamado pelo worker de sincronização periódica (BullMQ)
  sincronizar(tenantId: string): Promise<ResultadoSincronizacao>;
}
```

- `src/lib/erp-connectors/ixc.ts` implementa `ConectorERP` usando a API do
  **IXC Provedor** (autenticação por token, endpoints de colaboradores/
  ordens de serviço — a documentação exata da API do IXC do tenant deve ser
  obtida junto ao provedor/fornecedor no momento da integração real).
- `src/lib/erp-connectors/sgp.ts` implementa `ConectorERP` usando a API do
  **SGP** (modelo de autenticação e endpoints próprios do SGP).
- Cada `Tenant` tem uma configuração de `IntegracaoERP` (tipo: `IXC` ou
  `SGP`, URL base, credenciais/token — armazenados de forma criptografada,
  nunca em texto puro) — ver `03-MODELO-DADOS.md`.
- **Worker de sincronização** (BullMQ, job agendado por tenant, ex. a cada
  1-6h): chama `sincronizar(tenantId)` do conector configurado, que:
  1. Lista colaboradores no IXC/SGP;
  2. Faz *upsert* em `Usuario` por um identificador externo estável
     (`idExterno` + `tenantId`), nunca duplicando por nome/e-mail;
  3. Marca como inativo quem foi removido do sistema de origem (nunca
     apaga o histórico de pontos do colaborador).
- **Importação periódica de O.S.** (caminho principal): o mesmo worker chama
  `listarAtendimentosConcluidos(tenantId, desde)` e cria os `Atendimento`
  com *upsert* por `origemExternaId`, guardando o ponto de corte da última
  consulta em `IntegracaoERP.ultimaSincronizacaoEm`.
- **Antes de implementar cada conector**: validar autenticação e endpoints no
  sandbox do SGP (`demo.sgp.net.br`) e com acesso de teste do IXC — em
  especial se existe endpoint de colaboradores. Se não existir, o conector
  importa só O.S. e os colaboradores vêm por planilha, ligados pelo
  `idExternoERP` do técnico responsável na O.S.
- **Webhook em tempo real** (opcional, se o sistema de origem suportar): endpoint
  dedicado por conector (`/api/webhooks/ixc`, `/api/webhooks/sgp`) que cria
  o `Atendimento` assim que uma O.S./chamado é concluído, com
  `origemExternaId` único por tenant para garantir idempotência (não
  pontuar duas vezes o mesmo evento).
- Adicionar um terceiro sistema de gestão no futuro deve significar apenas
  criar um novo arquivo em `erp-connectors/`, implementando a mesma
  interface — sem tocar no motor de pontuação ou no restante do produto.

## 8. Dependências externas desejadas (podem ser mockadas no MVP)

- **E-mail**: Resend, com a conta/domínio do hub Aplivora (decidido em
  out/2026). Remetente configurável por tenant (`emailRemetente`).
- **SMS**: KingSMS (decidido em out/2026).
- **WhatsApp**: ainda sem API oficial. Fica atrás da interface
  `NotificadorWhatsApp` para plugar o provedor quando houver (API oficial
  ou sistemas já em uso pelo provedor, como Opa!), sem reescrever regra de
  negócio. Configurável por tenant (cada provedor pode usar seu próprio
  número/conta). Até lá, a pesquisa sai por e-mail e SMS.
- Credenciais de API do IXC/SGP de cada provedor cliente (obtidas no
  onboarding daquele tenant).

## 9. Requisitos não-funcionais

- **Isolamento de dados** entre tenants é requisito de segurança, não só de
  negócio — cobrir com testes automatizados.
- **Idempotência** no recebimento de webhooks externos (ERP e, mais tarde,
  provedores de WhatsApp) — evitar pontuar duas vezes o mesmo atendimento.
- **Auditoria completa**: toda alteração de pontos e todo resgate deve ser
  rastreável (quem, quando, por quê).
- **Segurança de credenciais de terceiros**: tokens/segredos de integração
  com IXC/SGP de cada tenant devem ser armazenados criptografados em
  repouso (nunca em texto puro no banco).
- **LGPD**: dados do cliente final (telefone/e-mail) e dados de
  colaboradores sincronizados do ERP usados apenas para a finalidade do
  produto. Toda mensagem de pesquisa traz link para o cliente deixar de
  receber pesquisas (`ClienteFinal.naoPerturbe`); telefone/e-mail de
  clientes sem atendimento recente devem ser anonimizados após um prazo de
  retenção configurável (padrão sugerido: 24 meses, a validar
  juridicamente); o hall da fama nunca expõe dados de clientes.
- **Limites do plano** (`limiteColaboradores`, `limiteFiliais`) aplicados no
  cadastro e na importação de usuários/equipes.

## 10. Evolução da stack por fase

A numeração segue o roadmap oficial do `CLAUDE.md`.

1. **Fase 2**: Redis + BullMQ entram com o worker de sincronização IXC/SGP.
2. **Fase 3**: `sharp` para fotos de prêmios, ainda em disco local.
3. **Fase 4**: workers de notificação (WhatsApp/e-mail/SMS).
4. **Fase 5**: onboarding self-service de novo tenant, automação de
   certificado por domínio customizado (avaliar migração/adição de Caddy),
   PWA com push notification.
5. **Pós-MVP**: storage de imagens em S3-compatible (MinIO ou provedor
   cloud), métricas avançadas (BI) por tenant e consolidadas para o Super
   Admin, billing automatizado (Stripe ou gateway nacional), sistemas de
   gestão adicionais além de IXC/SGP via a mesma interface `ConectorERP`.
