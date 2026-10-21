# Deploy em Servidor Debian

> Referência: `02-ARQUITETURA-STACK.md`. Guia para instalar e colocar a
> aplicação em produção em um servidor Debian limpo (testado mentalmente
> para Debian 12 "bookworm").

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
| `REDIS_URL` | `redis://localhost:6379` (a partir da Fase 2) |

> Não rode `npm run db:seed` em produção: ele cria usuários de exemplo com
> senha conhecida. O primeiro `SUPER_ADMIN` de produção deve ser criado com
> senha própria (script de criação a ser adicionado na Fase 1).

## 9. PM2 (gerenciador de processo)

```bash
sudo npm install -g pm2
cd /var/www/sinalplus/app
pm2 start npm --name sinalplus-web -- start
pm2 start npm --name sinalplus-worker -- run worker   # filas BullMQ — só a partir da Fase 2
pm2 save
pm2 startup systemd -u sinalplus --hp /var/www/sinalplus
```

## 10. Nginx como proxy reverso

Arquivo `/etc/nginx/sites-available/sinalplus`:

```nginx
server {
    listen 80;
    server_name sinalplus.com.br *.sinalplus.com.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;   # obrigatório: o tenant é resolvido pelo Host
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

## 11. HTTPS com Let's Encrypt (Certbot)

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
