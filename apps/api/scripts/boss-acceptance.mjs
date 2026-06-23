// Harness de acceptance do Boss (Easy/Hard) — Opção 3 (hpMult 2.0 + timeMult 1.25).
//
// Importa as funções REAIS do pacote `shared` (fonte única de verdade dos
// números) e espelha a decisão pura do handler apps/api/src/routes/boss.js,
// sem Fastify/Prisma. Se o boss.js e este harness divergirem, é porque a
// lógica de resolução foi alterada — atualize ambos juntos.
//
// Rodar: node apps/api/scripts/boss-acceptance.mjs

import {
  BOSS_LEVELS,
  BOSS_HARD,
  BOSS_HARD_MIN_TOTAL,
  BOSS_HARD_COOLDOWN_S,
  bossDef,
  bossMaxTaps,
  bossDamagePerTap,
  bossHardUnlocked,
  statsFromLevels,
} from 'shared';

// ---- espelho EXATO da lógica de boss.js (caminho puro, sem IO) ----
function resolve(player, body, nowMs) {
  const { level, taps, difficulty = 'easy' } = body || {};
  if (difficulty !== 'easy' && difficulty !== 'hard') return { status: 400, error: 'dificuldade inválida' };
  const base = BOSS_LEVELS.find((b) => b.level === level);
  if (!base) return { status: 400, error: 'boss inválido' };

  if (difficulty === 'hard') {
    if (!bossHardUnlocked(player.total)) {
      return { status: 403, error: 'boss_hard_locked', minTotal: BOSS_HARD_MIN_TOTAL };
    }
    if (player.bossTs) {
      const elapsedS = (nowMs - player.bossTs.getTime()) / 1000;
      if (elapsedS < BOSS_HARD_COOLDOWN_S) {
        return { status: 429, error: 'boss_hard_cooldown', retryAfterS: Math.ceil(BOSS_HARD_COOLDOWN_S - elapsedS) };
      }
    }
  }

  const def = bossDef(level, difficulty);
  const maxTaps = bossMaxTaps(level, difficulty);
  const validTaps = Math.max(0, Math.min(Math.floor(Number(taps) || 0), maxTaps));
  const dmgPerTap = bossDamagePerTap(player);
  const damage = validTaps * dmgPerTap;
  const win = damage >= def.hp;

  // espelha o UPDATE: hard sempre arma bossTs; crédito (3×) só em vitória.
  const out = { ...player, coins: player.coins, total: player.total, bossTs: player.bossTs };
  if (difficulty === 'hard') {
    out.bossTs = new Date(nowMs);
    if (win) { out.coins = player.coins + BigInt(def.reward); out.total = player.total + BigInt(def.reward); }
  } else if (win) {
    out.coins = player.coins + BigInt(def.reward); out.total = player.total + BigInt(def.reward);
  }

  // O servidor SEMPRE devolve o reward que ELE calculou (def.reward), nunca o que o cliente mandou.
  return { status: 200, win, damage, hp: def.hp, reward: win ? def.reward : 0, difficulty, validTaps, maxTaps, player: out };
}

const mkPlayer = (multN, total, bossTs = null) => ({
  id: 1,
  multN, battN: 0, chgN: 0, autoN: 0,
  coins: BigInt(total),
  total: BigInt(total),
  bossTs,
});

// ---- runner de asserts ----
let pass = 0, fail = 0;
const ok = (cond, msg) => { (cond ? pass++ : fail++); console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`); };

// ================= Tabela final (após arredondamento) =================
console.log(`\nConfig hard efetiva: hpMult=${BOSS_HARD.hpMult}  rewardMult=${BOSS_HARD.rewardMult}  timeMult=${BOSS_HARD.timeMult}\n`);
console.log('LV | hp_hard | tLS_hard | maxTaps_hard | perTap p/ vencer | reward (3x)');
console.log('---|---------|----------|--------------|------------------|-----------');
for (const b of BOSS_LEVELS) {
  const d = bossDef(b.level, 'hard');
  const mt = bossMaxTaps(b.level, 'hard');
  const need = Math.ceil(d.hp / mt);
  console.log(`${b.level}  | ${String(d.hp).padEnd(7)} | ${String(d.timeLimitS).padEnd(8)} | ${String(mt).padEnd(12)} | ${String(need).padEnd(16)} | ${d.reward}`);
}

// ================= 1) Easy byte-idêntico ao baseline =================
console.log('\n[1] Easy permanece byte-idêntico');
const EASY_BASELINE = {
  1: { hp: 500, tLS: 15, maxTaps: 180, reward: 1000 },
  2: { hp: 1200, tLS: 15, maxTaps: 180, reward: 2500 },
  3: { hp: 2500, tLS: 15, maxTaps: 180, reward: 5000 },
  4: { hp: 5000, tLS: 18, maxTaps: 216, reward: 10000 },
  5: { hp: 10000, tLS: 20, maxTaps: 240, reward: 20000 },
};
for (const b of BOSS_LEVELS) {
  const d = bossDef(b.level, 'easy');
  const mt = bossMaxTaps(b.level, 'easy');
  const exp = EASY_BASELINE[b.level];
  ok(d.hp === exp.hp && d.timeLimitS === exp.tLS && mt === exp.maxTaps && d.reward === exp.reward,
    `LV${b.level} easy: hp=${d.hp} tLS=${d.timeLimitS} maxTaps=${mt} reward=${d.reward}`);
}

// ================= 2) Hard vencível com perTap 67 no LV5 =================
console.log('\n[2] Hard LV5 vencível exatamente a partir de perTap 67');
{
  // multN=66 -> perTap 67 (o player +75 do screenshot, multN>=66, vence)
  const winner = mkPlayer(66, 5000);
  ok(statsFromLevels(winner).perTap === 67, `sanity: multN=66 => perTap=${statsFromLevels(winner).perTap}`);
  const rWin = resolve(winner, { level: 5, taps: 99999, difficulty: 'hard' }, 0);
  ok(rWin.status === 200 && rWin.win === true, `perTap 67 vence (status=${rWin.status} win=${rWin.win} damage=${rWin.damage} >= hp=${rWin.hp}, validTaps=${rWin.validTaps}/${rWin.maxTaps})`);

  // perTap 66 (multN=65) ainda perde -> 67 é o limiar exato
  const loser = mkPlayer(65, 5000);
  const rLose = resolve(loser, { level: 5, taps: 99999, difficulty: 'hard' }, 0);
  ok(rLose.status === 200 && rLose.win === false, `perTap 66 perde (damage=${rLose.damage} < hp=${rLose.hp})`);
}

// ================= 3) Win credita 3x =================
console.log('\n[3] Vitória credita reward 3x (e debita nada além do crédito)');
{
  const p = mkPlayer(66, 5000);
  const before = p.coins;
  const r = resolve(p, { level: 5, taps: 99999, difficulty: 'hard' }, 0);
  const base = BOSS_LEVELS.find((b) => b.level === 5);
  ok(r.reward === base.reward * BOSS_HARD.rewardMult, `reward=${r.reward} === base ${base.reward} x${BOSS_HARD.rewardMult}`);
  ok(r.player.coins - before === BigInt(r.reward), `coins +${r.player.coins - before} === reward ${r.reward}`);
  ok(r.player.bossTs instanceof Date, `bossTs armado na vitória (cooldown inicia)`);
}

// ================= 4) Cooldown 429 =================
console.log('\n[4] Segunda tentativa hard dentro do cooldown -> 429');
{
  const p = mkPlayer(66, 5000, new Date(0)); // lutou em t=0
  const r = resolve(p, { level: 5, taps: 99999, difficulty: 'hard' }, 60_000); // +60s, dentro dos 300s
  ok(r.status === 429 && r.error === 'boss_hard_cooldown', `status=${r.status} error=${r.error} retryAfterS=${r.retryAfterS}`);
  // depois do cooldown, libera
  const r2 = resolve(p, { level: 5, taps: 99999, difficulty: 'hard' }, BOSS_HARD_COOLDOWN_S * 1000 + 1);
  ok(r2.status === 200, `após ${BOSS_HARD_COOLDOWN_S}s libera (status=${r2.status})`);
}

// ================= 5) Gate 403 =================
console.log('\n[5] total < BOSS_HARD_MIN_TOTAL -> 403 (e easy passa)');
{
  const p = mkPlayer(66, BOSS_HARD_MIN_TOTAL - 1); // 2999
  const r = resolve(p, { level: 5, taps: 99999, difficulty: 'hard' }, 0);
  ok(r.status === 403 && r.error === 'boss_hard_locked', `hard travado (status=${r.status} error=${r.error} minTotal=${r.minTotal})`);
  const rEasy = resolve(p, { level: 5, taps: 99999, difficulty: 'easy' }, 0);
  ok(rEasy.status === 200, `easy não tem gate (status=${rEasy.status} win=${rEasy.win})`);
}

// ================= 6) Server ignora reward/taps do cliente =================
console.log('\n[6] Servidor recalcula tudo: ignora reward e clampa taps do cliente');
{
  // Player fraco (perTap=1) manda taps absurdos + reward forjado: servidor clampa e nega.
  const cheat = mkPlayer(0, 5000);
  const r = resolve(cheat, { level: 5, taps: 10 ** 9, difficulty: 'hard', reward: 999999, hp: 1 }, 0);
  const mt = bossMaxTaps(5, 'hard');
  ok(r.validTaps === mt, `taps do cliente (1e9) clampado ao teto do hard (${r.validTaps} === ${mt})`);
  ok(r.win === false && r.reward === 0, `perTap=1 não vence mesmo "mandando" reward/hp forjados (win=${r.win} reward=${r.reward})`);
  // Player legítimo: reward devolvido é o do servidor, não o do corpo.
  const legit = mkPlayer(66, 5000);
  const rl = resolve(legit, { level: 5, taps: 99999, difficulty: 'hard', reward: 1 }, 0);
  ok(rl.reward === bossDef(5, 'hard').reward, `reward vem do servidor (${rl.reward}), não do cliente (1)`);
}

console.log(`\n==== ${fail === 0 ? 'ACCEPTANCE OK' : 'ACCEPTANCE FALHOU'} — ${pass} pass / ${fail} fail ====\n`);
process.exit(fail === 0 ? 0 : 1);
