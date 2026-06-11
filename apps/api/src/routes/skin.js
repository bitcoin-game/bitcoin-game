import { SKINS } from 'shared';
import { serializePlayer } from '../db/queries.js';
import { prisma } from '../db/client.js';

export async function skinRoutes(app) {
  app.post('/skin', { preHandler: app.authenticate }, async (request, reply) => {
    const { action, skinId } = request.body || {};
    const skin = SKINS[skinId];
    if (!skin) return reply.code(400).send({ error: 'skin inválida' });

    const player = request.player;
    const owned = Array.isArray(player.ownedSkins) ? player.ownedSkins : [];

    if (action === 'buy') {
      if (owned.includes(skinId)) return reply.code(400).send({ error: 'skin já possuída' });

      if (skin.unlock === 'coins' && Number(player.coins) < skin.cost) {
        return reply.code(400).send({ error: 'saldo insuficiente' });
      }

      const data = { ownedSkins: [...owned, skinId] };
      if (skin.unlock === 'coins') data.coins = { decrement: BigInt(skin.cost) };

      const updated = await prisma.player.update({ where: { id: player.id }, data });
      return { state: serializePlayer(updated) };
    }

    if (action === 'equip') {
      if (!owned.includes(skinId)) return reply.code(400).send({ error: 'skin não possuída' });

      const updated = await prisma.player.update({
        where: { id: player.id },
        data: { equippedSkin: skinId },
      });
      return { state: serializePlayer(updated) };
    }

    return reply.code(400).send({ error: 'ação inválida' });
  });
}
