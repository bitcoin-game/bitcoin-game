import 'dotenv/config';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { getPlayer } from './db/queries.js';
import { sessionRoutes } from './routes/session.js';
import { syncRoutes } from './routes/sync.js';
import { upgradeRoutes } from './routes/upgrade.js';
import { skinRoutes } from './routes/skin.js';
import { bossRoutes } from './routes/boss.js';
import { leaderboardRoutes } from './routes/leaderboard.js';

const app = Fastify({ logger: true });

await app.register(jwt, { secret: process.env.JWT_SECRET });
await app.register(rateLimit, { global: false });

// Decorator de autenticação: valida o JWT de sessão e carrega o player do DB.
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'não autorizado' });
  }

  const player = await getPlayer(request.user.id);
  if (!player) return reply.code(401).send({ error: 'jogador não encontrado' });
  request.player = player;
});

await app.register(sessionRoutes, { prefix: '/api' });
await app.register(syncRoutes, { prefix: '/api' });
await app.register(upgradeRoutes, { prefix: '/api' });
await app.register(skinRoutes, { prefix: '/api' });
await app.register(bossRoutes, { prefix: '/api' });
await app.register(leaderboardRoutes, { prefix: '/api' });

const port = Number(process.env.PORT) || 3000;
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
