import { saveMapLocation } from '../../server/map.js';
import { withMapSession } from '../../server/map-http.js';
import { parseLocation, readMapJson } from '../../server/map-validation.js';

export function POST(request: Request): Promise<Response> {
  return withMapSession(request, 'location save', true, async () => saveMapLocation(parseLocation(await readMapJson(request))));
}
