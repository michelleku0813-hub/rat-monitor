import * as argon2 from 'argon2';
import {
  createAuthenticatedSession,
  fingerprint,
  findAdminUser,
  getClientIp,
  getDummyPasswordHash,
  isLoginThrottled,
  isTrustedMutation,
  isValidUsername,
  jsonResponse,
  loginThrottleKey,
  logAuthFailure,
  normalizeUsername,
  parseJsonObject,
  recordLoginFailure,
  sessionCookie,
} from '../../server/auth.js';

interface LoginPayload {
  username?: unknown;
  password?: unknown;
}

const GENERIC_AUTH_ERROR = '帳號或密碼不正確，請稍後再試。';

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isTrustedMutation(request)) {
      return jsonResponse({ error: '不允許的登入請求。' }, 403);
    }

    const payload = await parseJsonObject<LoginPayload>(request);
    const username = normalizeUsername(
      typeof payload?.username === 'string' ? payload.username : '',
    );
    const password = typeof payload?.password === 'string' ? payload.password : '';
    const ip = getClientIp(request);
    const usernameFingerprint = fingerprint(username || 'invalid');
    const ipFingerprint = fingerprint(ip);
    const principalKey = loginThrottleKey(username || 'invalid', ip);

    if (await isLoginThrottled(principalKey)) {
      return jsonResponse({ error: GENERIC_AUTH_ERROR }, 401);
    }

    const user = isValidUsername(username) ? await findAdminUser(username) : null;
    const passwordHash =
      user && user.status === 'active' && password.length <= 512
        ? user.password_hash
        : getDummyPasswordHash();
    const passwordMatches = await argon2.verify(passwordHash, password);

    if (!user || user.status !== 'active' || !passwordMatches) {
      await recordLoginFailure(principalKey, usernameFingerprint, ipFingerprint);
      return jsonResponse({ error: GENERIC_AUTH_ERROR }, 401);
    }

    const rawToken = await createAuthenticatedSession(
      { id: user.id, username: user.username, role: user.role },
      request,
      principalKey,
    );

    return jsonResponse(
      {
        user: {
          username: user.username,
          role: user.role,
        },
      },
      200,
      { 'Set-Cookie': sessionCookie(rawToken) },
    );
  } catch (error) {
    logAuthFailure('login', error);
    return jsonResponse({ error: '登入服務暫時無法使用，請稍後再試。' }, 503);
  }
}
