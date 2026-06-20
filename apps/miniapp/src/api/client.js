let token = null;

function authHeaders() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `erro ${res.status}`);
  }
  return res.json();
}

export async function createSession(initData) {
  const data = await request('/session', { method: 'POST', body: { initData } });
  token = data.token;
  return data;
}

export function sync(taps, nonce) {
  return request('/sync', { method: 'POST', body: { taps, nonce } });
}

export function buyUpgrade(kind) {
  return request('/upgrade', { method: 'POST', body: { kind } });
}

export function skinAction(action, skinId) {
  return request('/skin', { method: 'POST', body: { action, skinId } });
}

export function resolveBoss(level, taps, difficulty = 'easy') {
  return request('/boss/resolve', { method: 'POST', body: { level, taps, difficulty } });
}

export function getLeaderboard() {
  return request('/leaderboard');
}
