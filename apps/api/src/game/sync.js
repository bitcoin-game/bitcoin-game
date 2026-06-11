import { MAX_TAPS_PER_SYNC, TAP_RATE_ANOMALY_PER_S } from 'shared';

// Núcleo do anti-cheat: recalcula energia pelo relógio do servidor, trava os
// toques reclamados ao teto fisicamente possível e credita as moedas que o
// PRÓPRIO servidor calcula (nunca o que o cliente manda).
//
// Retorna { earned, energy, energyTs, anomaly } — não persiste, quem chama
// decide como gravar.
export function applySync(player, claimedTaps, now = Date.now()) {
  const elapsedS = Math.max(0, (now - player.energyTs.getTime()) / 1000);
  let energy = Math.min(player.maxEnergy, player.energy + elapsedS * player.regen);

  let taps = Math.floor(Number(claimedTaps) || 0);
  if (!Number.isFinite(taps) || taps < 0) taps = 0;

  const anomaly = elapsedS > 0 && taps / elapsedS > TAP_RATE_ANOMALY_PER_S;

  taps = Math.max(0, Math.min(taps, Math.floor(energy), MAX_TAPS_PER_SYNC));

  energy -= taps;
  const earned = taps * player.perTap;

  return {
    earned,
    taps,
    energy,
    energyTs: new Date(now),
    anomaly,
  };
}
