# 台北市市場地圖資料來源

資料擷取日期：2026-10-13（Asia/Taipei）。`src/data/mapCatalog.ts` 是固定的來源快照，不會在瀏覽器開啟時抓取政府網站。各筆保留來源連結，來源標示為 `reference`，表示地點參考座標，並非機台實測位置。

## 地點目錄

| 來源 | 採用筆數 | 欄位及轉換 |
| --- | ---: | --- |
| [臺北市傳統市（商）場，臺北市市場處](https://data.taipei/dataset/detail?id=89bebb3a-990d-4070-bd67-631a575f6d4a) | 47 | `seqno`、`stitle`、`xAddress`、`GTag_longitude`、`GTag_latitude`；經緯度為 WGS84 十進位。光華數位新天地、中山大樓及松江路命理街標為「其他」。 |
| [臺北市批發市場，臺北市市場處](https://data.taipei/dataset/detail?id=4a50dd4a-b09c-47c8-9374-fc04a9e59cc9) | 8 | 相同欄位；Big5 CSV。第一果菜批發市場另以營運方公開地圖連結修正參考點。 |
| [臺北市攤販集中場，臺北市市場處](https://data.taipei/dataset/detail?id=c013d9ec-a550-46bd-ac60-45f085930706) | 12 | 來源共 47 筆，僅採用已確認的夜市／夜間商圈；Big5 CSV。度分秒轉為十進位：`度 + 分 / 60 + 秒 / 3600`。`stitle` 為行政區，地點名稱來自 `xbody` 並採用常見夜市名稱。 |
| [士林觀光夜市](https://www.travel.taipei/en/attraction/details/1692)、[景美夜市](https://www.travel.taipei/en/attraction/details/2099)，臺北旅遊網 | 2 | 旅遊網確認名稱及市場周邊範圍。參考點沿用政府傳統市場資料中的士林市場及景美市場座標，因此日間市場與夜市可能在同一點位重疊；不是夜市範圍的精確中心。 |

總計 69 個參考地點：52 個市場、14 個夜市、3 個其他市／商場。既有「市場 A／夜市 B／巷道 C」是另外保留的示範資料，不計入這 69 筆。

原始下載連結：

- [傳統市（商）場 CSV](https://data.taipei/api/dataset/89bebb3a-990d-4070-bd67-631a575f6d4a/resource/35acfce1-2c4d-4c70-aa75-601cdab2b3f7/download)
- [批發市場 CSV](https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=5738e1ed-41f0-4205-adfe-7377be708193)
- [攤販集中場 CSV](https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=4874f750-b972-4c42-ad76-986960670c70)

政府資料集公開提供資料；[中央資料平臺的傳統市場資料集](https://data.gov.tw/dataset/121593)標示「政府資料開放授權條款－第 1 版」。使用資料時應保留資料提供機關與來源連結。地點 ID 使用來源序號並加上 `TPE-MARKET-`、`TPE-WHOLESALE-`、`TPE-NIGHT-` 前綴；往後刷新資料時應以既有 ID 配對，避免影響機台綁定。

## 已辨識的來源問題及修正

- **第一果菜批發市場**：批發市場 CSV 的 `(25.034179, 121.490125)` 與萬大路 533 號不一致。改採[臺北農產運銷公司官方交通資訊](https://www.tapmc.com.tw/Pages/ContactUs)所連結的地點標記 `(25.0183001, 121.4983607)`；這是公開參考點，未經本系統測量。其連結中的地圖視窗中心另為 `(25.0183016, 121.4961754)`，不可誤當地點標記。
- **南門市場**：傳統市場 CSV 仍含杭州南路二段 55 號的中繼地址。[市場官方交通資訊](https://www.tpnanmen.org.tw/article/239)及[臺北市市場處 2023 年開幕公告](https://travel.taipei/zh-tw/news/details/52885)確認已回到羅斯福路一段 8 號。地址與行政區改為現址；參考座標採[OpenStreetMap 節點 3201203197](https://www.openstreetmap.org/node/3201203197)的 `(25.0323362, 121.5182324)`，其地址與現址一致。該節點最後更新時間為 2024-12-12，仍需現地確認。
- 除上述已辨識問題，其他座標沿用來源資料，未對所有市場執行現地測量。政府資料更新時間不代表每個點位已重新定位，也不代表市場建築／攤位配置已更新。

## 平面圖

`public/maps/demo-market-floor.svg` 是本系統自製的「市場 A」示意圖，只用於示範機台擺設標記。`DEMO_FLOOR_PLANS` 保留 `is_demo: true`，不宣稱任何真實果菜市場的配置。圖面沒有比例尺、方向校正或地理定位。

查到的公開參考資料：

- [南門市場官方樓層平面圖](https://www.tpnanmen.org.tw/article/243)：公開瀏覽的 B1／1F／2F 圖面；網站保留著作權，亦非第一／第二果菜批發市場。本次只保留來源連結，沒有下載後重新散布。
- [臺北市第一果菜及萬大魚類批發市場改建工程環境資料](https://www-ws.gov.taipei/Download.ashx?icon=..pdf&n=QzAwLnBkZg%3D%3D&u=LzAwMS9VcGxvYWQvMzYzL3JlbGZpbGUvNDU1MDUvODM2MTg5NC9lM2NhNjBlNC1lMDhkLTQ4NWMtYjlhNi1iNjY4MjM0ZGU4MjYucGRm)：包含規劃／變更時的配置圖，不能據此推定現在的樓層、攤位或機台位置。本次未載入作為現況圖。

正式使用須取得該市場／樓層可使用的現況平面圖，設定獨立 `floor_plan_id`、圖片尺寸及來源。平面圖位置使用左上角為原點的比例座標：`floor_x = 圖片 x / 圖片寬`、`floor_y = 圖片 y / 圖片高`，值域 `[0, 1]`。替換圖面後，舊擺設位置須重新確認。GPS/WGS84 經緯度不能直接當作平面圖比例座標；如需自動對應，須另行取得樓層資訊、控制點及地理校正模型。

## OpenStreetMap 底圖

南門市場參考點與底圖使用 OpenStreetMap 資料，依 [OpenStreetMap 版權與授權](https://www.openstreetmap.org/copyright)保留 `© OpenStreetMap contributors` 可見署名及連結。

採用標準圖磚服務時依 [OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)：使用 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`；署名保持可見；瀏覽器傳送正常 Referer 並遵守 HTTP 快取標頭。不可預先大量下載圖磚或提供離線地圖下載功能。服務為盡力提供且無 SLA，正式商用／高流量可透過設定替換為合適的圖磚供應商並保留其要求的署名。
