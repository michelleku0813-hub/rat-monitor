import {
  emptyResponse,
  expiredSessionCookie,
  getAuthenticatedSession,
  isTrustedMutation,
  logAuthFailure,
  revokeSession,
} from '../../server/auth.js';

export async function POST(request: Request): Promise<Response> {
  try {
    if (!isTrustedMutation(request)) {
      return emptyResponse(403);
    }

    const session = await getAuthenticatedSession(request);
    if (session) {
      await revokeSession(session, request);
    }
    return emptyResponse(204, { 'Set-Cookie': expiredSessionCookie() });
  } catch (error) {
    logAuthFailure('logout', error);
    return emptyResponse(204, { 'Set-Cookie': expiredSessionCookie() });
  }
}
