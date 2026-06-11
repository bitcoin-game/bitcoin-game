// Acesso ao WebApp do Telegram. Em dev (fora do Telegram), gera um initData
// "fake" com dev=1 — só funciona se a API estiver com ALLOW_DEV_AUTH=true.
export function getWebApp() {
  return window.Telegram?.WebApp ?? null;
}

export function getInitData() {
  const webApp = getWebApp();
  if (webApp?.initData) {
    webApp.ready();
    webApp.expand();
    return webApp.initData;
  }

  // fallback de desenvolvimento local
  const devUser = {
    id: 1,
    first_name: 'Dev',
    username: 'dev_player',
  };
  const params = new URLSearchParams({
    dev: '1',
    user: JSON.stringify(devUser),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });

  const startParam = new URLSearchParams(window.location.search).get('startapp');
  if (startParam) params.set('start_param', startParam);

  return params.toString();
}
