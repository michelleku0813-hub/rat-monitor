import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { GET as getState } from '../api/map/state.ts';
import { POST as uploadPosition } from '../api/map/position.ts';
import { GET as getFloorImage } from '../api/map/floor-image.ts';
import { withMapSession } from '../server/map-http.ts';
import type { AuthenticatedSession } from '../server/auth.ts';

const originalOrigin = process.env.APP_ORIGIN;
const originalTokens = process.env.MAP_SENSOR_TOKENS;
process.env.APP_ORIGIN = 'https://maps.example.com';
process.env.MAP_SENSOR_TOKENS = JSON.stringify({ 'RAT-TPE-TEST': 'A'.repeat(43) });
after(() => {
  if (originalOrigin === undefined) delete process.env.APP_ORIGIN;
  else process.env.APP_ORIGIN = originalOrigin;
  if (originalTokens === undefined) delete process.env.MAP_SENSOR_TOKENS;
  else process.env.MAP_SENSOR_TOKENS = originalTokens;
});

function session(role: AuthenticatedSession['user']['role']): AuthenticatedSession {
  return { sessionId: 'test-session', user: { id: 'test-user', username: 'test-admin', role } };
}

test('state endpoint rejects missing administrator cookie before touching a database', async () => {
  const response = await getState(new Request('https://maps.example.com/api/map/state'));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: '未登入。' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('floor image endpoint requires administrator authentication before a database read', async () => {
  const response = await getFloorImage(new Request('https://maps.example.com/api/map/floor-image?floor_plan_id=PLAN-1'));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: '未登入。' });
});

test('mutation guard rejects missing or foreign Origin before session lookup', async () => {
  for (const origin of [undefined, 'https://foreign.example.com']) {
    const response = await withMapSession(new Request('https://maps.example.com/api/map/placements', {
      method: 'PUT', headers: origin ? { origin } : {},
    }), 'test', true, async () => { throw new Error('Storage must not run'); }, async () => { throw new Error('Session must not run'); });
    assert.equal(response.status, 403);
  }
});

test('viewer may read but cannot mutate; operator and super_admin may mutate', async () => {
  for (const role of ['viewer', 'operator', 'super_admin'] as const) {
    let calls = 0;
    const write = await withMapSession(new Request('https://maps.example.com/api/map/locations', {
      method: 'POST', headers: { origin: 'https://maps.example.com' },
    }), 'test', true, async () => { calls += 1; return { saved: true }; }, async () => session(role));
    assert.equal(write.status, role === 'viewer' ? 403 : 200);
    assert.equal(calls, role === 'viewer' ? 0 : 1);
    const read = await withMapSession(new Request('https://maps.example.com/api/map/state'), 'test', false,
      async () => ({ available: true }), async () => session(role));
    assert.equal(read.status, 200);
  }
});

test('expired session cannot execute a trusted-origin mutation', async () => {
  let calls = 0;
  const response = await withMapSession(new Request('https://maps.example.com/api/map/placements', {
    method: 'PUT', headers: { origin: 'https://maps.example.com' },
  }), 'test', true, async () => { calls += 1; return {}; }, async () => null);
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test('sensor endpoint rejects another device token without administrator authentication or DB access', async () => {
  const response = await uploadPosition(new Request('https://maps.example.com/api/map/position', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'B'.repeat(43) },
    body: JSON.stringify({ device_id: 'RAT-TPE-TEST', latitude: 25.04, longitude: 121.52, accuracy_m: 10, observed_at: new Date().toISOString() }),
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: '設備驗證失敗。' });
});
