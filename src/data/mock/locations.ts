import type { Location } from '../../types';

export const LOCATIONS: Location[] = [
  {
    location_id: 'LOC-001',
    name: '市場 A',
    type: 'market',
    address: '臺北市萬華區 prototype 示範市場',
    district: '萬華區',
    latitude: 25.0374,
    longitude: 121.4997,
    map_position: { x: 37, y: 63 },
  },
  {
    location_id: 'LOC-002',
    name: '夜市 B',
    type: 'night_market',
    address: '臺北市大同區 prototype 示範夜市',
    district: '大同區',
    latitude: 25.0553,
    longitude: 121.5159,
    map_position: { x: 53, y: 35 },
  },
  {
    location_id: 'LOC-003',
    name: '巷道 C',
    type: 'alley',
    address: '臺北市中正區 prototype 示範巷道',
    district: '中正區',
    latitude: 25.0287,
    longitude: 121.5197,
    map_position: { x: 61, y: 68 },
  },
];

export const LOCATION_MAP = Object.fromEntries(
  LOCATIONS.map((loc) => [loc.location_id, loc]),
) as Record<string, Location>;
