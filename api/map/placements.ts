import { saveDevicePlacement } from '../../server/map.js';
import { withMapSession } from '../../server/map-http.js';
import { parsePlacement, readMapJson } from '../../server/map-validation.js';

export function PUT(request: Request): Promise<Response> {
  return withMapSession(request, 'placement save', true, async () => saveDevicePlacement(parsePlacement(await readMapJson(request))));
}
