-- AIoT Smart Rat Monitoring — Formal PostgreSQL schema (planning only)
-- Prototype does NOT connect to a live database.

CREATE TABLE locations (
  location_id   TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('market', 'night_market', 'alley', 'other')),
  address       TEXT,
  monitoring_hours NUMERIC(10, 2) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE devices (
  device_id         TEXT PRIMARY KEY,
  location_id       TEXT NOT NULL REFERENCES locations(location_id),
  status            TEXT NOT NULL CHECK (status IN ('online', 'warning', 'offline')),
  battery           NUMERIC(5, 2),
  network           TEXT CHECK (network IN ('4G', 'Wi-Fi', 'LoRa')),
  signal_strength   INTEGER,
  last_seen         TIMESTAMPTZ,
  firmware_version  TEXT,
  ai_model_version  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE model_versions (
  model_version   TEXT PRIMARY KEY,
  architecture    TEXT,
  trained_at      TIMESTAMPTZ,
  precision_score NUMERIC(6, 4),
  recall_score    NUMERIC(6, 4),
  map_score       NUMERIC(6, 4),
  notes           TEXT
);

CREATE TABLE detection_events (
  event_id        TEXT PRIMARY KEY,
  device_id       TEXT NOT NULL REFERENCES devices(device_id),
  location_id     TEXT NOT NULL REFERENCES locations(location_id),
  captured_at     TIMESTAMPTZ NOT NULL,
  rat_detected    BOOLEAN NOT NULL DEFAULT TRUE,
  -- detected_count = rats in this frame; NOT unique population
  detected_count  INTEGER NOT NULL DEFAULT 1 CHECK (detected_count >= 0),
  confidence      NUMERIC(5, 4),
  image_url       TEXT,
  model_version   TEXT REFERENCES model_versions(model_version),
  review_status   TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'confirmed', 'reviewed', 'false_positive')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_detection_events_captured_at ON detection_events (captured_at DESC);
CREATE INDEX idx_detection_events_location ON detection_events (location_id, captured_at DESC);
CREATE INDEX idx_detection_events_device ON detection_events (device_id, captured_at DESC);

CREATE TABLE telemetry (
  telemetry_id    BIGSERIAL PRIMARY KEY,
  device_id       TEXT NOT NULL REFERENCES devices(device_id),
  recorded_at     TIMESTAMPTZ NOT NULL,
  battery         NUMERIC(5, 2),
  signal_strength INTEGER,
  network         TEXT,
  temperature_c   NUMERIC(5, 2),
  payload         JSONB
);

CREATE INDEX idx_telemetry_device_time ON telemetry (device_id, recorded_at DESC);

CREATE TABLE interventions (
  intervention_id BIGSERIAL PRIMARY KEY,
  location_id     TEXT NOT NULL REFERENCES locations(location_id),
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  intervention_type TEXT NOT NULL,
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
