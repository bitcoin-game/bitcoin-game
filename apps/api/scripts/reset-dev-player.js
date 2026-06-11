// Reseta o player de teste do bypass de auth dev (id=1) para os defaults
// de um jogador novo, sem afetar schema ou outros registros.
import { prisma } from '../src/db/client.js';

const DEV_PLAYER_ID = 1n;

await prisma.referral.deleteMany({
  where: { OR: [{ referrerId: DEV_PLAYER_ID }, { refereeId: DEV_PLAYER_ID }] },
});

const player = await prisma.player.update({
  where: { id: DEV_PLAYER_ID },
  data: {
    coins: 0n,
    total: 0n,
    perTap: 1,
    maxEnergy: 500,
    regen: 2,
    energy: 500,
    energyTs: new Date(),
    multN: 0,
    battN: 0,
    chgN: 0,
    autoN: 0,
    equippedSkin: 'classic',
    ownedSkins: ['classic'],
    referredBy: null,
    refCount: 0,
    lastSyncNonce: null,
    lastSeen: new Date(),
  },
});

console.log('--- player (depois) ---');
console.log(JSON.stringify(player, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

await prisma.$disconnect();
