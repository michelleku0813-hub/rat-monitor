import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoMapState, createMapService } from '../src/services/mapService.ts';
import { REFERENCE_FLOOR_PLANS } from '../src/data/marketFloorPlans.ts';
import type { DevicePlacementInput, MapState, MarketFloorPlan } from '../src/types/map.ts';

const STORAGE_KEY = 'rat-monitor-map-v1';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=';
function memoryStorage(initial: string | null = null) {
  return {
    value: initial, reads: 0, writes: 0,
    getItem(key: string) { assert.equal(key, STORAGE_KEY); this.reads += 1; return this.value; },
    setItem(key: string, value: string) { assert.equal(key, STORAGE_KEY); this.writes += 1; this.value = value; },
  };
}
function rasterPlan(): MarketFloorPlan {
  return { floor_plan_id: 'PLAN-TEST', location_id: 'LOC-001', name: '現場平面圖', image_url: png, width: 1, height: 1, source_label: '現場提供', is_demo: false };
}
function inputPlacement(state = createDemoMapState()): DevicePlacementInput {
  const { sensor_position: _sensor, ...input } = state.placements[0];
  return input;
}

test('fresh demo records are detached and reading does not write browser storage', async () => {
  const storage = memoryStorage();
  const service = createMapService({ mode: 'demo', storage });
  const initial = await service.getMapState();
  initial.locations[3].name = 'Changed by caller';
  assert.notEqual((await service.getMapState()).locations[3].name, 'Changed by caller');
  assert.equal(storage.writes, 0);
});

test('corrupt browser records cannot reach formatting components or be silently overwritten', async () => {
  const cases: Array<(state: MapState) => void> = [
    (state) => { state.locations[0].latitude = 'bad' as unknown as number; },
    (state) => { state.locations[0].longitude = 25.03; },
    (state) => { state.locations.push({ ...state.locations[0] }); },
    (state) => { state.placements.push({ ...state.placements[0] }); },
    (state) => { state.floor_plans.push({ ...state.floor_plans[0] }); },
    (state) => { state.locations[0].source_url = 'javascript:alert(1)'; },
    (state) => { state.floor_plans[0].source_url = 'data:text/html,unsafe'; },
    (state) => { state.floor_plans[0].image_url = 'https://external.example.com/image.png'; },
    (state) => { state.floor_plans[0].image_url = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='; },
    (state) => { state.floor_plans[0].image_url = '/api/map/floor-image?floor_plan_id=DEMO-FLOOR-001'; },
    (state) => { state.placements[0].longitude = null; },
    (state) => { state.placements[0].floor_y = null; },
    (state) => { state.placements[0].floor_x = 1.01; },
    (state) => { state.placements[0].floor_plan_id = 'UNKNOWN-PLAN'; },
    (state) => { state.placements[0].location_id = 'LOC-002'; },
    (state) => { state.placements[0].sensor_position = { latitude: 'bad' as unknown as number, longitude: 121.52, accuracy_m: 4, observed_at: new Date().toISOString() }; },
    (state) => { state.placements[0].sensor_position = { latitude: 25, longitude: 121.52, accuracy_m: 'bad' as unknown as number, observed_at: new Date().toISOString() }; },
    (state) => { state.placements[0].sensor_position = { latitude: 25, longitude: 121.52, accuracy_m: 4, observed_at: '2026-02-31T12:00:00Z' }; },
  ];
  for (const corrupt of cases) {
    const state = createDemoMapState(); corrupt(state);
    const raw = JSON.stringify(state);
    const storage = memoryStorage(raw);
    const service = createMapService({ mode: 'demo', storage });
    await assert.rejects(service.getMapState(), /原始資料仍保留/);
    await assert.rejects(service.saveMapLocation(createDemoMapState().locations[0]), /原始資料仍保留/);
    assert.equal(storage.value, raw);
    assert.equal(storage.writes, 0);
  }
  const storage = memoryStorage('{malformed-json');
  await assert.rejects(createMapService({ mode: 'demo', storage }).getMapState(), /原始資料仍保留/);
  assert.equal(storage.value, '{malformed-json');
});

test('saved edits override reference rows while newly bundled reference locations remain available', async () => {
  const state = createDemoMapState();
  state.locations = state.locations.slice(0, 3);
  state.floor_plans = state.floor_plans.filter((plan) => plan.location_id.startsWith('LOC-'));
  state.locations[0].name = '現場修改名稱';
  const storage = memoryStorage(JSON.stringify(state));
  const loaded = await createMapService({ mode: 'demo', storage }).getMapState();
  assert.equal(loaded.locations.find((item) => item.location_id === 'LOC-001')?.name, '現場修改名稱');
  assert.ok(loaded.locations.length > 3);
  assert.equal(storage.writes, 0);
});

test('demo plan and placement writes enforce immutable images, ownership and paired coordinates', async () => {
  const storage = memoryStorage();
  const service = createMapService({ mode: 'demo', storage });
  const plan = rasterPlan();
  await service.saveFloorPlan(plan);
  const input = { ...inputPlacement(), floor_plan_id: plan.floor_plan_id, floor_x: 0.1, floor_y: 0.2 };
  await service.saveDevicePlacement(input);
  const saved = await service.getMapState();
  assert.equal(saved.placements.find((placement) => placement.device_id === input.device_id)?.floor_x, 0.1);
  const unchanged = storage.value;
  await assert.rejects(service.saveFloorPlan({ ...saved.floor_plans.find((item) => item.floor_plan_id === 'DEMO-FLOOR-001')!, image_url: png, width: 1, height: 1 }), /新的平面圖識別碼/);
  await assert.rejects(service.saveFloorPlan({ ...plan, location_id: 'LOC-002' }), /新的平面圖識別碼/);
  await assert.rejects(service.saveDevicePlacement({ ...input, location_id: 'LOC-002' }));
  await assert.rejects(service.saveDevicePlacement({ ...input, latitude: 25, longitude: null }));
  await assert.rejects(service.saveFloorPlan({ ...plan, floor_plan_id: 'PLAN-UNKNOWN', location_id: 'UNKNOWN' }));
  assert.equal(storage.value, unchanged);
});

test('manual placement changes retain separate sensor observations and can register a new device', async () => {
  const state = createDemoMapState();
  const observed = { latitude: 51.5, longitude: -0.12, accuracy_m: 7, observed_at: '2026-10-13T11:59:00.000Z' };
  state.placements[0].sensor_position = observed;
  const storage = memoryStorage(JSON.stringify(state));
  const service = createMapService({ mode: 'demo', storage });
  const updated = await service.saveDevicePlacement({ ...inputPlacement(state), latitude: 25.05, longitude: 121.53 });
  assert.deepEqual(updated.sensor_position, observed);
  const registered = await service.saveDevicePlacement({ ...inputPlacement(state), device_id: 'RAT-TPE-NEW', floor_plan_id: null, floor_x: null, floor_y: null });
  assert.equal(registered.sensor_position, null);
  assert.equal((await service.getMapState()).placements.length, 4);
});

test('API failures and invalid API data never read or write local demo storage', async () => {
  const storage = { getItem() { throw new Error('Local fallback forbidden'); }, setItem() { throw new Error('Local write forbidden'); } };
  const failed = createMapService({ mode: 'api', storage, fetcher: async () => Response.json({ error: '後端尚未設定。' }, { status: 503 }) });
  await assert.rejects(failed.getMapState(), /後端尚未設定/);
  await assert.rejects(failed.saveMapLocation(createDemoMapState().locations[0]), /後端尚未設定/);
  const network = createMapService({ mode: 'api', storage, fetcher: async () => { throw new Error('Network unavailable'); } });
  await assert.rejects(network.getMapState(), /Network unavailable/);
  const invalidState = createDemoMapState(); invalidState.locations[0].latitude = 'bad' as unknown as number;
  const invalid = createMapService({ mode: 'api', storage, fetcher: async () => Response.json(invalidState) });
  await assert.rejects(invalid.getMapState(), /格式不正確/);
});

test('API image metadata permits only the matching same-origin protected image endpoint', async () => {
  const state = createDemoMapState();
  const plan = { ...rasterPlan(), image_url: '/api/map/floor-image?floor_plan_id=PLAN-TEST' };
  state.floor_plans.push(plan);
  const service = createMapService({ mode: 'api', fetcher: async () => Response.json(state) });
  assert.equal((await service.getMapState()).floor_plans.at(-1)?.image_url, plan.image_url);
  for (const image_url of [
    '/api/map/floor-image?floor_plan_id=ANOTHER-PLAN',
    '/api/map/floor-image?floor_plan_id=PLAN-TEST&other=1',
    'https://maps.example.com/api/map/floor-image?floor_plan_id=PLAN-TEST',
    '//external.example.com/api/map/floor-image?floor_plan_id=PLAN-TEST',
    '/api/map/floor-image?floor_plan_id=../../private',
  ]) {
    const invalid = structuredClone(state); invalid.floor_plans.at(-1)!.image_url = image_url;
    await assert.rejects(createMapService({ mode: 'api', fetcher: async () => Response.json(invalid) }).getMapState(), /格式不正確/);
  }
});

test('API upload sends data URL but accepts metadata image URL and uses session credentials', async () => {
  const plan = rasterPlan();
  let sent: RequestInit | undefined;
  const service = createMapService({ mode: 'api', fetcher: async (path, init) => {
    assert.equal(path, '/api/map/floor-plans'); sent = init;
    return Response.json({ ...plan, image_url: '/api/map/floor-image?floor_plan_id=PLAN-TEST' });
  } });
  const saved = await service.saveFloorPlan(plan);
  assert.equal(saved.image_url, '/api/map/floor-image?floor_plan_id=PLAN-TEST');
  assert.equal(sent?.credentials, 'same-origin');
  assert.equal(sent?.cache, 'no-store');
  assert.equal(JSON.parse(sent?.body as string).image_url, png);
});

test('browser storage failure is surfaced instead of reporting a successful save', async () => {
  const service = createMapService({ mode: 'demo', storage: { getItem() { return null; }, setItem() { throw new Error('Quota exceeded'); } } });
  await assert.rejects(service.saveMapLocation(createDemoMapState().locations[0]), /無法儲存地圖設定/);
});


test('bundled plans join existing browser uploads without storing image bytes or losing saved pins', async () => {
  const old = createDemoMapState();
  // Simulate an older release before reference floor plans were bundled.
  old.floor_plans = old.floor_plans.filter((plan) => plan.location_id.startsWith('LOC-'));
  old.floor_plans.push(rasterPlan());
  old.placements[0] = { ...old.placements[0], floor_plan_id: 'PLAN-TEST', floor_x: 0.64, floor_y: 0.31 };
  const storage = memoryStorage(JSON.stringify(old));
  const service = createMapService({ mode: 'demo', storage });
  const loaded = await service.getMapState();
  assert.equal(loaded.floor_plans.length, old.floor_plans.length + REFERENCE_FLOOR_PLANS.length);
  assert.deepEqual(loaded.floor_plans.find((plan) => plan.floor_plan_id === 'PLAN-TEST'), rasterPlan());
  assert.equal(loaded.placements[0].floor_x, 0.64);
  assert.equal(storage.writes, 0);
  const official = REFERENCE_FLOOR_PLANS[0];
  await service.saveDevicePlacement({ ...inputPlacement(), location_id: official.location_id,
    floor_plan_id: official.floor_plan_id, floor_x: 0.37, floor_y: 0.58 });
  const reopened = await createMapService({ mode: 'demo', storage }).getMapState();
  assert.equal(reopened.floor_plans.find((plan) => plan.floor_plan_id === official.floor_plan_id)?.image_url, official.image_url);
  assert.equal(reopened.floor_plans.find((plan) => plan.floor_plan_id === 'PLAN-TEST')?.image_url, png);
  const savedPin = reopened.placements.find((placement) => placement.device_id === 'RAT-TPE-001')!;
  assert.equal(savedPin.floor_plan_id, official.floor_plan_id);
  assert.equal(savedPin.floor_x, 0.37);
  assert.ok(official.image_url.startsWith('/maps/reference/'));
  assert.ok(storage.value!.length < 100_000);
});

test('reference IDs accept only canonical metadata and never permit arbitrary static or remote images', async () => {
  const storage = memoryStorage();
  const service = createMapService({ mode: 'demo', storage });
  const official = REFERENCE_FLOOR_PLANS[0];
  assert.deepEqual(await service.saveFloorPlan({ ...official }), official);
  for (const overrides of [
    { image_url: '/maps/reference/not-in-catalog.webp' },
    { image_url: 'https://external.example.com/plan.webp' },
    { image_url: png, width: 1, height: 1 },
    { width: official.width + 1 },
    { location_id: 'LOC-001' },
    { name: 'Pretend to be a current map' },
    { source_label: 'Changed version' },
    { source_url: 'https://other.example.com/' },
    { is_demo: true },
  ]) await assert.rejects(service.saveFloorPlan({ ...official, ...overrides }), /格式不正確/);
  await assert.rejects(service.saveFloorPlan({ ...official, floor_plan_id: 'UNLISTED-REFERENCE' }), /格式不正確/);
  const apiState = createDemoMapState();
  assert.equal((await createMapService({ mode: 'api', fetcher: async () => Response.json(apiState) }).getMapState()).floor_plans.length, apiState.floor_plans.length);
});
