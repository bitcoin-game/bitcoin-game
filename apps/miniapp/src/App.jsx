import { useCallback, useEffect, useRef, useState } from 'react';
import { UPGRADES, SKINS, BOSS_LEVELS, upgradeCost } from 'shared';
import { useGameState } from './hooks/useGameState.js';
import { SKIN_VISUALS } from './skinVisuals.js';
import { blip, playTap, unlockAudio, isMuted, setMuted } from './sound.js';
import { useLang } from './i18n.js';
import { getLeaderboard } from './api/client.js';

const LEVEL_FIELD = { mult: 'multN', batt: 'battN', chg: 'chgN', auto: 'autoN' };
const UPGRADE_ICONS = { mult: '✖', batt: '🔋', chg: '⚡', auto: '⚒' };

function fmt(n) {
  return Math.floor(n).toLocaleString('en-US');
}

function levelFromTotal(total) {
  return 1 + Math.floor(total / 750);
}

function bossDefForLevel(level) {
  const idx = Math.min(BOSS_LEVELS.length, level) - 1;
  return BOSS_LEVELS[idx];
}

export default function App() {
  const { state, loading, error, offlineGain, tap, upgrade, buySkin, equipSkin, fightBoss } = useGameState();
  const { lang, setLang, t } = useLang();

  const [toastMsg, setToastMsg] = useState('');
  const [floats, setFloats] = useState([]);
  const [muted, setMutedState] = useState(isMuted());
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);

  const [bossActive, setBossActive] = useState(false);
  const [bossHpVal, setBossHpVal] = useState(0);
  const [bossHpMax, setBossHpMax] = useState(0);
  const [bossLeft, setBossLeft] = useState(0);

  const stageRef = useRef(null);
  const tapRef = useRef(null);
  const toastTimer = useRef(null);
  const achievedRef = useRef({});
  const prevLevelRef = useRef(null);
  const bossTimerRef = useRef(null);
  const bossTapsRef = useRef(0);
  const bossHpRef = useRef(0);
  const bossEndedRef = useRef(false);
  const bossDefRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  const upgradeLabels = {
    mult: t('upgMulti'),
    batt: t('upgBattery'),
    chg:  t('upgCharge'),
    auto: t('upgAuto'),
  };

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 1900);
  }, []);

  const addFloat = useCallback((x, y, text) => {
    const id = Math.random();
    setFloats((prev) => [...prev, { id, x, y, text }]);
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 700);
  }, []);

  // leaderboard: load and refresh periodically
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getLeaderboard();
        if (!cancelled) setLeaderboard(data.leaderboard);
      } catch {}
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // achievements + level-up (cosmetic, client-side)
  useEffect(() => {
    if (!state) return;

    const lvl = levelFromTotal(state.total);
    if (prevLevelRef.current !== null && lvl > prevLevelRef.current) {
      showToast(t('levelUp', lvl));
    }
    prevLevelRef.current = lvl;

    const ach = (key, msg) => {
      if (achievedRef.current[key]) return;
      achievedRef.current[key] = true;
      showToast(msg);
      blip(660, 0.1);
      setTimeout(() => blip(880, 0.12), 90);
    };
    if (state.total >= 1)    ach('first', t('firstCoin'));
    if (state.total >= 100)  ach('c100',  t('hundredCoins'));
    if (state.total >= 1000) ach('c1k',   t('thousandCoins'));
  }, [state?.total, showToast, t]);

  // clean up boss timer on unmount
  useEffect(() => () => clearInterval(bossTimerRef.current), []);

  const endBoss = useCallback(async () => {
    if (bossEndedRef.current) return;
    bossEndedRef.current = true;
    clearInterval(bossTimerRef.current);
    setBossActive(false);

    const def = bossDefRef.current;
    const taps = bossTapsRef.current;
    try {
      const result = await fightBoss(def.level, taps);
      if (result.win) {
        showToast(t('bossDown', fmt(result.reward)));
        blip(523, 0.12);
        setTimeout(() => blip(659, 0.12), 110);
        setTimeout(() => blip(784, 0.18), 220);
      } else {
        showToast(t('bossEscaped'));
        blip(150, 0.25, 'sawtooth');
      }
    } catch (err) {
      showToast(err.message);
    }
  }, [fightBoss, showToast, t]);

  const startBoss = useCallback(() => {
    if (!state || bossActive) return;
    const def = bossDefForLevel(levelFromTotal(state.total));
    bossDefRef.current = def;
    bossHpRef.current = def.hp;
    bossTapsRef.current = 0;
    bossEndedRef.current = false;

    setBossHpMax(def.hp);
    setBossHpVal(def.hp);
    setBossLeft(def.timeLimitS);
    setBossActive(true);
    blip(180, 0.2, 'sawtooth');

    bossTimerRef.current = setInterval(() => {
      setBossLeft((prev) => {
        const next = prev - 0.1;
        if (next <= 0) {
          endBoss();
          return 0;
        }
        return next;
      });
    }, 100);
  }, [state, bossActive, endBoss]);

  const damageBoss = useCallback(
    (e) => {
      if (!state) return;
      bossTapsRef.current += 1;
      const dmg = state.perTap;
      bossHpRef.current = Math.max(0, bossHpRef.current - dmg);
      setBossHpVal(bossHpRef.current);
      blip(300 + Math.random() * 120, 0.05);

      const rect = tapRef.current.getBoundingClientRect();
      const pr = stageRef.current.getBoundingClientRect();
      addFloat(rect.left + rect.width / 2 - pr.left - 14, rect.top + 30 - pr.top, `-${dmg}`);

      if (bossHpRef.current <= 0) endBoss();
    },
    [state, endBoss, addFloat]
  );

  const onTap = useCallback(
    (e) => {
      if (!state) return;
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      if (!audioUnlockedRef.current) {
        audioUnlockedRef.current = true;
        unlockAudio();
      }
      if (bossActive) {
        damageBoss(e);
        return;
      }
      if (state.energy < 1) {
        blip(140, 0.12, 'sawtooth');
        return;
      }
      tap();
      playTap();

      const rect = tapRef.current.getBoundingClientRect();
      const pr = stageRef.current.getBoundingClientRect();
      const px = (e.clientX ?? rect.left + rect.width / 2) - pr.left;
      const py = (e.clientY ?? rect.top + rect.height / 2) - pr.top;
      addFloat(px - 14, py - 20, `+${state.perTap}`);
    },
    [state, bossActive, tap, damageBoss, addFloat]
  );

  const handleUpgrade = useCallback(
    async (kind) => {
      try {
        await upgrade(kind);
        blip(520, 0.07);
        setTimeout(() => blip(700, 0.09), 70);
        if (!achievedRef.current.up1) {
          achievedRef.current.up1 = true;
          showToast(t('firstUpgrade'));
        }
      } catch (err) {
        blip(150, 0.12, 'sawtooth');
        showToast(err.message);
      }
    },
    [upgrade, showToast, t]
  );

  const handleSkinClick = useCallback(
    async (skin, owned, equipped) => {
      try {
        if (equipped) return;
        if (owned) {
          await equipSkin(skin.id);
          blip(700, 0.06);
          return;
        }
        await buySkin(skin.id);
        showToast(t('skinBought', skin.label.toUpperCase()));
        blip(520, 0.08);
        setTimeout(() => blip(740, 0.1), 80);
        if (skin.id === 'legend') {
          showToast(t('youAreLegend'));
        }
      } catch (err) {
        blip(150, 0.12, 'sawtooth');
        showToast(err.message);
      }
    },
    [buySkin, equipSkin, showToast, t]
  );

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) blip(660, 0.08);
  }, [muted]);

  if (loading) return <div className="app center">{t('loading')}</div>;
  if (error && !state) return <div className="app center error">{t('error')}{error}</div>;
  if (!state) return null;

  const equippedVisual = SKIN_VISUALS[state.equippedSkin] || SKIN_VISUALS.classic;
  const dead = state.energy < 1 && !bossActive;
  const bossDef = bossDefForLevel(levelFromTotal(state.total));

  return (
    <div className="app">
      <div className="hud">
        <div>
          <div className="balance">
            <span className="coin">₿</span>
            <span className="amt">{fmt(state.coins)}</span>
            <span className="tk">$BitGame</span>
          </div>
          <div style={{ fontSize: 15, color: 'var(--dim)', marginTop: 4 }}>
            {t('perTap')}: <b style={{ color: 'var(--orange)' }}>{state.perTap}</b> · Idle:{' '}
            <b style={{ color: 'var(--green)' }}>{state.autoN}</b>/s
          </div>
        </div>
        <div className="right">
          LV <b>{levelFromTotal(state.total)}</b>
          <br />
          High <b>{fmt(state.total)}</b>
          <br />
          <button id="mute" className="pixel" onClick={toggleMute}>
            {muted ? '🔇' : '🔊'}
          </button>
          {' '}
          <button
            className="pixel lang-btn"
            style={{ opacity: lang === 'en' ? 1 : 0.4 }}
            onClick={() => setLang('en')}
          >EN</button>
          {' '}
          <button
            className="pixel lang-btn"
            style={{ opacity: lang === 'pt' ? 1 : 0.4 }}
            onClick={() => setLang('pt')}
          >PT</button>
        </div>
      </div>

      <div className="energy">
        <div className="lab">
          <span>{t('energy')}</span>
          <span>
            {Math.floor(state.energy)} / {state.maxEnergy}
          </span>
        </div>
        <div className="bar">
          <i style={{ width: `${(state.energy / state.maxEnergy) * 100}%` }} />
        </div>
      </div>

      <div className="stage" ref={stageRef}>
        <div className="hint pixel">
          {dead ? t('recharging') : bossActive ? t('smashBoss') : '▶ INSERT COIN ◀'}
        </div>
        <div
          ref={tapRef}
          className={`tap pixel${dead ? ' dead' : ''}${equippedVisual.legend ? ' legendary' : ''}`}
          style={{
            background: equippedVisual.bg,
            borderColor: equippedVisual.bd,
            color: equippedVisual.col,
            boxShadow: `8px 8px 0 rgba(0,0,0,.45), 0 0 34px ${equippedVisual.gl}`,
          }}
          onPointerDown={onTap}
        >
          {equippedVisual.gly}
        </div>
        {floats.map((f) => (
          <div key={f.id} className="float" style={{ left: f.x, top: f.y }}>
            {f.text}
          </div>
        ))}
        <button className="bossbtn pixel" disabled={bossActive} onClick={startBoss}>
          ⚔ BOSS FIGHT
        </button>
        <div className={`bosswrap${bossActive ? ' on' : ''}`}>
          <div className="top">
            <span>👾 NPC BOSS LV{bossDef.level}</span>
            <span>{Math.max(0, bossLeft).toFixed(1)}s</span>
          </div>
          <div className="bosshp">
            <i style={{ width: `${bossHpMax > 0 ? Math.max(0, (bossHpVal / bossHpMax) * 100) : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="lbl pixel">UPGRADES</div>
      <div className="ups">
        {Object.entries(UPGRADES).map(([kind, def]) => {
          const level = state[LEVEL_FIELD[kind]];
          const cost = upgradeCost(kind, level);
          const maxed = level >= def.maxLevel;
          const canAfford = !maxed && state.coins >= cost;
          const displayLevel = kind === 'auto' ? level : level + 1;
          return (
            <div
              key={kind}
              className={`up${canAfford ? '' : ' no'}`}
              onClick={() => canAfford && handleUpgrade(kind)}
            >
              <div className="ic">{UPGRADE_ICONS[kind]}</div>
              <div className="meta">
                <div className="nm pixel">{upgradeLabels[kind]}</div>
                <div className="lv">Lv {displayLevel}</div>
                <div className="cost">{maxed ? t('maxed') : `₿${fmt(cost)}`}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="lbl pixel">{t('skinsSection')}</div>
      <div className="skins">
        {Object.values(SKINS).map((skin) => {
          const visual = SKIN_VISUALS[skin.id];
          const owned = state.ownedSkins.includes(skin.id);
          const equipped = state.equippedSkin === skin.id;

          let action;
          let progress = null;
          if (equipped) {
            action = <span style={{ color: 'var(--blue)' }}>{t('using')}</span>;
          } else if (owned) {
            action = <span style={{ color: 'var(--green)' }}>{t('equip')}</span>;
          } else {
            action = <span style={{ color: 'var(--amber)' }}>₿{fmt(skin.cost)}</span>;
            progress = (
              <div className="pbar">
                <i style={{ width: `${Math.min(100, (state.coins / skin.cost) * 100)}%` }} />
              </div>
            );
          }

          return (
            <div
              key={skin.id}
              className={`skin${equipped ? ' eq' : ''}`}
              onClick={() => handleSkinClick(skin, owned, equipped)}
            >
              <div
                className={`prev${visual.legend ? ' legendary' : ''}`}
                style={{ background: visual.bg, borderColor: visual.bd, color: visual.col, boxShadow: `0 0 14px ${visual.gl}` }}
              >
                {visual.gly}
              </div>
              <div className="sn">{skin.label}</div>
              <div className="rar" style={{ color: visual.rc }}>
                {t(visual.rar)}
              </div>
              <div className="act">{action}</div>
              {progress}
            </div>
          );
        })}
      </div>

      <div className="lbl pixel">HIGH SCORES</div>
      <div className="lb">
        {leaderboard.map((row, i) => (
          <div key={row.id} className={`r${row.id === state.id ? ' you' : ''}${i === 0 ? ' gold' : ''}`}>
            <span className="rk">{i + 1}</span>
            <span className="nm">{row.id === state.id ? 'YOU' : row.username || row.firstName || `P${row.id}`}</span>
            <span className="sc">{fmt(row.total)}</span>
          </div>
        ))}
      </div>

      <div className="foot">
        {t('footerTap')}
        <br />
        {t('footerAuto')}
        <br />
        {t('footerRef')}
      </div>

      <div id="toast" className={`pixel${toastMsg ? ' on' : ''}`}>
        {toastMsg && `🏆 ${toastMsg}`}
      </div>

      <div className={`modal${offlineGain > 0 && welcomeOpen ? ' on' : ''}`}>
        <div className="box">
          <div className="ttl pixel">
            WELCOME BACK,
            <br />
            PLAYER
          </div>
          <div className="msg">
            {t('offlineMined', `₿${fmt(offlineGain)}`)}
          </div>
          <button
            className="pixel"
            onClick={() => {
              setWelcomeOpen(false);
              blip(700, 0.08);
            }}
          >
            {t('collect')}
          </button>
        </div>
      </div>
    </div>
  );
}
