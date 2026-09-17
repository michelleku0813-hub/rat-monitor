import {
  expiredSessionCookie,
  getAuthenticatedSession,
  getSessionToken,
  jsonResponse,
  logAuthFailure,
} from '../../server/auth.js';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAuthenticatedSession(request);
    if (!session) {
      const headers = getSessionToken(request)
        ? { 'Set-Cookie': expiredSessionCookie() }
        : undefined;
      return jsonResponse({ error: '未登入。' }, 401, headers);
    }

    return jsonResponse({
      user: {
        username: session.user.username,
        role: session.user.role,
      },
    });
  } catch (error) {
    logAuthFailure('session lookup', error);
    return jsonResponse({ error: '登入服務暫時無法使用，請稍後再試。' }, 503);
  }
}
