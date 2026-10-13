import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEMO_FLOOR_IMAGE,
  MAX_MAP_JSON_BYTES,
  MapRequestError,
  isAuthorizedSensor,
  isNewerObservation,
  parseFloorPlan,
  parseLocation,
  parsePlacement,
  parseSensorPosition,
  readMapJson,
  validateCoordinates,
  validateFloorImage,
} from '../server/map-validation.ts';

const location = {
  location_id: 'LOC-TEST', name: '測試市場', type: 'market', address: '臺北市',
  district: '中正區', latitude: 25.04, longitude: 121.52, coordinate_source: 'manual',
};
const placement = {
  device_id: 'RAT-TPE-TEST', location_id: 'LOC-TEST', latitude: null, longitude: null,
  floor_plan_id: null, floor_x: null, floor_y: null, placement_note: '',
};
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=';
const now = Date.parse('2026-10-13T12:00:00Z');
const sensor = { device_id: 'RAT-TPE-TEST', latitude: 25.04, longitude: 121.52, accuracy_m: 6, observed_at: '2026-10-13T19:59:00+08:00' };

function rejectsInput(action, status = 400) {
  assert.throws(action, (error) => error instanceof MapRequestError && error.status === status);
}

test('location configuration validates Taiwan bounds, finite coordinates and source URLs', () => {
  assert.deepEqual(parseLocation(location), location);
  for (const latitude of [NaN, Infinity, '25.04', 91, 0]) rejectsInput(() => parseLocation({ ...location, latitude }));
  rejectsInput(() => parseLocation({ ...location, latitude: 121.52, longitude: 25.04 }));
  rejectsInput(() => parseLocation({ ...location, type: ['market'] }));
  rejectsInput(() => parseLocation({ ...location, coordinate_source: ['manual'] }));
  rejectsInput(() => parseLocation({ ...location, source_url: 'javascript:alert(1)' }));
  rejectsInput(() => parseLocation({ ...location, source_url: 'https://secret:password@example.com/' }));
  assert.equal(parseLocation({ ...location, source_url: 'https://example.com/market' }).source_url, 'https://example.com/market');
  // A sensor abroad must remain abroad; there is no Taipei-center substitution.
  assert.deepEqual(validateCoordinates(51.5, -0.12), { latitude: 51.5, longitude: -0.12 });
});

test('placement GPS and normalized floor coordinates require complete pairs and a plan', () => {
  assert.deepEqual(parsePlacement(placement), placement);
  rejectsInput(() => parsePlacement({ ...placement, latitude: 25 }));
  rejectsInput(() => parsePlacement({ ...placement, floor_x: 0.5 }));
  rejectsInput(() => parsePlacement({ ...placement, floor_x: 0.5, floor_y: 0.5 }));
  rejectsInput(() => parsePlacement({ ...placement, floor_plan_id: 'PLAN-1', floor_x: -0.01, floor_y: 0.5 }));
  rejectsInput(() => parsePlacement({ ...placement, floor_plan_id: 'PLAN-1', floor_x: 0.5, floor_y: 1.01 }));
  rejectsInput(() => parsePlacement({ ...placement, longitude: undefined }));
  const corners = parsePlacement({ ...placement, floor_plan_id: 'PLAN-1', floor_x: 0, floor_y: 1 });
  assert.equal(corners.floor_x, 0);
  assert.equal(corners.floor_y, 1);
});

test('uploads enforce raster signatures, matching dimensions and safe local demo image', () => {
  assert.equal(validateFloorImage(png, 1, 1).image_url, png);
  rejectsInput(() => validateFloorImage(png, 2, 1));
  rejectsInput(() => validateFloorImage(png.replace('image/png', 'image/jpeg'), 1, 1));
  rejectsInput(() => validateFloorImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 1, 1));
  rejectsInput(() => validateFloorImage('https://example.com/plan.png', 1200, 800));
  rejectsInput(() => validateFloorImage('data:image/png;base64,eHl6', 1, 1));
  rejectsInput(() => validateFloorImage(DEMO_FLOOR_IMAGE, 1200, 800));
  assert.equal(validateFloorImage(DEMO_FLOOR_IMAGE, 1200, 800, true).width, 1200);
  rejectsInput(() => validateFloorImage(DEMO_FLOOR_IMAGE, 1201, 800, true));
  const large = 'data:image/png;base64,' + Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64');
  rejectsInput(() => validateFloorImage(large, 1, 1), 413);
  rejectsInput(() => parseFloorPlan({ floor_plan_id: 'PLAN-1', location_id: 'LOC-TEST', name: '示範', image_url: DEMO_FLOOR_IMAGE, width: 1200, height: 800, source_label: '示範', is_demo: false }, true));
});

test('JSON size limit applies to both Content-Length and unbounded streams', async () => {
  const request = (body, headers = {}) => new Request('https://example.com', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
  assert.deepEqual(await readMapJson(request('{"test":1}')), { test: 1 });
  await assert.rejects(readMapJson(request('{}', { 'content-length': String(MAX_MAP_JSON_BYTES + 1) })), (error) => error.status === 413);
  let canceled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(MAX_MAP_JSON_BYTES)); controller.enqueue(new Uint8Array(1)); },
    cancel() { canceled = true; },
  });
  await assert.rejects(readMapJson(new Request('https://example.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half' })), (error) => error.status === 413);
  assert.equal(canceled, true);
  await assert.rejects(readMapJson(request('[]')), (error) => error.status === 400);
  await assert.rejects(readMapJson(request('invalid')), (error) => error.status === 400);
  await assert.rejects(readMapJson(new Request('https://example.com', { method: 'POST', body: '{}' })), (error) => error.status === 415);
});

test('a sensor bearer token is restricted to its own registered configuration ID', () => {
  const tokenA = 'A'.repeat(43);
  const tokenB = 'B'.repeat(43);
  const config = JSON.stringify({ 'RAT-TPE-A': tokenA, 'RAT-TPE-B': tokenB });
  const request = (token) => new Request('https://example.com', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(isAuthorizedSensor(request(tokenA), 'RAT-TPE-A', config), true);
  assert.equal(isAuthorizedSensor(request(tokenA), 'RAT-TPE-B', config), false);
  assert.equal(isAuthorizedSensor(request(tokenA), 'RAT-UNKNOWN', config), false);
  assert.equal(isAuthorizedSensor(request('short'), 'RAT-TPE-A', config), false);
  assert.equal(isAuthorizedSensor(new Request('https://example.com'), 'RAT-TPE-A', config), false);
  assert.throws(() => isAuthorizedSensor(request(tokenA), 'RAT-TPE-A', undefined));
  assert.throws(() => isAuthorizedSensor(request(tokenA), 'RAT-TPE-A', '{invalid-json}'));
});

test('sensor observations normalize timezone, validate accuracy and reject clock poisoning', () => {
  assert.equal(parseSensorPosition(sensor, now).observed_at, '2026-10-13T11:59:00.000Z');
  assert.equal(parseSensorPosition({ ...sensor, accuracy_m: undefined }, now).accuracy_m, null);
  rejectsInput(() => parseSensorPosition({ ...sensor, accuracy_m: -1 }, now));
  rejectsInput(() => parseSensorPosition({ ...sensor, observed_at: '2026-10-13T12:00:00' }, now));
  rejectsInput(() => parseSensorPosition({ ...sensor, observed_at: '2026-02-31T12:00:00Z' }, now));
  rejectsInput(() => parseSensorPosition({ ...sensor, observed_at: '2026-10-13T12:05:01Z' }, now));
  rejectsInput(() => parseSensorPosition({ ...sensor, longitude: 181 }, now));
});

test('newest observation selection ignores delayed or duplicate readings', () => {
  const latest = parseSensorPosition(sensor, now);
  assert.equal(isNewerObservation(latest, null), true);
  assert.equal(isNewerObservation(latest, latest), false);
  const older = parseSensorPosition({ ...sensor, observed_at: '2026-10-13T11:58:00Z' }, now);
  const newer = parseSensorPosition({ ...sensor, observed_at: '2026-10-13T12:00:00Z' }, now);
  assert.equal(isNewerObservation(older, latest), false);
  assert.equal(isNewerObservation(newer, latest), true);
  assert.equal(isNewerObservation(parseSensorPosition({ ...sensor, observed_at: '2026-10-13T11:59:00Z' }, now), latest), false);
});
