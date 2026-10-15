-- Taipei market map persistence. Run explicitly in the Neon SQL Editor.
-- Separate from docs/schema.sql (planned monitoring tables) and auth tables.
-- Re-running does not overwrite administrator changes or sensor observations.
BEGIN;

CREATE TABLE IF NOT EXISTS map_locations (
  location_id TEXT PRIMARY KEY CHECK (location_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  type TEXT NOT NULL CHECK (type IN ('market', 'night_market', 'alley', 'other')),
  address TEXT NOT NULL DEFAULT '' CHECK (char_length(address) <= 300),
  district TEXT NOT NULL DEFAULT '' CHECK (char_length(district) <= 40),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN 21.5 AND 26.5),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN 118 AND 123),
  coordinate_source TEXT NOT NULL CHECK (coordinate_source IN ('demo', 'reference', 'manual')),
  source_url TEXT CHECK (source_url IS NULL OR (char_length(source_url) <= 1500 AND source_url ~ '^https?://')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS map_floor_plans (
  floor_plan_id TEXT PRIMARY KEY CHECK (floor_plan_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  location_id TEXT NOT NULL REFERENCES map_locations(location_id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  image_url TEXT NOT NULL,
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 8000),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 8000),
  source_label TEXT NOT NULL CHECK (char_length(source_label) BETWEEN 1 AND 180),
  source_url TEXT CHECK (source_url IS NULL OR (char_length(source_url) <= 1500 AND source_url ~ '^https?://')),
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (floor_plan_id, location_id),
  CHECK (image_url <> '/maps/demo-market-floor.svg' OR (is_demo AND width = 1200 AND height = 800))
);

-- BEGIN GENERATED REFERENCE FLOOR CONSTRAINT
-- Generated from src/data/marketFloorPlans.ts. Do not edit this block by hand.
-- Regenerate: node --import tsx scripts/generate-map-reference-schema.ts
-- Reserved IDs accept only their complete canonical metadata, never uploads.
ALTER TABLE map_floor_plans DROP CONSTRAINT IF EXISTS map_floor_plans_image_url_check;
ALTER TABLE map_floor_plans ADD CONSTRAINT map_floor_plans_image_url_check CHECK (
  octet_length(image_url) <= 2796250 AND (
    (floor_plan_id NOT IN ('TPE-PLAN-MARKET-016-2026-TENDER-1F', 'TPE-PLAN-MARKET-016-2026-TENDER-2F', 'TPE-PLAN-MARKET-026-2026-1F', 'TPE-PLAN-MARKET-026-2026-2F', 'TPE-PLAN-MARKET-026-2026-B1', 'TPE-PLAN-MARKET-030-2026-TENDER-1F', 'TPE-PLAN-WHOLESALE-002-UNDATED-RETAIL-PDF20260318', 'TPE-PLAN-MARKET-020-2021-UNSPECIFIED', 'TPE-PLAN-MARKET-002-2021-INTERIM-ALL', 'TPE-PLAN-MARKET-002-2021-INTERIM-A', 'TPE-PLAN-MARKET-002-2021-INTERIM-B', 'TPE-PLAN-MARKET-002-2021-INTERIM-C', 'TPE-PLAN-MARKET-002-2021-INTERIM-D', 'TPE-PLAN-MARKET-002-2021-INTERIM-E', 'TPE-PLAN-NIGHT-025-2010-P382', 'TPE-PLAN-MARKET-040-UNDATED-B1', 'TPE-PLAN-NIGHT-044-2010-P387', 'TPE-PLAN-MARKET-018-2021-INTERIM-2F', 'TPE-PLAN-MARKET-022-2021-UNSPECIFIED', 'TPE-PLAN-MARKET-007-2021-2F', 'TPE-PLAN-MARKET-036-2021-B1', 'TPE-PLAN-MARKET-028-2021-2F', 'TPE-PLAN-MARKET-009-2021-INTERIM-2F', 'TPE-PLAN-MARKET-009-2021-INTERIM-3F-FREEZERS', 'TPE-PLAN-MARKET-009-2019-ZONING', 'TPE-PLAN-NIGHT-035-2010-P377', 'TPE-PLAN-NIGHT-035-2010-P378', 'TPE-PLAN-NIGHT-035-2010-P379', 'TPE-PLAN-MARKET-031-2021-UNSPECIFIED', 'TPE-PLAN-MARKET-044-2021-B1', 'TPE-PLAN-NIGHT-029-2010-P381', 'TPE-PLAN-MARKET-032-2021-B1', 'TPE-PLAN-NIGHT-011-2010-P372', 'TPE-PLAN-NIGHT-011-2010-P373', 'TPE-PLAN-NIGHT-011-2010-P374', 'TPE-PLAN-NIGHT-011-2010-P375', 'TPE-PLAN-NIGHT-011-2010-P376', 'TPE-PLAN-MARKET-014-2021-2F', 'TPE-PLAN-MARKET-042-2021-1F') AND
      (image_url = '/maps/demo-market-floor.svg' OR image_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'))
    OR (source_url IS NOT NULL AND
      (floor_plan_id, location_id, name, image_url, width, height, source_label, source_url, is_demo) IN (
        ('TPE-PLAN-MARKET-016-2026-TENDER-1F', 'TPE-MARKET-016', '中崙市場・1F（2026 近期招標圖）', '/maps/reference/tpe-plan-market-016-2026-tender-1f.webp', 2526, 1786, '臺北市市場處｜2026招標附件・近期公開圖｜原PDF第15頁；檢查2026-10-15。招標文件圖面，非現況測繪。', 'https://www-ws.gov.taipei/001/Upload/407/relfile/53196/9561636/5e190401-d65f-41c4-b5e7-0cbc129f33bc.pdf', FALSE),
        ('TPE-PLAN-MARKET-016-2026-TENDER-2F', 'TPE-MARKET-016', '中崙市場・2F（2026 近期招標圖）', '/maps/reference/tpe-plan-market-016-2026-tender-2f.webp', 2526, 1786, '臺北市市場處｜2026招標附件・近期公開圖｜原PDF第15頁；檢查2026-10-15。招標文件圖面，非現況測繪。', 'https://www-ws.gov.taipei/001/Upload/407/relfile/53196/9552737/436f3fb9-e2a9-4a8c-ae37-20aa13fe1154.pdf', FALSE),
        ('TPE-PLAN-MARKET-026-2026-1F', 'TPE-MARKET-026', '南門市場・1F（2026 近期官網圖）', '/maps/reference/tpe-plan-market-026-2026-1f.webp', 1000, 750, '南門市場｜2026檔名・近期官網圖；精確發布日未載｜官網樓層攤位圖；檢查2026-10-15。', 'https://www.tpnanmen.org.tw/uploads/images/%E5%8D%97%E9%96%80%E5%B8%82%E5%A0%B4%E5%B9%B3%E9%85%8D%E5%9C%962026-1F.jpg', FALSE),
        ('TPE-PLAN-MARKET-026-2026-2F', 'TPE-MARKET-026', '南門市場・2F（2026 近期官網圖）', '/maps/reference/tpe-plan-market-026-2026-2f.webp', 1000, 750, '南門市場｜2026檔名・近期官網圖；精確發布日未載｜官網樓層攤位圖；檢查2026-10-15。', 'https://www.tpnanmen.org.tw/uploads/images/%E5%8D%97%E9%96%80%E5%B8%82%E5%A0%B4%E5%B9%B3%E9%85%8D%E5%9C%962026-2F.jpg', FALSE),
        ('TPE-PLAN-MARKET-026-2026-B1', 'TPE-MARKET-026', '南門市場・B1（2026 近期官網圖）', '/maps/reference/tpe-plan-market-026-2026-b1.webp', 1000, 750, '南門市場｜2026檔名・近期官網圖；精確發布日未載｜官網樓層攤位圖；檢查2026-10-15。', 'https://www.tpnanmen.org.tw/uploads/images/%E5%8D%97%E9%96%80%E5%B8%82%E5%A0%B4%E5%B9%B3%E9%85%8D%E5%9C%962026-B1.jpg', FALSE),
        ('TPE-PLAN-MARKET-030-2026-TENDER-1F', 'TPE-MARKET-030', '幸安市場・1F（2026 近期招標圖）', '/maps/reference/tpe-plan-market-030-2026-tender-1f.webp', 2526, 1786, '臺北市市場處｜2026招標附件・近期公開圖｜原PDF第21頁；檢查2026-10-15。招標文件圖面，非現況測繪。', 'https://www-ws.gov.taipei/Download.ashx?u=LzAwMS9VcGxvYWQvNDA3L3JlbGZpbGUvNTMxOTYvOTcxNjg3MS9jMWJiMTRjZS0wOTk1LTQ0NjUtYmE3MS1mMTVjOWYwZWM4ODQucGRm&n=5oub5qiZ5paH5Lu2LnBkZg%3d%3d&icon=..pdf', FALSE),
        ('TPE-PLAN-WHOLESALE-002-UNDATED-RETAIL-PDF20260318', 'TPE-WHOLESALE-002', '第二果菜批發市場・果菜零批場（未定年官網圖）', '/maps/reference/tpe-plan-wholesale-002-undated-retail-pdf20260318.webp', 2525, 1786, '臺北農產運銷股份有限公司｜未定年官網圖；PDF建立日2026-03-18｜原PDF第1頁・樓層未標；檢查2026-10-15。檔案建立日不等同圖面版本或測量日。', 'https://www.tapmc.com.tw/webatt/%E7%AC%AC%E4%BA%8C%E6%9E%9C%E8%8F%9C%E6%89%B9%E7%99%BC%E5%B8%82%E5%A0%B4%E9%9B%B6%E6%89%B9%E5%A0%B4%E4%BD%8D%E7%BD%AE%E5%9C%96.pdf', FALSE),
        ('TPE-PLAN-MARKET-020-2021-UNSPECIFIED', 'TPE-MARKET-020', '信義市場・樓層未標（2021 歷史圖）', '/maps/reference/tpe-plan-market-020-2021-unspecified.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第12頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-MARKET-002-2021-INTERIM-ALL', 'TPE-MARKET-002', '北投中繼市場・全區（2021 歷史規劃）', '/maps/reference/tpe-plan-market-002-2021-interim-all.webp', 3572, 2526, '臺北市市場處（圖面：創構建築師事務所）｜2021-08-11歷史規劃圖｜原PDF第1頁；檢查2026-10-15。設計階段，非現況確認圖。', 'https://www-ws.gov.taipei/001/Upload/407/relfile/46159/8441111/e4c5fc41-5583-466f-bd2b-7eb7996bb071.pdf', FALSE),
        ('TPE-PLAN-MARKET-002-2021-INTERIM-A', 'TPE-MARKET-002', '北投中繼市場・A區（2021 歷史規劃）', '/maps/reference/tpe-plan-market-002-2021-interim-a.webp', 3572, 2526, '臺北市市場處（圖面：創構建築師事務所）｜2021-08-11歷史規劃圖｜原PDF第2頁；檢查2026-10-15。設計階段，非現況確認圖。', 'https://www-ws.gov.taipei/001/Upload/407/relfile/46159/8441111/e4c5fc41-5583-466f-bd2b-7eb7996bb071.pdf', FALSE),
        ('TPE-PLAN-MARKET-002-2021-INTERIM-B', 'TPE-MARKET-002', '北投中繼市場・B區（2021 歷史規劃）', '/maps/reference/tpe-plan-market-002-2021-interim-b.webp', 3572, 2526, '臺北市市場處（圖面：創構建築師事務所）｜2021-08-11歷史規劃圖｜原PDF第3頁；檢查2026-10-15。設計階段，非現況確認圖。', 'https://www-ws.gov.taipei/001/Upload/407/relfile/46159/8441111/e4c5fc41-5583-466f-bd2b-7eb7996bb071.pdf', FALSE),
        ('TPE-PLAN-MARKET-002-2021-INTERIM-C', 'TPE-MARKET-002', '北投中繼市場・C區（2021 歷史規劃）', '/maps/reference/tpe-plan-market-002-2021-interim-c.webp', 3572, 2526, '臺北市市場處（圖面：創構建築師事務所）｜2021-08-11歷史規劃圖｜原PDF第4頁；檢查2026-10-15。設計階段，非現況確認圖。', 'https://www-ws.gov.taipei/001/Upload/407/relfile/46159/8441111/e4c5fc41-5583-466f-bd2b-7eb7996bb071.pdf', FALSE),
        ('TPE-PLAN-MARKET-002-2021-INTERIM-D', 'TPE-MARKET-002', '北投中繼市場・D區（2021 歷史規劃）', '/maps/reference/tpe-plan-market-002-2021-interim-d.webp', 3572, 2526, '臺北市市場處（圖面：創構建築師事務所）｜2021-08-11歷史規劃圖｜原PDF第5頁；檢查2026-10-15。設計階段，非現況確認圖。', 'https://www-ws.gov.taipei/001/Upload/407/relfile/46159/8441111/e4c5fc41-5583-466f-bd2b-7eb7996bb071.pdf', FALSE),
        ('TPE-PLAN-MARKET-002-2021-INTERIM-E', 'TPE-MARKET-002', '北投中繼市場・E庫體區（2021 歷史規劃）', '/maps/reference/tpe-plan-market-002-2021-interim-e.webp', 3572, 2526, '臺北市市場處（圖面：創構建築師事務所）｜2021-08-11歷史規劃圖｜原PDF第6頁；檢查2026-10-15。設計階段，非現況確認圖。', 'https://www-ws.gov.taipei/001/Upload/407/relfile/46159/8441111/e4c5fc41-5583-466f-bd2b-7eb7996bb071.pdf', FALSE),
        ('TPE-PLAN-NIGHT-025-2010-P382', 'TPE-NIGHT-025', '南機場夜市・攤位圖 1/1（2010 歷史圖）', '/maps/reference/tpe-plan-night-025-2010-p382.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第382頁（印刷頁361）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-MARKET-040-UNDATED-B1', 'TPE-MARKET-040', '士林市場・B1（未定年舊圖）', '/maps/reference/tpe-plan-market-040-undated-b1.webp', 1490, 819, '臺北市街頭藝人登記及展演申請平台｜未定年舊圖；未確認2025改裝後現況｜街頭藝人場域示意；檢查2026-10-15。紅藍箭頭是原圖表演場域及動線；原介紹頁目前404。', 'https://tpbusker.gov.taipei/upfiles/9c8ee89a-ac98-40a7-8bc5-d41a49cc67d2.jpg', FALSE),
        ('TPE-PLAN-NIGHT-044-2010-P387', 'TPE-NIGHT-044', '寧夏夜市・攤位圖 1/1（2010 歷史圖）', '/maps/reference/tpe-plan-night-044-2010-p387.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第387頁（印刷頁366）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-MARKET-018-2021-INTERIM-2F', 'TPE-MARKET-018', '成功中繼市場・2F飲食攤（2021 歷史圖）', '/maps/reference/tpe-plan-market-018-2021-interim-2f.webp', 2880, 1620, '臺北市市場處｜2021公告附件・歷史平面圖｜原PDF第1頁；檢查2026-10-15。', 'https://www-ws.gov.taipei/001/Upload/407/relfile/20230/8381012/8e75f12e-49f6-4afa-a419-7ec9a44dade7.pdf', FALSE),
        ('TPE-PLAN-MARKET-022-2021-UNSPECIFIED', 'TPE-MARKET-022', '成德市場・樓層未標（2021 歷史圖）', '/maps/reference/tpe-plan-market-022-2021-unspecified.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第5頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-MARKET-007-2021-2F', 'TPE-MARKET-007', '木柵市場・2F（2021 歷史圖）', '/maps/reference/tpe-plan-market-007-2021-2f.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第13頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-MARKET-036-2021-B1', 'TPE-MARKET-036', '松江市場・B1（2021 歷史圖）', '/maps/reference/tpe-plan-market-036-2021-b1.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第7頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-MARKET-028-2021-2F', 'TPE-MARKET-028', '水源市場・2F（2021 歷史圖）', '/maps/reference/tpe-plan-market-028-2021-2f.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第14頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-MARKET-009-2021-INTERIM-2F', 'TPE-MARKET-009', '環南市場・中繼市場2F（2021 歷史圖）', '/maps/reference/tpe-plan-market-009-2021-interim-2f.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第11頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-MARKET-009-2021-INTERIM-3F-FREEZERS', 'TPE-MARKET-009', '環南市場・中繼市場3F冰櫃（2021 歷史圖）', '/maps/reference/tpe-plan-market-009-2021-interim-3f-freezers.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第10頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-MARKET-009-2019-ZONING', 'TPE-MARKET-009', '環南市場・全區業種配置（2019 歷史規劃）', '/maps/reference/tpe-plan-market-009-2019-zoning.webp', 1786, 2526, '臺北市市場處｜2019說明會附件・歷史規劃圖｜原PDF第2頁；檢查2026-10-15。當年完工規劃示意，未確認與改建後現況相同。', 'https://www-ws.gov.taipei/Download.ashx?n=55Kw5Y2X5biC5aC05pSk5L2N44CB5qWt56iu6YWN572u5Y%2BK5oq957Gk6Kqq5piO5pyDLnBkZg%3D%3D&u=LzAwMS9VcGxvYWQvNDA3L3JlbGZpbGUvMTMxOTcvODA5MjI3Ny82OTYzYTc2ZC0yZThlLTQ2NjktOGI5Zi0zNzM1ODVhMzYyYTUucGRm', FALSE),
        ('TPE-PLAN-NIGHT-035-2010-P377', 'TPE-NIGHT-035', '臨江街夜市・攤位圖 1/3（2010 歷史圖）', '/maps/reference/tpe-plan-night-035-2010-p377.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第377頁（印刷頁356）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-NIGHT-035-2010-P378', 'TPE-NIGHT-035', '臨江街夜市・攤位圖 2/3（2010 歷史圖）', '/maps/reference/tpe-plan-night-035-2010-p378.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第378頁（印刷頁357）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-NIGHT-035-2010-P379', 'TPE-NIGHT-035', '臨江街夜市・攤位圖 3/3（2010 歷史圖）', '/maps/reference/tpe-plan-night-035-2010-p379.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第379頁（印刷頁358）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-MARKET-031-2021-UNSPECIFIED', 'TPE-MARKET-031', '蘭州市場・樓層未標（2021 歷史圖）', '/maps/reference/tpe-plan-market-031-2021-unspecified.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第3頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-MARKET-044-2021-B1', 'TPE-MARKET-044', '西寧市場・B1（2021 歷史圖）', '/maps/reference/tpe-plan-market-044-2021-b1.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第8頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-NIGHT-029-2010-P381', 'TPE-NIGHT-029', '雙城街夜市・攤位圖 1/1（2010 歷史圖）', '/maps/reference/tpe-plan-night-029-2010-p381.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第381頁（印刷頁360）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-MARKET-032-2021-B1', 'TPE-MARKET-032', '雙連市場・B1（2021 歷史圖）', '/maps/reference/tpe-plan-market-032-2021-b1.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第4頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-NIGHT-011-2010-P372', 'TPE-NIGHT-011', '饒河街夜市・攤位圖 1/5（2010 歷史圖）', '/maps/reference/tpe-plan-night-011-2010-p372.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第372頁（印刷頁351）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-NIGHT-011-2010-P373', 'TPE-NIGHT-011', '饒河街夜市・攤位圖 2/5（2010 歷史圖）', '/maps/reference/tpe-plan-night-011-2010-p373.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第373頁（印刷頁352）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-NIGHT-011-2010-P374', 'TPE-NIGHT-011', '饒河街夜市・攤位圖 3/5（2010 歷史圖）', '/maps/reference/tpe-plan-night-011-2010-p374.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第374頁（印刷頁353）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-NIGHT-011-2010-P375', 'TPE-NIGHT-011', '饒河街夜市・攤位圖 4/5（2010 歷史圖）', '/maps/reference/tpe-plan-night-011-2010-p375.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第375頁（印刷頁354）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-NIGHT-011-2010-P376', 'TPE-NIGHT-011', '饒河街夜市・攤位圖 5/5（2010 歷史圖）', '/maps/reference/tpe-plan-night-011-2010-p376.webp', 1786, 2526, '臺北市市場處（委託單位）｜2010-12-27報告・歷史攤位圖｜原PDF第376頁（印刷頁355）；檢查2026-10-15。非現況配置。', 'https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=34a10310-2545-47d0-a0a2-bc11e319b883', FALSE),
        ('TPE-PLAN-MARKET-014-2021-2F', 'TPE-MARKET-014', '龍城市場・2F（2021 歷史圖）', '/maps/reference/tpe-plan-market-014-2021-2f.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第6頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE),
        ('TPE-PLAN-MARKET-042-2021-1F', 'TPE-MARKET-042', '龍山商場・1F（2021 歷史圖）', '/maps/reference/tpe-plan-market-042-2021-1f.webp', 2525, 1786, '臺北市市場處｜2021-04-21資料附圖・歷史攤位圖｜原PDF第9頁；檢查2026-10-15。保留原圖折痕與註記。', 'https://www-ws.gov.taipei/001/Upload/407/ckfile/3eb956d9-ddaa-4d63-a9df-f9a70e60ba68.pdf', FALSE)
      ))
  )
);
-- END GENERATED REFERENCE FLOOR CONSTRAINT

CREATE INDEX IF NOT EXISTS map_floor_plans_location_lookup ON map_floor_plans(location_id);

-- A stable image identity prevents delayed clients from pinning a new image
-- using coordinates read from an old image. A replacement uses a new plan ID.
CREATE OR REPLACE FUNCTION map_keep_floor_image_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.image_url IS DISTINCT FROM OLD.image_url OR NEW.width IS DISTINCT FROM OLD.width
     OR NEW.height IS DISTINCT FROM OLD.height OR NEW.location_id IS DISTINCT FROM OLD.location_id THEN
    RAISE EXCEPTION 'Create a new floor_plan_id when changing image, dimensions or location';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS map_floor_image_immutable ON map_floor_plans;
CREATE TRIGGER map_floor_image_immutable BEFORE UPDATE ON map_floor_plans
FOR EACH ROW EXECUTE FUNCTION map_keep_floor_image_immutable();

CREATE TABLE IF NOT EXISTS map_device_placements (
  device_id TEXT PRIMARY KEY CHECK (device_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  location_id TEXT NOT NULL REFERENCES map_locations(location_id) ON DELETE RESTRICT,
  latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  floor_plan_id TEXT,
  floor_x DOUBLE PRECISION CHECK (floor_x BETWEEN 0 AND 1),
  floor_y DOUBLE PRECISION CHECK (floor_y BETWEEN 0 AND 1),
  placement_note TEXT NOT NULL DEFAULT '' CHECK (char_length(placement_note) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (floor_plan_id, location_id) REFERENCES map_floor_plans(floor_plan_id, location_id) ON DELETE RESTRICT,
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK ((floor_x IS NULL) = (floor_y IS NULL)),
  CHECK (floor_x IS NULL OR floor_plan_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS map_device_placements_location_lookup ON map_device_placements(location_id);
CREATE INDEX IF NOT EXISTS map_device_placements_floor_lookup ON map_device_placements(floor_plan_id) WHERE floor_plan_id IS NOT NULL;

-- One latest reading per registered device. GPS never changes the indoor pin.
CREATE TABLE IF NOT EXISTS map_sensor_positions (
  device_id TEXT PRIMARY KEY REFERENCES map_device_placements(device_id) ON DELETE RESTRICT,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m DOUBLE PRECISION CHECK (accuracy_m BETWEEN 0 AND 100000),
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO map_locations (location_id, name, type, address, district, latitude, longitude, coordinate_source)
VALUES
  ('LOC-001', '市場 A', 'market', '臺北市萬華區 prototype 示範市場', '萬華區', 25.0374, 121.4997, 'demo'),
  ('LOC-002', '夜市 B', 'night_market', '臺北市大同區 prototype 示範夜市', '大同區', 25.0553, 121.5159, 'demo'),
  ('LOC-003', '巷道 C', 'alley', '臺北市中正區 prototype 示範巷道', '中正區', 25.0287, 121.5197, 'demo')
ON CONFLICT (location_id) DO NOTHING;

INSERT INTO map_floor_plans (floor_plan_id, location_id, name, image_url, width, height, source_label, is_demo)
VALUES ('DEMO-FLOOR-001', 'LOC-001', '市場 A 示範平面圖', '/maps/demo-market-floor.svg', 1200, 800, '本系統示範配置，非真實市場平面圖', TRUE)
ON CONFLICT (floor_plan_id) DO NOTHING;

INSERT INTO map_device_placements (device_id, location_id, latitude, longitude, floor_plan_id, floor_x, floor_y, placement_note)
VALUES
  ('RAT-TPE-001', 'LOC-001', 25.0374, 121.4997, 'DEMO-FLOOR-001', 0.35, 0.62, '示範機台；實際位置待現場確認'),
  ('RAT-TPE-002', 'LOC-002', 25.0553, 121.5159, NULL, NULL, NULL, '示範機台；實際位置待現場確認'),
  ('RAT-TPE-003', 'LOC-003', 25.0287, 121.5197, NULL, NULL, NULL, '示範機台；實際位置待現場確認')
ON CONFLICT (device_id) DO NOTHING;

COMMIT;
