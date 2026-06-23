import {
  BOSS_LEVELS,
  bossDamagePerTap,
  bossMaxTaps,
  bossDef,
  bossHardUnlocked,
  BOSS_HARD_MIN_TOTAL,
  BOSS_HARD_COOLDOWN_S,
} from 'shared';
import { serializePlayer } from '../db/queries.js';
import { checkQualified } from '../referral/attribute.js';
import { prisma } from '../db/client.js';

export async function bossRoutes(app) {
  app.post('/boss/resolve', { preHandler: app.authenticate }, async (request, reply) => {
    const { level, taps, difficulty = 'easy' } = request.body || {};
    if (difficulty !== 'easy' && difficulty !== 'hard') {
      return reply.code(400).send({ error: 'dificuldade inválida' });
    }
    const base = BOSS_LEVELS.find((b) => b.level === level);
    if (!base) return reply.code(400).send({ error: 'boss inválido' });

    const player = request.player;

    // Gate + cooldown valem SÓ no Hard. Easy = caminho original, intacto.
    if (difficulty === 'hard') {
      if (!bossHardUnlocked(player.total)) {
        return reply.code(403).send({ error: 'boss_hard_locked', minTotal: BOSS_HARD_MIN_TOTAL });
      }
      if (player.bossTs) {
        const elapsedS = (Date.now() - player.bossTs.getTime()) / 1000;
        if (elapsedS < BOSS_HARD_COOLDOWN_S) {
          return reply
            .code(429)
            .send({ error: 'boss_hard_cooldown', retryAfterS: Math.ceil(BOSS_HARD_COOLDOWN_S - elapsedS) });
        }
      }
    }

    const def = bossDef(level, difficulty);
    const maxTaps = bossMaxTaps(level, difficulty); // teto de toques CIENTE da dificuldade: o hard usa o timeLimitS escalado, senão o HP inflado vira invencível
    const validTaps = Math.max(0, Math.min(Math.floor(Number(taps) || 0), maxTaps));

    const dmgPerTap = bossDamagePerTap(player);
    const damage = validTaps * dmgPerTap;
    const win = damage >= def.hp;

    let player2 = player;
    if (difficulty === 'hard') {
      // marca a tentativa (vitória OU derrota) p/ disparar o cooldown — perder
      // também "gasta" a janela, então o downside é real e não dá pra farmar.
      const data = { bossTs: new Date() };
      if (win) {
        data.coins = { increment: BigInt(def.reward) };
        data.total = { increment: BigInt(def.reward) };
      }
      player2 = await prisma.player.update({ where: { id: player.id }, data });
      if (win) await checkQualified(player2);
    } else if (win) {
      player2 = await prisma.player.update({
        where: { id: player.id },
        data: {
          coins: { increment: BigInt(def.reward) },
          total: { increment: BigInt(def.reward) },
        },
      });
      await checkQualified(player2);
    }

    return { win, damage, hp: def.hp, reward: win ? def.reward : 0, difficulty, state: serializePlayer(player2) };
  });
}
