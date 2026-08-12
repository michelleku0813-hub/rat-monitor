import type { Location } from '../../types';

export const LOCATIONS: Location[] = [
  {
    location_id: 'LOC-001',
    name: '市場 A',
    type: 'market',
    address: '臺北市萬華區 prototype 示範市場',
    monitoring_hours: 168,
  },
  {
    location_id: 'LOC-002',
    name: '夜市 B',
    type: 'night_market',
    address: '臺北市大同區 prototype 示範夜市',
    monitoring_hours: 140,
  },
  {
    location_id: 'LOC-003',
    name: '巷道 C',
    type: 'alley',
    address: '臺北市中正區 prototype 示範巷道',
    monitoring_hours: 168,
  },
];

export const LOCATION_MAP = Object.fromEntries(
  LOCATIONS.map((loc) => [loc.location_id, loc]),
) as Record<string, Location>;
