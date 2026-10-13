# 台北市地圖與機台定位 API

地圖資料分為場域的 WGS84 經緯度、機台的設定座標、感測器的最新 GPS 讀值，以及平面圖內的手動擺設點。GPS 不會修改平面圖內的擺設點。室內 GPS 常受遮蔽物影響，平面圖標記需由管理員依現場位置點選；未經校正與定位系統整合，不能把經緯度直接換成平面圖座標。

## 啟用正式儲存

1. 先依 [neon-setup.md](neon-setup.md) 建立登入用資料表、管理員與 Vercel 環境變數。
2. 在同一個 Neon 資料庫 SQL Editor 執行 [neon-map-schema.sql](neon-map-schema.sql)。這會建立獨立的 `map_*` 資料表，並加入明確標示為示範資料的三個場域、三台機台與一張示範平面圖。重跑不覆寫已儲存資料。後端不會自動建表或遷移。
3. 在 Vercel 建置環境設定 `VITE_MAP_DATA_MODE=api`，再重新建置與部署。`DATABASE_URL`、`APP_ORIGIN`、登入密鑰及 `MAP_SENSOR_TOKENS` 都只供伺服器使用，不得加上 `VITE_`。
4. 若要接收實際機台的定位，在伺服器環境設定 `MAP_SENSOR_TOKENS`，格式為 JSON 物件，每台機台各自使用不同的至少 32 字元 base64url 隨機 Token。可在受信任的終端機執行 `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` 產生 Token；不要提交或分享其輸出。

`VITE_MAP_DATA_MODE=demo` 使用此瀏覽器的示範資料與本機儲存，不會上傳到 Neon，也不會接收後端 GPS。切到 `api` 不會把瀏覽器示範修改自動轉存到正式資料庫。本機 `npm run dev` 只有 Vite 前端；測試正式 API 需使用提供 Vercel Functions 的開發環境，例如 `vercel dev`，並將 `APP_ORIGIN` 設為該環境的確切來源。設定檔需保持被 Git 排除。

官方參考場域目錄隨程式附帶，`GET` 會將它和已儲存場域合併，同一識別碼以 Neon 資料為準。讀取不改動資料庫；第一次儲存參考場域的平面圖或機台時，後端才會將該場域加入資料庫。參考座標是場域入口或代表點，不代表現場機台位置；實際擺放座標需另行確認。

## 管理員端點

所有端點皆回傳 JSON，附 `Cache-Control: no-store`。讀取需要有效的管理員 Session Cookie；修改另外要求 `Origin` 完全等於 `APP_ORIGIN`，且角色是 `operator` 或 `super_admin`。`viewer` 可以讀取，修改會回傳 403。

| 方法與路徑 | 請求／回應 |
| --- | --- |
| `GET /api/map/state` | 回傳 `MapState`：`locations`、`floor_plans`、`placements`，機台資料內含可為 `null` 的 `sensor_position` |
| `GET /api/map/floor-image?floor_plan_id=...` | 驗證管理員 Cookie 後回傳單張 PNG／JPEG／WebP 二進位圖片，最多 2 MiB |
| `POST /api/map/locations` | 完整 `MapLocation`；依 `location_id` 新增或更新，回傳儲存的場域 |
| `POST /api/map/floor-plans` | 完整 `MarketFloorPlan`；依 `floor_plan_id` 新增或更新，回傳平面圖 |
| `PUT /api/map/placements` | 完整 `DevicePlacementInput`，不接受用此端點覆寫 `sensor_position`；依 `device_id` 新增或更新，回傳含最新感測值的機台擺設 |

欄位定義位於 [src/types/map.ts](../src/types/map.ts)。識別碼最多 64 字元，限英數字、底線與連字號。場域設定座標限定臺灣周邊範圍（緯度 21.5 至 26.5、經度 118 至 123）；機台設定與感測座標依 WGS84 全球範圍檢查。非台北點可被儲存，不會被強制改成台北中心點。

設定 GPS 的 `latitude`／`longitude` 必須同時為數字或同時為 `null`。平面圖的 `floor_x`／`floor_y` 也必須同時為數字或同時為 `null`，數值介於 0 與 1，原點在圖片左上角，向右／向下增加；有平面座標時必須指定屬於同一場域的 `floor_plan_id`。`PUT /placements` 也會登錄新的機台識別碼；只有已登錄的機台可以上傳感測座標。

平面圖 `image_url` 上傳值為 `data:image/png;base64,...`、`data:image/jpeg;base64,...` 或 `data:image/webp;base64,...`。原始圖片最多 2 MiB，寬高各最多 8000 像素，後端驗證檔案標頭與宣告尺寸。JSON 全文限制 3 MiB，包含串流請求；超過回傳 413。系統內建的 `/maps/demo-market-floor.svg` 只允許固定 1200 × 800 且 `is_demo: true`。不接受任意遠端圖片網址、SVG 上傳或 HTML。

正式 API 的場域資料與上傳回應只提供圖片中繼資料，`image_url` 為同來源的 `/api/map/floor-image?floor_plan_id=...`；瀏覽器以管理員 Cookie 單獨載入圖片。這讓多張平面圖不會把 `state` 回應撐過 Vercel 的回應大小限制。Neon 保留上傳的 Data URL；示範模式的圖片仍直接存在本機儲存，示範 SVG 保持原路徑。此版更新平面圖來源等中繼資料時仍須提交原始 Data URL，畫面上傳流程會以新識別碼新增圖面。

平面圖識別碼對應固定的圖片、尺寸與場域，這三項不可覆寫；重用識別碼更換圖片會回傳 409。上傳新圖片時建立新的 `floor_plan_id`，再將機台移到新圖並重新點選。原有點位仍屬於原圖，不會被誤套到新圖；延遲送達的舊圖點位也只會寫入舊圖。圖名、來源與示範標示可修改。資料庫 Trigger 同樣維持此規則。

## 感測器端點

`POST /api/map/position` 使用每台機台獨立的 Bearer Token，無須管理員 Cookie 或瀏覽器 Origin。請以 HTTPS 呼叫。機台 ID 與 Token 必須匹配 `MAP_SENSOR_TOKENS`，且 ID 必須已在 `map_device_placements` 登錄。未知 ID 或不相符 Token 不會建立設備資料。

在硬體端以受保護方式設定 `RAT_SENSOR_TOKEN`，下列範例的 Token 與時間需換成實際值。不要將真實 Token 存在腳本原始碼或 Git：

~~~bash
curl --fail-with-body https://rat-monitor.vercel.app/api/map/position \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${RAT_SENSOR_TOKEN}" \
  --data '{"device_id":"RAT-TPE-001","latitude":25.0374,"longitude":121.4997,"accuracy_m":8.5,"observed_at":"2026-10-13T10:30:00+08:00"}'
~~~

`accuracy_m` 是以公尺表示的定位誤差，可為 `null` 或省略；有效數值為 0 至 100000。`observed_at` 必須是含時區的 ISO 8601 時間，不能超過伺服器現在時間 5 分鐘，避免設備時鐘錯誤阻擋後續讀值。回應為 `{ "device_id": "...", "accepted": true, "sensor_position": { ... } }`。資料庫以時間條件原子更新：較舊或相同時間的讀值回傳 `accepted: false` 與目前最新點位，不覆寫新讀值；此條件也適用於併發上傳。

此版本只保存每台機台最新的一筆 GPS，不提供移動軌跡。設定經緯度、感測經緯度與平面圖座標各自儲存，畫面可依目前資料分別呈現來源、誤差及時間。

錯誤狀態包含 400（資料無效）、401（未登入或設備驗證失敗）、403（來源或角色不符）、404（場域／機台未登錄）、409（平面圖識別碼衝突）、413（資料過大）、415（非 JSON）與 503（後端設定或服務不可用）。錯誤回應與伺服器日誌不輸出資料庫連線字串、Token 或資料庫驅動錯誤內容。

## 本機驗證

執行 `npm test` 可驗證座標與配對欄位、圖片與串流大小、設備 Token 和讀值時間順序。再執行 `npm run build` 與 `npm run lint`。這些檢查不會連接或修改正式資料庫；部署後仍需用已登入管理員與測試機台驗證 Neon 持久化、角色拒絕、上傳新圖重新點選及新舊讀值上傳。
