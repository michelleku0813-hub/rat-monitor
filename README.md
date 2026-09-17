# AIoT 智慧鼠患監測系統 — Web Dashboard Prototype

第一版監測控制台（監測資料仍為 Mock Data）。**非正式監測資料。**

## 技術棧

- React + Vite + TypeScript
- React Router
- Recharts
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
- **台北機台地圖** — 可點選的 SVG 台北市行政區示意圖、場域與機台連線狀態
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

正式 PostgreSQL 規劃見 `docs/schema.sql`。

## 管理員登入

登入已改為 Vercel Functions 與 Neon PostgreSQL 的後端帳密驗證。帳密僅以 Argon2id 雜湊儲存，瀏覽器使用 HttpOnly Session Cookie；沒有公開註冊、Email 驗證或自助重設密碼。

首次設定與建立唯一管理員帳號，請依 docs/neon-setup.md 操作；資料表定義位於 docs/neon-auth-schema.sql。完成 Neon 與 Vercel 的機密設定前，請不要部署此登入版本。

## 尚未實作

真實寄信、FastAPI / 業務資料 PostgreSQL、YOLO 與 IoT 硬體通訊。死鼠通知目前仍是前端模擬；未來接入真實設備資料與寄信服務時，所有後端 API 都要檢查管理員 Session 與角色。
