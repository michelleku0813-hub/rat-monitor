import type {
  ActivityFilters,
  ActivityProfile,
  AnomalyAlert,
  CameraSnapshot,
  DailyActivity,
  DashboardSummary,
  DeadRatNotification,
  DetectionEvent,
  DeviceFleetSummary,
  DeviceHealth,
  EventFilters,
  HeatmapCell,
  HourlyActivity,
  LocationActivity,
  LocationStats,
  MetricMeta,
  OpsAlert,
  RodentAbsenceRate,
  ReviewDecision,
  RiskAssessment,
  RiskLevel,
  StreamStatus,
} from '../types';
import { DETECTION_EVENTS, INDEPENDENCE_INTERVAL_SEC, MODEL_VERSION } from '../data/mock/events';
import { DEMO_NOW, DEVICES } from '../data/mock/devices';
import { LOCATIONS, LOCATION_MAP } from '../data/mock/locations';
import { DAY_MS, MONITORING_SESSIONS, MOCK_RANGE_START, taipeiMidnight } from '../data/mock/sessions';
import { boxesForEvent } from '../data/mock/boundingBoxes';
import { toTaipeiIso } from '../utils/format';

/**
 * Data Service Layer
 *
 * Current: Mock Data → Data Service → UI
 * Future:  REST API → Data Service → UI
 *
 * UI components should only consume this module so the data source
 * can be swapped without rewriting pages.
 *
 * Metric definitions follow 《鼠患 AIoT Dashboard 指標研究報告》:
 * - Only independent, non-false-positive events are counted.
 * - Cross-site comparison uses Events per 100 effective monitoring hours.
 * - Effective monitoring hours come from monitoring sessions (online AND camera can see).
 */

const TZ = 'Asia/Taipei';
const HOUR_MS = 60 * 60 * 1000;
const NOW = DEMO_NOW.getTime();

export const HEARTBEAT_TIMEOUT_MIN = 15;
/** Prototype thresholds on Events / 100h — to be calibrated per site with real data. */
export const RISK_THRESHOLDS = { medium: 15, high: 30, trend_up: 25, trend_min_events: 20 } as const;
export const ANOMALY_Z_THRESHOLD = 3;
export const ANOMALY_BASELINE_DAYS = 28;
/** FEHD-style sampling: 2-minute slices, 19:00–07:00. */
export const RAR_SLICE_MIN = 2;
export const NIGHT_START_HOUR = 19;
export const NIGHT_END_HOUR = 7;

/* ——————————————————— time helpers ——————————————————— */

const ts = (iso: string) => new Date(iso).getTime();

function toTaipeiDateKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function dateKeyToMidnight(key: string): number {
  return new Date(`${key}T00:00:00+08:00`).getTime();
}

function getHourInTaipei(ms: number): number {
  return Math.floor((ms - dateKeyToMidnight(toTaipeiDateKey(ms))) / HOUR_MS);
}

/** 0 = Monday … 6 = Sunday */
function getWeekdayMon0(ms: number): number {
  const sun0 = new Date(dateKeyToMidnight(toTaipeiDateKey(ms)) + 12 * HOUR_MS).getUTCDay();
  return (sun0 + 6) % 7;
}

function formatHourRange(hour: number): string {
  const next = (hour + 1) % 24;
  return `${String(hour).padStart(2, '0')}:00–${String(next).padStart(2, '0')}:00`;
}

interface DayWindow {
  start: number;
  end: number;
  dayKeys: string[];
}

/** Calendar-day window in Taipei time, clipped to the data cut-off. */
function resolveWindow(filters?: ActivityFilters): DayWindow {
  const days = filters?.days ?? 7;
  const start = filters?.start_date
    ? dateKeyToMidnight(filters.start_date)
    : taipeiMidnight(days - 1);
  const end = Math.min(
    filters?.end_date ? dateKeyToMidnight(filters.end_date) + DAY_MS : NOW,
    NOW,
  );
  const dayKeys: string[] = [];
  for (let t = start; t < end; t += DAY_MS) dayKeys.push(toTaipeiDateKey(t));
  return { start, end, dayKeys };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round1(((current - previous) / previous) * 100);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function delay<T>(data: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

/* ——————————————————— core metric primitives ——————————————————— */

/**
 * Events that count toward metrics: independent and not rejected by review.
 * Re-evaluated on every call so review decisions take effect immediately.
 */
function countedEvents(): DetectionEvent[] {
  return DETECTION_EVENTS.filter(
    (e) => e.rat_detected && e.is_independent && e.review_status !== 'false_positive',
  );
}

function deviceIdsFor(locationId?: string): string[] {
  return DEVICES.filter(
    (d) => !locationId || locationId === 'all' || d.location_id === locationId,
  ).map((d) => d.device_id);
}

function countedIn(start: number, end: number, deviceIds: string[]): DetectionEvent[] {
  return countedEvents().filter((e) => {
    const t = ts(e.event_start);
    return t >= start && t < end && deviceIds.includes(e.device_id);
  });
}

/** Effective monitoring hours (online and camera usable) inside [start, end). */
function monitoringHours(start: number, end: number, deviceIds: string[]): number {
  let ms = 0;
  for (const s of MONITORING_SESSIONS) {
    if (!deviceIds.includes(s.device_id)) continue;
    const overlap = Math.min(ts(s.end_at), end) - Math.max(ts(s.start_at), start);
    if (overlap > 0) ms += overlap;
  }
  return ms / HOUR_MS;
}

function per100h(events: number, hours: number): number {
  return hours > 0 ? round1((events / hours) * 100) : 0;
}

function peakHour(events: DetectionEvent[]): { hour: number; count: number } | null {
  if (events.length === 0) return null;
  const counts = new Array(24).fill(0);
  for (const e of events) counts[getHourInTaipei(ts(e.event_start))] += 1;
  let hour = 0;
  for (let h = 1; h < 24; h++) if (counts[h] > counts[hour]) hour = h;
  return { hour, count: counts[hour] };
}

/**
 * Rodent Absence Rate (after Hong Kong FEHD): share of valid night-time
 * 2-minute slices without any counted event. Slices where the device was not
 * effectively monitoring are excluded from the denominator.
 */
function rodentAbsence(deviceIds: string[], nights: number): RodentAbsenceRate {
  const sliceMs = RAR_SLICE_MIN * 60 * 1000;
  let valid = 0;
  let rodent = 0;

  for (const deviceId of deviceIds) {
    const sessions = MONITORING_SESSIONS.filter((s) => s.device_id === deviceId).map((s) => [
      ts(s.start_at),
      ts(s.end_at),
    ]);
    const events = countedEvents().filter((e) => e.device_id === deviceId).map((e) => [
      ts(e.event_start),
      ts(e.event_end),
    ]);

    for (let k = 1; k <= nights; k++) {
      const nightStart = taipeiMidnight(k) + NIGHT_START_HOUR * HOUR_MS;
      const nightEnd = taipeiMidnight(k - 1) + NIGHT_END_HOUR * HOUR_MS;
      for (let t = nightStart; t + sliceMs <= nightEnd; t += sliceMs) {
        const covered = sessions.some(([a, b]) => a <= t && b >= t + sliceMs);
        if (!covered) continue;
        valid += 1;
        if (events.some(([a, b]) => a < t + sliceMs && b > t)) rodent += 1;
      }
    }
  }

  return {
    value: valid > 0 ? round1(((valid - rodent) / valid) * 100) : null,
    valid_slices: valid,
    rodent_slices: rodent,
    nights,
  };
}

/**
 * Spike detection: today's count (up to the current time of day) against the
 * same partial-day counts of the previous 28 days, using a MAD-based robust z-score.
 * Days with < 80% monitoring coverage are excluded from the baseline.
 */
function detectAnomalies(): AnomalyAlert[] {
  const offset = NOW - taipeiMidnight(0);
  const alerts: AnomalyAlert[] = [];

  for (const loc of LOCATIONS) {
    const deviceIds = deviceIdsFor(loc.location_id);
    const fullHours = (offset / HOUR_MS) * deviceIds.length;
    const todayStart = taipeiMidnight(0);
    if (monitoringHours(todayStart, NOW, deviceIds) < fullHours * 0.5) continue;

    const today = countedIn(todayStart, NOW, deviceIds).length;
    const baseline: number[] = [];
    for (let k = 1; k <= ANOMALY_BASELINE_DAYS; k++) {
      const start = taipeiMidnight(k);
      if (start < MOCK_RANGE_START) break;
      if (monitoringHours(start, start + offset, deviceIds) < fullHours * 0.8) continue;
      baseline.push(countedIn(start, start + offset, deviceIds).length);
    }
    if (baseline.length < 14) continue;

    const med = median(baseline);
    // Floor MAD at 1 event so a flat baseline does not yield an infinite z-score.
    const mad = Math.max(median(baseline.map((v) => Math.abs(v - med))), 1);
    const z = round1((0.6745 * (today - med)) / mad);

    if (z > ANOMALY_Z_THRESHOLD) {
      alerts.push({
        alert_id: `ANM-${loc.location_id}-${toTaipeiDateKey(NOW)}`,
        location_id: loc.location_id,
        location_name: loc.name,
        type: 'spike',
        triggered_at: toTaipeiIso(DEMO_NOW),
        metric_value: today,
        baseline_value: med,
        z_score: z,
        threshold: ANOMALY_Z_THRESHOLD,
        baseline_days: baseline.length,
        status: 'open',
      });
    }
  }

  return alerts.sort((a, b) => b.z_score - a.z_score);
}

const LEVELS: RiskLevel[] = ['low', 'medium', 'high'];

function assessRisk(
  eventsPer100h: number,
  events: number,
  trendChange: number | null,
  hasAnomaly: boolean,
): RiskAssessment {
  const baseIdx =
    eventsPer100h >= RISK_THRESHOLDS.high ? 2 : eventsPer100h >= RISK_THRESHOLDS.medium ? 1 : 0;
  // Small samples swing wildly in percentage terms; only escalate on enough events.
  const trendEscalated =
    trendChange !== null &&
    trendChange >= RISK_THRESHOLDS.trend_up &&
    events >= RISK_THRESHOLDS.trend_min_events;
  const idx = Math.min(2, baseIdx + (trendEscalated ? 1 : 0) + (hasAnomaly ? 1 : 0));
  return {
    level: LEVELS[idx],
    base_level: LEVELS[baseIdx],
    events_per_100h: eventsPer100h,
    trend_change_percentage: trendChange,
    trend_escalated: trendEscalated,
    anomaly_escalated: hasAnomaly,
    thresholds: { ...RISK_THRESHOLDS },
  };
}

/** Rolling N×24h window vs the preceding equal window, per location. */
function locationActivity(days: number, anomalies: AnomalyAlert[]) {
  const end = NOW;
  const start = end - days * DAY_MS;
  const prevStart = start - days * DAY_MS;

  return LOCATIONS.map((loc) => {
    const deviceIds = deviceIdsFor(loc.location_id);
    const events = countedIn(start, end, deviceIds);
    const hours = monitoringHours(start, end, deviceIds);
    const rate = per100h(events.length, hours);
    const prevRate = per100h(
      countedIn(prevStart, start, deviceIds).length,
      monitoringHours(prevStart, start, deviceIds),
    );
    const trend = pctChange(rate, prevRate);
    return {
      loc,
      events,
      hours: round1(hours),
      rate,
      trend,
      risk: assessRisk(rate, events.length, trend, anomalies.some((a) => a.location_id === loc.location_id)),
    };
  });
}

function fleetSummary(devices: DeviceHealth[]): DeviceFleetSummary {
  const connected = devices.filter((d) => d.status !== 'offline' && !d.heartbeat_stale).length;
  const effective = devices.filter((d) => d.effective_monitoring).length;
  return {
    total: devices.length,
    connected,
    effective,
    camera_issues: devices.filter((d) => d.camera_health !== 'normal').length,
    stale: devices.filter((d) => d.heartbeat_stale).length,
    effective_rate: devices.length ? Math.round((effective / devices.length) * 100) : 0,
    avg_upload_success_rate: devices.length
      ? round1(devices.reduce((sum, d) => sum + d.upload_success_rate, 0) / devices.length)
      : 0,
    heartbeat_timeout_min: HEARTBEAT_TIMEOUT_MIN,
  };
}

function deviceHealth(): DeviceHealth[] {
  return DEVICES.map((d) => {
    const stale = NOW - ts(d.last_seen) > HEARTBEAT_TIMEOUT_MIN * 60 * 1000;
    return {
      ...d,
      heartbeat_stale: stale,
      effective_monitoring: d.status === 'online' && !stale && d.camera_health === 'normal',
      monitoring_hours_7d: round1(monitoringHours(NOW - 7 * DAY_MS, NOW, [d.device_id])),
    };
  });
}

function dailySeries(filters: ActivityFilters | undefined): DailyActivity[] {
  const win = resolveWindow(filters);
  const deviceIds = deviceIdsFor(filters?.location_id);
  const dayCount = (key: string) => {
    const start = dateKeyToMidnight(key);
    return countedIn(start, Math.min(start + DAY_MS, NOW), deviceIds).length;
  };

  return win.dayKeys.map((date) => {
    const start = dateKeyToMidnight(date);
    const end = Math.min(start + DAY_MS, NOW);
    const events = dayCount(date);
    const hours = monitoringHours(start, end, deviceIds);

    let ma7: number | null = null;
    if (start - 6 * DAY_MS >= MOCK_RANGE_START) {
      let sum = 0;
      for (let i = 0; i < 7; i++) sum += dayCount(toTaipeiDateKey(start - i * DAY_MS));
      ma7 = round1(sum / 7);
    }

    return {
      date,
      events,
      ma7,
      monitoring_hours: round1(hours),
      events_per_100h: hours >= 1 ? per100h(events, hours) : null,
    };
  });
}

function enrichEvent(event: DetectionEvent): DetectionEvent {
  if (event.bounding_boxes?.length) return event;
  return {
    ...event,
    bounding_boxes: boxesForEvent(
      event.event_id,
      event.max_simultaneous_count,
      event.mean_confidence,
    ),
  };
}

/* ——————————————————— public API ——————————————————— */

/** GET /api/v1/meta — methodology disclosure shown on every page. */
export async function getMetricMeta(): Promise<MetricMeta> {
  const recent = DETECTION_EVENTS.filter(
    (e) => e.is_independent && ts(e.event_start) >= NOW - 30 * DAY_MS,
  );
  const reviewed = recent.filter((e) => e.review_status !== 'pending').length;
  return delay({
    data_updated_at: toTaipeiIso(DEMO_NOW),
    independence_interval_sec: INDEPENDENCE_INTERVAL_SEC,
    model_version: MODEL_VERSION,
    review_rate: recent.length ? Math.round((reviewed / recent.length) * 100) : 0,
    false_positive_count: recent.filter((e) => e.review_status === 'false_positive').length,
    heartbeat_timeout_min: HEARTBEAT_TIMEOUT_MIN,
  }, 60);
}

/** GET /api/v1/dashboard/summary */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const all = deviceIdsFor();
  const lastStart = NOW - 7 * DAY_MS;
  const prevStart = NOW - 14 * DAY_MS;

  const lastEvents = countedIn(lastStart, NOW, all);
  const prevEvents = countedIn(prevStart, lastStart, all);
  const lastHours = monitoringHours(lastStart, NOW, all);
  const prevHours = monitoringHours(prevStart, lastStart, all);

  const lastAvg = round1(lastEvents.length / 7);
  const prevAvg = round1(prevEvents.length / 7);
  const change = pctChange(lastEvents.length, prevEvents.length);

  const sparkline = dailySeries({ days: 14 }).map((d) => d.ma7 ?? d.events);
  const anomalies = detectAnomalies();

  return delay({
    events_per_100h: {
      value: per100h(lastEvents.length, lastHours),
      previous: per100h(prevEvents.length, prevHours),
      events: lastEvents.length,
      monitoring_hours: round1(lastHours),
    },
    trend: {
      last7_daily_avg: lastAvg,
      prev7_daily_avg: prevAvg,
      change_percentage: change,
      direction: change === null || Math.abs(change) < 10 ? 'flat' : change > 0 ? 'up' : 'down',
      today_events: countedIn(taipeiMidnight(0), NOW, all).length,
      sparkline,
    },
    anomalies: { open: anomalies.length, top: anomalies[0] ?? null },
    devices: fleetSummary(deviceHealth()),
  });
}

/** GET /api/v1/dashboard/rodent-absence — FEHD-style RAR over the last N nights. */
export async function getRodentAbsenceRate(filters?: ActivityFilters): Promise<RodentAbsenceRate> {
  return delay(rodentAbsence(deviceIdsFor(filters?.location_id), filters?.days ?? 7));
}

/** GET /api/v1/dashboard/hourly — average events per day for each hour. */
export async function getHourlyActivity(filters?: ActivityFilters): Promise<HourlyActivity[]> {
  const win = resolveWindow(filters);
  const events = countedIn(win.start, win.end, deviceIdsFor(filters?.location_id));
  const counts = new Array(24).fill(0);
  for (const e of events) counts[getHourInTaipei(ts(e.event_start))] += 1;
  const days = Math.max(1, win.dayKeys.length);
  return delay(counts.map((n, hour) => ({ hour, events: n, avg_per_day: round2(n / days) })));
}

/** GET /api/v1/dashboard/daily */
export async function getDailyActivity(filters?: ActivityFilters): Promise<DailyActivity[]> {
  return delay(dailySeries(filters));
}

/** GET /api/v1/locations/ranking — standardized cross-site comparison. */
export async function getLocationActivity(filters?: ActivityFilters): Promise<LocationActivity[]> {
  const rows = locationActivity(filters?.days ?? 7, detectAnomalies());
  return delay(
    rows
      .map((r) => ({
        location_id: r.loc.location_id,
        location_name: r.loc.name,
        events: r.events.length,
        monitoring_hours: r.hours,
        events_per_100_hours: r.rate,
        risk: r.risk,
      }))
      .sort((a, b) => b.events_per_100_hours - a.events_per_100_hours),
  );
}

/** Weekday × hour heatmap, averaged per weekday occurrence. */
export async function getHeatmap(filters?: ActivityFilters): Promise<HeatmapCell[]> {
  const win = resolveWindow(filters);
  const events = countedIn(win.start, win.end, deviceIdsFor(filters?.location_id));

  const samples = new Array(7).fill(0);
  for (const key of win.dayKeys) samples[getWeekdayMon0(dateKeyToMidnight(key))] += 1;

  const grid: Record<string, number> = {};
  for (const e of events) {
    const t = ts(e.event_start);
    const key = `${getWeekdayMon0(t)}-${getHourInTaipei(t)}`;
    grid[key] = (grid[key] ?? 0) + 1;
  }

  const cells: HeatmapCell[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      const n = grid[`${weekday}-${hour}`] ?? 0;
      cells.push({
        weekday,
        hour,
        events: n,
        samples: samples[weekday],
        avg_events: samples[weekday] ? round2(n / samples[weekday]) : 0,
      });
    }
  }
  return delay(cells);
}

const DURATION_BUCKETS: { label: string; max: number }[] = [
  { label: '< 10 秒', max: 10 },
  { label: '10–30 秒', max: 30 },
  { label: '30 秒–2 分', max: 120 },
  { label: '2–5 分', max: 300 },
  { label: '≥ 5 分', max: Infinity },
];

/** Nocturnal share and event-duration distribution. */
export async function getActivityProfile(filters?: ActivityFilters): Promise<ActivityProfile> {
  const win = resolveWindow(filters);
  const events = countedIn(win.start, win.end, deviceIdsFor(filters?.location_id));
  const nocturnal = events.filter((e) => {
    const h = getHourInTaipei(ts(e.event_start));
    return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
  }).length;

  const buckets = DURATION_BUCKETS.map((b) => ({ label: b.label, events: 0 }));
  for (const e of events) {
    const idx = DURATION_BUCKETS.findIndex((b) => e.duration_sec < b.max);
    buckets[idx].events += 1;
  }

  return delay({
    total_events: events.length,
    nocturnal_events: nocturnal,
    nocturnal_share: events.length ? round1((nocturnal / events.length) * 100) : 0,
    duration_buckets: buckets,
    median_duration_sec: events.length ? median(events.map((e) => e.duration_sec)) : null,
  });
}

/** GET /api/v1/events — every recorded event, including merged and rejected ones. */
export async function getDetectionEvents(filters?: EventFilters): Promise<DetectionEvent[]> {
  let events = DETECTION_EVENTS.filter((e) => e.rat_detected);
  if (filters?.location_id && filters.location_id !== 'all') {
    events = events.filter((e) => e.location_id === filters.location_id);
  }
  if (filters?.start_date) {
    const start = dateKeyToMidnight(filters.start_date);
    events = events.filter((e) => ts(e.event_start) >= start);
  }
  if (filters?.end_date) {
    const end = dateKeyToMidnight(filters.end_date) + DAY_MS;
    events = events.filter((e) => ts(e.event_start) < end);
  }
  if (filters?.review_status) {
    events = events.filter((e) => e.review_status === filters.review_status);
  }
  if (filters?.min_confidence !== undefined) {
    events = events.filter((e) => e.mean_confidence >= filters.min_confidence!);
  }
  if (filters?.limit) events = events.slice(0, filters.limit);
  return delay(events.map(enrichEvent));
}

/**
 * PATCH /api/v1/events/:id/review — record a human review decision.
 * Passing 'pending' clears a previous decision. Mock: mutates in-memory data.
 */
export async function submitEventReview(
  eventId: string,
  decision: ReviewDecision | 'pending',
  reviewer: string,
): Promise<DetectionEvent> {
  const event = DETECTION_EVENTS.find((e) => e.event_id === eventId);
  if (!event) throw new Error(`找不到事件 ${eventId}`);
  event.review_status = decision;
  event.reviewed_by = decision === 'pending' ? null : reviewer;
  event.reviewed_at = decision === 'pending' ? null : toTaipeiIso(new Date());
  return delay(enrichEvent({ ...event }), 150);
}

/** GET /api/v1/anomalies */
export async function getAnomalyAlerts(): Promise<AnomalyAlert[]> {
  return delay(detectAnomalies());
}

function streamStatusFor(device: DeviceHealth): StreamStatus {
  if (device.status === 'offline') return 'offline';
  if (device.status === 'warning' || device.heartbeat_stale || device.camera_health !== 'normal') {
    return 'degraded';
  }
  return 'live';
}

/** Advances each poll so mock snapshots appear to change over time. */
let snapshotPollTick = 0;

/** GET /api/v1/cameras/snapshots — simulated live frames (poll to refresh). */
export async function getCameraSnapshots(): Promise<CameraSnapshot[]> {
  snapshotPollTick += 1;
  const tick = snapshotPollTick;

  const snapshots = deviceHealth().map((device, index) => {
    const deviceEvents = countedEvents().filter((e) => e.device_id === device.device_id);
    const stream_status = streamStatusFor(device);

    // Degraded/offline: stale last frame; online: cycle recent frames + idle
    const cycleLen = Math.min(5, Math.max(1, deviceEvents.length));
    const showIdle = stream_status === 'live' && (tick + index) % 4 === 0;

    const base = {
      device_id: device.device_id,
      location_id: device.location_id,
      stream_status,
      device_status: device.status,
      camera_health: device.camera_health,
    };

    if (showIdle || deviceEvents.length === 0) {
      const ageSec = 8 + ((tick + index * 3) % 20);
      return {
        ...base,
        captured_at: toTaipeiIso(new Date(NOW - ageSec * 1000)),
        image_url: '/mock/rat-idle.svg',
        bounding_boxes: [],
        activity_detected: false,
      } satisfies CameraSnapshot;
    }

    const event = enrichEvent(deviceEvents[(tick + index) % cycleLen]);
    const ageSec =
      stream_status === 'live' ? 2 + ((tick + index) % 12) : 60 * 30 + ((tick + index) % 120);

    return {
      ...base,
      captured_at: toTaipeiIso(new Date(NOW - ageSec * 1000)),
      image_url: event.image_url,
      bounding_boxes: event.bounding_boxes ?? [],
      linked_event_id: event.event_id,
      activity_detected: true,
    } satisfies CameraSnapshot;
  });

  return delay(snapshots, 80);
}

const CAMERA_HEALTH_LABEL: Record<string, string> = {
  occluded: '鏡頭遮蔽',
  blurred: '畫面模糊',
  foggy: '鏡頭起霧',
};

/** GET /api/v1/dashboard/alerts */
export async function getOpsAlerts(): Promise<OpsAlert[]> {
  const alerts: OpsAlert[] = [];

  for (const a of detectAnomalies()) {
    alerts.push({
      id: a.alert_id,
      kind: 'spike',
      severity: a.z_score >= 6 ? 'critical' : 'warning',
      title: `${a.location_name} · 活動異常增加`,
      detail: `今日截至目前 ${a.metric_value} 次事件 · 基線中位數 ${a.baseline_value} · z = ${a.z_score}（門檻 ${a.threshold}）`,
      href: `/analysis?location=${a.location_id}`,
    });
  }

  for (const d of deviceHealth()) {
    const location = LOCATION_MAP[d.location_id]?.name ?? d.location_id;
    if (d.heartbeat_stale || d.status === 'offline') {
      alerts.push({
        id: `device-${d.device_id}`,
        kind: 'device_offline',
        severity: 'critical',
        title: `${d.device_id} · 失聯`,
        detail: `${location} · 超過 ${HEARTBEAT_TIMEOUT_MIN} 分鐘未回報 · 電量 ${d.battery}% · 期間資料有缺口`,
        href: '/devices',
      });
    }
    if (d.camera_health !== 'normal') {
      alerts.push({
        id: `tamper-${d.device_id}`,
        kind: 'tamper',
        severity: 'warning',
        title: `${d.device_id} · ${CAMERA_HEALTH_LABEL[d.camera_health]}`,
        detail: `${location} · 設備在線但看不見，此期間不計入監測時數`,
        href: '/devices',
      });
    }
  }

  const meta = await getMetricMeta();
  const pending = DETECTION_EVENTS.filter(
    (e) =>
      e.is_independent && e.review_status === 'pending' && ts(e.event_start) >= NOW - 30 * DAY_MS,
  ).length;
  if (pending > 0) {
    alerts.push({
      id: 'pending-review',
      kind: 'review',
      severity: meta.review_rate < 60 ? 'warning' : 'info',
      title: `人工複核率 ${meta.review_rate}%`,
      detail: `近 30 日 · 待複核 ${pending} 筆`,
      href: '/events?review=pending',
    });
  }

  const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  return delay(alerts.sort((a, b) => rank[a.severity] - rank[b.severity]), 60);
}

/** GET /api/v1/devices */
export async function getDevices(): Promise<DeviceHealth[]> {
  return delay(deviceHealth());
}

/** GET /api/v1/devices/summary */
export async function getDeviceFleetSummary(): Promise<DeviceFleetSummary> {
  return delay(fleetSummary(deviceHealth()));
}

/**
 * Prototype notification flow.  A production version should invoke a protected
 * backend endpoint, which in turn talks to the email provider.
 */
export async function simulateDeadRatNotification(
  locationId: string,
): Promise<DeadRatNotification> {
  const location = LOCATION_MAP[locationId] ?? LOCATIONS[0];
  const device = DEVICES.find((item) => item.location_id === location.location_id) ?? DEVICES[0];
  const detectedAt = new Date().toISOString();
  const body = `辨識到死老鼠\n時間：${new Intl.DateTimeFormat('zh-TW', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(detectedAt))}\n地點：${location.name}（${location.address}）`;

  return delay(
    {
      notification_id: `MAIL-${Date.now()}`,
      location_id: location.location_id,
      device_id: device.device_id,
      detected_at: detectedAt,
      recipient: 'ops@example.tw',
      subject: `[緊急通報] 辨識到死老鼠｜${location.name}`,
      body,
      delivery_status: 'sent',
    },
    700,
  );
}

/** GET /api/v1/locations — 7-day rolling stats per site. */
export async function getLocations(): Promise<LocationStats[]> {
  const rows = locationActivity(7, detectAnomalies());
  const deviceCount = (id: string) => DEVICES.filter((d) => d.location_id === id).length;
  const latest = (id: string) =>
    countedEvents().find((e) => e.location_id === id)?.event_start ?? null;

  return delay(
    rows.map((r) => {
      const peak = peakHour(r.events);
      return {
        ...r.loc,
        device_count: deviceCount(r.loc.location_id),
        detection_event_count: r.events.length,
        monitoring_hours: r.hours,
        events_per_100_hours: r.rate,
        trend_change_percentage: r.trend,
        peak_hour: peak ? formatHourRange(peak.hour) : '—',
        latest_detection: latest(r.loc.location_id),
        risk: r.risk,
      };
    }),
  );
}

export function getLocationName(locationId: string): string {
  return LOCATION_MAP[locationId]?.name ?? locationId;
}
