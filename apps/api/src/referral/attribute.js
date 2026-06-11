import { QUALIFY_TOTAL, REFERRAL_REWARD, REFERRAL_DAILY_CAP } from 'shared';
import {
  getPlayer,
  setReferredBy,
  createReferral,
  getPendingReferral,
  rewardReferral,
  addCoins,
  incrRefCount,
  countQualifiedReferralsToday,
} from '../db/queries.js';

// Atribuição de indicação — só roda na criação da conta (1 indicador por indicado).
export async function attributeOnCreate(tgUserId, startParam) {
  const m = /^ref_(\d+)$/.exec(startParam || '');
  if (!m) return;
  const refId = m[1];

  if (BigInt(refId) === BigInt(tgUserId)) return; // sem auto-indicação

  const referrer = await getPlayer(refId);
  if (!referrer) return; // indicador precisa existir

  await setReferredBy(tgUserId, refId);
  await createReferral({ referrerId: refId, refereeId: tgUserId });
}

// Chamado depois de cada ganho do indicado (sync, boss, etc).
export async function checkQualified(player) {
  if (!player.referredBy) return;
  if (Number(player.total) < QUALIFY_TOTAL) return;

  const ref = await getPendingReferral(player.id);
  if (!ref) return;

  const dailyCount = await countQualifiedReferralsToday(player.referredBy);
  if (dailyCount >= REFERRAL_DAILY_CAP) return; // teto diário do indicador

  await rewardReferral(ref.id);
  await addCoins(player.referredBy, REFERRAL_REWARD);
  await incrRefCount(player.referredBy);
}
