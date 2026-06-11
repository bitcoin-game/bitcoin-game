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
