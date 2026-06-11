// Config única do jogo — importada pelo frontend (render) e backend (cálculo).
// O servidor nunca confia em valores recebidos do cliente: ele recalcula
// tudo a partir dos níveis (mult_n, batt_n, chg_n, auto_n) usando estas
// mesmas fórmulas.

// ---------- Stats base (nível 0 em todos os upgrades) ----------
export const BASE_PER_TAP = 1;
export const BASE_MAX_ENERGY = 500;
export const BASE_REGEN = 2; // energia / segundo

// ---------- Anti-cheat ----------
export const MAX_TAPS_PER_SYNC = 200; // clamp duro por request
export const SYNC_RATE_LIMIT_MS = 2000; // 1 sync a cada 2s por jogador
export const TAP_RATE_ANOMALY_PER_S = 15; // acima disso -> flag de anomalia
export const OFFLINE_CAP_S = 3600; // 1h de idle offline na Fase 1

// ---------- Upgrades ----------
// cost(level) = baseCost * growth ^ level (arredondado)
// effect(level) = stat resultante quando o upgrade está nesse nível
export const UPGRADES = {
  mult: {
    label: 'Multiplicador',
    baseCost: 50,
    growth: 1.15,
    maxLevel: 100,
    // per_tap = base + nível (cada nível soma +1 moeda por toque)
    effect: (level) => BASE_PER_TAP + level,
  },
  batt: {
    label: 'Bateria',
    baseCost: 75,
    growth: 1.16,
    maxLevel: 100,
    // max_energy = base + 250 por nível
    effect: (level) => BASE_MAX_ENERGY + level * 250,
  },
  chg: {
    label: 'Carregador',
    baseCost: 100,
    growth: 1.18,
    maxLevel: 100,
    // regen = base + 1 energia/s por nível
    effect: (level) => BASE_REGEN + level,
  },
  auto: {
    label: 'Auto-Miner',
    baseCost: 200,
    growth: 1.2,
    maxLevel: 100,
    // auto = moedas/segundo geradas offline e online (idle)
    effect: (level) => level,
  },
};

export function upgradeCost(kind, currentLevel) {
  const def = UPGRADES[kind];
  if (!def) throw new Error(`upgrade desconhecido: ${kind}`);
  return Math.floor(def.baseCost * Math.pow(def.growth, currentLevel));
}

export function upgradeEffect(kind, level) {
  const def = UPGRADES[kind];
  if (!def) throw new Error(`upgrade desconhecido: ${kind}`);
  return def.effect(level);
}

// Recalcula os stats derivados (per_tap, max_energy, regen, auto) a partir
// dos níveis salvos. Chamado pelo servidor após qualquer upgrade e usado
// pelo frontend para exibir os mesmos números.
export function statsFromLevels({ multN, battN, chgN, autoN }) {
  return {
    perTap: upgradeEffect('mult', multN),
    maxEnergy: upgradeEffect('batt', battN),
    regen: upgradeEffect('chg', chgN),
    autoRate: upgradeEffect('auto', autoN), // moedas/seg
  };
}

// ---------- Skins ----------
// Catálogo do protótipo (bitcoin-game-prototype.html) — front e back leem
// desta mesma lista, então preço e posse vêm sempre do servidor.
export const SKINS = {
  classic: { id: 'classic', label: 'Classic', cost: 0, unlock: 'default' },
  green: { id: 'green', label: 'Green Chip', cost: 300, unlock: 'coins' },
  cyber: { id: 'cyber', label: 'Cyber', cost: 1200, unlock: 'coins' },
  crt: { id: 'crt', label: 'CRT', cost: 4000, unlock: 'coins' },
  legend: { id: 'legend', label: 'The Legend', cost: 20000, unlock: 'coins' },
};

// ---------- Programa de indicação (Player 2) ----------
export const QUALIFY_TOTAL = 1000; // total mínimo do indicado p/ qualificar
export const REFERRAL_REWARD = 500; // moedas creditadas ao indicador
export const REFERRAL_DAILY_CAP = 10; // máx. de indicações qualificadas/dia por indicador

// ---------- Boss ----------
// O cliente joga a luta localmente e submete `taps` ao final; o servidor
// revalida pelo teto físico de toques no tempo (timeLimitS * maxTapRateS).
export const BOSS_LEVELS = [
  { level: 1, hp: 500, timeLimitS: 15, maxTapRateS: 12, reward: 1000 },
  { level: 2, hp: 1200, timeLimitS: 15, maxTapRateS: 12, reward: 2500 },
  { level: 3, hp: 2500, timeLimitS: 15, maxTapRateS: 12, reward: 5000 },
  { level: 4, hp: 5000, timeLimitS: 18, maxTapRateS: 12, reward: 10000 },
  { level: 5, hp: 10000, timeLimitS: 20, maxTapRateS: 12, reward: 20000 },
];

export function bossDamagePerTap(player) {
  // mesmo per_tap do tap normal
  return statsFromLevels(player).perTap;
}

export function bossMaxTaps(level) {
  const def = BOSS_LEVELS.find((b) => b.level === level);
  if (!def) throw new Error(`boss level desconhecido: ${level}`);
  return Math.floor(def.timeLimitS * def.maxTapRateS);
}
