import { test, expect, type Page } from '@playwright/test';
import type { MapState } from '../../src/types/map';

async function selectDemoMarket(page: Page) {
  await page.getByRole('searchbox', { name: '搜尋場域' }).fill('市場 A');
  await page.locator('.taipei-map-results__grid').getByRole('button', { name: /市場 A/ }).click();
  await expect(page.locator('.market-placement__header h2')).toContainText('市場 A');
  await page.locator('.market-placement__selectors select').first().selectOption('RAT-TPE-001');
}

async function savedMap(page: Page): Promise<MapState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('rat-monitor-map-v1')!) as MapState);
}

test('uploaded floor plan preserves aspect ratio, keeps prior placement when viewing, and persists clicked coordinates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { username: 'upload-test', role: 'operator' } } }));
  await page.route('**/api/auth/activity', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/locations');
  await selectDemoMarket(page);

  // A real rectangular PNG exercises decode, dimensions, and intrinsic image sizing.
  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 180;
    const drawing = canvas.getContext('2d')!;
    drawing.fillStyle = '#f7f5ef';
    drawing.fillRect(0, 0, 360, 180);
    drawing.strokeStyle = '#365c52';
    drawing.lineWidth = 4;
    drawing.strokeRect(12, 12, 336, 156);
    drawing.strokeRect(32, 32, 110, 116);
    drawing.strokeRect(212, 32, 110, 116);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: '＋ 新增平面圖' }).click();
  await page.locator('.market-placement input[type="file"]').setInputFiles({
    name: 'market-floor-360x180.png', mimeType: 'image/png', buffer: Buffer.from(pngBase64, 'base64'),
  });
  await expect(page.locator('.market-placement__preview')).toContainText('360 × 180 px');
  await page.getByLabel('平面圖名稱', { exact: true }).fill('實測用 2:1 平面圖');
  await page.getByLabel('圖片來源', { exact: true }).fill('E2E 現場配置測試圖');
  await page.getByRole('button', { name: '儲存平面圖', exact: true }).click();
  const planSelect = page.getByRole('combobox', { name: '市場平面圖', exact: true });
  await expect(planSelect.locator('option:checked')).toHaveText('實測用 2:1 平面圖');
  const uploadedPlanId = await planSelect.inputValue();
  expect(uploadedPlanId).not.toBe('DEMO-FLOOR-001');
  await expect(page.getByLabel('X（左右 %）')).toHaveValue('');

  await planSelect.selectOption('DEMO-FLOOR-001');
  expect(Number(await page.getByLabel('X（左右 %）').inputValue())).toBeCloseTo(28, 6);
  expect(Number(await page.getByLabel('Y（上下 %）').inputValue())).toBeCloseTo(36, 6);
  await expect(page.locator('.market-placement__marker.is-selected')).toContainText('RAT-TPE-001');
  await planSelect.selectOption(uploadedPlanId);
  await expect(page.getByRole('button', { name: '儲存機台位置', exact: true })).toBeDisabled();
  // Saving another field while viewing the new image must retain the old floor point.
  await page.getByRole('textbox', { name: '位置備註', exact: true }).fill('切換圖面後仍保留原機台位置');
  await page.getByRole('button', { name: '儲存機台位置', exact: true }).click();
  await expect(page.getByText('機台位置已儲存。', { exact: true })).toBeVisible();
  const beforeClick = (await savedMap(page)).placements.find((placement) => placement.device_id === 'RAT-TPE-001')!;
  expect(beforeClick.floor_plan_id).toBe('DEMO-FLOOR-001');
  expect(beforeClick.floor_x).toBeCloseTo(0.28, 6);
  expect(beforeClick.floor_y).toBeCloseTo(0.36, 6);

  const image = page.locator('.market-placement__image > img');
  await expect(image).toBeVisible();
  expect(await image.evaluate((element) => ({ width: (element as HTMLImageElement).naturalWidth, height: (element as HTMLImageElement).naturalHeight }))).toEqual({ width: 360, height: 180 });
  const target = page.locator('.market-placement__image-target');
  const imageBounds = await image.boundingBox();
  const targetBounds = await target.boundingBox();
  expect(imageBounds).not.toBeNull();
  expect(targetBounds).not.toBeNull();
  expect(imageBounds!.width / imageBounds!.height).toBeCloseTo(2, 3);
  expect(targetBounds!.width).toBeCloseTo(imageBounds!.width, 3);
  expect(targetBounds!.height).toBeCloseTo(imageBounds!.height, 3);
  await target.click({ position: { x: targetBounds!.width * 0.7, y: targetBounds!.height * 0.25 } });
  const xPercent = Number(await page.getByLabel('X（左右 %）').inputValue());
  const yPercent = Number(await page.getByLabel('Y（上下 %）').inputValue());
  expect(xPercent).toBeCloseTo(70, 0);
  expect(yPercent).toBeCloseTo(25, 0);
  await page.getByRole('button', { name: '儲存機台位置', exact: true }).click();
  await expect(page.getByRole('button', { name: '儲存機台位置', exact: true })).toBeDisabled();
  const saved = await savedMap(page);
  const uploaded = saved.floor_plans.find((plan) => plan.floor_plan_id === uploadedPlanId)!;
  expect(uploaded.width).toBe(360);
  expect(uploaded.height).toBe(180);
  expect(uploaded.image_url).toMatch(/^data:image\/png;base64,/);
  const placed = saved.placements.find((placement) => placement.device_id === 'RAT-TPE-001')!;
  expect(placed.floor_plan_id).toBe(uploadedPlanId);
  expect(placed.floor_x).toBeCloseTo(xPercent / 100, 10);
  expect(placed.floor_y).toBeCloseTo(yPercent / 100, 10);
  expect(placed.latitude).toBe(beforeClick.latitude);
  expect(placed.longitude).toBe(beforeClick.longitude);
  expect(placed.sensor_position).toBeNull();

  await page.reload();
  await selectDemoMarket(page);
  await expect(planSelect).toHaveValue(uploadedPlanId);
  expect(Number(await page.getByLabel('X（左右 %）').inputValue())).toBeCloseTo(xPercent, 8);
  expect(Number(await page.getByLabel('Y（上下 %）').inputValue())).toBeCloseTo(yPercent, 8);
  await expect(page.locator('.market-placement__marker.is-selected')).toContainText('RAT-TPE-001');
  expect(errors).toEqual([]);
});

test('custom machine IDs require valid input and register only after saving their location', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { username: 'registration-test', role: 'operator' } } }));
  await page.route('**/api/auth/activity', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/locations');
  await selectDemoMarket(page);
  await page.getByRole('button', { name: '＋ 新增機台', exact: true }).click();
  const idInput = page.getByRole('textbox', { name: '新機台編號', exact: true });
  const setUp = page.getByRole('button', { name: '設定新機台', exact: true });
  await expect(setUp).toBeDisabled();
  await idInput.fill('機台 A');
  await expect(setUp).toBeDisabled();
  await expect(page.getByText('機台編號格式不符，請使用英文字母、數字、底線或連字號。')).toBeVisible();
  await idInput.fill('RAT-TPE-001');
  await expect(setUp).toBeDisabled();
  await expect(page.getByText('此機台編號已存在，請從上方機台選單選擇。')).toBeVisible();
  await idInput.fill('FIELD-NEW-009');
  await setUp.click();
  await expect(page.getByRole('button', { name: '新增並儲存機台', exact: true })).toBeEnabled();
  await expect(page.getByLabel('緯度', { exact: true })).toHaveValue('25.0374');
  await expect(page.getByLabel('經度', { exact: true })).toHaveValue('121.4997');
  const beforeSave = await page.evaluate(() => localStorage.getItem('rat-monitor-map-v1'));
  expect(beforeSave).toBeNull();
  await page.getByLabel('X（左右 %）').fill('84');
  await page.getByLabel('Y（上下 %）').fill('61');
  await page.getByLabel('緯度', { exact: true }).fill('25.039111');
  await page.getByLabel('經度', { exact: true }).fill('121.502222');
  await page.getByRole('textbox', { name: '位置備註', exact: true }).fill('北側入口的新機台');
  await page.getByRole('button', { name: '新增並儲存機台', exact: true }).click();
  await expect(page.getByText('新機台已新增至此場域，位置已儲存。', { exact: true })).toBeVisible();
  const placement = (await savedMap(page)).placements.find((item) => item.device_id === 'FIELD-NEW-009')!;
  expect(placement.location_id).toBe('LOC-001');
  expect(placement.latitude).toBe(25.039111);
  expect(placement.longitude).toBe(121.502222);
  expect(placement.floor_x).toBe(0.84);
  expect(placement.floor_y).toBe(0.61);
  expect(placement.sensor_position).toBeNull();
  await page.reload();
  await selectDemoMarket(page);
  await page.locator('.market-placement__selectors select').first().selectOption('FIELD-NEW-009');
  await expect(page.getByLabel('緯度', { exact: true })).toHaveValue('25.039111');
  await expect(page.getByLabel('X（左右 %）')).toHaveValue('84');
  await expect(page.getByRole('textbox', { name: '位置備註', exact: true })).toHaveValue('北側入口的新機台');
  await expect(page.locator('.market-placement__marker.is-selected')).toContainText('FIELD-NEW-009');
});
