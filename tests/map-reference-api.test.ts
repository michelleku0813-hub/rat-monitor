import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { REFERENCE_FLOOR_PLANS } from '../src/data/marketFloorPlans.ts';
import { getMapState, saveDevicePlacement, saveFloorPlan } from '../server/map.ts';
import { MapRequestError, parseFloorPlan } from '../server/map-validation.ts';
import { referenceFloorConstraint, referenceFloorMigration } from '../scripts/generate-map-reference-schema.ts';
import type { DevicePlacementInput, MarketFloorPlan } from '../src/types/map.ts';

interface TestDatabase {
  query(sql: string, parameters?: unknown[]): Promise<unknown[]>;
  transaction(build: (sql: TestDatabase) => Promise<unknown[]>[], options?: unknown): Promise<unknown[][]>;
}

const reference = () => {
  assert.equal(REFERENCE_FLOOR_PLANS.length, 39);
  return { ...REFERENCE_FLOOR_PLANS[0] };
};

/** In-memory SQL boundary: these tests never connect to Neon or read secrets. */
function storedMap() {
  const locations = new Map<string, Record<string, unknown>>();
  const floors = new Map<string, Record<string, unknown>>();
  const placements = new Map<string, Record<string, unknown>>();
  const statements: { sql: string; parameters: unknown[] }[] = [];
  const transactions: unknown[] = [];
  const database: TestDatabase = {
    async query(sql: string, parameters: unknown[] = []) {
      statements.push({ sql, parameters });
      if (sql.startsWith('SELECT pg_advisory_xact_lock')) return [];
      if (sql.includes('FROM map_locations')) return sql.includes('WHERE location_id')
        ? [locations.get(parameters[0] as string)].filter(Boolean) : [...locations.values()];
      if (sql.includes('FROM map_floor_plans')) return sql.includes('WHERE floor_plan_id')
        ? [floors.get(parameters[0] as string)].filter(Boolean) : [...floors.values()];
      if (sql.includes('FROM map_device_placements')) return sql.includes('WHERE p.device_id')
        ? [placements.get(parameters[0] as string)].filter(Boolean) : [...placements.values()];
      if (sql.startsWith('INSERT INTO map_locations')) {
        const fields = ['location_id', 'name', 'type', 'address', 'district', 'latitude', 'longitude', 'coordinate_source', 'source_url'];
        const row = Object.fromEntries(fields.map((field, index) => [field, parameters[index]]));
        if (!locations.has(row.location_id as string)) locations.set(row.location_id as string, row);
        return [];
      }
      if (sql.startsWith('INSERT INTO map_floor_plans')) {
        const fields = ['floor_plan_id', 'location_id', 'name', 'image_url', 'width', 'height', 'source_label', 'source_url', 'is_demo'];
        const row = Object.fromEntries(fields.map((field, index) => [field, parameters[index]]));
        const existing = floors.get(row.floor_plan_id as string);
        if (existing && ['location_id', 'image_url', 'width', 'height'].some((field) => existing[field] !== row[field])) return [];
        floors.set(row.floor_plan_id as string, row);
        return [row];
      }
      if (sql.startsWith('INSERT INTO map_device_placements')) {
        const fields = ['device_id', 'location_id', 'latitude', 'longitude', 'floor_plan_id', 'floor_x', 'floor_y', 'placement_note'];
        const row: Record<string, unknown> = { ...Object.fromEntries(fields.map((field, index) => [field, parameters[index]])),
          sensor_latitude: null, sensor_longitude: null, sensor_accuracy_m: null, sensor_observed_at: null };
        placements.set(row.device_id as string, row);
        return [];
      }
      throw new Error(`Unexpected test query: ${sql}`);
    },
    async transaction(build, options) {
      transactions.push(options);
      return Promise.all(build(database));
    },
  };
  return { database: database as unknown as Parameters<typeof getMapState>[0], locations, floors, placements, statements, transactions };
}

test('official plan IDs accept only all nine exact bundled metadata fields', () => {
  for (const plan of REFERENCE_FLOOR_PLANS) assert.deepEqual(parseFloorPlan(plan), plan);
  const plan = reference();
  const changed: Partial<MarketFloorPlan>[] = [
    { floor_plan_id: 'UNLISTED-PLAN' }, { location_id: 'LOC-001' }, { name: `${plan.name} 修改` },
    { image_url: '/maps/reference/other.webp' }, { image_url: 'https://example.com/plan.webp' },
    { image_url: '/maps/reference/../secret.webp' }, { image_url: `${plan.image_url}?other=1` },
    { width: plan.width + 1 }, { height: plan.height + 1 }, { source_label: '其他來源' },
    { source_url: 'https://example.com/' }, { source_url: undefined }, { is_demo: true },
  ];
  for (const changes of changed) assert.throws(() => parseFloorPlan({ ...plan, ...changes }), MapRequestError);
  const upload = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=';
  assert.throws(() => parseFloorPlan({ ...plan, image_url: upload, width: 1, height: 1 }), (error) => error instanceof MapRequestError && error.status === 409);
});

test('API state includes all public official plans without writing catalog rows or embedding uploads', async () => {
  const store = storedMap();
  store.floors.set('UPLOADED-PLAN', {
    floor_plan_id: 'UPLOADED-PLAN', location_id: 'LOC-001', name: '管理員上傳', image_url: 'data:image/png;base64,private',
    width: 1, height: 1, source_label: '現場', source_url: null, is_demo: false,
  });
  const state = await getMapState(store.database);
  for (const plan of REFERENCE_FLOOR_PLANS) assert.deepEqual(state.floor_plans.find((saved) => saved.floor_plan_id === plan.floor_plan_id), plan);
  assert.equal(state.floor_plans.find((plan) => plan.floor_plan_id === 'UPLOADED-PLAN')?.image_url, '/api/map/floor-image?floor_plan_id=UPLOADED-PLAN');
  assert.equal(JSON.stringify(state).includes('data:image/'), false);
  assert.ok(store.statements.every(({ sql }) => sql.startsWith('SELECT ')));
  assert.deepEqual(store.transactions, [{ isolationLevel: 'RepeatableRead', readOnly: true }]);
});

test('first official-plan pin materializes canonical location and plan before persisting coordinates', async () => {
  const plan = reference();
  const store = storedMap();
  const input: DevicePlacementInput = {
    device_id: 'RAT-REFERENCE-TEST', location_id: plan.location_id, latitude: null, longitude: null,
    floor_plan_id: plan.floor_plan_id, floor_x: 0.25, floor_y: 0.75, placement_note: '官方圖測試標記',
  };
  assert.deepEqual(await saveDevicePlacement(input, store.database), { ...input, sensor_position: null });
  assert.ok(store.locations.has(plan.location_id));
  assert.deepEqual(store.floors.get(plan.floor_plan_id), plan);
  const writes = store.statements.filter(({ sql }) => sql.startsWith('INSERT')).map(({ sql }) => sql.split(' ')[2]);
  assert.deepEqual(writes, ['map_locations', 'map_floor_plans', 'map_device_placements']);
  assert.ok(store.statements.flatMap(({ parameters }) => parameters).every((value) => typeof value !== 'string' || !value.startsWith('data:image/')));
  await saveDevicePlacement({ ...input, floor_x: 0.5 }, store.database);
  assert.equal(store.statements.filter(({ sql }) => sql.startsWith('INSERT INTO map_floor_plans')).length, 1);
});

test('official plans reject wrong market ownership and conflicting saved image identities', async () => {
  const plan = reference();
  const input: DevicePlacementInput = {
    device_id: 'RAT-REFERENCE-TEST', location_id: 'LOC-001', latitude: null, longitude: null,
    floor_plan_id: plan.floor_plan_id, floor_x: 0.2, floor_y: 0.3, placement_note: '',
  };
  const wrongLocation = storedMap();
  await assert.rejects(saveDevicePlacement(input, wrongLocation.database), MapRequestError);
  assert.equal(wrongLocation.placements.size, 0);
  const conflicting = storedMap();
  conflicting.floors.set(plan.floor_plan_id, { ...plan, image_url: '/maps/demo-market-floor.svg' });
  await assert.rejects(saveDevicePlacement({ ...input, location_id: plan.location_id }, conflicting.database), (error) => error instanceof MapRequestError && error.status === 409);
  await assert.rejects(getMapState(conflicting.database), (error) => error instanceof MapRequestError && error.status === 409);
  assert.equal(conflicting.placements.size, 0);
  const tampered = storedMap();
  await assert.rejects(saveFloorPlan({ ...plan, name: '改名' }, tampered.database), MapRequestError);
  assert.equal(tampered.statements.length, 0);
});

test('fresh schema and repeatable upgrade contain the same generated official-plan allowlist', () => {
  const constraint = referenceFloorConstraint();
  const schema = readFileSync(new URL('../docs/neon-map-schema.sql', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../docs/neon-map-reference-plans.sql', import.meta.url), 'utf8');
  assert.ok(schema.includes(constraint));
  assert.equal(migration, referenceFloorMigration());
  assert.equal(REFERENCE_FLOOR_PLANS.filter((plan) => constraint.includes(`'${plan.floor_plan_id}'`)).length, 39);
  assert.ok(constraint.includes('DROP CONSTRAINT IF EXISTS'));
  assert.ok(constraint.includes('source_url IS NOT NULL'));
  assert.ok(!migration.includes('INSERT INTO'));
});
