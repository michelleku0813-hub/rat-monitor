import { createHash, timingSafeEqual } from 'node:crypto';
import type {
  DevicePlacementInput,
  MapLocation,
  MarketFloorPlan,
  SensorPosition,
} from '../src/types/map.js';

export const MAX_MAP_JSON_BYTES = 3 * 1024 * 1024;
export const MAX_FLOOR_IMAGE_BYTES = 2 * 1024 * 1024;
export const DEMO_FLOOR_IMAGE = '/maps/demo-market-floor.svg';

export class MapRequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'MapRequestError';
    this.status = status;
  }
}

function invalid(message: string): never {
  throw new MapRequestError(message);
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    invalid('請提供 JSON 物件。');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maxLength: number, allowEmpty = false): string {
  if (typeof value !== 'string') invalid(`${label}格式不正確。`);
  const result = value.trim();
  const hasControl = [...result].some((char) => char.charCodeAt(0) < 32 && !['\t', '\n', '\r'].includes(char));
  if ((!allowEmpty && !result) || result.length > maxLength || hasControl) {
    invalid(`${label}長度或格式不正確。`);
  }
  return result;
}

export function identifier(value: unknown, label = '識別碼'): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) {
    invalid(`${label}只能包含英數字、底線及連字號，最多 64 字。`);
  }
  return value;
}

function finite(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    invalid(`${label}必須是 ${min} 至 ${max} 的有效數字。`);
  }
  return value;
}

export function validateCoordinates(latitude: unknown, longitude: unknown): { latitude: number; longitude: number } {
  return {
    latitude: finite(latitude, '緯度', -90, 90),
    longitude: finite(longitude, '經度', -180, 180),
  };
}

function sourceUrl(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  const result = text(value, '來源網址', 1500);
  try {
    const url = new URL(result);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) invalid('來源網址必須是 HTTP 或 HTTPS。');
  } catch {
    invalid('來源網址必須是 HTTP 或 HTTPS。');
  }
  return result;
}

export function parseLocation(value: unknown): MapLocation {
  const input = record(value);
  const coords = validateCoordinates(input.latitude, input.longitude);
  // Covers Taiwan and nearby islands; the Taipei viewport is a display choice.
  if (coords.latitude < 21.5 || coords.latitude > 26.5 || coords.longitude < 118 || coords.longitude > 123) {
    invalid('場域座標須位於臺灣範圍（緯度 21.5–26.5、經度 118–123），請確認經緯度順序。');
  }
  if (typeof input.type !== 'string' || !['market', 'night_market', 'alley', 'other'].includes(input.type)) invalid('場域類型不正確。');
  if (typeof input.coordinate_source !== 'string' || !['demo', 'reference', 'manual'].includes(input.coordinate_source)) invalid('座標來源不正確。');
  const url = sourceUrl(input.source_url);
  return {
    location_id: identifier(input.location_id, '場域識別碼'),
    name: text(input.name, '場域名稱', 120),
    type: input.type as MapLocation['type'],
    address: text(input.address, '地址', 300, true),
    district: text(input.district, '行政區', 40, true),
    ...coords,
    coordinate_source: input.coordinate_source as MapLocation['coordinate_source'],
    ...(url ? { source_url: url } : {}),
  };
}

export function parsePlacement(value: unknown): DevicePlacementInput {
  const input = record(value);
  const hasGps = input.latitude !== null || input.longitude !== null;
  const gps = hasGps ? validateCoordinates(input.latitude, input.longitude) : { latitude: null, longitude: null };
  const hasFloorPoint = input.floor_x !== null || input.floor_y !== null;
  const floorPlanId = input.floor_plan_id === null ? null : identifier(input.floor_plan_id, '平面圖識別碼');
  if (hasFloorPoint && !floorPlanId) invalid('平面座標須指定所屬平面圖。');
  return {
    device_id: identifier(input.device_id, '設備識別碼'),
    location_id: identifier(input.location_id, '場域識別碼'),
    ...gps,
    floor_plan_id: floorPlanId,
    floor_x: hasFloorPoint ? finite(input.floor_x, '平面 X 座標', 0, 1) : null,
    floor_y: hasFloorPoint ? finite(input.floor_y, '平面 Y 座標', 0, 1) : null,
    placement_note: text(input.placement_note, '擺設說明', 1000, true),
  };
}

function pngDimensions(bytes: Buffer): [number, number] | null {
  if (bytes.length < 33 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
  let offset = 8;
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.length - offset - 12) return null;
    const kind = bytes.toString('ascii', offset + 4, offset + 8);
    offset += length + 12;
    if (kind === 'IEND') {
      ended = length === 0 && offset === bytes.length;
      break;
    }
  }
  return ended ? [bytes.readUInt32BE(16), bytes.readUInt32BE(20)] : null;
}

function jpegDimensions(bytes: Buffer): [number, number] | null {
  if (bytes.length < 12 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8) return null;
      return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Buffer): [number, number] | null {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) return null;
  const kind = bytes.toString('ascii', 12, 16);
  const size = bytes.readUInt32LE(16);
  if (size > bytes.length - 20) return null;
  if (kind === 'VP8X' && size >= 10) return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
  if (kind === 'VP8L' && size >= 5 && bytes[20] === 0x2f) {
    const packed = bytes.readUInt32LE(21);
    return [(packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1];
  }
  if (kind === 'VP8 ' && size >= 10 && bytes.subarray(23, 26).toString('hex') === '9d012a') return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  return null;
}

export function validateFloorImage(image: unknown, width: unknown, height: unknown, allowDemo = false): { image_url: string; width: number; height: number } {
  const imageWidth = finite(width, '平面圖寬度', 1, 8000);
  const imageHeight = finite(height, '平面圖高度', 1, 8000);
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight)) invalid('平面圖尺寸必須是整數。');
  if (allowDemo && image === DEMO_FLOOR_IMAGE && imageWidth === 1200 && imageHeight === 800) return { image_url: image, width: imageWidth, height: imageHeight };
  if (typeof image !== 'string') invalid('請上傳 PNG、JPEG 或 WebP 平面圖。');
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match || match[2].length % 4 !== 0) invalid('請上傳 PNG、JPEG 或 WebP 的有效圖片資料。');
  // Reject before decoding so oversized payloads do not allocate a second large buffer.
  if (match[2].length > Math.ceil(MAX_FLOOR_IMAGE_BYTES / 3) * 4) throw new MapRequestError('平面圖不得超過 2 MB。', 413);
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_FLOOR_IMAGE_BYTES) throw new MapRequestError('平面圖不得超過 2 MB。', 413);
  if (bytes.toString('base64') !== match[2]) invalid('圖片的 Base64 資料不正確。');
  const dimensions = match[1] === 'png' ? pngDimensions(bytes) : match[1] === 'jpeg' ? jpegDimensions(bytes) : webpDimensions(bytes);
  if (!dimensions || dimensions[0] !== imageWidth || dimensions[1] !== imageHeight) invalid('圖片格式或尺寸不符，請重新選取平面圖。');
  return { image_url: image, width: imageWidth, height: imageHeight };
}

export function parseFloorPlan(value: unknown, allowDemo = false): MarketFloorPlan {
  const input = record(value);
  if (typeof input.is_demo !== 'boolean') invalid('請標示平面圖是否為示範資料。');
  if (input.image_url === DEMO_FLOOR_IMAGE && !input.is_demo) invalid('示範平面圖必須保留示範標示。');
  const url = sourceUrl(input.source_url);
  return {
    floor_plan_id: identifier(input.floor_plan_id, '平面圖識別碼'),
    location_id: identifier(input.location_id, '場域識別碼'),
    name: text(input.name, '平面圖名稱', 120),
    ...validateFloorImage(input.image_url, input.width, input.height, allowDemo),
    source_label: text(input.source_label, '平面圖來源', 180),
    ...(url ? { source_url: url } : {}),
    is_demo: input.is_demo,
  };
}

export interface SensorPositionInput extends SensorPosition {
  device_id: string;
}

export function parseSensorPosition(value: unknown, now = Date.now()): SensorPositionInput {
  const input = record(value);
  const coords = validateCoordinates(input.latitude, input.longitude);
  if (typeof input.observed_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(input.observed_at)) invalid('感測時間須為含時區的 ISO 8601 時間。');
  const calendar = new Date(`${input.observed_at.slice(0, 19)}Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 19) !== input.observed_at.slice(0, 19)) invalid('感測時間的日期或時刻不存在。');
  const observedTime = Date.parse(input.observed_at);
  if (!Number.isFinite(observedTime) || observedTime > now + 5 * 60 * 1000) invalid('感測時間不正確或超過現在 5 分鐘，請校正設備時鐘。');
  return {
    device_id: identifier(input.device_id, '設備識別碼'),
    ...coords,
    accuracy_m: input.accuracy_m === null || input.accuracy_m === undefined ? null : finite(input.accuracy_m, '定位誤差', 0, 100000),
    observed_at: new Date(observedTime).toISOString(),
  };
}

/** Older and duplicate timestamps cannot replace the latest observation. */
export function isNewerObservation(incoming: SensorPosition, current: SensorPosition | null): boolean {
  return !current || Date.parse(incoming.observed_at) > Date.parse(current.observed_at);
}

export function isAuthorizedSensor(request: Request, deviceId: string, configuredTokens: string | undefined): boolean {
  if (!configuredTokens) throw new Error('Sensor token configuration missing');
  let config: Record<string, unknown>;
  try {
    config = record(JSON.parse(configuredTokens));
  } catch {
    throw new Error('Sensor token configuration invalid');
  }
  const expected = Object.hasOwn(config, deviceId) ? config[deviceId] : undefined;
  const token = /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (typeof expected !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(expected) || !token) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(expected), digest(token));
}

/** Limit streamed bodies as well as Content-Length; no unbounded request.json(). */
export async function readMapJson(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) throw new MapRequestError('請使用 application/json。', 415);
  const contentLength = request.headers.get('content-length');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_MAP_JSON_BYTES)) throw new MapRequestError('請求不得超過 3 MB。', 413);
  if (!request.body) invalid('請提供 JSON 物件。');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MAP_JSON_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new MapRequestError('請求不得超過 3 MB。', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return record(JSON.parse(Buffer.concat(chunks, total).toString('utf8')));
  } catch (error) {
    if (error instanceof MapRequestError) throw error;
    invalid('JSON 格式不正確。');
  }
}
