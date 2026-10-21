# Deploy em Servidor Debian

> Referência: `02-ARQUITETURA-STACK.md`. Guia para instalar e colocar a
> aplicação em produção em um servidor Debian limpo (testado mentalmente
> para Debian 12 "bookworm").

> **Servidor da Aplivora (já em produção com outros produtos).** O proxy
> reverso é o **Caddy** (`/etc/caddy/Caddyfile`), não o Nginx. Neste caso,
> **não instale `nginx` nem mexa no `ufw`** (seções 2 e 3 valem só para um
> servidor limpo), use a seção 10 (Caddy) e confira o estado real antes de
> qualquer mudança: `docker ps`, `ss -lntp` e
> `caddy validate --config /etc/caddy/Caddyfile`. Convenções do servidor:
> projeto em `/opt/sinalplus/gamificacaotelecom` (caminho completo nos
> comandos), porta publicada só em `127.0.0.1`, e uma porta livre no host
> (proposta: `3600`, ocupadas hoje: 3000, 3001, 3100, 3200, 3300, 3400,
> 3410, 3411, 3500 e 35432; confirme com `ss -lntp`). Os exemplos abaixo
> usam `/var/www/sinalplus/app` e a porta 3000; troque pelos valores do servidor.

## 1. Requisitos do servidor

- Debian 12 (bookworm) ou superior, acesso root/sudo.
- Mínimo recomendado: 2 vCPU, 2-4 GB RAM, 40 GB SSD (suficiente para o MVP
  com dezenas de tenants).
- Domínio próprio apontando para o IP do servidor (ex.: `sinalplus.com.br`
  com wildcard `*.sinalplus.com.br` para subdomínios de tenant).

## 2. Pacotes do sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw nginx postgresql postgresql-contrib redis-server
```

## 3. Firewall básico

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 4. Node.js (via NodeSource, versão LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

## 5. PostgreSQL — criar banco e usuário

```bash
sudo -u postgres psql <<'SQL'
CREATE USER sinalplus WITH PASSWORD 'TROCAR_SENHA_FORTE';
CREATE DATABASE sinalplus OWNER sinalplus;
SQL
```

Ajustar `DATABASE_URL` no `.env` da aplicação:

```
DATABASE_URL="postgresql://sinalplus:TROCAR_SENHA_FORTE@localhost:5432/sinalplus"
```

## 6. Redis

Redis já vem com configuração padrão segura para uso local (bind em
127.0.0.1). Confirmar:

```bash
sudo systemctl enable --now redis-server
redis-cli ping   # deve responder PONG
```

## 7. Usuário de sistema e pasta da aplicação

```bash
sudo adduser --system --group --home /var/www/sinalplus sinalplus
sudo mkdir -p /var/www/sinalplus
sudo chown -R sinalplus:sinalplus /var/www/sinalplus
```

## 8. Deploy do código

```bash
sudo -u sinalplus -i
cd /var/www/sinalplus
git clone <URL_DO_REPOSITORIO> app
cd app
cp .env.example .env     # preencher as variáveis abaixo
npm ci
npx prisma migrate deploy
npm run build
```

Variáveis obrigatórias no `.env` de produção:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | a URL criada na seção 5 |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `PLATAFORMA_DOMINIO` | domínio da plataforma, ex.: `sinalplus.com.br` (tenants ficam em `{slug}.sinalplus.com.br`) |
| `PLATAFORMA_NOME` | nome exibido só no domínio da plataforma |
| `CREDENCIAIS_CHAVE` | `openssl rand -base64 32` — cifra as credenciais de IXC/SGP; **guarde fora do servidor**, sem ela as credenciais salvas não podem ser lidas |
| `UPLOADS_DIR` | `/var/www/sinalplus/app/uploads` — logos, favicons e fotos de prêmio (entra no backup) |
| `REDIS_URL` | `redis://localhost:6379` (a partir da Fase 2) |

> Não rode `npm run db:seed` em produção: ele cria usuários de exemplo com
> senha conhecida. Crie o primeiro `SUPER_ADMIN` com senha própria (pedida no
> terminal, mínimo de 12 caracteres; rodar de novo troca a senha):
>
> ```bash
> npm run criar-super-admin -- --email voce@empresa.com.br --nome "Seu Nome"
> ```

## 9. PM2 (gerenciador de processo)

```bash
sudo npm install -g pm2
cd /var/www/sinalplus/app
pm2 start npm --name sinalplus-web -- start
pm2 start npm --name sinalplus-worker -- run worker   # filas BullMQ — só a partir da Fase 2
pm2 save
pm2 startup systemd -u sinalplus --hp /var/www/sinalplus
```

## 10. Proxy reverso: Caddy (servidor da Aplivora) ou Nginx

### Caddy (o que roda no servidor da Aplivora)

Antes de editar: backup do `Caddyfile`, e nunca alterar um bloco de outro
produto.

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F)
```

Bloco do SinalPlus Telecom (domínio da plataforma **a confirmar**; a proposta
é `sinalplus.aplivora.com.br`, com os provedores em
`{slug}.sinalplus.aplivora.com.br`, e `PLATAFORMA_DOMINIO` com o mesmo valor):

```caddy
sinalplus.aplivora.com.br, *.sinalplus.aplivora.com.br {
    encode zstd gzip

    # Imagens enviadas servidas direto do disco (opcional).
    handle_path /uploads/* {
        root * /opt/sinalplus/gamificacaotelecom/uploads
        header X-Content-Type-Options nosniff
        file_server
    }

    reverse_proxy 127.0.0.1:3600
}
```

- O Caddy repassa o `Host` original e **sobrescreve** `X-Forwarded-Host`,
  `X-Forwarded-For` e `X-Forwarded-Proto` (enquanto `trusted_proxies` não
  estiver configurado). O app resolve o provedor por esse host, então confirme
  depois de subir: `curl -sI https://demo.sinalplus.aplivora.com.br/login`.
- **Certificado wildcard**: `*.sinalplus.aplivora.com.br` exige validação por
  DNS (um Caddy com o plugin do provedor de DNS) e um registro DNS
  `*.sinalplus` apontando para o IP do servidor. Sem o plugin, a alternativa
  é o *on-demand TLS* do Caddy com um endpoint `ask` que só autoriza domínios
  de provedores cadastrados; ele chega com a automação de domínios da Fase 5.
  Até lá, publique cada provedor com um bloco próprio.
- Validar e só então recarregar, sem reiniciar o Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Nginx (servidor limpo, sem Caddy)

Arquivo `/etc/nginx/sites-available/sinalplus`:

```nginx
server {
    listen 80;
    server_name sinalplus.com.br *.sinalplus.com.br;

    # Opcional: imagens enviadas servidas direto do disco.
    location /uploads/ {
        alias /var/www/sinalplus/app/uploads/;
        add_header X-Content-Type-Options nosniff;
        expires 1y;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;   # obrigatório: o tenant é resolvido pelo Host
        proxy_set_header X-Forwarded-Host $host;   # sobrescreve o que o cliente mandar
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sinalplus /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 11. HTTPS

No Caddy o HTTPS é automático (seção 10). No Nginx, use o Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sinalplus.com.br -d *.sinalplus.com.br
```
> Wildcard exige validação via DNS (certbot vai pedir para criar um registro
> TXT no provedor de DNS). Alternativa mais simples no MVP: emitir
> certificado só para o domínio principal e para subdomínios específicos à
> medida que novos tenants forem criados.

## 12. Backups

- **Banco de dados**: `pg_dump` diário via cron, armazenado fora do
  servidor (ex.: enviado para um bucket externo ou outro servidor).
- **Uploads de imagens** (`/var/www/sinalplus/app/uploads`): incluir no
  backup diário (rsync ou tar + envio externo).

```bash
# exemplo simples de cron diário (crontab -e do usuário sinalplus)
0 3 * * * pg_dump sinalplus | gzip > /var/backups/sinalplus/db-$(date +\%F).sql.gz
```

## 13. Logs e monitoramento mínimo

```bash
pm2 logs sinalplus-web
pm2 monit
```
- Configurar `logrotate` para os logs do PM2 (`~/.pm2/logs`).
- Opcional: instalar **Uptime Kuma** (self-host, Docker ou Node) em outra
  porta para monitorar disponibilidade do domínio.

## 14. Atualizações (deploy de nova versão)

```bash
sudo -u sinalplus -i
cd /var/www/sinalplus/app
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 reload sinalplus-web
pm2 reload sinalplus-worker
```

## 15. Alternativa com Docker Compose (opcional, pós-MVP)

Se o projeto crescer e precisar rodar em mais de um servidor ou precisar de
ambientes de staging isolados, considerar migrar para um `docker-compose.yml`
com serviços `web`, `worker`, `postgres`, `redis` e `nginx` — mantendo o
mesmo schema Prisma e variáveis de ambiente, apenas mudando a forma de
orquestração. Não é necessário para o MVP em servidor único.
