import { getAuthenticatedSession, jsonResponse } from '../../server/auth.js';
import { getFloorImage } from '../../server/map.js';
import { mapErrorResponse } from '../../server/map-http.js';
import { identifier } from '../../server/map-validation.js';

export async function GET(request: Request): Promise<Response> {
  try {
    if (!await getAuthenticatedSession(request)) return jsonResponse({ error: '未登入。' }, 401);
    const floorPlanId = identifier(new URL(request.url).searchParams.get('floor_plan_id'), '平面圖識別碼');
    const image = await getFloorImage(floorPlanId);
    return new Response(image.body, { headers: {
      'Content-Type': image.contentType,
      'Content-Length': String(image.body.byteLength),
      'Cache-Control': 'private, no-store',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    } });
  } catch (error) {
    return mapErrorResponse('floor image read', error);
  }
}
