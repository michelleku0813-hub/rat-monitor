import { test, expect } from '@playwright/test';
import type { DevicePlacementInput, MapState } from '../../src/types/map';

test('API map errors stay explicit and live GPS polling preserves floor drafts before backend save and reload', async ({ page }) => {
  let state: MapState = {
    locations: [{
      location_id: 'LOC-001', name: 'API 果菜市場', type: 'market', district: '萬華區',
      address: '後端測試場域地址', latitude: 25.0374, longitude: 121.4997, coordinate_source: 'manual',
    }],
    floor_plans: [{
      floor_plan_id: 'API-FLOOR-001', location_id: 'LOC-001', name: 'API 測試平面圖',
      image_url: '/maps/demo-market-floor.svg', width: 1200, height: 800,
      source_label: 'API 測試圖面，非實際市場配置', is_demo: true,
    }],
    placements: [{
      device_id: 'RAT-TPE-001', location_id: 'LOC-001', latitude: 25.0382, longitude: 121.5002,
      floor_plan_id: 'API-FLOOR-001', floor_x: 0.28, floor_y: 0.36, placement_note: '後端原始位置',
      sensor_position: { latitude: 25.0655, longitude: 121.5355, accuracy_m: 3.2, observed_at: '2026-10-13T02:00:00.000Z' },
    }],
  };
  let failState = true;
  let stateReads = 0;
  const writes: DevicePlacementInput[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-13T02:00:15.000Z') });
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { username: 'api-map-test', role: 'operator' } } }));
  await page.route('**/api/auth/activity', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  // All API state is an in-memory test fixture; this test never contacts a database.
  await page.route('**/api/map/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/map/state' && request.method() === 'GET') {
      stateReads += 1;
      await route.fulfill(failState
        ? { status: 503, json: { error: '測試後端暫時無法提供地圖' } }
        : { json: state });
      return;
    }
    if (path === '/api/map/placements' && request.method() === 'PUT') {
      const input = request.postDataJSON() as DevicePlacementInput;
      writes.push(input);
      const sensor = state.placements.find((placement) => placement.device_id === input.device_id)?.sensor_position ?? null;
      const placement = { ...input, sensor_position: sensor };
      state = { ...state, placements: [...state.placements.filter((saved) => saved.device_id !== input.device_id), placement] };
      await route.fulfill({ json: placement });
      return;
    }
    await route.fulfill({ status: 405, json: { error: '測試未預期的 API 操作' } });
  });

  await page.goto('/locations');
  await expect(page.getByRole('alert')).toContainText('測試後端暫時無法提供地圖');
  await expect(page.locator('.market-placement')).toHaveCount(0);
  await expect(page.getByText('72 個場域', { exact: true })).toHaveCount(0);
  await expect(page.getByText('地圖設定儲存於後端；感測器回報每 15 秒更新。', { exact: false })).toBeVisible();
  failState = false;
  await page.getByRole('button', { name: '重新載入', exact: true }).click();
  await expect(page.getByText('1 個場域', { exact: true })).toBeVisible();
  await expect(page.locator('.market-placement__header h2')).toHaveText('API 果菜市場');
  const sensorCard = page.locator('.market-placement__sensor');
  await expect(sensorCard).toContainText('25.065500, 121.535500');
  await expect(sensorCard).toContainText('± 3.2 公尺');
  await expect(sensorCard).toContainText('10:00:00');
  await expect(sensorCard).toContainText('最近回報');
  await expect(page.getByLabel('緯度', { exact: true })).toHaveValue('25.0382');
  await expect(page.getByLabel('經度', { exact: true })).toHaveValue('121.5002');

  const configuredMarker = page.getByRole('button', { name: 'RAT-TPE-001 設定位置', exact: true });
  const sensorMarker = page.getByRole('button', { name: 'RAT-TPE-001 感測器回報', exact: true });
  await expect(configuredMarker).toHaveCount(1);
  await expect(sensorMarker).toHaveCount(1);
  expect(await configuredMarker.getAttribute('style')).not.toEqual(await sensorMarker.getAttribute('style'));
  await page.getByRole('checkbox', { name: '感測器回報', exact: true }).uncheck();
  await expect(sensorMarker).toHaveCount(0);
  await expect(configuredMarker).toHaveCount(1);
  await page.getByRole('checkbox', { name: '感測器回報', exact: true }).check();
  await page.getByRole('checkbox', { name: '機台設定位置', exact: true }).uncheck();
  await expect(configuredMarker).toHaveCount(0);
  await expect(sensorMarker).toHaveCount(1);
  await page.getByRole('checkbox', { name: '機台設定位置', exact: true }).check();

  await page.getByLabel('X（左右 %）').fill('54.123456');
  await page.getByLabel('Y（上下 %）').fill('72.654321');
  await page.getByRole('textbox', { name: '位置備註', exact: true }).fill('輪詢期間尚未儲存的配置');
  const readsBeforePoll = stateReads;
  state.placements[0].sensor_position = {
    latitude: 25.069, longitude: 121.54, accuracy_m: 1.6, observed_at: '2026-10-13T02:00:30.000Z',
  };
  await page.clock.fastForward(15_500);
  await expect.poll(() => stateReads).toBeGreaterThan(readsBeforePoll);
  await expect(sensorCard).toContainText('25.069000, 121.540000');
  await expect(sensorCard).toContainText('± 1.6 公尺');
  await expect(sensorCard).toContainText('10:00:30');
  await expect(page.getByLabel('X（左右 %）')).toHaveValue('54.123456');
  await expect(page.getByLabel('Y（上下 %）')).toHaveValue('72.654321');
  await expect(page.getByRole('textbox', { name: '位置備註', exact: true })).toHaveValue('輪詢期間尚未儲存的配置');
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: '儲存機台位置', exact: true }).click();
  await expect(page.getByText('機台位置已儲存。', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].floor_x).toBeCloseTo(0.54123456, 8);
  expect(writes[0].floor_y).toBeCloseTo(0.72654321, 8);
  expect(writes[0].latitude).toBe(25.0382);
  expect(writes[0].longitude).toBe(121.5002);
  expect(writes[0]).not.toHaveProperty('sensor_position');
  expect(await page.evaluate(() => localStorage.getItem('rat-monitor-map-v1'))).toBeNull();

  const readsBeforeReload = stateReads;
  await page.reload();
  await expect.poll(() => stateReads).toBeGreaterThan(readsBeforeReload);
  await expect(page.getByLabel('X（左右 %）')).toHaveValue('54.123456');
  await expect(page.getByLabel('Y（上下 %）')).toHaveValue('72.654321');
  await expect(sensorCard).toContainText('25.069000, 121.540000');
  await expect(page.getByRole('button', { name: '儲存機台位置', exact: true })).toBeDisabled();
  expect(pageErrors).toEqual([]);
});
