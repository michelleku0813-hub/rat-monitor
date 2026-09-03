import type {
  ActivityFilters,
  CameraSnapshot,
  DailyActivity,
  DashboardSummary,
  DeadRatNotification,
  DetectionEvent,
  Device,
  EventFilters,
  HeatmapCell,
  HourlyActivity,
  LocationActivity,
  LocationStats,
  OpsAlert,
  StreamStatus,
} from '../types';
import { DETECTION_EVENTS } from '../data/mock/events';
import { DEVICES } from '../data/mock/devices';
import { LOCATIONS, LOCATION_MAP } from '../data/mock/locations';
import { DEMO_NOW } from '../data/mock/devices';
import { boxesForEvent } from '../data/mock/boundingBoxes';

/**
 * Data Service Layer
 *
 * Current: Mock Data → Data Service → UI
 * Future:  REST API → Data Service → UI
 *
 * UI components should only consume this module so the data source
 * can be swapped without rewriting pages.
 */

const TZ = 'Asia/Taipei';

function toTaipeiDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function getHourInTaipei(iso: string): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    hour12: false,
  }).format(new Date(iso));
  return Number(hourStr) % 24;
}

function getWeekdayMon0(iso: string): number {
  // 0=Mon … 6=Sun
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(new Date(iso));
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[wd] ?? 0;
}

function formatHourRange(hour: number): string {
  const next = (hour + 1) % 24;
  return `${String(hour).padStart(2, '0')}:00–${String(next).padStart(2, '0')}:00`;
}

function todayKey(): string {
  return toTaipeiDateKey(DEMO_NOW.toISOString());
}

function yesterdayKey(): string {
  const d = new Date(DEMO_NOW);
  d.setDate(d.getDate() - 1);
  return toTaipeiDateKey(d.toISOString());
}

function dateKeysLastNDays(n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(DEMO_NOW);
    d.setDate(d.getDate() - i);
    keys.push(toTaipeiDateKey(d.toISOString()));
  }
  return keys;
}

function filterEvents(events: DetectionEvent[], filters?: EventFilters | ActivityFilters): DetectionEvent[] {
  let result = events.filter((e) => e.rat_detected);

  if (filters?.location_id && filters.location_id !== 'all') {
    result = result.filter((e) => e.location_id === filters.location_id);
  }

  if (filters?.start_date) {
    result = result.filter((e) => toTaipeiDateKey(e.captured_at) >= filters.start_date!);
  }

  if (filters?.end_date) {
    result = result.filter((e) => toTaipeiDateKey(e.captured_at) <= filters.end_date!);
  }

  return result;
}

function peakHourLabel(events: DetectionEvent[]): string {
  if (events.length === 0) return '—';
  const counts = new Array(24).fill(0);
  for (const e of events) {
    counts[getHourInTaipei(e.captured_at)] += 1;
  }
  let maxH = 0;
  for (let h = 1; h < 24; h++) {
    if (counts[h] > counts[maxH]) maxH = h;
  }
  return formatHourRange(maxH);
}

function delay<T>(data: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

function enrichEvent(event: DetectionEvent): DetectionEvent {
  if (event.bounding_boxes?.length) return event;
  return {
    ...event,
    bounding_boxes: boxesForEvent(event.event_id, event.detected_count, event.confidence),
  };
}

function streamStatusForDevice(status: Device['status']): StreamStatus {
  if (status === 'online') return 'live';
  if (status === 'warning') return 'degraded';
  return 'offline';
}

/** Advances each poll so mock snapshots appear to change over time. */
let snapshotPollTick = 0;

function formatTaipeiOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+08:00`;
}

/** GET /api/v1/dashboard/summary */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const today = todayKey();
  const yesterday = yesterdayKey();
  const all = DETECTION_EVENTS.filter((e) => e.rat_detected);

  const todayEvents = all.filter((e) => toTaipeiDateKey(e.captured_at) === today);
  const yesterdayEvents = all.filter((e) => toTaipeiDateKey(e.captured_at) === yesterday);

  const todayCount = todayEvents.length;
  const yesterdayCount = yesterdayEvents.length;
  const change =
    yesterdayCount === 0
      ? todayCount > 0
        ? 100
        : 0
      : Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 1000) / 10;

  // Highest activity location over selected period (prototype: last 7 days raw event count)
  const last7 = dateKeysLastNDays(7);
  const recent = all.filter((e) => last7.includes(toTaipeiDateKey(e.captured_at)));
  const byLoc: Record<string, number> = {};
  for (const e of recent) {
    byLoc[e.location_id] = (byLoc[e.location_id] ?? 0) + 1;
  }
  let topLocId = LOCATIONS[0].location_id;
  let topCount = -1;
  for (const loc of LOCATIONS) {
    const c = byLoc[loc.location_id] ?? 0;
    if (c > topCount) {
      topCount = c;
      topLocId = loc.location_id;
    }
  }

  const online = DEVICES.filter((d) => d.status === 'online').length;
  const latest = all[0]?.captured_at ?? null;

  return delay({
    today_events: todayCount,
    yesterday_events: yesterdayCount,
    change_percentage: change,
    peak_hour: peakHourLabel(todayEvents),
    highest_activity_location: LOCATION_MAP[topLocId]?.name ?? topLocId,
    online_devices: online,
    total_devices: DEVICES.length,
    latest_detection: latest,
  });
}

/** GET /api/v1/dashboard/hourly */
export async function getHourlyActivity(filters?: ActivityFilters): Promise<HourlyActivity[]> {
  const today = todayKey();
  const events = filterEvents(DETECTION_EVENTS, {
    ...filters,
    start_date: filters?.start_date ?? today,
    end_date: filters?.end_date ?? today,
  });

  const counts = new Array(24).fill(0);
  for (const e of events) {
    counts[getHourInTaipei(e.captured_at)] += 1;
  }

  return delay(counts.map((events, hour) => ({ hour, events })));
}

/** GET /api/v1/dashboard/daily */
export async function getDailyActivity(filters?: ActivityFilters): Promise<DailyActivity[]> {
  const days = filters?.days ?? 7;
  const keys = dateKeysLastNDays(days);
  const events = filterEvents(DETECTION_EVENTS, {
    ...filters,
    start_date: filters?.start_date ?? keys[0],
    end_date: filters?.end_date ?? keys[keys.length - 1],
  });

  const map: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const e of events) {
    const k = toTaipeiDateKey(e.captured_at);
    if (k in map) map[k] += 1;
  }

  return delay(keys.map((date) => ({ date, events: map[date] ?? 0 })));
}

/** Location comparison for Overview chart */
export async function getLocationActivity(filters?: ActivityFilters): Promise<LocationActivity[]> {
  const days = filters?.days ?? 7;
  const keys = dateKeysLastNDays(days);
  const events = filterEvents(DETECTION_EVENTS, {
    start_date: keys[0],
    end_date: keys[keys.length - 1],
  });

  return delay(
    LOCATIONS.map((loc) => {
      const count = events.filter((e) => e.location_id === loc.location_id).length;
      const hours = loc.monitoring_hours;
      return {
        location_id: loc.location_id,
        location_name: loc.name,
        events: count,
        monitoring_hours: hours,
        events_per_100_hours: hours > 0 ? Math.round((count / hours) * 1000) / 10 : 0,
      };
    }),
  );
}

/** Weekday × hour heatmap */
export async function getHeatmap(filters?: ActivityFilters): Promise<HeatmapCell[]> {
  const days = filters?.days ?? 7;
  const keys = dateKeysLastNDays(days);
  const events = filterEvents(DETECTION_EVENTS, {
    ...filters,
    start_date: filters?.start_date ?? keys[0],
    end_date: filters?.end_date ?? keys[keys.length - 1],
  });

  const grid: Record<string, number> = {};
  for (const e of events) {
    const key = `${getWeekdayMon0(e.captured_at)}-${getHourInTaipei(e.captured_at)}`;
    grid[key] = (grid[key] ?? 0) + 1;
  }

  const cells: HeatmapCell[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({
        weekday,
        hour,
        events: grid[`${weekday}-${hour}`] ?? 0,
      });
    }
  }
  return delay(cells);
}

/** GET /api/v1/events */
export async function getDetectionEvents(filters?: EventFilters): Promise<DetectionEvent[]> {
  let events = filterEvents(DETECTION_EVENTS, filters).map(enrichEvent);
  if (filters?.limit) {
    events = events.slice(0, filters.limit);
  }
  return delay(events);
}

/** GET /api/v1/cameras/snapshots — simulated live frames (poll to refresh). */
export async function getCameraSnapshots(): Promise<CameraSnapshot[]> {
  snapshotPollTick += 1;
  const tick = snapshotPollTick;

  const snapshots = DEVICES.map((device, index) => {
    const deviceEvents = DETECTION_EVENTS.filter(
      (e) => e.device_id === device.device_id && e.rat_detected,
    );
    const stream_status = streamStatusForDevice(device.status);

    // Degraded/offline: stale last frame; online: cycle recent frames + idle
    const cycleLen = Math.min(5, Math.max(1, deviceEvents.length));
    const showIdle = stream_status === 'live' && (tick + index) % 4 === 0;

    if (showIdle || deviceEvents.length === 0) {
      const ageSec = 8 + ((tick + index * 3) % 20);
      const captured = new Date(DEMO_NOW.getTime() - ageSec * 1000);
      return {
        device_id: device.device_id,
        location_id: device.location_id,
        captured_at: formatTaipeiOffset(captured),
        image_url: '/mock/rat-idle.svg',
        stream_status,
        device_status: device.status,
        bounding_boxes: [],
        activity_detected: false,
      } satisfies CameraSnapshot;
    }

    const event = enrichEvent(deviceEvents[(tick + index) % cycleLen]);
    const ageSec =
      stream_status === 'live'
        ? 2 + ((tick + index) % 12)
        : 60 * 30 + ((tick + index) % 120); // warning looks stale
    const captured = new Date(DEMO_NOW.getTime() - ageSec * 1000);

    return {
      device_id: device.device_id,
      location_id: device.location_id,
      captured_at: formatTaipeiOffset(captured),
      image_url: event.image_url,
      stream_status,
      device_status: device.status,
      bounding_boxes: event.bounding_boxes ?? [],
      linked_event_id: event.event_id,
      activity_detected: true,
    } satisfies CameraSnapshot;
  });

  return delay(snapshots, 80);
}

/** GET /api/v1/dashboard/alerts */
export async function getOpsAlerts(): Promise<OpsAlert[]> {
  const summary = await getDashboardSummary();
  const pending = DETECTION_EVENTS.filter((e) => e.review_status === 'pending').length;
  const problemDevices = DEVICES.filter((d) => d.status !== 'online');

  const alerts: OpsAlert[] = [];

  if (pending > 0) {
    alerts.push({
      id: 'pending-review',
      severity: pending >= 20 ? 'warning' : 'info',
      title: `待審核事件 ${pending} 筆`,
      detail: 'Detection Events 待人工檢視',
      href: '/events?review=pending',
    });
  }

  for (const device of problemDevices) {
    alerts.push({
      id: `device-${device.device_id}`,
      severity: device.status === 'offline' ? 'critical' : 'warning',
      title: `${device.device_id} · ${device.status === 'offline' ? 'Offline' : 'Warning'}`,
      detail: `${LOCATION_MAP[device.location_id]?.name ?? device.location_id} · 電量 ${device.battery}%`,
      href: '/devices',
    });
  }

  if (summary.change_percentage >= 15) {
    alerts.push({
      id: 'activity-spike',
      severity: 'warning',
      title: `今日活動較昨日 ${summary.change_percentage > 0 ? '+' : ''}${summary.change_percentage}%`,
      detail: `今日 ${summary.today_events} 次事件 vs 昨日 ${summary.yesterday_events} 次`,
      href: '/analysis',
    });
  }

  return delay(alerts, 60);
}

/** GET /api/v1/devices */
export async function getDevices(): Promise<Device[]> {
  return delay([...DEVICES]);
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

export async function getLocations(): Promise<LocationStats[]> {
  const all = DETECTION_EVENTS.filter((e) => e.rat_detected);

  return delay(
    LOCATIONS.map((loc) => {
      const locEvents = all.filter((e) => e.location_id === loc.location_id);
      const deviceCount = DEVICES.filter((d) => d.location_id === loc.location_id).length;
      const hours = loc.monitoring_hours;
      return {
        ...loc,
        device_count: deviceCount,
        detection_event_count: locEvents.length,
        events_per_100_hours: hours > 0 ? Math.round((locEvents.length / hours) * 1000) / 10 : 0,
        peak_hour: peakHourLabel(locEvents),
        latest_detection: locEvents[0]?.captured_at ?? null,
      };
    }),
  );
}

export function getLocationName(locationId: string): string {
  return LOCATION_MAP[locationId]?.name ?? locationId;
}
