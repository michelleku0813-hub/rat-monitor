# AIoT 智慧鼠患監測系統 — Web Dashboard Prototype

第一版監測控制台（監測資料仍為 Mock Data）。**非正式監測資料。**

## 技術棧

- React + Vite + TypeScript
- React Router
- Recharts
- Leaflet + OpenStreetMap 街道底圖
- Vercel Functions（管理員登入 API）
- Neon PostgreSQL（管理員帳密、Session、登入稽核）
- Responsive Web Design

## 資料流

```
Camera / YOLO（尚未串接）
  → Mock JSON
  → Data Service Layer (`src/services/dataService.ts`)
  → React Dashboard
```

未來可替換為：

```
REST API → Data Service → UI
```

UI 不直接依賴硬體或 Mock 實作細節。

## 重要名詞

| 用語 | 意義 |
|------|------|
| Detection Event | 一筆鼠隻**活動偵測事件** |
| Detected Count | 該次影像中 AI 偵測到的鼠隻數量 |
| ❌ 老鼠總數 / 族群數 | 系統目前無法辨識個體，首頁禁止使用 |

Confidence ≠ Accuracy；Confidence 僅出現在 Detection Events 明細。

## 啟動

```bash
npm install
npm run dev
```

建置：

```bash
npm run build
```

## 頁面

- **登入頁** — 管理員帳號＋密碼；不提供註冊、Email 驗證或自助密碼重設
- **監測總覽** — KPI + 營運告警 + **死鼠辨識／通知信模擬** + 即時影像監看 + 最近活動 + 24h / 7 日 / 場域圖表
- **Activity Analysis** — Heatmap、趨勢、場域／日期篩選
- **Detection Events** — 事件列表與示意 IR 影像 / 資料驅動 Bounding Box
- **台北市地圖與機台部署** — Leaflet 街道地圖、69 個市場／夜市參考地點、圖層與行政區篩選、場域座標設定、平面圖上傳與機台擺設、獨立感測器 GPS 回報
- **設備健康** — RAT-TPE-001/002/003 的電池、供電電壓／功耗、記憶體、CPU、溫度與網路遙測（003 為 Warning）

頁面頂部固定標示：**Prototype – Demo Data**。即時影像區另標 **Simulated Live · Demo Data**。

## Mock 資料

- ≥ 100 筆 Detection Events（最近 7 天）
- 凌晨 01:00–04:00 活動較高
- 活動量：市場 A > 夜市 B > 巷道 C
- 即時影像：輪詢模擬快照（含 idle／偵測幀、資料驅動 bbox）

## 未來 API（由 Data Service 對齊）

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/hourly`
- `GET /api/v1/dashboard/daily`
- `GET /api/v1/dashboard/alerts`
- `GET /api/v1/cameras/snapshots`
- `GET /api/v1/events`
- `GET /api/v1/devices`
- `POST /api/v1/notifications/dead-rat`（目前由前端模擬）

監測業務 PostgreSQL 規劃見 `docs/schema.sql`。

## 台北市地圖與機台座標

地圖包含 69 個參考地點（52 個市場、14 個夜市、3 個其他商場），另保留原有 3 個模擬監測場域。支援市場、夜市、其他場域、機台設定位置、感測器回報與監測風險等圖層；可搜尋名稱、按行政區篩選與從地圖選取經緯度。

目前預設 `VITE_MAP_DATA_MODE=demo`，場域、機台擺設與平面圖修改會留存在此瀏覽器。要使用後端儲存，依 [地圖 API 與設定](docs/map-api.md) 執行 [地圖 SQL migration](docs/neon-map-schema.sql)，設定 `VITE_MAP_DATA_MODE=api` 後重新建置。API 模式無法使用時會顯示錯誤，不會自動改為示範資料。管理員可以編輯，viewer 僅能檢視。

平面圖上傳接受 PNG、JPEG、WebP（最多 2 MiB、各邊不超過 8000 px），可新增機台編號，在圖上點選或輸入 X／Y 百分比即可標記機台。圖片版本使用新的識別碼；現有點位保留在原圖，避免誤套到更新圖面。內建的市場 A 圖是自製示意圖；真實果菜市場須提供現況圖面。來源與座標修正紀錄見 [地圖資料來源](docs/map-sources.md)。

機台設定經緯度、感測器經緯度與室內平面位置各自儲存。硬體透過 `POST /api/map/position` 使用每台設備自己的伺服器金鑰回報；介面每 15 秒讀取最新座標、時間與定位精度。GPS 不會自動換算室內圖面位置。

可用 `VITE_MAP_TILE_URL` 與 `VITE_MAP_TILE_ATTRIBUTION` 設定替代圖磚服務；URL 格式為 `{z}/{x}/{y}`。預設 OpenStreetMap 保留署名，沒有離線預先下載功能。

驗證：

```bash
npm test
npm run build
npm run lint
npm run test:e2e
npm run test:e2e:api
```

瀏覽器測試會使用本機 Google Chrome；無 Chrome 的環境可調整 `playwright.config.ts` 的 channel 並安裝 Playwright Chromium。測試登入與圖磚僅於測試中模擬，不改動應用程式的登入驗證。

## 管理員登入

登入已改為 Vercel Functions 與 Neon PostgreSQL 的後端帳密驗證。帳密僅以 Argon2id 雜湊儲存，瀏覽器使用 HttpOnly Session Cookie；沒有公開註冊、Email 驗證或自助重設密碼。

首次設定與建立唯一管理員帳號，請依 docs/neon-setup.md 操作；資料表定義位於 docs/neon-auth-schema.sql。完成 Neon 與 Vercel 的機密設定前，請不要部署此登入版本。

## 尚未實作

真實寄信、鼠患監測業務資料 PostgreSQL、YOLO 與實際硬體串接。地圖設定與 GPS 定位後端已實作，需另完成 migration 與設備金鑰配置。死鼠通知目前仍是前端模擬；未來接入真實設備資料與寄信服務時，所有後端 API 都要檢查管理員 Session 與角色。
