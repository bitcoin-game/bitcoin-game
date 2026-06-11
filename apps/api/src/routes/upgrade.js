import { UPGRADES, upgradeCost, statsFromLevels } from 'shared';
import { serializePlayer } from '../db/queries.js';
import { prisma } from '../db/client.js';

const LEVEL_FIELD = { mult: 'multN', batt: 'battN', chg: 'chgN', auto: 'autoN' };

export async function upgradeRoutes(app) {
  app.post('/upgrade', { preHandler: app.authenticate }, async (request, reply) => {
    const { kind } = request.body || {};
    if (!UPGRADES[kind]) return reply.code(400).send({ error: 'upgrade inválido' });

    const player = request.player;
    const levelField = LEVEL_FIELD[kind];
    const currentLevel = player[levelField];

    if (currentLevel >= UPGRADES[kind].maxLevel) {
      return reply.code(400).send({ error: 'nível máximo atingido' });
    }

    const cost = upgradeCost(kind, currentLevel);
    if (Number(player.coins) < cost) {
      return reply.code(400).send({ error: 'saldo insuficiente' });
    }

    const newLevel = currentLevel + 1;
    const stats = statsFromLevels({ ...player, [levelField]: newLevel });

    const updated = await prisma.player.update({
      where: { id: player.id },
      data: {
        coins: { decrement: BigInt(cost) },
        [levelField]: newLevel,
        perTap: stats.perTap,
        maxEnergy: stats.maxEnergy,
        regen: stats.regen,
      },
    });

    return { state: serializePlayer(updated) };
  });
}
