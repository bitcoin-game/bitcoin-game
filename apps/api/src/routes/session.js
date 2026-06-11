import { validateInitData } from '../auth/validateInitData.js';
import { upsertPlayerFromTelegram, serializePlayer, getPlayer } from '../db/queries.js';
import { applyOffline } from '../game/offline.js';
import { attributeOnCreate } from '../referral/attribute.js';
import { prisma } from '../db/client.js';

export async function sessionRoutes(app) {
  app.post('/session', async (request, reply) => {
    const { initData } = request.body || {};
    if (!initData) return reply.code(400).send({ error: 'initData obrigatório' });

    let parsed;
    try {
      parsed = validateInitData(initData, process.env.BOT_TOKEN, process.env.ALLOW_DEV_AUTH === 'true');
    } catch (err) {
      return reply.code(401).send({ error: err.message });
    }

    const { user: tgUser, startParam } = parsed;

    const existing = await getPlayer(tgUser.id);
    const isNew = !existing;

    let player = await upsertPlayerFromTelegram(tgUser);

    if (isNew && startParam) {
      await attributeOnCreate(player.id, startParam);
      player = await getPlayer(player.id); // recarrega com referredBy preenchido
    }

    const { gain, now } = applyOffline(player, Date.now());

    player = await prisma.player.update({
      where: { id: player.id },
      data: {
        coins: { increment: BigInt(gain) },
        total: { increment: BigInt(gain) },
        lastSeen: now,
      },
    });

    const token = await reply.jwtSign(
      { id: Number(player.id) },
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    return { token, state: serializePlayer(player), offlineGain: gain };
  });
}
