# Bitcoin Game — Telegram Mini App (Fase 1)

Monorepo: `packages/shared` (config compartilhada), `apps/api` (Fastify +
Prisma/Postgres), `apps/miniapp` (React + Vite).

> **Status atual: fatia vertical local funcional.** O backend autoritativo e o
> frontend CRT estão de pé e validados em ambiente de desenvolvimento, mas a
> Fase 1 da spec ainda não está fechada — faltam itens de auth real, infra e
> hardening listados abaixo antes de considerar a Fase 1 completa.

## Como rodar local

```bash
npm install
docker compose up -d          # Postgres local na porta 5434
cp apps/api/.env.example apps/api/.env   # preencher BOT_TOKEN, JWT_SECRET, DATABASE_URL
npm run prisma:migrate        # aplica as migrations (Player, Referral)

npm run dev:api       # API em http://localhost:3000
npm run dev:miniapp   # Mini App em http://localhost:5180 (proxy /api -> :3000)
```

Portas: API `:3000`, miniapp (Vite) `:5180`, Postgres `:5434`.

### Bypass de auth de dev

Fora do Telegram, `apps/miniapp/src/telegram.js` gera um `initData` fake com
`dev=1` e um usuário fixo (`id=1`). Para a API aceitar isso, defina
`ALLOW_DEV_AUTH=true` no `apps/api/.env` (**NUNCA em produção** — esse modo
pula completamente a verificação HMAC do Telegram).

## ✅ Feito e verificado

- **Backend autoritativo**: `POST /api/session`, `POST /api/sync`,
  `POST /api/upgrade`, `POST /api/skin`, `POST /api/boss/resolve`,
  `GET /api/leaderboard`.
- **Atribuição de indicação "Player 2"** no `/session` (via `start_param`).
- **Modelo de energia anti-cheat** — verificado: rate-limit do `/sync`
  retorna 429 ao exceder 1 req/2s, e replay do mesmo `nonce` é rejeitado
  (idempotência).
- **Frontend CRT** portado de `bitcoin-game-prototype.html` sobre o app
  Vite/React, com tap otimista + reconciliação periódica via `/sync`
  — verificado: energia 500→496, saldo 62→74, high score atualizando, sem
  erros de console.
- **Compra/equip de skin** (`/api/skin`) — verificado de ponta a ponta:
  comprar "Neon Arcade" debita o saldo (6068 → 1068, custo 5000), equipar
  atualiza `equippedSkin`, e o estado persiste em uma nova sessão
  (`ownedSkins` e `equippedSkin` corretos após novo `/session`).
- **Welcome-back / offline gain** — verificado: com `lastSeen` simulado 1h no
  passado e `autoN=2`, o `/session` retornou `offlineGain` calculado
  corretamente (capado em `OFFLINE_CAP_S`), e o modal "WELCOME BACK, PLAYER"
  exibiu o valor correto na UI, fechando ao clicar em "COLETAR".

## ⏳ Pendente para a Fase 1 fechar

- **Auth real do Telegram**: até agora `validateInitData` (HMAC) só foi
  exercitado via **bypass de modo dev** (`ALLOW_DEV_AUTH=true` + `dev=1` +
  usuário fixo `id=1`). **Nunca foi testado contra um cliente Telegram real**
  — é preciso validar o fluxo de `initData` assinado de verdade dentro do
  Telegram.
- **Setup do bot no BotFather** + registro do Mini App (URL, menu button,
  etc).
- **Deploy HTTPS** — exigido pelo Telegram para o WebApp funcionar fora do
  ambiente de dev local.
- **Redis** para rate-limit/cache em escala (hoje o rate-limit e o cache do
  leaderboard são in-memory, ok apenas para 1 instância).
- **Passe final de hardening anti-cheat** (revisão de limites, anomalias de
  taps, edge cases de sync).

---

## Deploy manual (Railway)

> O código está pronto para deploy single-origin: a API serve o build do
> frontend via `@fastify/static` na mesma porta/domínio. Os passos abaixo
> são os que você executa manualmente — o código e o Dockerfile já estão
> configurados.

### 1. Criar projeto e conectar repo

1. **railway.app → New Project → Deploy from GitHub repo** → selecione este
   repositório.
2. Railway detecta o `Dockerfile` automaticamente (builder configurado em
   `railway.toml`).

### 2. Provisionar Postgres

1. No painel do projeto → **Add Service → Database → PostgreSQL**.
2. Copie a `DATABASE_URL` gerada (aba **Variables** do serviço Postgres).

### 3. Variáveis de ambiente

Configure no serviço da **API** (não no Postgres). Veja também
`.env.production.example` na raiz do repo.

| Variável | Obrigatória | Descrição |
|---|:---:|---|
| `DATABASE_URL` | ✅ | URL copiada do Postgres provisionado |
| `BOT_TOKEN` | ✅ | Token gerado pelo @BotFather |
| `JWT_SECRET` | ✅ | String aleatória longa — gere com `openssl rand -hex 64` |
| `NODE_ENV` | ✅ | `production` |
| `PORT` | — | Railway injeta automaticamente; padrão `3000` |
| `JWT_EXPIRES_IN` | — | Duração do JWT de sessão; padrão `1h` |
| `OFFLINE_CAP_S` | — | Teto de idle offline em segundos; padrão `3600` |

> **Atenção:** `ALLOW_DEV_AUTH` **jamais** deve ser definida em produção.
> O servidor recusa o boot com `process.exit(1)` se detectar
> `NODE_ENV=production` + `ALLOW_DEV_AUTH=true`.

### 4. Deploy

Após o push para `main` o Railway faz o build via Dockerfile:

1. `npm ci` — instala dependências
2. `npm run build --workspace=apps/miniapp` — gera `apps/miniapp/dist`
3. `npm run prisma:generate` — gera o Prisma Client
4. Na inicialização: `prisma migrate deploy` — aplica migrations pendentes
5. `node apps/api/src/server.js` — sobe a API servindo o estático

Verifique o healthcheck em `https://<domínio>/api/leaderboard`.

### 5. Configurar o bot no BotFather

Execute os comandos abaixo no chat com **@BotFather** no Telegram:

```
/newbot
  → escolha nome e @username para o bot
  → guarde o token gerado → BOT_TOKEN

/newapp
  → selecione o bot criado
  → título: Bitcoin Game
  → descrição: Tap, mine & upgrade
  → foto: imagem 640×360 px (obrigatória)
  → URL do Web App: https://<domínio-railway>/
  → nome curto (slug): game

/setmenubutton
  → selecione o bot
  → tipo: Web App
  → URL: https://<domínio-railway>/
```

**Link direto para abrir o app:**
```
https://t.me/<@username>/<slug>
```
Exemplo: `https://t.me/BitcoinGameBot/game`

**Deep link de indicação** (parâmetro `start_param` lido em `/api/session`):
```
https://t.me/<@username>/<slug>?startapp=ref_<id-do-jogador>
```
Exemplo: `https://t.me/BitcoinGameBot/game?startapp=ref_42`
