# Fundação do Produto — SinalPlus Telecom

> SaaS de gamificação para provedores de internet (ISPs), focado em transformar o
> feedback de pós-venda em um programa de pontos, níveis e prêmios para os
> colaboradores de atendimento, vendas e instalação/suporte técnico.
> Desenhado desde o início para ser **white-label** e vendido para provedores
> em todo o Brasil, cada um com sua própria marca e seus próprios dados.

Documento de fundação: visão, problema, personas, regras de negócio e escopo de
funcionalidades. Serve de referência para todos os demais arquivos técnicos
(`02-ARQUITETURA-STACK.md`, `03-MODELO-DADOS.md`, `04-DEPLOY-DEBIAN.md`,
`CLAUDE.md`).

---

## 1. Problema

Provedores de internet regionais (ISPs) competem principalmente em dois eixos:
preço e **qualidade de atendimento/suporte**. Grande parte da experiência do
cliente é definida não pela rede em si, mas pelo técnico que faz a instalação,
pelo atendente que resolve um chamado, ou pelo vendedor que faz o pós-venda.

Hoje esse feedback (quando existe) costuma:
- Ficar perdido em pesquisas de satisfação que ninguém lê de verdade;
- Não ter consequência prática para quem presta o atendimento;
- Não gerar nenhum incentivo visível e imediato para o time de campo/atendimento.

**Hipótese do produto:** se o feedback do pós-venda virar pontos visíveis,
acumuláveis e trocáveis por prêmios reais, o time de atendimento/instalação
passa a se importar genuinamente com a nota que o cliente dá — e isso melhora
retenção (churn) e a reputação do provedor.

## 2. Visão do produto

Uma plataforma SaaS multi-tenant **e white-label** (um provedor = um "tenant",
cada um com sua própria marca) onde:

1. O cliente final do provedor avalia o atendimento/instalação recebido;
2. Essa avaliação usa uma escala visual de **sinal de Wi-Fi** (1 a 5 "barras"),
   em vez de estrelas — reforçando a identidade do setor;
3. Cada avaliação positiva gera **pontos** para o colaborador responsável
   (técnico, atendente ou vendedor) vinculado àquele atendimento;
4. Avaliações negativas **descontam pontos** e disparam um alerta de
   recuperação de serviço para o gestor;
5. Os colaboradores trocam pontos acumulados por **prêmios** cadastrados pelo
   provedor (com fotos, estoque e custo em pontos);
6. Gestores acompanham tudo em um **ranking/dashboard** por equipe, filial e
   período;
7. Em provedores de maior porte, os **colaboradores cadastrados no sistema de
   gestão que o provedor já usa (IXC ou SGP) são sincronizados
   automaticamente** — sem necessidade de recadastrar ninguém à mão.

## 3. Personas

| Persona | Quem é | O que quer |
|---|---|---|
| **Super Admin (dono do SaaS)** | Equipe da SinalPlus | Gerenciar tenants (provedores), planos, cobrança, saúde da plataforma |
| **Admin do Provedor** | Dono/gerente do ISP (ex.: GigaNetPe) | Configurar regras de pontuação, cadastrar prêmios, ver relatórios gerais, personalizar a marca |
| **Gestor de Equipe** | Supervisor de técnicos/atendentes | Acompanhar ranking da sua equipe, tratar feedbacks negativos |
| **Colaborador** | Técnico de instalação, atendente de suporte, vendedor | Ver seus pontos, seu nível, resgatar prêmios |
| **Cliente final** | Assinante do provedor | Responder a pesquisa de satisfação pós-atendimento (sem precisar de login) |

## 4. Fluxo principal (ponta a ponta)

1. Um atendimento é concluído no sistema do provedor (instalação, chamado de
   suporte, renegociação, etc.) e fica associado a um **colaborador** e a um
   **cliente** — o colaborador pode já existir por ter sido sincronizado do
   IXC/SGP.
2. O sistema dispara uma pesquisa de satisfação para o cliente, via link
   único com prazo de validade (WhatsApp, SMS ou e-mail) — sem necessidade
   de criar conta. Clientes que pediram para não receber pesquisas são
   respeitados.
3. O cliente escolhe o nível de satisfação em uma UI com **ícone de sinal de
   Wi-Fi** (ver seção 5) e, opcionalmente, deixa um comentário.
4. A plataforma calcula a pontuação resultante conforme as **regras de
   pontuação do tenant** (seção 6) e credita/debita o colaborador.
5. Se a nota for baixa (ex.: 1-2 barras), abre-se automaticamente um **caso de
   recuperação** visível para o gestor, com prazo de contato.
6. O colaborador acompanha pontos, nível e selos (badges) em seu painel/PWA —
   com a marca e as cores do próprio provedor (white-label).
7. Quando tiver pontos suficientes, o colaborador solicita o **resgate** de um
   prêmio do catálogo; o gestor aprova/entrega e o estoque é baixado.

## 5. A métrica central: "Sinal" em vez de "Estrela"

- Escala de 1 a 5, representada visualmente como barras de sinal Wi-Fi
  (como o ícone de celular), de **sinal fraco** (1 barra, vermelho) a
  **sinal forte/full bars** (5 barras, verde).
- Mapeamento sugerido:
  - 1 barra — Péssimo (equivalente a 1 estrela)
  - 2 barras — Ruim
  - 3 barras — Neutro/Regular
  - 4 barras — Bom
  - 5 barras — Excelente (sinal máximo)
- Pode ser reaproveitada tanto na pesquisa ao cliente quanto como "elemento de
  marca" do produto (ícone, splash screen, etc.).
- Mesma estrutura de dados de uma nota 1-5 estrelas "por baixo do capô" —
  troca-se apenas a camada visual (ver `03-MODELO-DADOS.md`).

## 6. Regras de pontuação (configuráveis por tenant)

Cada provedor pode calibrar os pesos, mas o padrão sugerido é:

| Avaliação (sinal) | Pontos para o colaborador |
|---|---|
| 5 barras | +10 |
| 4 barras | +5 |
| 3 barras | 0 (neutro) |
| 2 barras | -5 |
| 1 barra | -10 (+ abre caso de recuperação) |

Regras adicionais:
- **Vínculo obrigatório a um atendimento real** (ordem de serviço / ticket /
  venda) para evitar fraude — feedback "solto" sem atendimento associado não
  pontua.
- **Janela de validade**: pontos "pendentes" por X dias (padrão 7,
  configurável por tenant) até virarem saldo gastável — evita manipulação de
  avaliações por terceiros e dá tempo para contestação e auditoria.
- **Limite diário/semanal de pontos creditados por colaborador**
  (configurável) para evitar concentração artificial.
- **Multiplicadores de campanha**: o admin pode criar campanhas sazonais
  (ex.: "mês da fibra" = pontos em dobro).
- Pontos não podem ficar negativos no saldo total (piso em zero). O piso é
  aplicado **no momento do débito**: uma nota baixa só desconta até o saldo
  que o colaborador tem, e o desconto "cheio" que a regra daria continua
  registrado para fins de relatório. Assim, um crédito futuro nunca é
  consumido por uma dívida acumulada (ver `03-MODELO-DADOS.md`, seção 4).
- **Contestação**: o colaborador pode contestar uma avaliação que considere
  injusta (ex.: problema de rede fora do alcance dele); o gestor aceita ou
  recusa, e o estorno, quando houver, entra como ajuste auditado.

## 7. Níveis e selos (gamificação além dos pontos)

- **Níveis do colaborador** (ex.: Sinal Fraco → Sinal Médio → Sinal Forte →
  Fibra Pura → Lenda da Rede), definidos por pontuação acumulada histórica
  (não o saldo atual, para não "rebaixar" alguém por ter gastado pontos).
- **Selos/conquistas**: ex. "7 avaliações de sinal máximo seguidas", "Zero reclamações no
  mês", "Resgatou o primeiro prêmio", "Melhor da filial do mês".
- **Ranking**: geral, por filial/equipe e por período (semana/mês/trimestre).
- **Hall da fama opcional**: tela pública (sem dados sensíveis) que o
  provedor pode usar como vitrine institucional/RH.

## 8. Catálogo de prêmios

- Cadastro de prêmios com: nome, descrição, **fotos** (galeria), custo em
  pontos, categoria (ex.: eletrônicos, vale-compra, folga, brindes da marca),
  estoque disponível e status (ativo/inativo).
- Fluxo de resgate: colaborador solicita → sistema reserva o estoque →
  gestor/admin aprova → marca como entregue (com data e, opcional, foto de
  comprovação da entrega).
- Histórico completo de resgates por colaborador (extrato de pontos:
  créditos, débitos, resgates).

## 9. Recuperação de serviço (service recovery)

Quando um cliente dá nota baixa (1-2 barras):
- Abre-se automaticamente um "caso" vinculado ao atendimento, visível para o
  gestor da equipe;
- Notificação (e-mail/WhatsApp/painel) para o gestor com prazo de contato
  (ex.: 24h);
- Gestor registra a ação tomada e pode fechar o caso;
- Relatório de "casos abertos vs. resolvidos vs. prazo estourado" por
  gestor/filial.

## 10. Multi-tenancy e planos (visão SaaS nacional)

- Cada **provedor (tenant)** tem seus próprios: colaboradores, prêmios,
  regras de pontuação, clientes, marca e dados — isolados dos demais
  tenants. O isolamento de dados entre tenants é requisito de segurança
  desde o primeiro dia, não uma evolução futura.
- Planos sugeridos (a validar com o negócio):
  - **Starter**: 1 filial, até N colaboradores, catálogo de prêmios limitado,
    marca própria básica (logo + cor).
  - **Pro**: múltiplas filiais, campanhas, relatórios avançados,
    API/webhooks, domínio próprio.
  - **Enterprise**: integração automática com IXC/SGP (sincronização de
    colaboradores), SSO, suporte prioritário.
- Cobrança não é o foco deste documento, mas o modelo de dados já prevê
  `tenant` e `plano` como entidades (ver `03-MODELO-DADOS.md`).

## 11. White-label e comercialização nacional

Esta não é uma evolução tardia: é uma decisão de arquitetura desde o MVP,
porque o modelo de negócio é vender a mesma plataforma para **muitos
provedores diferentes em todo o Brasil**, cada um enxergando o produto como
"seu".

O que cada provedor pode personalizar:
- **Identidade visual**: logo, favicon, cor primária/secundária, nome
  comercial exibido (ex.: um provedor pode chamar internamente de "Pontos
  GigaNet", outro de "Clube Fibra+") — o nome "SinalPlus" aparece apenas
  como a plataforma por trás, não necessariamente para o colaborador/cliente
  final.
- **Domínio**: subdomínio padrão (`giganetpe.sinalplus.com.br`) no plano
  Starter/Pro, com opção de **domínio próprio** (`pontos.giganetpe.com.br`)
  nos planos superiores.
- **Canal de notificação**: remetente de e-mail e número de WhatsApp usados
  para enviar a pesquisa de satisfação podem ser os do próprio provedor.
- **Catálogo de prêmios, regras de pontuação, níveis e selos**: 100% próprios
  de cada tenant — não existe prêmio ou regra "compartilhada entre
  provedores" (exceto os templates iniciais sugeridos no onboarding).

O que é compartilhado (plataforma, não dado de negócio):
- Código-fonte, infraestrutura, engine de pontuação, mecanismo de resgate,
  lógica de recuperação de serviço — tudo isso é o "motor" comum que atende
  todos os tenants.

**Implicações técnicas** (detalhadas em `02-ARQUITETURA-STACK.md` e
`03-MODELO-DADOS.md`):
- A entidade `Tenant` precisa guardar, desde o schema inicial: logo, cores,
  nome de exibição, favicon e domínio customizado (não é um campo a
  adicionar depois).
- Provisionamento de domínio próprio e HTTPS por tenant precisa ser um
  processo repetível (não manual) para escalar a venda nacional.
- Onboarding de um novo provedor (cadastro de tenant, convite do Admin,
  escolha de cores/logo, configuração inicial de regras de pontuação) deve
  ser **self-service ou quase self-service**, para permitir vender sem
  Nicholas precisar configurar cada cliente manualmente.

## 12. Integrações com sistemas de gestão de provedores (IXC e SGP) — prioridade

Esta é uma das prioridades do produto, especialmente para **fechar negócio
com provedores de médio/grande porte**, que já têm centenas de colaboradores
cadastrados em seu ERP e não aceitariam recadastrar tudo manualmente.

Os dois sistemas de gestão mais usados por provedores de internet no Brasil
são o **IXC Provedor** e o **SGP (Sistema Gerenciador de Provedor)**. A
plataforma deve ser capaz de:

1. **Sincronizar colaboradores cadastrados**: puxar a lista de
   técnicos/atendentes/vendedores já existente no IXC ou no SGP do provedor
   (nome, e-mail, cargo/função, filial/equipe) e criar/atualizar os
   registros de `Usuario` automaticamente — eliminando o cadastro manual,
   que é o maior ponto de atrito em provedores grandes.
2. **Vincular atendimentos a esses colaboradores**: quando uma O.S.
   (ordem de serviço) de instalação ou chamado de suporte é fechada no
   IXC/SGP, a plataforma recebe o evento (webhook, se o sistema suportar, ou
   consulta periódica à API) e cria o `Atendimento` já associado ao
   colaborador e ao cliente corretos.
3. **Reconciliação periódica**: além do evento em tempo real, rodar uma
   sincronização agendada (ex.: a cada X horas) para capturar
   admissões/demissões e mudanças de equipe que não disparam webhook.

Como IXC e SGP têm modelos de API diferentes entre si, a integração deve ser
construída como um **conector plugável por sistema** (uma interface comum,
uma implementação para IXC e outra para SGP — ver `02-ARQUITETURA-STACK.md`),
para que adicionar suporte a um terceiro sistema de gestão no futuro não
exija reescrever a lógica de negócio.

**O que já se sabe das APIs** (ver `REFERENCIA-IXC-SGP.md`): nenhum dos dois
sistemas tem webhook nativo confirmado, e nenhum endpoint de listagem de
colaboradores foi confirmado ainda (no SGP, os endpoints públicos encontrados
são de cliente final e de O.S.). Por isso:
- a **consulta periódica** (polling) é o caminho principal para importar
  O.S. concluídas; webhook é opcional, usado se o sistema oferecer;
- a sincronização de colaboradores só deve ser prometida a um cliente depois
  de validada no sandbox do SGP (`demo.sgp.net.br`) e com acesso de teste do
  IXC (via um provedor que já o usa, como a GigaNetPe);
- a **importação por planilha (CSV)** entra já no MVP, como garantia para
  qualquer provedor.

Enquanto a sincronização automática de um sistema específico não estiver
pronta para um tenant, o cadastro manual/importação via planilha continua
disponível — a integração é um **acelerador para contas grandes**, não um
bloqueio para o provedor começar a usar a plataforma.

## 13. Ideias extras sugeridas (incrementos possíveis)

- **PWA mobile para colaboradores**: instalável no celular do técnico, com
  notificação push de pontos recebidos e saldo em tempo real.
- **Gamificação em equipe**: competição entre filiais/times, não só
  individual — bom para ISPs com várias cidades (ex. Paulista, Abreu e Lima,
  Igarassu) ou, no caso de uma conta white-label maior, entre regionais de
  um mesmo provedor nacional.
- **"Termômetro de risco de churn"**: cruzar notas baixas recorrentes de um
  mesmo cliente com risco de cancelamento, alimentando um dashboard do
  provedor.
- **Pesquisa com micro-incentivo ao cliente**: cupom/desconto simbólico para
  quem responde a pesquisa, aumentando a taxa de resposta.
- **Exportação de relatórios** em CSV/PDF para folha de bônus/RH.
- **Loja de pontos com fornecedores parceiros** (fase futura): prêmios
  patrocinados por marcas locais, criando uma rede de benefícios regional.
- **Modo "auditor"**: amostragem aleatória de atendimentos 5★ para ligação de
  confirmação, coibindo fraude.
- **Metas individuais e coletivas** com barra de progresso (ex.: "faltam 120
  pontos para o próximo nível").
- **Painel de "saúde da conta" para o Super Admin**: visão de todos os
  tenants (provedores clientes), uso, inadimplência de plano — útil já
  pensando em vender para muitos provedores no Brasil todo.

### Incorporadas ao roadmap após a revisão de coerência (out/2026)

- **Contestação de avaliação** pelo colaborador (seção 6).
- **Antifraude na resposta**: registrar IP, navegador e horário da resposta;
  marcar como suspeita (sem pontuar automaticamente) a resposta vinda do
  mesmo IP/dispositivo de uma sessão do colaborador, ou respondida segundos
  após o atendimento ser concluído. Complementa o "modo auditor".
- **Relatório de satisfação (CSAT) para o provedor**: média de sinal e taxa
  de resposta por tipo de atendimento, equipe e período — o valor que o dono
  do provedor enxerga além da gamificação.
- **LGPD do cliente final**: opção de não receber mais pesquisas (link de
  descadastro em toda mensagem), prazo de retenção de telefone/e-mail e
  anonimização no hall da fama.
- **Template de onboarding**: regras de pontuação, níveis e selos padrão
  copiados automaticamente ao criar um novo tenant.

## 14. Fora de escopo (nesta primeira versão)

- Emissão de nota fiscal/pagamento de bônus em dinheiro (o produto lida com
  pontos e prêmios físicos/digitais, não com folha de pagamento).
- Conectores prontos para sistemas de gestão além de IXC e SGP (a
  arquitetura de conector plugável, seção 12, deixa isso fácil de adicionar
  depois, mas não entra no MVP).
- App mobile nativo (iOS/Android) — o MVP usa **PWA** (web responsiva
  instalável), mais barato de manter em um único servidor Debian.
- Checkout/cobrança self-service automatizada (planos e cobrança no MVP
  podem ser geridos manualmente pelo Super Admin; automação de billing é
  evolução futura).

## 15. Critérios de sucesso do MVP

- Um provedor consegue: cadastrar-se (ou ser cadastrado) como tenant com sua
  própria marca, sincronizar (ou importar) seus colaboradores, configurar
  regras de pontuação, cadastrar prêmios com foto, registrar atendimentos
  (manual, via API ou via conector IXC/SGP), enviar pesquisa, receber
  avaliação do cliente, ver o ranking e processar um resgate — tudo rodando
  em um único servidor Debian, atendendo múltiplos provedores ao mesmo
  tempo, cada um com sua própria identidade visual.
