import crypto from 'node:crypto';

const MAX_AGE_MS = 24 * 3600 * 1000;

// Valida o initData assinado pelo Telegram (HMAC com o BOT_TOKEN).
// Lança erro se a assinatura não bater ou se o initData estiver expirado.
// Retorna o objeto `user` do Telegram, que passa a ser confiável.
//
// `allowDev`: se true e o initData tiver `dev=1`, pula a checagem de HMAC.
// Usado SOMENTE em desenvolvimento local (ALLOW_DEV_AUTH=true), nunca em produção.
export function validateInitData(initData, botToken, allowDev = false) {
  const params = new URLSearchParams(initData);

  if (allowDev && params.get('dev') === '1') {
    const userRaw = params.get('user');
    if (!userRaw) throw new Error('initData sem user');
    return { user: JSON.parse(userRaw), startParam: params.get('start_param') };
  }

  const hash = params.get('hash');
  if (!hash) throw new Error('initData sem hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) throw new Error('initData inválido');

  const authDate = Number(params.get('auth_date')) * 1000;
  if (!authDate || Date.now() - authDate > MAX_AGE_MS) throw new Error('initData expirado');

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('initData sem user');

  return {
    user: JSON.parse(userRaw),
    startParam: params.get('start_param'),
  };
}
