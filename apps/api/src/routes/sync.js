import { SYNC_RATE_LIMIT_MS } from 'shared';
import { applySync } from '../game/sync.js';
import { serializePlayer } from '../db/queries.js';
import { checkQualified } from '../referral/attribute.js';
import { prisma } from '../db/client.js';

export async function syncRoutes(app) {
  app.post(
    '/sync',
    {
      preHandler: app.authenticate,
      config: {
        rateLimit: {
          max: 1,
          timeWindow: SYNC_RATE_LIMIT_MS,
          hook: 'preHandler',
          keyGenerator: (request) => (request.player ? String(request.player.id) : request.ip),
        },
      },
    },
    async (request) => {
      const { taps, nonce } = request.body || {};
      const player = request.player;

      // replay do mesmo nonce -> devolve o estado atual sem reaplicar
      if (nonce && player.lastSyncNonce === nonce) {
        return { state: serializePlayer(player), earned: 0 };
      }

      const result = applySync(player, taps, Date.now());

      if (result.anomaly) {
        request.log.warn(
          { playerId: Number(player.id), taps },
          'taxa de toques acima do esperado'
        );
      }

      const updated = await prisma.player.update({
        where: { id: player.id },
        data: {
          coins: { increment: BigInt(result.earned) },
          total: { increment: BigInt(result.earned) },
          energy: result.energy,
          energyTs: result.energyTs,
          lastSeen: result.energyTs,
          lastSyncNonce: nonce ?? null,
        },
      });

      await checkQualified(updated);

      return { state: serializePlayer(updated), earned: result.earned };
    }
  );
}
