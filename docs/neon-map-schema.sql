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
  image_url TEXT NOT NULL CHECK (
    octet_length(image_url) <= 2796250 AND
    (image_url = '/maps/demo-market-floor.svg' OR image_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$')
  ),
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
