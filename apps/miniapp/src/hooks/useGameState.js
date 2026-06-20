import { useCallback, useEffect, useRef, useState } from 'react';
import { createSession, sync as syncApi, buyUpgrade, skinAction, resolveBoss } from '../api/client.js';
import { getInitData } from '../telegram.js';

const SYNC_INTERVAL_MS = 4000;
const SYNC_TAP_THRESHOLD = 30;

export function useGameState() {
  const [state, setState] = useState(null);
  const [offlineGain, setOfflineGain] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pendingTaps = useRef(0);
  const syncing = useRef(false);

  // boot: cria sessão e carrega o estado autoritativo
  useEffect(() => {
    (async () => {
      try {
        const data = await createSession(getInitData());
        setState(data.state);
        setOfflineGain(data.offlineGain);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const flushSync = useCallback(async () => {
    if (syncing.current || pendingTaps.current === 0) return;
    syncing.current = true;
    const taps = pendingTaps.current;
    pendingTaps.current = 0;

    try {
      const nonce = crypto.randomUUID();
      const data = await syncApi(taps, nonce);
      setState(data.state);
    } catch (err) {
      // devolve os toques pendentes pra tentar de novo no próximo ciclo
      pendingTaps.current += taps;
      setError(err.message);
    } finally {
      syncing.current = false;
    }
  }, []);

  // sync periódico
  useEffect(() => {
    const id = setInterval(flushSync, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [flushSync]);

  // regen de energia + renda passiva do AUTO, em espelho local (mesma
  // fórmula do servidor); o /sync corrige qualquer deriva a cada ciclo
  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        if (!prev) return prev;
        const energy = Math.min(prev.maxEnergy, prev.energy + prev.regen);
        const idle = prev.autoN;
        if (energy === prev.energy && idle === 0) return prev;
        return {
          ...prev,
          energy,
          coins: prev.coins + idle,
          total: prev.total + idle,
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // tap otimista: feedback instantâneo, reconciliado pelo servidor depois
  const tap = useCallback(() => {
    setState((prev) => {
      if (!prev || prev.energy < 1) return prev;
      pendingTaps.current += 1;
      const next = {
        ...prev,
        coins: prev.coins + prev.perTap,
        total: prev.total + prev.perTap,
        energy: prev.energy - 1,
      };
      if (pendingTaps.current >= SYNC_TAP_THRESHOLD) flushSync();
      return next;
    });
  }, [flushSync]);

  const upgrade = useCallback(async (kind) => {
    await flushSync();
    const data = await buyUpgrade(kind);
    setState(data.state);
  }, [flushSync]);

  const buySkin = useCallback(async (skinId) => {
    const data = await skinAction('buy', skinId);
    setState(data.state);
  }, []);

  const equipSkin = useCallback(async (skinId) => {
    const data = await skinAction('equip', skinId);
    setState(data.state);
  }, []);

  const fightBoss = useCallback(async (level, taps, difficulty = 'easy') => {
    await flushSync();
    const data = await resolveBoss(level, taps, difficulty);
    setState(data.state);
    return data;
  }, [flushSync]);

  return { state, loading, error, offlineGain, tap, upgrade, buySkin, equipSkin, fightBoss };
}
