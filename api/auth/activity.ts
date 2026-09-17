import {
  expiredSessionCookie,
  getAuthenticatedSession,
  getSessionToken,
  isTrustedMutation,
  jsonResponse,
  logAuthFailure,
  refreshSessionActivity,
} from '../../server/auth.js';

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isTrustedMutation(request)) {
      return jsonResponse({ error: '不允許的請求。' }, 403);
    }

    const session = await getAuthenticatedSession(request);
    if (!session || !(await refreshSessionActivity(session.sessionId))) {
      const headers = getSessionToken(request)
        ? { 'Set-Cookie': expiredSessionCookie() }
        : undefined;
      return jsonResponse({ error: '登入已逾時。' }, 401, headers);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    logAuthFailure('activity refresh', error);
    return jsonResponse({ error: '登入服務暫時無法使用，請稍後再試。' }, 503);
  }
}
