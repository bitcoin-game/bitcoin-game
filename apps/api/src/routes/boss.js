import { BOSS_LEVELS, bossDamagePerTap, bossMaxTaps } from 'shared';
import { serializePlayer } from '../db/queries.js';
import { checkQualified } from '../referral/attribute.js';
import { prisma } from '../db/client.js';

export async function bossRoutes(app) {
  app.post('/boss/resolve', { preHandler: app.authenticate }, async (request, reply) => {
    const { level, taps } = request.body || {};
    const def = BOSS_LEVELS.find((b) => b.level === level);
    if (!def) return reply.code(400).send({ error: 'boss inválido' });

    const player = request.player;
    const maxTaps = bossMaxTaps(level); // teto de toques no tempo do boss
    const validTaps = Math.max(0, Math.min(Math.floor(Number(taps) || 0), maxTaps));

    const dmgPerTap = bossDamagePerTap(player);
    const damage = validTaps * dmgPerTap;
    const win = damage >= def.hp;

    let player2 = player;
    if (win) {
      player2 = await prisma.player.update({
        where: { id: player.id },
        data: {
          coins: { increment: BigInt(def.reward) },
          total: { increment: BigInt(def.reward) },
        },
      });
      await checkQualified(player2);
    }

    return { win, damage, hp: def.hp, reward: win ? def.reward : 0, state: serializePlayer(player2) };
  });
}
