/** Normalized bounding box (0–1 relative to image width/height). */
export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  confidence: number;
}

/**
 * Independent Detection Event: one de-duplicated rodent activity observation.
 * One ByteTrack trajectory = one event; a track that disappears for longer than
 * the independence interval T and reappears counts as a new event.
 * An event is NOT a unique individual.
 */
export interface DetectionEvent {
  event_id: string;
  device_id: string;
  location_id: string;
  /** Alias of event_start, kept for sorting and legacy consumers. */
  captured_at: string;
  event_start: string;
  event_end: string;
  duration_sec: number;
  tracking_id: string;
  rat_detected: boolean;
  /** False when the track re-appeared within T and was merged into an earlier event. */
  is_independent: boolean;
  /** Silence interval T used for de-duplication, in seconds. */
  independence_interval_sec: number;
  /** Max boxes in a single frame — a lower bound ("at least N"), never a population count. */
  max_simultaneous_count: number;
  /** Mean per-box confidence along the track. Confidence ≠ accuracy. */
  mean_confidence: number;
  image_url: string;
  model_version: string;
  review_status: ReviewStatus;
  /** Human reviewer account; null while the event is AI-only. */
  reviewed_by: string | null;
  reviewed_at: string | null;
  bounding_boxes?: BoundingBox[];
}

/** Continuous interval in which a device was online AND its camera could see. */
export interface MonitoringSession {
  session_id: string;
  device_id: string;
  start_at: string;
  end_at: string;
  effective_seconds: number;
  /** Why the session ended; null while the session is still open at data cut-off. */
  downtime_reason: DowntimeReason | null;
}

export type DowntimeReason = 'offline' | 'tamper' | 'battery';

export type StreamStatus = 'live' | 'degraded' | 'offline';

/** Latest camera frame for live monitor (mock poll or future snapshot API). */
export interface CameraSnapshot {
  device_id: string;
  location_id: string;
  captured_at: string;
  image_url: string;
  stream_status: StreamStatus;
  device_status: DeviceStatus;
  camera_health: CameraHealth;
  bounding_boxes: BoundingBox[];
  linked_event_id?: string;
  activity_detected: boolean;
}

export type OpsAlertSeverity = 'info' | 'warning' | 'critical';
export type OpsAlertKind = 'spike' | 'device_offline' | 'tamper' | 'review';

export interface OpsAlert {
  id: string;
  kind: OpsAlertKind;
  severity: OpsAlertSeverity;
  title: string;
  detail: string;
  href: string;
}

/** pending = AI detection only; confirmed / false_positive = decided by a human reviewer. */
export type ReviewStatus = 'pending' | 'confirmed' | 'false_positive';
export type ReviewDecision = Exclude<ReviewStatus, 'pending'>;

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
}

export type DeviceStatus = 'online' | 'warning' | 'offline';
export type NetworkType = '4G' | 'Wi-Fi' | 'LoRa';
export type CameraHealth = 'normal' | 'occluded' | 'blurred' | 'foggy';

export interface Device {
  device_id: string;
  location_id: string;
  status: DeviceStatus;
  camera_health: CameraHealth;
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
  /** Successful uploads ÷ attempts over the last 24 h, 0–100. */
  upload_success_rate: number;
  firmware_version: string;
  ai_model_version: string;
}

/** Device plus fields derived by the data service. */
export interface DeviceHealth extends Device {
  /** last_seen older than the heartbeat timeout. */
  heartbeat_stale: boolean;
  /** Connected, fresh heartbeat and camera can see — its data can be trusted. */
  effective_monitoring: boolean;
  monitoring_hours_7d: number;
}

export interface DeviceFleetSummary {
  total: number;
  connected: number;
  effective: number;
  camera_issues: number;
  stale: number;
  effective_rate: number;
  avg_upload_success_rate: number;
  heartbeat_timeout_min: number;
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

/** Shared disclosure shown next to every metric so numbers stay interpretable. */
export interface MetricMeta {
  data_updated_at: string;
  independence_interval_sec: number;
  model_version: string;
  /** Share of events that received human review (confirmed or false positive). */
  review_rate: number;
  false_positive_count: number;
  heartbeat_timeout_min: number;
}

export type TrendDirection = 'up' | 'down' | 'flat';

export interface DashboardSummary {
  events_per_100h: {
    value: number;
    previous: number;
    events: number;
    monitoring_hours: number;
  };
  trend: {
    last7_daily_avg: number;
    prev7_daily_avg: number;
    change_percentage: number | null;
    direction: TrendDirection;
    today_events: number;
    sparkline: number[];
  };
  anomalies: {
    open: number;
    top: AnomalyAlert | null;
  };
  devices: DeviceFleetSummary;
}

export interface RodentAbsenceRate {
  value: number | null;
  valid_slices: number;
  rodent_slices: number;
  nights: number;
}

export interface HourlyActivity {
  hour: number;
  events: number;
  avg_per_day: number;
}

export interface DailyActivity {
  date: string;
  events: number;
  /** 7-day moving average of daily events (null until 7 days of history exist). */
  ma7: number | null;
  monitoring_hours: number;
  events_per_100h: number | null;
}

export type RiskLevel = 'low' | 'medium' | 'high';

/** Explainable, rule-based risk grading — every component is exposed. */
export interface RiskAssessment {
  level: RiskLevel;
  base_level: RiskLevel;
  events_per_100h: number;
  trend_change_percentage: number | null;
  trend_escalated: boolean;
  anomaly_escalated: boolean;
  thresholds: { medium: number; high: number; trend_up: number; trend_min_events: number };
}

export interface LocationActivity {
  location_id: string;
  location_name: string;
  events: number;
  monitoring_hours: number;
  events_per_100_hours: number;
  risk: RiskAssessment;
}

export interface LocationStats extends Location {
  device_count: number;
  detection_event_count: number;
  monitoring_hours: number;
  events_per_100_hours: number;
  trend_change_percentage: number | null;
  peak_hour: string;
  latest_detection: string | null;
  risk: RiskAssessment;
}

export interface HeatmapCell {
  weekday: number; // 0 = Monday … 6 = Sunday
  hour: number;
  events: number;
  /** Number of that weekday's occurrences in the window. */
  samples: number;
  avg_events: number;
}

export interface AnomalyAlert {
  alert_id: string;
  location_id: string;
  location_name: string;
  type: 'spike';
  triggered_at: string;
  metric_value: number;
  baseline_value: number;
  z_score: number;
  threshold: number;
  baseline_days: number;
  status: 'open' | 'ack' | 'closed';
}

export interface ActivityProfile {
  total_events: number;
  nocturnal_events: number;
  nocturnal_share: number;
  duration_buckets: { label: string; events: number }[];
  median_duration_sec: number | null;
}

export interface EventFilters {
  location_id?: string;
  start_date?: string;
  end_date?: string;
  review_status?: ReviewStatus;
  min_confidence?: number;
  limit?: number;
}

export interface ActivityFilters {
  location_id?: string;
  start_date?: string;
  end_date?: string;
  days?: 7 | 14 | 30;
}
