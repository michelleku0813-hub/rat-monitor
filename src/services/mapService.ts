import { LOCATIONS } from '../data/mock/locations';
import { MAP_CATALOG, DEMO_FLOOR_PLANS } from '../data/mapCatalog';
import { REFERENCE_FLOOR_PLANS, getReferenceFloorPlan, isReferenceFloorPlan } from '../data/marketFloorPlans';
import type { DevicePlacement, DevicePlacementInput, MapLocation, MapState, MarketFloorPlan, SensorPosition } from '../types/map';

export const MAP_DATA_MODE = import.meta.env?.VITE_MAP_DATA_MODE === 'api' ? 'api' : 'demo';
const STORAGE_KEY = 'rat-monitor-map-v1';

export function createDemoMapState(): MapState {
  return {
    locations: [
      ...LOCATIONS.map(({ map_position: _position, ...location }) => ({ ...location, coordinate_source: 'demo' as const })),
      ...MAP_CATALOG.map((location) => ({ ...location })),
    ],
    floor_plans: [...DEMO_FLOOR_PLANS, ...REFERENCE_FLOOR_PLANS].map((plan) => ({ ...plan })),
    placements: LOCATIONS.map((location, index) => ({
      device_id: `RAT-TPE-${String(index + 1).padStart(3, '0')}`,
      location_id: location.location_id,
      latitude: location.latitude,
      longitude: location.longitude,
      floor_plan_id: index === 0 ? DEMO_FLOOR_PLANS[0]?.floor_plan_id ?? null : null,
      floor_x: index === 0 ? 0.28 : null,
      floor_y: index === 0 ? 0.36 : null,
      placement_note: index === 0 ? '示範位置，請以現場勘查後的配置為準。' : '示範機台設定位置',
      sensor_position: null,
    })),
  };
}

function requireValue(condition: unknown): asserts condition {
  if (!condition) throw new Error('地圖資料格式不正確，請確認座標、識別碼與平面圖。');
}

function object(value: unknown): Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function id(value: unknown): string {
  requireValue(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value));
  return value;
}

function text(value: unknown, limit: number, allowEmpty = false): string {
  requireValue(typeof value === 'string');
  const result = value.trim();
  requireValue((allowEmpty || result.length > 0) && result.length <= limit);
  requireValue(![...result].some((char) => char.charCodeAt(0) < 32 && !['\t', '\n', '\r'].includes(char)));
  return result;
}

function number(value: unknown, min: number, max: number): number {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
  return value;
}

function url(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  const result = text(value, 1500);
  const parsed = new URL(result);
  requireValue(['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password);
  return result;
}

function parseLocation(value: unknown): MapLocation {
  const item = object(value);
  requireValue(typeof item.type === 'string' && ['market', 'night_market', 'alley', 'other'].includes(item.type));
  requireValue(typeof item.coordinate_source === 'string' && ['demo', 'reference', 'manual'].includes(item.coordinate_source));
  const sourceUrl = url(item.source_url);
  return {
    location_id: id(item.location_id), name: text(item.name, 120), type: item.type as MapLocation['type'],
    address: text(item.address, 300, true), district: text(item.district, 40, true),
    latitude: number(item.latitude, 21.5, 26.5), longitude: number(item.longitude, 118, 123),
    coordinate_source: item.coordinate_source as MapLocation['coordinate_source'], ...(sourceUrl ? { source_url: sourceUrl } : {}),
  };
}

/** Validate raster headers without executing SVG or loading remote content. */
function imageDimensions(bytes: string, mime: string): [number, number] | null {
  const read = (offset: number, size: number, little = false) => {
    let value = 0;
    for (let index = 0; index < size; index += 1) value = value * 256 + bytes.charCodeAt(offset + (little ? size - 1 - index : index));
    return value;
  };
  if (mime === 'png') {
    if (bytes.length < 33 || bytes.slice(0, 8) !== '\x89PNG\r\n\x1a\n' || bytes.slice(12, 16) !== 'IHDR') return null;
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = read(offset, 4);
      if (length > bytes.length - offset - 12) return null;
      const kind = bytes.slice(offset + 4, offset + 8);
      offset += length + 12;
      if (kind === 'IEND') return length === 0 && offset === bytes.length ? [read(16, 4), read(20, 4)] : null;
    }
    return null;
  }
  if (mime === 'jpeg') {
    if (bytes.length < 12 || read(0, 2) !== 0xffd8 || read(bytes.length - 2, 2) !== 0xffd9) return null;
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (read(offset, 1) !== 0xff) return null;
      while (read(offset, 1) === 0xff) offset += 1;
      const marker = read(offset++, 1);
      if (marker === 0xda || marker === 0xd9) return null;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) return null;
      const length = read(offset, 2);
      if (length < 2 || offset + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return length >= 8 ? [read(offset + 5, 2), read(offset + 3, 2)] : null;
      offset += length;
    }
    return null;
  }
  if (bytes.length < 30 || bytes.slice(0, 4) !== 'RIFF' || bytes.slice(8, 12) !== 'WEBP' || read(4, 4, true) + 8 !== bytes.length) return null;
  const kind = bytes.slice(12, 16);
  const size = read(16, 4, true);
  if (size > bytes.length - 20) return null;
  if (kind === 'VP8X' && size >= 10) return [read(24, 3, true) + 1, read(27, 3, true) + 1];
  if (kind === 'VP8L' && size >= 5 && read(20, 1) === 0x2f) {
    const packed = read(21, 4, true);
    return [(packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1];
  }
  if (kind === 'VP8 ' && size >= 10 && bytes.slice(23, 26) === '\x9d\x01\x2a') return [read(26, 2, true) & 0x3fff, read(28, 2, true) & 0x3fff];
  return null;
}

function parseFloorPlan(value: unknown, allowProtectedImage = false): MarketFloorPlan {
  const item = object(value);
  const width = number(item.width, 1, 8000);
  const height = number(item.height, 1, 8000);
  requireValue(Number.isInteger(width) && Number.isInteger(height) && typeof item.is_demo === 'boolean' && typeof item.image_url === 'string');
  const image = item.image_url;
  const floorPlanId = id(item.floor_plan_id);
  const reference = getReferenceFloorPlan(floorPlanId);
  if (reference) {
    requireValue(isReferenceFloorPlan(item));
    return { ...reference };
  }
  if (image === '/maps/demo-market-floor.svg') requireValue(item.is_demo && width === 1200 && height === 800);
  else if (allowProtectedImage && image === `/api/map/floor-image?floor_plan_id=${encodeURIComponent(floorPlanId)}`) { /* Authenticated binary image endpoint. */ }
  else {
    requireValue(image.length <= Math.ceil((2 * 1024 * 1024) / 3) * 4 + 64);
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    requireValue(match && match[2].length % 4 === 0);
    const bytes = atob(match[2]);
    requireValue(bytes.length <= 2 * 1024 * 1024 && btoa(bytes) === match[2]);
    const dimensions = imageDimensions(bytes, match[1]);
    requireValue(dimensions && dimensions[0] === width && dimensions[1] === height);
  }
  const sourceUrl = url(item.source_url);
  return {
    floor_plan_id: floorPlanId, location_id: id(item.location_id), name: text(item.name, 120),
    image_url: image, width, height, source_label: text(item.source_label, 180),
    ...(sourceUrl ? { source_url: sourceUrl } : {}), is_demo: item.is_demo,
  };
}

function parsePlacement(value: unknown): DevicePlacementInput {
  const item = object(value);
  const hasGps = item.latitude !== null || item.longitude !== null;
  const hasFloorPoint = item.floor_x !== null || item.floor_y !== null;
  const floorPlanId = item.floor_plan_id === null ? null : id(item.floor_plan_id);
  requireValue(!hasFloorPoint || floorPlanId !== null);
  return {
    device_id: id(item.device_id), location_id: id(item.location_id),
    latitude: hasGps ? number(item.latitude, -90, 90) : null, longitude: hasGps ? number(item.longitude, -180, 180) : null,
    floor_plan_id: floorPlanId, floor_x: hasFloorPoint ? number(item.floor_x, 0, 1) : null,
    floor_y: hasFloorPoint ? number(item.floor_y, 0, 1) : null, placement_note: text(item.placement_note, 1000, true),
  };
}

function parseSensor(value: unknown): SensorPosition | null {
  if (value === null) return null;
  const item = object(value);
  requireValue(typeof item.observed_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(item.observed_at));
  const calendar = new Date(`${item.observed_at.slice(0, 19)}Z`);
  const observedTime = Date.parse(item.observed_at);
  requireValue(Number.isFinite(calendar.getTime()) && calendar.toISOString().slice(0, 19) === item.observed_at.slice(0, 19) && Number.isFinite(observedTime));
  return {
    latitude: number(item.latitude, -90, 90), longitude: number(item.longitude, -180, 180),
    accuracy_m: item.accuracy_m === null ? null : number(item.accuracy_m, 0, 100000), observed_at: new Date(observedTime).toISOString(),
  };
}

function parseDevicePlacement(value: unknown): DevicePlacement {
  const item = object(value);
  return { ...parsePlacement(item), sensor_position: parseSensor(item.sensor_position) };
}

function requireUnique<T>(items: T[], key: (item: T) => string): void {
  requireValue(new Set(items.map(key)).size === items.length);
}

function requirePlacementReferences(state: MapState, placement: DevicePlacementInput): void {
  requireValue(state.locations.some((location) => location.location_id === placement.location_id));
  requireValue(placement.floor_plan_id === null || state.floor_plans.some((plan) => plan.floor_plan_id === placement.floor_plan_id && plan.location_id === placement.location_id));
}

/** Never pass unchecked local or API records to numeric formatting components. */
function parseMapState(value: unknown, allowProtectedImages = false): MapState {
  const item = object(value);
  requireValue(Array.isArray(item.locations) && Array.isArray(item.floor_plans) && Array.isArray(item.placements));
  const state: MapState = {
    locations: item.locations.map(parseLocation), floor_plans: item.floor_plans.map((plan) => parseFloorPlan(plan, allowProtectedImages)), placements: item.placements.map(parseDevicePlacement),
  };
  requireUnique(state.locations, (location) => location.location_id);
  requireUnique(state.floor_plans, (plan) => plan.floor_plan_id);
  requireUnique(state.placements, (placement) => placement.device_id);
  for (const plan of state.floor_plans) requireValue(state.locations.some((location) => location.location_id === plan.location_id));
  for (const placement of state.placements) requirePlacementReferences(state, placement);
  return state;
}

type BrowserMapStorage = Pick<Storage, 'getItem' | 'setItem'>;

function readDemoState(storage?: BrowserMapStorage): MapState {
  const initial = createDemoMapState();
  let saved: string | null;
  try { saved = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY); }
  catch { throw new Error('瀏覽器無法讀取地圖設定，請允許本機儲存。'); }
  if (!saved) return initial;
  try {
    const parsed = parseMapState(JSON.parse(saved));
    // Keep newly bundled reference sites available after earlier demo edits.
    return {
      ...parsed,
      locations: [...new Map([...initial.locations, ...parsed.locations].map((location) => [location.location_id, location])).values()],
      floor_plans: [...new Map([...initial.floor_plans, ...parsed.floor_plans].map((plan) => [plan.floor_plan_id, plan])).values()],
    };
  } catch { throw new Error('本機地圖設定損毀，原始資料仍保留；請修復或清除此網站的地圖儲存資料後重試。'); }
}

function persistDemoState(state: MapState, storage?: BrowserMapStorage): void {
  try { (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { throw new Error('無法儲存地圖設定，可能是瀏覽器儲存空間不足。請改用較小的平面圖。'); }
}

async function mapRequest(fetcher: typeof fetch, path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const response = await fetcher(`/api/map/${path}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string' ? payload.error : '地圖服務無法使用，請確認已完成後端與資料庫設定。';
    throw new Error(message);
  }
  return payload;
}

interface MapServiceOptions { mode: 'api' | 'demo'; storage?: BrowserMapStorage; fetcher?: typeof fetch }

/** Explicit dependencies let tests prove that API failures never fall back to local data. */
export function createMapService({ mode, storage, fetcher = globalThis.fetch }: MapServiceOptions) {
  return {
    async getMapState(): Promise<MapState> {
      return mode === 'api' ? parseMapState(await mapRequest(fetcher, 'state'), true) : readDemoState(storage);
    },
    async saveMapLocation(value: MapLocation): Promise<MapLocation> {
      const location = parseLocation(value);
      if (mode === 'api') return parseLocation(await mapRequest(fetcher, 'locations', 'POST', location));
      const state = readDemoState(storage);
      state.locations = [...state.locations.filter((item) => item.location_id !== location.location_id), location];
      persistDemoState(state, storage);
      return location;
    },
    async saveFloorPlan(value: MarketFloorPlan): Promise<MarketFloorPlan> {
      const plan = parseFloorPlan(value);
      if (mode === 'api') return parseFloorPlan(await mapRequest(fetcher, 'floor-plans', 'POST', plan), true);
      const state = readDemoState(storage);
      requireValue(state.locations.some((location) => location.location_id === plan.location_id));
      const previous = state.floor_plans.find((item) => item.floor_plan_id === plan.floor_plan_id);
      if (previous && (previous.image_url !== plan.image_url || previous.width !== plan.width || previous.height !== plan.height || previous.location_id !== plan.location_id)) {
        throw new Error('請以新的平面圖識別碼上傳更新圖面，並重新確認機台位置。');
      }
      state.floor_plans = [...state.floor_plans.filter((item) => item.floor_plan_id !== plan.floor_plan_id), plan];
      persistDemoState(state, storage);
      return plan;
    },
    async saveDevicePlacement(value: DevicePlacementInput): Promise<DevicePlacement> {
      const input = parsePlacement(value);
      if (mode === 'api') return parseDevicePlacement(await mapRequest(fetcher, 'placements', 'PUT', input));
      const state = readDemoState(storage);
      requirePlacementReferences(state, input);
      const old = state.placements.find((item) => item.device_id === input.device_id);
      const placement: DevicePlacement = { ...input, sensor_position: old?.sensor_position ?? null };
      state.placements = [...state.placements.filter((item) => item.device_id !== input.device_id), placement];
      persistDemoState(state, storage);
      return placement;
    },
  };
}

const service = createMapService({ mode: MAP_DATA_MODE });
export const getMapState = service.getMapState;
export const saveMapLocation = service.saveMapLocation;
export const saveFloorPlan = service.saveFloorPlan;
export const saveDevicePlacement = service.saveDevicePlacement;
