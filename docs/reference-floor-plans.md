# 市場與夜市參考場地圖

依既有 `台北市夜市與菜市場場地圖/圖面來源索引.csv` 收錄 **23 個場域、39 張圖**，查核日期 **2026-10-15**。場域依 `mapCatalog.ts` 的完整市場名稱對應；成功中繼市場對應「臺北市公有成功市場（臨時攤棚）」；士林市場 B1 對應公有士林市場，並非士林夜市。

所有圖片由原 PNG／JPEG 轉為 **lossless WebP**，保留原尺寸、頁面方向、原有文字與註記，以及南門市場 JPEG 的 ICC 色彩設定。轉檔前核對 CSV SHA256，轉檔後逐張確認 RGB 像素完全相等；沒有裁切、縮放或重繪。

原圖合計 51,578,007 bytes；靜態 WebP 合計 25,522,952 bytes。檔案位於 `public/maps/reference/`；九個 canonical 欄位與版本識別碼列於 `src/data/marketFloorPlans.ts`。

## 版本與用途範圍

- 「近期」僅表示近期官網或招標附件提供，並非現場測繪確認。南門市場的2026來自檔名；第二果菜市場PDF建立日不等同圖面日期，故標為「未定年」。
- 「歷史」與「歷史規劃」保留原年度。北投中繼市場、環南2019全區圖屬當年設計／完工規劃；環南2021圖是中繼市場樓層。
- 士林B1是未定年街頭藝人場域舊圖，未確認2025改裝後現況；圖內紅藍箭頭為原有標記。
- 圖面未經地理定位，圖像座標不是 WGS84 經緯度。`is_demo: false` 表示來源圖面，並不保證是最新現況。

## 圖面索引

| 場域 ID | 圖面／版本 | 原PDF頁 | 尺寸 px | 靜態檔案／穩定 ID | 來源 |
| --- | --- | --- | --- | --- | --- |
| `TPE-MARKET-016` | 中崙市場・1F（2026 近期招標圖） | 15 | 2526 × 1786 | [TPE-PLAN-MARKET-016-2026-TENDER-1F](../public/maps/reference/tpe-plan-market-016-2026-tender-1f.webp) | [S01][S01] |
| `TPE-MARKET-016` | 中崙市場・2F（2026 近期招標圖） | 15 | 2526 × 1786 | [TPE-PLAN-MARKET-016-2026-TENDER-2F](../public/maps/reference/tpe-plan-market-016-2026-tender-2f.webp) | [S02][S02] |
| `TPE-MARKET-026` | 南門市場・1F（2026 近期官網圖） | 圖片原檔 | 1000 × 750 | [TPE-PLAN-MARKET-026-2026-1F](../public/maps/reference/tpe-plan-market-026-2026-1f.webp) | [S03][S03] |
| `TPE-MARKET-026` | 南門市場・2F（2026 近期官網圖） | 圖片原檔 | 1000 × 750 | [TPE-PLAN-MARKET-026-2026-2F](../public/maps/reference/tpe-plan-market-026-2026-2f.webp) | [S04][S04] |
| `TPE-MARKET-026` | 南門市場・B1（2026 近期官網圖） | 圖片原檔 | 1000 × 750 | [TPE-PLAN-MARKET-026-2026-B1](../public/maps/reference/tpe-plan-market-026-2026-b1.webp) | [S05][S05] |
| `TPE-MARKET-030` | 幸安市場・1F（2026 近期招標圖） | 21 | 2526 × 1786 | [TPE-PLAN-MARKET-030-2026-TENDER-1F](../public/maps/reference/tpe-plan-market-030-2026-tender-1f.webp) | [S06][S06] |
| `TPE-WHOLESALE-002` | 第二果菜批發市場・果菜零批場（未定年官網圖） | 1 | 2525 × 1786 | [TPE-PLAN-WHOLESALE-002-UNDATED-RETAIL-PDF20260318](../public/maps/reference/tpe-plan-wholesale-002-undated-retail-pdf20260318.webp) | [S07][S07] |
| `TPE-MARKET-020` | 信義市場・樓層未標（2021 歷史圖） | 12 | 2525 × 1786 | [TPE-PLAN-MARKET-020-2021-UNSPECIFIED](../public/maps/reference/tpe-plan-market-020-2021-unspecified.webp) | [S08][S08] |
| `TPE-MARKET-002` | 北投中繼市場・全區（2021 歷史規劃） | 1 | 3572 × 2526 | [TPE-PLAN-MARKET-002-2021-INTERIM-ALL](../public/maps/reference/tpe-plan-market-002-2021-interim-all.webp) | [S09][S09] |
| `TPE-MARKET-002` | 北投中繼市場・A區（2021 歷史規劃） | 2 | 3572 × 2526 | [TPE-PLAN-MARKET-002-2021-INTERIM-A](../public/maps/reference/tpe-plan-market-002-2021-interim-a.webp) | [S09][S09] |
| `TPE-MARKET-002` | 北投中繼市場・B區（2021 歷史規劃） | 3 | 3572 × 2526 | [TPE-PLAN-MARKET-002-2021-INTERIM-B](../public/maps/reference/tpe-plan-market-002-2021-interim-b.webp) | [S09][S09] |
| `TPE-MARKET-002` | 北投中繼市場・C區（2021 歷史規劃） | 4 | 3572 × 2526 | [TPE-PLAN-MARKET-002-2021-INTERIM-C](../public/maps/reference/tpe-plan-market-002-2021-interim-c.webp) | [S09][S09] |
| `TPE-MARKET-002` | 北投中繼市場・D區（2021 歷史規劃） | 5 | 3572 × 2526 | [TPE-PLAN-MARKET-002-2021-INTERIM-D](../public/maps/reference/tpe-plan-market-002-2021-interim-d.webp) | [S09][S09] |
| `TPE-MARKET-002` | 北投中繼市場・E庫體區（2021 歷史規劃） | 6 | 3572 × 2526 | [TPE-PLAN-MARKET-002-2021-INTERIM-E](../public/maps/reference/tpe-plan-market-002-2021-interim-e.webp) | [S09][S09] |
| `TPE-NIGHT-025` | 南機場夜市・攤位圖 1/1（2010 歷史圖） | 382 | 1786 × 2526 | [TPE-PLAN-NIGHT-025-2010-P382](../public/maps/reference/tpe-plan-night-025-2010-p382.webp) | [S10][S10] |
| `TPE-MARKET-040` | 士林市場・B1（未定年舊圖） | 圖片原檔 | 1490 × 819 | [TPE-PLAN-MARKET-040-UNDATED-B1](../public/maps/reference/tpe-plan-market-040-undated-b1.webp) | [S11][S11] |
| `TPE-NIGHT-044` | 寧夏夜市・攤位圖 1/1（2010 歷史圖） | 387 | 1786 × 2526 | [TPE-PLAN-NIGHT-044-2010-P387](../public/maps/reference/tpe-plan-night-044-2010-p387.webp) | [S10][S10] |
| `TPE-MARKET-018` | 成功中繼市場・2F飲食攤（2021 歷史圖） | 1 | 2880 × 1620 | [TPE-PLAN-MARKET-018-2021-INTERIM-2F](../public/maps/reference/tpe-plan-market-018-2021-interim-2f.webp) | [S12][S12] |
| `TPE-MARKET-022` | 成德市場・樓層未標（2021 歷史圖） | 5 | 2525 × 1786 | [TPE-PLAN-MARKET-022-2021-UNSPECIFIED](../public/maps/reference/tpe-plan-market-022-2021-unspecified.webp) | [S08][S08] |
| `TPE-MARKET-007` | 木柵市場・2F（2021 歷史圖） | 13 | 2525 × 1786 | [TPE-PLAN-MARKET-007-2021-2F](../public/maps/reference/tpe-plan-market-007-2021-2f.webp) | [S08][S08] |
| `TPE-MARKET-036` | 松江市場・B1（2021 歷史圖） | 7 | 2525 × 1786 | [TPE-PLAN-MARKET-036-2021-B1](../public/maps/reference/tpe-plan-market-036-2021-b1.webp) | [S08][S08] |
| `TPE-MARKET-028` | 水源市場・2F（2021 歷史圖） | 14 | 2525 × 1786 | [TPE-PLAN-MARKET-028-2021-2F](../public/maps/reference/tpe-plan-market-028-2021-2f.webp) | [S08][S08] |
| `TPE-MARKET-009` | 環南市場・中繼市場2F（2021 歷史圖） | 11 | 2525 × 1786 | [TPE-PLAN-MARKET-009-2021-INTERIM-2F](../public/maps/reference/tpe-plan-market-009-2021-interim-2f.webp) | [S08][S08] |
| `TPE-MARKET-009` | 環南市場・中繼市場3F冰櫃（2021 歷史圖） | 10 | 2525 × 1786 | [TPE-PLAN-MARKET-009-2021-INTERIM-3F-FREEZERS](../public/maps/reference/tpe-plan-market-009-2021-interim-3f-freezers.webp) | [S08][S08] |
| `TPE-MARKET-009` | 環南市場・全區業種配置（2019 歷史規劃） | 2 | 1786 × 2526 | [TPE-PLAN-MARKET-009-2019-ZONING](../public/maps/reference/tpe-plan-market-009-2019-zoning.webp) | [S13][S13] |
| `TPE-NIGHT-035` | 臨江街夜市・攤位圖 1/3（2010 歷史圖） | 377 | 1786 × 2526 | [TPE-PLAN-NIGHT-035-2010-P377](../public/maps/reference/tpe-plan-night-035-2010-p377.webp) | [S10][S10] |
| `TPE-NIGHT-035` | 臨江街夜市・攤位圖 2/3（2010 歷史圖） | 378 | 1786 × 2526 | [TPE-PLAN-NIGHT-035-2010-P378](../public/maps/reference/tpe-plan-night-035-2010-p378.webp) | [S10][S10] |
| `TPE-NIGHT-035` | 臨江街夜市・攤位圖 3/3（2010 歷史圖） | 379 | 1786 × 2526 | [TPE-PLAN-NIGHT-035-2010-P379](../public/maps/reference/tpe-plan-night-035-2010-p379.webp) | [S10][S10] |
| `TPE-MARKET-031` | 蘭州市場・樓層未標（2021 歷史圖） | 3 | 2525 × 1786 | [TPE-PLAN-MARKET-031-2021-UNSPECIFIED](../public/maps/reference/tpe-plan-market-031-2021-unspecified.webp) | [S08][S08] |
| `TPE-MARKET-044` | 西寧市場・B1（2021 歷史圖） | 8 | 2525 × 1786 | [TPE-PLAN-MARKET-044-2021-B1](../public/maps/reference/tpe-plan-market-044-2021-b1.webp) | [S08][S08] |
| `TPE-NIGHT-029` | 雙城街夜市・攤位圖 1/1（2010 歷史圖） | 381 | 1786 × 2526 | [TPE-PLAN-NIGHT-029-2010-P381](../public/maps/reference/tpe-plan-night-029-2010-p381.webp) | [S10][S10] |
| `TPE-MARKET-032` | 雙連市場・B1（2021 歷史圖） | 4 | 2525 × 1786 | [TPE-PLAN-MARKET-032-2021-B1](../public/maps/reference/tpe-plan-market-032-2021-b1.webp) | [S08][S08] |
| `TPE-NIGHT-011` | 饒河街夜市・攤位圖 1/5（2010 歷史圖） | 372 | 1786 × 2526 | [TPE-PLAN-NIGHT-011-2010-P372](../public/maps/reference/tpe-plan-night-011-2010-p372.webp) | [S10][S10] |
| `TPE-NIGHT-011` | 饒河街夜市・攤位圖 2/5（2010 歷史圖） | 373 | 1786 × 2526 | [TPE-PLAN-NIGHT-011-2010-P373](../public/maps/reference/tpe-plan-night-011-2010-p373.webp) | [S10][S10] |
| `TPE-NIGHT-011` | 饒河街夜市・攤位圖 3/5（2010 歷史圖） | 374 | 1786 × 2526 | [TPE-PLAN-NIGHT-011-2010-P374](../public/maps/reference/tpe-plan-night-011-2010-p374.webp) | [S10][S10] |
| `TPE-NIGHT-011` | 饒河街夜市・攤位圖 4/5（2010 歷史圖） | 375 | 1786 × 2526 | [TPE-PLAN-NIGHT-011-2010-P375](../public/maps/reference/tpe-plan-night-011-2010-p375.webp) | [S10][S10] |
| `TPE-NIGHT-011` | 饒河街夜市・攤位圖 5/5（2010 歷史圖） | 376 | 1786 × 2526 | [TPE-PLAN-NIGHT-011-2010-P376](../public/maps/reference/tpe-plan-night-011-2010-p376.webp) | [S10][S10] |
| `TPE-MARKET-014` | 龍城市場・2F（2021 歷史圖） | 6 | 2525 × 1786 | [TPE-PLAN-MARKET-014-2021-2F](../public/maps/reference/tpe-plan-market-014-2021-2f.webp) | [S08][S08] |
| `TPE-MARKET-042` | 龍山商場・1F（2021 歷史圖） | 9 | 2525 × 1786 | [TPE-PLAN-MARKET-042-2021-1F](../public/maps/reference/tpe-plan-market-042-2021-1f.webp) | [S08][S08] |

## 原始來源

[S01]: https://www-ws.gov.taipei/001/Upload/407/relfile/53196/9561636/5e190401-d65f-41c4-b5e7-0cbc129f33bc.pdf "臺北市市場處"
[S02]: https://www-ws.gov.taipei/001/Upload/407/relfile/53196/9552737/436f3fb9-e2a9-4a8c-ae37-20aa13fe1154.pdf "臺北市市場處"
[S03]: https://www.tpnanmen.org.tw/uploads/images/%E5%8D%97%E9%96%80%E5%B8%82%E5%A0%B4%E5%B9%B3%E9%85%8D%E5%9C%962026-1F.jpg "南門市場"
[S04]: https://www.tpnanmen.org.tw/uploads/images/%E5%8D%97%E9%96%80%E5%B8%82%E5%A0%B4%E5%B9%B3%E9%85%8D%E5%9C%962026-2F.jpg "南門市場"
[S05]: https://www.tpnanmen.org.tw/uploads/images/%E5%8D%97%E9%96%80%E5%B8%82%E5%A0%B4%E5%B9%B3%E9%85%8D%E5%9C%962026-B1.jpg "南門市場"
[S06]: https://www-ws.gov.taipei/Download.ashx?u=LzAwMS9VcGxvYWQvNDA3L3JlbGZpbGUvNTMxOTYvOTcxNjg3MS9jMWJiMTRjZS0wOTk1LTQ0NjUtYmE3MS1mMTVjOWYwZWM4ODQucGRm&n=5oub5qiZ5paH5Lu2LnBkZg%3d%3d&icon=..pdf "臺北市市場處"
[S07]: https://www.tapmc.com.tw/webatt/%E7%AC%AC%E4%BA%8C%E6%9E%9C%E8%8F%9C%E6%89%B9%E7%99%BC%E5%B8%82%E5%A0%B4%E9%9B%B6%E6%89%B9%E5%A0%B4%E4%BD%8D%E7%BD%AE%E5%9C%96.pdf "臺北農產運銷股份有限公司"
[S08]: https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf "臺北市市場處"
[S09]: https://www-ws.gov.taipei/001/Upload/407/relfile/46159/8441111/e4c5fc41-5583-466f-bd2b-7eb7996bb071.pdf "臺北市市場處（圖面：創構建築師事務所）"
[S10]: https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883 "臺北市市場處（委託單位）"
[S11]: https://tpbusker.gov.taipei/upfiles/9c8ee89a-ac98-40a7-8bc5-d41a49cc67d2.jpg "臺北市街頭藝人登記及展演申請平台"
[S12]: https://www-ws.gov.taipei/001/Upload/407/relfile/20230/8381012/8e75f12e-49f6-4afa-a419-7ec9a44dade7.pdf "臺北市市場處"
[S13]: https://www-ws.gov.taipei/Download.ashx?n=55Kw5Y2X5biC5aC05pSk5L2N44CB5qWt56iu6YWN572u5Y%2BK5oq957Gk6Kqq5piO5pyDLnBkZg%3D%3D&u=LzAwMS9VcGxvYWQvNDA3L3JlbGZpbGUvMTMxOTcvODA5MjI3Ny82OTYzYTc2ZC0yZThlLTQ2NjktOGI5Zi0zNzM1ODVhMzYyYTUucGRm "臺北市市場處"

- [S01・臺北市市場處](https://www-ws.gov.taipei/001/Upload/407/relfile/53196/9561636/5e190401-d65f-41c4-b5e7-0cbc129f33bc.pdf)
- [S02・臺北市市場處](https://www-ws.gov.taipei/001/Upload/407/relfile/53196/9552737/436f3fb9-e2a9-4a8c-ae37-20aa13fe1154.pdf)
- [S03・南門市場](https://www.tpnanmen.org.tw/uploads/images/%E5%8D%97%E9%96%80%E5%B8%82%E5%A0%B4%E5%B9%B3%E9%85%8D%E5%9C%962026-1F.jpg)
- [S04・南門市場](https://www.tpnanmen.org.tw/uploads/images/%E5%8D%97%E9%96%80%E5%B8%82%E5%A0%B4%E5%B9%B3%E9%85%8D%E5%9C%962026-2F.jpg)
- [S05・南門市場](https://www.tpnanmen.org.tw/uploads/images/%E5%8D%97%E9%96%80%E5%B8%82%E5%A0%B4%E5%B9%B3%E9%85%8D%E5%9C%962026-B1.jpg)
- [S06・臺北市市場處](https://www-ws.gov.taipei/Download.ashx?u=LzAwMS9VcGxvYWQvNDA3L3JlbGZpbGUvNTMxOTYvOTcxNjg3MS9jMWJiMTRjZS0wOTk1LTQ0NjUtYmE3MS1mMTVjOWYwZWM4ODQucGRm&n=5oub5qiZ5paH5Lu2LnBkZg%3d%3d&icon=..pdf)
- [S07・臺北農產運銷股份有限公司](https://www.tapmc.com.tw/webatt/%E7%AC%AC%E4%BA%8C%E6%9E%9C%E8%8F%9C%E6%89%B9%E7%99%BC%E5%B8%82%E5%A0%B4%E9%9B%B6%E6%89%B9%E5%A0%B4%E4%BD%8D%E7%BD%AE%E5%9C%96.pdf)
- [S08・臺北市市場處](https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf)
- [S09・臺北市市場處（圖面：創構建築師事務所）](https://www-ws.gov.taipei/001/Upload/407/relfile/46159/8441111/e4c5fc41-5583-466f-bd2b-7eb7996bb071.pdf)
- [S10・臺北市市場處（委託單位）](https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883)
- [S11・臺北市街頭藝人登記及展演申請平台](https://tpbusker.gov.taipei/upfiles/9c8ee89a-ac98-40a7-8bc5-d41a49cc67d2.jpg)
- [S12・臺北市市場處](https://www-ws.gov.taipei/001/Upload/407/relfile/20230/8381012/8e75f12e-49f6-4afa-a419-7ec9a44dade7.pdf)
- [S13・臺北市市場處](https://www-ws.gov.taipei/Download.ashx?n=55Kw5Y2X5biC5aC05pSk5L2N44CB5qWt56iu6YWN572u5Y%2BK5oq957Gk6Kqq5piO5pyDLnBkZg%3D%3D&u=LzAwMS9VcGxvYWQvNDA3L3JlbGZpbGUvMTMxOTcvODA5MjI3Ny82OTYzYTc2ZC0yZThlLTQ2NjktOGI5Zi0zNzM1ODVhMzYyYTUucGRm)

CSV保存各原檔相對路徑、版本說明、來源網址、原PDF頁碼、檢查日、尺寸與SHA256。既有原檔保持不變；後續更換圖片內容應使用新的版本識別碼及檔名。
