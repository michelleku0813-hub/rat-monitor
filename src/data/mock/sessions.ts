import type { DowntimeReason, MonitoringSession } from '../../types';
import { toTaipeiIso } from '../../utils/format';
import { DEMO_NOW, DEVICES } from './devices';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Days of mock history, including today. */
export const MOCK_HISTORY_DAYS = 35;

const TODAY_MIDNIGHT = new Date(`${toTaipeiIso(DEMO_NOW).slice(0, 10)}T00:00:00+08:00`).getTime();

/** Taipei local midnight N days before DEMO_NOW's date (Taipei has no DST). */
export function taipeiMidnight(daysAgo: number): number {
  return TODAY_MIDNIGHT - daysAgo * DAY_MS;
}

export const MOCK_RANGE_START = taipeiMidnight(MOCK_HISTORY_DAYS - 1);

interface CoverageGap {
  device_id: string;
  start: number;
  end: number;
  reason: DowntimeReason;
}

/** Taipei wall-clock time on the day N days before DEMO_NOW. */
const at = (daysAgo: number, hour: number, minute = 0, second = 0) =>
  taipeiMidnight(daysAgo) + ((hour * 60 + minute) * 60 + second) * 1000;

/**
 * Periods where a device produced no trustworthy data: offline, camera tampered
 * (occluded / foggy) or battery exhausted. Events never occur inside a gap.
 */
export const COVERAGE_GAPS: CoverageGap[] = [
  { device_id: 'RAT-TPE-001', start: at(21, 2), end: at(21, 5), reason: 'offline' },
  { device_id: 'RAT-TPE-001', start: at(9, 10), end: at(9, 13, 30), reason: 'offline' },
  { device_id: 'RAT-TPE-002', start: at(6, 23), end: at(5, 4), reason: 'tamper' },
  { device_id: 'RAT-TPE-002', start: at(0, 15, 30), end: DEMO_NOW.getTime(), reason: 'tamper' },
  { device_id: 'RAT-TPE-003', start: at(3, 20), end: at(2, 8), reason: 'battery' },
  { device_id: 'RAT-TPE-003', start: at(0, 9, 14, 2), end: DEMO_NOW.getTime(), reason: 'battery' },
];

export function isInCoverageGap(deviceId: string, ts: number): boolean {
  return COVERAGE_GAPS.some((g) => g.device_id === deviceId && ts >= g.start && ts < g.end);
}

function buildSessions(): MonitoringSession[] {
  const sessions: MonitoringSession[] = [];
  const end = DEMO_NOW.getTime();

  for (const device of DEVICES) {
    const gaps = COVERAGE_GAPS.filter((g) => g.device_id === device.device_id).sort(
      (a, b) => a.start - b.start,
    );
    let cursor = MOCK_RANGE_START;
    let seq = 1;

    const push = (start: number, stop: number, reason: DowntimeReason | null) => {
      if (stop <= start) return;
      sessions.push({
        session_id: `SES-${device.device_id.slice(-3)}-${String(seq++).padStart(3, '0')}`,
        device_id: device.device_id,
        start_at: toTaipeiIso(new Date(start)),
        end_at: toTaipeiIso(new Date(stop)),
        effective_seconds: Math.round((stop - start) / 1000),
        downtime_reason: reason,
      });
    };

    for (const gap of gaps) {
      push(cursor, gap.start, gap.reason);
      cursor = Math.max(cursor, gap.end);
    }
    push(cursor, end, null);
  }

  return sessions;
}

export const MONITORING_SESSIONS: MonitoringSession[] = buildSessions();
