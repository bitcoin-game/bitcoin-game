import { OFFLINE_CAP_S, statsFromLevels } from 'shared';

// Calcula e credita o ganho de idle/offline desde o último `lastSeen`,
// usando o relógio do servidor. Chamado em /api/session quando o jogador volta.
export function applyOffline(player, now = Date.now()) {
  const elapsed = Math.max(0, (now - player.lastSeen.getTime()) / 1000);
  const capped = Math.min(elapsed, OFFLINE_CAP_S);
  const { autoRate } = statsFromLevels(player);
  const gain = Math.floor(capped * autoRate);

  return { gain, elapsed: capped, now: new Date(now) };
}
