import { getDatabase } from './auth.js';
import { DEMO_FLOOR_PLANS, MAP_CATALOG } from '../src/data/mapCatalog.js';
import type {
  DevicePlacement,
  DevicePlacementInput,
  MapLocation,
  MapState,
  MarketFloorPlan,
  SensorPosition,
} from '../src/types/map.js';
import {
  isNewerObservation,
  MapRequestError,
  parseFloorPlan,
  parseLocation,
  validateFloorImage,
  type SensorPositionInput,
} from './map-validation.js';

const LOCATION_COLUMNS = 'location_id, name, type, address, district, latitude, longitude, coordinate_source, source_url';
const FLOOR_COLUMNS = 'floor_plan_id, location_id, name, image_url, width, height, source_label, source_url, is_demo';
const FLOOR_METADATA_COLUMNS = `floor_plan_id, location_id, name,
  CASE WHEN image_url LIKE 'data:image/%' THEN '/api/map/floor-image?floor_plan_id=' || floor_plan_id ELSE image_url END AS image_url,
  width, height, source_label, source_url, is_demo`;
const PLACEMENT_QUERY = `SELECT p.device_id, p.location_id, p.latitude, p.longitude, p.floor_plan_id, p.floor_x, p.floor_y, p.placement_note,
  s.latitude AS sensor_latitude, s.longitude AS sensor_longitude, s.accuracy_m AS sensor_accuracy_m, s.observed_at AS sensor_observed_at
  FROM map_device_placements p LEFT JOIN map_sensor_positions s ON s.device_id = p.device_id`;

interface LocationRow extends Omit<MapLocation, 'source_url'> { source_url: string | null }
interface FloorRow extends Omit<MarketFloorPlan, 'source_url'> { source_url: string | null }
interface PlacementRow extends DevicePlacementInput {
  sensor_latitude: number | null;
  sensor_longitude: number | null;
  sensor_accuracy_m: number | null;
  sensor_observed_at: string | Date | null;
}
interface PositionRow {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  observed_at: string | Date;
}

function locationFromRow(row: LocationRow): MapLocation {
  const { source_url, ...location } = row;
  return { ...location, ...(source_url ? { source_url } : {}) };
}

function floorFromRow(row: FloorRow): MarketFloorPlan {
  const { source_url, ...plan } = row;
  return { ...plan, image_url: plan.image_url.startsWith('data:image/') ? `/api/map/floor-image?floor_plan_id=${encodeURIComponent(plan.floor_plan_id)}` : plan.image_url, ...(source_url ? { source_url } : {}) };
}

function positionFromRow(row: PositionRow): SensorPosition {
  return { ...row, observed_at: new Date(row.observed_at).toISOString() };
}

function placementFromRow(row: PlacementRow): DevicePlacement {
  const { sensor_latitude, sensor_longitude, sensor_accuracy_m, sensor_observed_at, ...placement } = row;
  return {
    ...placement,
    sensor_position: sensor_latitude !== null && sensor_longitude !== null && sensor_observed_at !== null
      ? positionFromRow({ latitude: sensor_latitude, longitude: sensor_longitude, accuracy_m: sensor_accuracy_m, observed_at: sensor_observed_at })
      : null,
  };
}

function mergeById<T>(reference: T[], saved: T[], id: (item: T) => string): T[] {
  return [...new Map([...reference, ...saved].map((item) => [id(item), item])).values()];
}

/** A read never writes a catalog row or applies a schema migration. */
export async function getMapState(): Promise<MapState> {
  const [locations, floorPlans, placements] = await getDatabase().transaction((sql) => [
    sql.query(`SELECT ${LOCATION_COLUMNS} FROM map_locations ORDER BY location_id`),
    sql.query(`SELECT ${FLOOR_METADATA_COLUMNS} FROM map_floor_plans ORDER BY floor_plan_id`),
    sql.query(`${PLACEMENT_QUERY} ORDER BY p.device_id`),
  ], { isolationLevel: 'RepeatableRead', readOnly: true });
  return {
    locations: mergeById(MAP_CATALOG, (locations as LocationRow[]).map(locationFromRow), (item) => item.location_id),
    floor_plans: mergeById(DEMO_FLOOR_PLANS, (floorPlans as FloorRow[]).map(floorFromRow), (item) => item.floor_plan_id),
    placements: (placements as PlacementRow[]).map(placementFromRow),
  };
}

const UPSERT_LOCATION = `INSERT INTO map_locations (${LOCATION_COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  ON CONFLICT (location_id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, address = EXCLUDED.address,
  district = EXCLUDED.district, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
  coordinate_source = EXCLUDED.coordinate_source, source_url = EXCLUDED.source_url, updated_at = NOW()
  RETURNING ${LOCATION_COLUMNS}`;

function locationParameters(location: MapLocation): unknown[] {
  return [location.location_id, location.name, location.type, location.address, location.district,
    location.latitude, location.longitude, location.coordinate_source, location.source_url ?? null];
}

export async function saveMapLocation(location: MapLocation): Promise<MapLocation> {
  const rows = await getDatabase().query(UPSERT_LOCATION, locationParameters(location)) as LocationRow[];
  return locationFromRow(rows[0]);
}

/** Catalog rows only become persistent when an administrator saves a related item. */
async function ensureLocation(locationId: string): Promise<void> {
  const sql = getDatabase();
  const rows = await sql.query('SELECT location_id FROM map_locations WHERE location_id = $1', [locationId]);
  if (rows.length) return;
  const reference = MAP_CATALOG.find((item) => item.location_id === locationId);
  if (!reference) throw new MapRequestError('場域不存在，請先儲存場域。', 404);
  const location = parseLocation(reference);
  // Preserve a concurrent administrator edit instead of replacing it with catalog data.
  await sql.query(`INSERT INTO map_locations (${LOCATION_COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (location_id) DO NOTHING`, locationParameters(location));
}

export async function saveFloorPlan(plan: MarketFloorPlan): Promise<MarketFloorPlan> {
  await ensureLocation(plan.location_id);
  const parameters = [plan.floor_plan_id, plan.location_id, plan.name, plan.image_url, plan.width, plan.height,
    plan.source_label, plan.source_url ?? null, plan.is_demo];
  const results = await getDatabase().transaction((sql) => [
    // Lock even an absent ID to serialize concurrent creation and metadata updates.
    sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [plan.floor_plan_id]),
    sql.query(`INSERT INTO map_floor_plans (${FLOOR_COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (floor_plan_id) DO UPDATE SET name = EXCLUDED.name, source_label = EXCLUDED.source_label,
      source_url = EXCLUDED.source_url, is_demo = EXCLUDED.is_demo, updated_at = NOW()
      WHERE map_floor_plans.location_id = EXCLUDED.location_id AND map_floor_plans.image_url = EXCLUDED.image_url
      AND map_floor_plans.width = EXCLUDED.width AND map_floor_plans.height = EXCLUDED.height RETURNING ${FLOOR_METADATA_COLUMNS}`, parameters),
  ]);
  const rows = results[1] as FloorRow[];
  if (!rows.length) throw new MapRequestError('平面圖識別碼已存在；更換圖片、尺寸或場域時，請建立新的平面圖識別碼。', 409);
  return floorFromRow(rows[0]);
}

/** Serve one protected raster at a time; state responses never embed large images. */
export async function getFloorImage(floorPlanId: string): Promise<{ body: Uint8Array<ArrayBuffer>; contentType: string }> {
  const rows = await getDatabase().query('SELECT image_url, width, height FROM map_floor_plans WHERE floor_plan_id = $1', [floorPlanId]) as { image_url: string; width: number; height: number }[];
  const plan = rows[0];
  if (!plan || !plan.image_url.startsWith('data:image/')) throw new MapRequestError('上傳的平面圖圖片不存在。', 404);
  validateFloorImage(plan.image_url, plan.width, plan.height);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(plan.image_url);
  if (!match) throw new Error('Stored map image invalid');
  return { body: Uint8Array.from(Buffer.from(match[2], 'base64')), contentType: match[1] };
}

async function ensureFloorPlan(floorPlanId: string, locationId: string): Promise<void> {
  const rows = await getDatabase().query('SELECT location_id FROM map_floor_plans WHERE floor_plan_id = $1', [floorPlanId]) as { location_id: string }[];
  if (rows.length) {
    if (rows[0].location_id !== locationId) throw new MapRequestError('平面圖不屬於選取的場域。');
    return;
  }
  const demo = DEMO_FLOOR_PLANS.find((item) => item.floor_plan_id === floorPlanId && item.location_id === locationId);
  if (!demo) throw new MapRequestError('平面圖不存在或不屬於選取的場域。');
  await saveFloorPlan(parseFloorPlan(demo, true));
}

async function getDevicePlacement(deviceId: string): Promise<DevicePlacement | null> {
  const rows = await getDatabase().query(`${PLACEMENT_QUERY} WHERE p.device_id = $1`, [deviceId]) as PlacementRow[];
  return rows[0] ? placementFromRow(rows[0]) : null;
}

export async function saveDevicePlacement(placement: DevicePlacementInput): Promise<DevicePlacement> {
  await ensureLocation(placement.location_id);
  if (placement.floor_plan_id) await ensureFloorPlan(placement.floor_plan_id, placement.location_id);
  const { device_id, location_id, latitude, longitude, floor_plan_id, floor_x, floor_y, placement_note } = placement;
  await getDatabase().transaction((sql) => [
    // Images are immutable for each plan ID, so a delayed pin still refers to its original image.
    sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [floor_plan_id ?? `device:${device_id}`]),
    sql.query(`INSERT INTO map_device_placements (device_id, location_id, latitude, longitude, floor_plan_id, floor_x, floor_y, placement_note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (device_id) DO UPDATE SET location_id = EXCLUDED.location_id,
      latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, floor_plan_id = EXCLUDED.floor_plan_id,
      floor_x = EXCLUDED.floor_x, floor_y = EXCLUDED.floor_y, placement_note = EXCLUDED.placement_note, updated_at = NOW()`,
    [device_id, location_id, latitude, longitude, floor_plan_id, floor_x, floor_y, placement_note]),
  ]);
  const saved = await getDevicePlacement(device_id);
  if (!saved) throw new Error('Map placement save failed');
  return saved;
}

export interface SensorUpdateResult {
  device_id: string;
  accepted: boolean;
  sensor_position: SensorPosition;
}

export async function updateSensorPosition(input: SensorPositionInput): Promise<SensorUpdateResult> {
  const current = await getDevicePlacement(input.device_id);
  if (!current) throw new MapRequestError('設備未登錄，請先由管理員設定機台位置。', 404);
  if (!isNewerObservation(input, current.sensor_position)) {
    return { device_id: input.device_id, accepted: false, sensor_position: current.sensor_position! };
  }
  const rows = await getDatabase().query(`INSERT INTO map_sensor_positions (device_id, latitude, longitude, accuracy_m, observed_at)
    VALUES ($1,$2,$3,$4,$5) ON CONFLICT (device_id) DO UPDATE SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude, accuracy_m = EXCLUDED.accuracy_m, observed_at = EXCLUDED.observed_at, received_at = NOW()
    WHERE map_sensor_positions.observed_at < EXCLUDED.observed_at
    RETURNING latitude, longitude, accuracy_m, observed_at`,
  [input.device_id, input.latitude, input.longitude, input.accuracy_m, input.observed_at]) as PositionRow[];
  if (rows[0]) return { device_id: input.device_id, accepted: true, sensor_position: positionFromRow(rows[0]) };
  // Another request may have stored an even newer point since the initial read.
  const latest = await getDevicePlacement(input.device_id);
  if (!latest?.sensor_position) throw new Error('Map sensor update failed');
  return { device_id: input.device_id, accepted: false, sensor_position: latest.sensor_position };
}
