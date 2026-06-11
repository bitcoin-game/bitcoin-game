import { prisma } from './client.js';

// BigInt não serializa em JSON; o jogo nunca chega perto de 2^53, então
// convertemos coins/total/ids para Number na borda da API.
export function serializePlayer(player) {
  if (!player) return null;
  return {
    id: Number(player.id),
    username: player.username,
    firstName: player.firstName,
    coins: Number(player.coins),
    total: Number(player.total),
    perTap: player.perTap,
    maxEnergy: player.maxEnergy,
    regen: player.regen,
    energy: player.energy,
    multN: player.multN,
    battN: player.battN,
    chgN: player.chgN,
    autoN: player.autoN,
    equippedSkin: player.equippedSkin,
    ownedSkins: player.ownedSkins,
    referredBy: player.referredBy != null ? Number(player.referredBy) : null,
    refCount: player.refCount,
  };
}

export async function getPlayer(id) {
  return prisma.player.findUnique({ where: { id: BigInt(id) } });
}

export async function upsertPlayerFromTelegram(tgUser) {
  const id = BigInt(tgUser.id);
  return prisma.player.upsert({
    where: { id },
    update: {
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
    },
    create: {
      id,
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
    },
  });
}

export async function setReferredBy(playerId, referrerId) {
  return prisma.player.update({
    where: { id: BigInt(playerId) },
    data: { referredBy: BigInt(referrerId) },
  });
}

export async function createReferral({ referrerId, refereeId }) {
  return prisma.referral.create({
    data: {
      referrerId: BigInt(referrerId),
      refereeId: BigInt(refereeId),
      status: 'pending',
    },
  });
}

export async function getPendingReferral(refereeId) {
  return prisma.referral.findFirst({
    where: { refereeId: BigInt(refereeId), status: 'pending' },
  });
}

export async function rewardReferral(referralId) {
  return prisma.referral.update({
    where: { id: referralId },
    data: { status: 'rewarded', rewardedAt: new Date() },
  });
}

export async function addCoins(playerId, amount) {
  return prisma.player.update({
    where: { id: BigInt(playerId) },
    data: {
      coins: { increment: BigInt(amount) },
      total: { increment: BigInt(amount) },
    },
  });
}

export async function incrRefCount(playerId) {
  return prisma.player.update({
    where: { id: BigInt(playerId) },
    data: { refCount: { increment: 1 } },
  });
}

export async function countQualifiedReferralsToday(referrerId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.referral.count({
    where: {
      referrerId: BigInt(referrerId),
      status: 'rewarded',
      rewardedAt: { gte: startOfDay },
    },
  });
}

export async function getLeaderboard(limit = 100) {
  const players = await prisma.player.findMany({
    orderBy: { total: 'desc' },
    take: limit,
    select: { id: true, username: true, firstName: true, total: true, equippedSkin: true },
  });
  return players.map((p) => ({
    id: Number(p.id),
    username: p.username,
    firstName: p.firstName,
    total: Number(p.total),
    equippedSkin: p.equippedSkin,
  }));
}
