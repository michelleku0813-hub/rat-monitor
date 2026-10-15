import { test, expect, type Page } from '@playwright/test';

async function openMap(page: Page, role = 'operator') {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: { username: 'map-test', role } } }));
  await page.route('**/api/auth/activity', (route) => route.fulfill({ json: { ok: true } }));
  // Offline tiles make these tests deterministic and verify the fallback UX.
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/locations');
  await expect(page.getByRole('heading', { name: '台北市地圖與機台部署' })).toBeVisible();
  await expect(page.getByText('72 個場域', { exact: true })).toBeVisible();
}

async function openPlacement(page: Page) {
  await page.getByRole('tab', { name: '場地圖與機台', exact: true }).click();
  const advanced = page.getByRole('button', { name: /^進階座標/ });
  if (await advanced.count() && await advanced.getAttribute('aria-expanded') === 'false') await advanced.click();
}

test('map filters, layers and floor placement persist without conflating GPS', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openMap(page);
  await expect(page.getByText('部分街道圖磚載入失敗。', { exact: false })).toBeVisible();
  await page.getByRole('checkbox', { name: '夜市', exact: true }).uncheck();
  await expect(page.locator('.taipei-map-pin').filter({ hasText: '夜' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: '夜市', exact: true }).check();
  await page.getByRole('searchbox', { name: '搜尋場域' }).fill('南門');
  await page.locator('.taipei-map-results__grid').getByRole('button', { name: /南門/ }).click();
  await expect(page.locator('.taipei-map-selected')).toContainText('羅斯福路一段8號');
  await page.getByRole('searchbox', { name: '搜尋場域' }).fill('市場 A');
  await page.locator('.taipei-map-results__grid').getByRole('button', { name: /市場 A/ }).click();
  await openPlacement(page);
  await expect(page.getByText('示意圖，非實際市場配置')).toBeVisible();
  await page.getByLabel('X（左右 %）').fill('62.5');
  await page.getByLabel('Y（上下 %）').fill('44');
  // Switching workspaces must keep the unsaved placement draft.
  await page.getByRole('tab', { name: '台北市地圖', exact: true }).click();
  await openPlacement(page);
  await expect(page.getByLabel('X（左右 %）')).toHaveValue('62.5');
  await page.getByRole('button', { name: '儲存機台位置', exact: true }).click();
  await expect(page.getByRole('button', { name: '儲存機台位置', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole('searchbox', { name: '搜尋場域' }).fill('市場 A');
  await page.locator('.taipei-map-results__grid').getByRole('button', { name: /市場 A/ }).click();
  await openPlacement(page);
  await expect(page.getByLabel('X（左右 %）')).toHaveValue('62.5');
  await expect(page.getByLabel('Y（上下 %）')).toHaveValue('44');
  await expect(page.getByText('尚無回報', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/taipei-map-desktop.png', fullPage: true });
});

test('manual site coordinates and moving an existing device to a real market', async ({ page }) => {
  await openMap(page);
  await page.getByRole('searchbox', { name: '搜尋場域' }).fill('第一果菜');
  await page.locator('.taipei-map-results__grid').getByRole('button', { name: /第一果菜/ }).click();
  await page.locator('.map-location-settings__summary').click();
  await page.getByLabel('場域名稱', { exact: true }).fill('第一果菜批發市場（已核對）');
  await page.getByRole('button', { name: '儲存場域', exact: true }).click();
  await expect(page.getByText('場域已儲存。', { exact: true })).toBeVisible();
  await openPlacement(page);
  await expect(page.getByText('此場域尚無平面圖', { exact: true })).toBeVisible();
  const deviceSelect = page.locator('.market-placement__selectors select').first();
  await deviceSelect.selectOption('RAT-TPE-001');
  await page.getByRole('button', { name: /^進階座標/ }).click();
  await page.getByLabel('緯度', { exact: true }).fill('25.01831');
  await page.getByLabel('經度', { exact: true }).fill('121.49837');
  await page.getByRole('button', { name: /儲存機台位置|儲存並移至此場域/ }).click();
  await expect(page.locator('.market-placement')).toContainText('RAT-TPE-001');
  await page.reload();
  await page.getByRole('searchbox', { name: '搜尋場域' }).fill('第一果菜');
  await page.locator('.taipei-map-results__grid').getByRole('button', { name: /第一果菜/ }).click();
  await openPlacement(page);
  await expect(page.getByLabel('緯度', { exact: true })).toHaveValue('25.01831');
});

test('viewer can inspect the floor plan but cannot edit on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page, 'viewer');
  await page.getByRole('searchbox', { name: '搜尋場域' }).fill('市場 A');
  await page.locator('.taipei-map-results__grid').getByRole('button', { name: /市場 A/ }).click();
  await openPlacement(page);
  await expect(page.getByText('示意圖，非實際市場配置')).toBeVisible();
  await expect(page.getByRole('button', { name: '儲存場域', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '儲存機台位置', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('X（左右 %）')).toBeDisabled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/taipei-map-mobile.png', fullPage: true });
});

test('workspace navigation cancels coordinate picking and keeps keyboard focus visible', async ({ page }) => {
  await openMap(page);
  const settings = page.locator('.map-location-settings__details');
  await expect(settings).not.toHaveAttribute('open');
  await page.locator('.map-location-settings__summary').click();
  await page.getByRole('button', { name: '從地圖選取經緯度', exact: true }).click();
  await expect(page.getByText('座標選取中：', { exact: false })).toBeVisible();
  const mapTab = page.getByRole('tab', { name: '台北市地圖', exact: true });
  const placementTab = page.getByRole('tab', { name: '場地圖與機台', exact: true });
  await mapTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(placementTab).toBeFocused();
  await expect(placementTab).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(mapTab).toBeFocused();
  await expect(page.getByText('座標選取中：', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: '從地圖選取經緯度', exact: true }).click();
  await page.getByRole('button', { name: '前往場地圖擺設', exact: false }).click();
  await expect(placementTab).toBeFocused();
  await mapTab.click();
  await expect(page.getByText('座標選取中：', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: '取消編輯', exact: true }).click();
  await expect(settings).not.toHaveAttribute('open');
});
