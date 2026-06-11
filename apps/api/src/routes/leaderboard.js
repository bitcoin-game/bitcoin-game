import { getLeaderboard } from '../db/queries.js';

const CACHE_MS = 10_000;
let cache = { data: null, ts: 0 };

export async function leaderboardRoutes(app) {
  app.get('/leaderboard', async () => {
    const now = Date.now();
    if (!cache.data || now - cache.ts > CACHE_MS) {
      cache = { data: await getLeaderboard(100), ts: now };
    }
    return { leaderboard: cache.data };
  });
}
