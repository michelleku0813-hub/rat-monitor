/** Normalized bounding box (0–1 relative to image width/height). */
export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  confidence: number;
}

/** Detection Event: one AI-detected rat activity observation (not unique individuals). */
export interface DetectionEvent {
  event_id: string;
  device_id: string;
  location_id: string;
  captured_at: string;
  rat_detected: boolean;
  /** Number of rats detected in this frame — NOT unique population count. */
  detected_count: number;
  confidence: number;
  image_url: string;
  model_version: string;
  review_status: ReviewStatus;
  bounding_boxes?: BoundingBox[];
}

export type StreamStatus = 'live' | 'degraded' | 'offline';

/** Latest camera frame for live monitor (mock poll or future snapshot API). */
export interface CameraSnapshot {
  device_id: string;
  location_id: string;
  captured_at: string;
  image_url: string;
  stream_status: StreamStatus;
  device_status: DeviceStatus;
  bounding_boxes: BoundingBox[];
  linked_event_id?: string;
  activity_detected: boolean;
}

export type OpsAlertSeverity = 'info' | 'warning' | 'critical';

export interface OpsAlert {
  id: string;
  severity: OpsAlertSeverity;
  title: string;
  detail: string;
  href: string;
}

export type ReviewStatus = 'pending' | 'confirmed' | 'false_positive' | 'reviewed';

export type LocationType = 'market' | 'night_market' | 'alley' | 'other';

export interface Location {
  location_id: string;
  name: string;
  type: LocationType;
  address: string;
  district: string;
  /** Coordinates are kept for future map-provider integration. */
  latitude: number;
  longitude: number;
  /** Percentage position used by the lightweight prototype SVG map. */
  map_position: {
    x: number;
    y: number;
  };
  monitoring_hours: number;
}

export type DeviceStatus = 'online' | 'warning' | 'offline';
export type NetworkType = '4G' | 'Wi-Fi' | 'LoRa';

export interface Device {
  device_id: string;
  location_id: string;
  status: DeviceStatus;
  battery: number;
  power_mode: string;
  voltage: number;
  power_watts: number;
  memory_used_mb: number;
  memory_total_mb: number;
  cpu_usage: number;
  temperature_c: number;
  network: NetworkType;
  signal_strength: number;
  last_seen: string;
  firmware_version: string;
  ai_model_version: string;
}

/** A prototype-only email dispatch record for a dead-rat detection. */
export interface DeadRatNotification {
  notification_id: string;
  location_id: string;
  device_id: string;
  detected_at: string;
  recipient: string;
  subject: string;
  body: string;
  delivery_status: 'sent';
}

export interface DashboardSummary {
  today_events: number;
  yesterday_events: number;
  change_percentage: number;
  peak_hour: string;
  highest_activity_location: string;
  online_devices: number;
  total_devices: number;
  latest_detection: string | null;
}

export interface HourlyActivity {
  hour: number;
  events: number;
}

export interface DailyActivity {
  date: string;
  events: number;
}

export interface LocationActivity {
  location_id: string;
  location_name: string;
  events: number;
  monitoring_hours: number;
  events_per_100_hours: number;
}

export interface LocationStats extends Location {
  device_count: number;
  detection_event_count: number;
  events_per_100_hours: number;
  peak_hour: string;
  latest_detection: string | null;
}

export interface HeatmapCell {
  weekday: number; // 0 = Monday … 6 = Sunday
  hour: number;
  events: number;
}

export interface EventFilters {
  location_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface ActivityFilters {
  location_id?: string;
  start_date?: string;
  end_date?: string;
  days?: 7 | 14 | 30;
}
