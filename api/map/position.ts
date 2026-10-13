import { jsonResponse } from '../../server/auth.js';
import { updateSensorPosition } from '../../server/map.js';
import { mapErrorResponse } from '../../server/map-http.js';
import { isAuthorizedSensor, parseSensorPosition, readMapJson } from '../../server/map-validation.js';

/** Hardware authenticates independently of administrator cookies and Origin. */
export async function POST(request: Request): Promise<Response> {
  try {
    const input = parseSensorPosition(await readMapJson(request));
    if (!isAuthorizedSensor(request, input.device_id, process.env.MAP_SENSOR_TOKENS)) {
      return jsonResponse({ error: '設備驗證失敗。' }, 401);
    }
    return jsonResponse(await updateSensorPosition(input));
  } catch (error) {
    return mapErrorResponse('sensor update', error);
  }
}
