# Referência: APIs dos Sistemas de Gestão de Provedores (IXC e SGP)

> Documento de consulta permanente, para usar em **qualquer projeto** que
> precise integrar com o **IXC Provedor** ou o **SGP (TSMX)** — não é
> específico do SinalPlus. Reúne os links oficiais, o que já se sabe sobre
> cada API a partir da documentação pública, e um checklist do que ainda
> falta levantar antes de implementar uma integração real.
>
> Este documento é um **ponto de partida**, não a documentação completa —
> os sites oficiais só expõem o índice/menu publicamente em alguns pontos;
> o conteúdo técnico detalhado (parâmetros exatos, exemplos de JSON,
> limites de taxa) precisa ser consultado diretamente nas páginas linkadas
> abaixo, ou obtido com o provedor/fornecedor que já usa o sistema.

---

## 1. IXC Provedor

### Links oficiais
- Wiki da API: https://wikiapiprovedor.ixcsoft.com.br/
- Documentação geral do ERP: https://wiki-erp.ixcsoft.com.br/documentacao/

### O que a documentação pública mostra

**Módulos do sistema** (cada um pode ter endpoints próprios na API):
- Cadastros: clientes, contratos, produtos, fornecedores, estruturas
- Operacional: compras (entradas), vendas/pedidos (saídas), contas a pagar
  e a receber, fiscal, contabilidade, folha de pagamento, estoque
- Provedor (específico de ISP): ONUs, logins de assinante, planos de
  velocidade, OLTs, Radius, pools de IP, SpeedTest
- Suporte: ordens de serviço, atendimentos, eventos
- Inmap (mapeamento/geolocalização): Sales (viabilidade técnica), Service
  (O.S. e rotas de técnico), Fiberdocs (documentação de fibra FTTH)
- Outros: Hotsite, CRM, Frota, Plataforma VoIP, MVNO
- Integrações nativas: e-mail SMTP, MVNO

**Seção "Informações API"** (existe, mas conteúdo detalhado não acessível
via scraping simples — precisa navegação manual):
- Erros comuns
- Configuração do webservice
- Geração de token de acesso
- Verificação de acesso à API
- Configuração de acesso via Apache e via Nginx
- "Recursos da API" (requisições com filtros específicos)

**Erros HTTP conhecidos**: 400 (Bad Request), 401 (Authorization Required),
404 (Not Found, no Nginx) — sugere API REST tradicional com autenticação
por token.

**Ecossistema de produtos IXC** (pode ter APIs/documentações próprias,
relevante se o provedor cliente usar algum desses):
- Opa! Suite (atendimento/CRM com Opa! IA)
- IXC Assina (assinatura digital de contratos)
- IXC ACS (gestão de equipamentos CPE)
- IXC Oner, Olli, IXC Academy

### Para o SinalPlus: o que precisamos confirmar antes de implementar

- [ ] Formato de autenticação exato (token no header? Basic Auth? OAuth?) —
      a wiki menciona "gerar token de acesso" mas o passo a passo não foi
      capturado publicamente.
- [ ] Endpoint exato para listar colaboradores/técnicos/atendentes
      cadastrados (provavelmente dentro de "Cadastros", mas não confirmado).
- [ ] Endpoint para consultar ordens de serviço concluídas (dentro de
      "Suporte") e se há filtro por data/status/responsável.
- [ ] Existência (ou não) de webhooks nativos para "O.S. concluída" — a
      documentação pública não menciona webhooks; é possível que a
      integração precise ser por **polling periódico** via API em vez de
      evento em tempo real (confirmar com o provedor cliente, ex. GigaNetPe,
      que já usa IXC).
- [ ] Rate limits / limites de requisições por minuto.
- [ ] Ambiente de homologação/sandbox disponível (não identificado
      publicamente para o IXC — diferente do SGP, que tem sandbox claro).

---

## 2. SGP (TSMX)

### Links oficiais
- Wiki/Books gerais: https://bookstack.sgp.net.br/books
- Book "API" (índice): https://bookstack.sgp.net.br/books/api
- Página para desenvolvedores (sandbox, credenciais, suporte):
  https://www.tsmx.net.br/developers
- Documentação de referência completa da API: **api.sgp.net.br** (citada
  na página de desenvolvedores, não explorada diretamente ainda)
- Coleção Postman com todos os endpoints:
  https://documenter.getpostman.com/view/6682240/2sB34hHg2V

### O que a documentação pública mostra

**Métodos de autenticação da API** (confirmados):
1. **Basic** — usuário e senha do SGP (os mesmos de login no painel).
2. **Token** — gerado no painel admin do SGP, na seção de ferramentas.
3. **CPF/CNPJ + senha da Central do Assinante** — usado para autenticar o
   **cliente final** (não um admin/integração), dados que ficam no
   contrato de prestação de serviço do assinante.

**Endpoints conhecidos** (extraídos da página de desenvolvedores — lista
parcial, não exaustiva):

| Método | Endpoint | Função |
|---|---|---|
| GET | `/api/ura/clientes/` | Consulta dados do cliente |
| GET | `/api/ura/fatura2via/` | Gera a 2ª via de fatura |
| GET | `/api/ura/titulos/` | Lista os títulos (financeiro) do cliente |
| GET | `/api/os/list/` | Lista ordens de serviço |
| POST | `/api/ura/chamado/` | Abre chamado (via URA) |
| PUT | `/api/os/update/id/{os_id}/` | Atualiza uma ordem de serviço |

> O padrão de URL (`/api/os/...`) sugere que existem outros recursos sob o
> mesmo prefixo (ex.: criação de O.S., consulta por técnico responsável) —
> confirmar na coleção do Postman linkada acima.

**Ambiente de testes (sandbox)**:
- Existe um ambiente de demonstração separado da produção, em
  `demo.sgp.net.br`, com dados fictícios.
- Simula PIX, boleto e cartão, e emissão de nota fiscal em modo teste —
  ótimo para testar o fluxo de sincronização sem mexer em dados reais de
  um provedor cliente.
- Credenciais de demonstração disponíveis na própria página de
  desenvolvedores; também é possível gerar credenciais via API.

**Books relevantes no wiki** (além de "API"), que podem ter informação útil
para a integração:
- Autenticando Clientes
- Clientes
- Contratos
- Atendimento
- Aplicativo do Técnico (pode revelar como o SGP já representa
  tecnicos/colaboradores internamente)
- Gateways de Cartão de Crédito / Carteiras Bancárias (não relevante para
  o SinalPlus, mas existe caso surja necessidade de cobrança)

**Suporte técnico do fornecedor**: e-mail
`desenvolvimento@sgp.net.br`, WhatsApp, atendimento seg-sex 8h-18h — útil
para esclarecer dúvidas de implementação direto com a TSMX.

### Para o SinalPlus: o que precisamos confirmar antes de implementar

- [ ] Explorar a **coleção do Postman** (link acima) endpoint por endpoint
      — é a fonte mais completa e estruturada encontrada até agora.
- [ ] Confirmar se existe endpoint específico para **listar colaboradores/
      usuários internos do provedor** (os endpoints encontrados são
      focados em cliente final e O.S., não em colaboradores) — os
      endpoints acima (`/api/ura/*`) parecem voltados à URA/autoatendimento
      do assinante, não à gestão interna de equipe.
- [ ] Testar autenticação por **Token** no ambiente sandbox
      (`demo.sgp.net.br`) antes de qualquer integração real.
- [ ] Confirmar existência (ou não) de webhooks para eventos de O.S.
      concluída — não identificado na documentação pública; pode ser
      necessário usar `GET /api/os/list/` com polling periódico e filtro
      por data/status.
- [ ] Rate limits da API.

---

## 2.1 Validação com acessos de teste (22/10/2026)

Testes somente leitura, feitos do ambiente de nuvem com as variáveis
`IXC_TESTE_*` e `SGP_TESTE_*` (seção 6). Nenhum dado pessoal foi guardado.

### IXC (GigaNetPe) — funcionando

- **Autenticação**: `Authorization: Basic base64(<token>)`, em que o token
  já vem no formato `<id>:<hash>` gerado pelo IXC. O `<id>` do token **não**
  é o ID do usuário da API, então o conector deve usar o token inteiro.
- **Listagem**: `POST <URL>/webservice/v1/<tabela>` com o header
  `ixcsoft: listar` e corpo JSON
  `{"qtype":"<tabela>.<campo>","query":"...","oper":"=|>|>=|<|like","page":"1","rp":"<qtd>","sortname":"<tabela>.<campo>","sortorder":"asc|desc"}`.
  A resposta é `{"page","total","registros":[...]}` com todos os valores
  como string (content-type `text/x-json`).
- **Colaboradores**: tabela `funcionarios` existe e é acessível (campos úteis:
  `id`, `funcionario` (nome), `email`, `fone_celular`, `ativo` (`S`/`N`),
  `data_demissao`, `filial_id`, `id_departamento`, `id_funcao`). Na
  GigaNetPe: 7 funcionários, 6 com e-mail. Também há `usuarios` (logins do
  sistema).
- **O.S. concluídas**: tabela `su_oss_chamado`, `status = "F"` (outros vistos:
  `A`, `AG`, `EX`). Filtro por data funciona com
  `qtype=su_oss_chamado.data_fechamento`, `oper=">="`. Campos úteis: `id`,
  `id_cliente`, `id_tecnico` (casa com `funcionarios.id`), `id_assunto`
  (tabela `su_oss_assunto`, 26 assuntos), `id_filial`, `data_fechamento`,
  `protocolo`, `status_pesquisa_satisfacao`, `ultima_atualizacao`.
  Volume: ~1.500 O.S. fechadas, ~100 em outubro/2026; todas com técnico.
- **Clientes**: tabela `cliente` (campos `razao`, `fone`, `telefone_celular`,
  `whatsapp`, `email`, `ativo`).
- **Filial**: o ID da filial não foi exigido nas listagens; as O.S. vêm de
  3 filiais e podem ser filtradas por `id_filial`.
- **Webhook**: não encontrado; seguir com consulta periódica por
  `data_fechamento`/`ultima_atualizacao`.
- **Atenção de segurança**: o usuário de teste lê campos sensíveis que o
  SinalPlus não precisa (salário e dados bancários em `funcionarios`, senhas
  de NFS-e em `filial`, `senha` em `cliente`). Em produção, o grupo da API
  deve ter só as permissões da seção 6 e o conector deve descartar tudo que
  não for usado.

### SGP — ainda não autenticou

- A URL de teste configurada é a de um SGP real (não o `demo.sgp.net.br`).
- `POST /api/ura/clientes/` e `POST /api/os/list/` com `token` e `app` no
  corpo (form, multipart, JSON ou querystring) respondem
  `403 {"detail":"Credenciais de autenticação incorretas."}`. Sem os campos,
  a resposta é "As credenciais de autenticação não foram fornecidas", ou
  seja, o formato está certo e o par token/app é que foi recusado.
- O `demo.sgp.net.br` e o `bookstack.sgp.net.br` estão bloqueados pela rede
  do ambiente de nuvem.
- Próximo passo: conferir no painel do SGP (Administração > Integrações >
  Tokens) se o token está ativo e o nome exato do App, ou liberar o
  `demo.sgp.net.br` para testar com `demo`/`demo`.

## 3. Comparativo rápido (o que já dá pra concluir)

| Aspecto | IXC | SGP |
|---|---|---|
| Autenticação | Token (mecanismo exato não confirmado publicamente) | Basic, Token, ou CPF/CNPJ+senha (para cliente final) |
| Sandbox/homologação | Não identificado publicamente | Sim — `demo.sgp.net.br`, com dados fictícios |
| Documentação centralizada de endpoints | Dispersa em wiki (menu), sem corpo de página capturável publicamente | Coleção Postman dedicada (mais fácil de explorar) |
| Endpoints de O.S. confirmados | Não (módulo "Suporte" existe, endpoints não confirmados) | Sim: `GET /api/os/list/`, `PUT /api/os/update/id/{id}/` |
| Endpoints de colaboradores/equipe confirmados | Não | Não confirmado — endpoints encontrados são voltados ao cliente final/URA |
| Webhooks nativos | Não identificado | Não identificado |
| Suporte ao desenvolvedor | Não identificado um canal direto | E-mail e WhatsApp dedicados (`desenvolvimento@sgp.net.br`) |

## 4. Próximos passos recomendados (quando for implementar de verdade)

1. **Para o SGP**: comece pelo sandbox (`demo.sgp.net.br`) e pela coleção
   do Postman — é o caminho mais rápido para um protótipo funcional, já
   que há ambiente de teste pronto.
2. **Para o IXC**: como a GigaNetPe (cliente já documentado em outros
   projetos) usa IXC, o caminho mais rápido é **pedir ao próprio provedor
   acesso de API de homologação/teste** e a documentação completa da
   seção "Informações API" da wiki, em vez de depender só do conteúdo
   público indexável.
3. Em ambos os casos, **validar primeiro se existe algum endpoint — ou
   relatório exportável — que liste tecnicamente "colaboradores/usuários
   internos do sistema"**, já que essa é a necessidade central do conector
   descrito no `02-ARQUITETURA-STACK.md` do SinalPlus (seção 7,
   `ConectorERP`). Os endpoints públicos encontrados até agora são mais
   voltados a cliente final (URA) e O.S. do que a colaboradores.
4. Manter as credenciais de API de cada provedor cliente sempre
   criptografadas em repouso (já é requisito definido no
   `02-ARQUITETURA-STACK.md`, seção 9).

## 5. Como usar este documento em outros projetos

Este arquivo não depende do SinalPlus — qualquer projeto futuro que precise
ler dados de um provedor de internet que use IXC ou SGP pode partir direto
daqui. Ao começar uma nova integração:
1. Releia este documento.
2. Marque os itens do checklist que já foram confirmados naquele projeto
   específico (credenciais obtidas, endpoints testados).
3. Atualize este arquivo com o que for descoberto de novo — ele é
   cumulativo entre projetos.

## 6. Como gerar o acesso de teste (passo a passo)

Para a Fase 2 do SinalPlus Telecom precisamos de um acesso **somente
leitura** em cada sistema. O conector só lê colaboradores, clientes e O.S.;
nunca grava nada no ERP do provedor.

### IXC Provedor (no sistema da GigaNetPe)

Fonte: [Como gerar um Token para integrações API](https://wiki-erp.ixcsoft.com.br/documentacao/guias-tutoriais/api/como-gerar-um-token-para-integracoes-api.html)
(wiki oficial do IXC).

1. **Crie um grupo só para a integração** em
   **Configurações > Usuários > Grupo de usuários** (pode duplicar um grupo
   existente e tirar o que não precisa). Dê a ele permissão **apenas de
   leitura/consulta** em:
   - Funcionários (tabela `funcionarios`) — técnicos, atendentes e vendedores;
   - Ordens de serviço / chamados (tabela `su_oss_chamado`);
   - Clientes (tabela `cliente`) — nome, telefone e e-mail para a pesquisa;
   - Filiais (em **Configurações > Empresa > Filiais**) — anote também o
     **ID da filial**, que o IXC exige desde a versão 79.28.8.
2. Na seção **Permissão de login** desse grupo, campo **Redes permitidas**,
   o IXC pode restringir por IP. Se a GigaNetPe exigir, peça o IP de onde os
   testes vão rodar antes de liberar (em produção será o IP do servidor do
   SinalPlus Telecom).
3. **Crie um usuário exclusivo** para a integração em
   **Configurações > Usuários > Usuário > Novo** (ex.: `api-sinalplus`), no
   grupo do passo 1. Usuário exclusivo deixa claro nos logs do IXC o que foi
   feito pela integração.
4. Na seção **API** do usuário, marque **Permite acesso a API** e salve. O
   token aparece no campo **Token de acesso** (em algumas versões o botão é
   **Gerar token API**, na aba Webservice).
5. Anote: **URL do IXC** (ex.: `https://ixc.giganetpe.com.br`), **ID numérico
   do usuário** criado, **token** e **ID da filial**. A API fica em
   `<URL>/webservice/v1/`.

> Cuidado: o token é vinculado ao usuário. Se o e-mail ou a senha desse
> usuário mudarem, o token muda junto.

### SGP (TSMX)

Fonte: [Autenticações via API](https://bookstack.sgp.net.br/books/api/page/autenticacoes-via-api)
(BookStack oficial do SGP).

- **Sandbox público**: `demo.sgp.net.br`, usuário `demo`, senha `demo`
  (publicado na [página de desenvolvedores](https://www.tsmx.net.br/developers)).
  Dá para começar os testes por ele sem pedir nada a ninguém.
- **Token de um SGP real** (quando houver um provedor cliente com SGP):
  1. No painel do SGP, vá em **Administração > Integrações > Tokens**.
  2. Clique em **Adicionar Token**, dê um nome de identificação (ex.:
     `sinalplus`) e defina ou crie o **App** (ex.: `sinalplus`).
  3. Anote o **Token**, o nome do **App** e a **URL do SGP**. A autenticação
     por Token + App é a recomendada pela TSMX; Token e App vão no corpo de
     cada requisição.
  4. Dúvidas de endpoint: `desenvolvimento@sgp.net.br` (suporte da TSMX).

### Como entregar as credenciais

Não cole tokens no chat. Cadastre-os como variáveis de ambiente do ambiente
de nuvem do projeto (Configurações do projeto > Cloud environment > Add cloud
environment), com estes nomes:

| Variável | Conteúdo |
|---|---|
| `IXC_TESTE_URL` | URL do IXC da GigaNetPe |
| `IXC_TESTE_USUARIO_ID` | ID numérico do usuário da API |
| `IXC_TESTE_TOKEN` | token gerado no passo 4 |
| `IXC_TESTE_FILIAL_ID` | ID da filial |
| `SGP_TESTE_URL` | URL do SGP (para o sandbox: `https://demo.sgp.net.br`) |
| `SGP_TESTE_TOKEN` / `SGP_TESTE_APP` | token e app (não precisa para o sandbox) |
