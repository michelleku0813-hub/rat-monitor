import { getMapState } from '../../server/map.js';
import { withMapSession } from '../../server/map-http.js';

export function GET(request: Request): Promise<Response> {
  return withMapSession(request, 'state read', false, getMapState);
}
