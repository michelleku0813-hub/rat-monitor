import {
  getAuthenticatedSession,
  isTrustedMutation,
  jsonResponse,
  type AuthenticatedSession,
} from './auth.js';
import { MapRequestError } from './map-validation.js';

export function mapErrorResponse(operation: string, error: unknown): Response {
  if (error instanceof MapRequestError) return jsonResponse({ error: error.message }, error.status);
  // Driver errors can contain DATABASE_URL credentials. Do not log error objects.
  console.error(`Map ${operation} failed (internal).`);
  return jsonResponse({ error: '地圖服務暫時無法使用，請確認後端設定或稍後重試。' }, 503);
}

export async function withMapSession(
  request: Request,
  operation: string,
  mutation: boolean,
  action: () => Promise<unknown>,
  sessionLookup: (request: Request) => Promise<AuthenticatedSession | null> = getAuthenticatedSession,
): Promise<Response> {
  try {
    if (mutation && !isTrustedMutation(request)) return jsonResponse({ error: '不允許的地圖修改請求。' }, 403);
    const session = await sessionLookup(request);
    if (!session) return jsonResponse({ error: '未登入。' }, 401);
    if (mutation && session.user.role === 'viewer') return jsonResponse({ error: '此帳號僅可檢視地圖。' }, 403);
    return jsonResponse(await action());
  } catch (error) {
    return mapErrorResponse(operation, error);
  }
}
