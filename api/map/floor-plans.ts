import { saveFloorPlan } from '../../server/map.js';
import { withMapSession } from '../../server/map-http.js';
import { parseFloorPlan, readMapJson } from '../../server/map-validation.js';

export function POST(request: Request): Promise<Response> {
  return withMapSession(request, 'floor plan save', true, async () => saveFloorPlan(parseFloorPlan(await readMapJson(request), true)));
}
