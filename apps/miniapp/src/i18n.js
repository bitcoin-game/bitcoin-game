import { useCallback, useEffect, useState } from 'react';

const SUPPORTED = ['en', 'pt'];
const DEFAULT = 'en';

// EN is the master — every new string goes here first.
// Brand lemas (INSERT COIN, BOSS FIGHT, GAME OVER, HIGH SCORES, UPGRADES) are
// identical across languages and are NOT listed here — use them literally in JSX.
const dict = {
  en: {
    loading:       'Loading…',
    error:         'Error: ',
    energy:        'ENERGY',
    perTap:        'Per tap',
    recharging:    'RECHARGING…',
    smashBoss:     'SMASH THE BOSS! 👾',
    maxed:         'MAX',
    skinsSection:  'SKINS · YOUR PLAYER',
    using:         'USING',
    equip:         'EQUIP',
    footerTap:     'Tap the coin · spend on upgrades and skins.',
    footerAuto:    "AUTO mines even while you're away — come back and collect. 🕹️",
    footerRef:     'Refer friends with your link to unlock exclusive skins.',
    offlineMined:  'Your AUTO mined ₿{n} while you were away',
    collect:       'COLLECT',
    bossEscaped:   'THE BOSS GOT AWAY… try again',
    bossDown:      'BOSS DOWN! +{n} ₿',
    bossEasy:      'EASY',
    bossHard:      'HARD',
    bossHardLoot:  'More loot · real risk',
    bossHardReq:   'Reach {n} score to unlock HARD',
    bossLocked:    'HARD locked — keep leveling up',
    bossCooldown:  'BOSS resting — try HARD again soon',
    levelUp:       'LEVEL UP → LV {n}',
    skinBought:    'SKIN: {n}!',
    youAreLegend:  'YOU ARE THE LEGEND',
    firstCoin:     'FIRST COIN',
    hundredCoins:  'ONE HUNDRED COINS',
    thousandCoins: '1,000 COINS — YOU ARE PLAYER',
    firstUpgrade:  'FIRST UPGRADE',
    upgMulti:      'MULTI',
    upgBattery:    'BATTERY',
    upgCharge:     'CHARGE',
    upgAuto:       'AUTO',
    // Rarity labels — keyed by the English value stored in skinVisuals.js
    STARTER:       'STARTER',
    COMMON:        'COMMON',
    RARE:          'RARE',
    LEGEND:        'LEGEND',
  },
  pt: {
    loading:       'Carregando…',
    error:         'Erro: ',
    energy:        'ENERGIA',
    perTap:        'Por toque',
    recharging:    'RECARREGANDO…',
    smashBoss:     'SMASH THE BOSS! 👾',
    maxed:         'MÁX',
    skinsSection:  'SKINS · SEU PLAYER',
    using:         'USANDO',
    equip:         'EQUIPAR',
    footerTap:     'Toque a moeda · gaste em upgrades e skins.',
    footerAuto:    'O AUTO minera mesmo com você fora — volte e colete. 🕹️',
    footerRef:     'Indique amigos pelo seu link para desbloquear skins exclusivas.',
    offlineMined:  'Seu AUTO minerou ₿{n} enquanto você esteve fora',
    collect:       'COLETAR',
    bossEscaped:   'O BOSS FUGIU… tenta de novo',
    bossDown:      'BOSS DOWN! +{n} ₿',
    bossEasy:      'FÁCIL',
    bossHard:      'DIFÍCIL',
    bossHardLoot:  'Mais loot · risco real',
    bossHardReq:   'Alcance {n} de score p/ liberar DIFÍCIL',
    bossLocked:    'DIFÍCIL travado — continue evoluindo',
    bossCooldown:  'BOSS descansando — tente DIFÍCIL em breve',
    levelUp:       'LEVEL UP → LV {n}',
    skinBought:    'SKIN: {n}!',
    youAreLegend:  'VOCÊ É A LENDA',
    firstCoin:     'PRIMEIRA FICHA',
    hundredCoins:  'CEM MOEDAS',
    thousandCoins: 'MIL MOEDAS — VOCÊ É PLAYER',
    firstUpgrade:  'PRIMEIRO UPGRADE',
    upgMulti:      'MULTI',
    upgBattery:    'BATERIA',
    upgCharge:     'CARGA',
    upgAuto:       'AUTO',
    STARTER:       'INICIAL',
    COMMON:        'COMUM',
    RARE:          'RARO',
    LEGEND:        'LENDA',
  },
};

export function useLang() {
  const [lang, setLangState] = useState(DEFAULT);

  // Boot: read preference from CloudStorage, fall back to localStorage, default EN.
  useEffect(() => {
    const cs = window.Telegram?.WebApp?.CloudStorage;
    if (cs) {
      cs.getItem('lang', (err, val) => {
        if (!err && val && SUPPORTED.includes(val)) setLangState(val);
      });
    } else {
      try {
        const saved = localStorage.getItem('lang');
        if (saved && SUPPORTED.includes(saved)) setLangState(saved);
      } catch {}
    }
  }, []);

  const setLang = useCallback((l) => {
    setLangState(l);
    const cs = window.Telegram?.WebApp?.CloudStorage;
    if (cs) {
      cs.setItem('lang', l);
    } else {
      try { localStorage.setItem('lang', l); } catch {}
    }
  }, []);

  // t(key) → translated string
  // t(key, n) → translated string with {n} replaced by n
  const t = useCallback(
    (key, n) => {
      const val = (dict[lang] ?? dict[DEFAULT])[key] ?? dict[DEFAULT][key] ?? key;
      return n !== undefined ? String(val).replace('{n}', n) : val;
    },
    [lang]
  );

  return { lang, setLang, t };
}
