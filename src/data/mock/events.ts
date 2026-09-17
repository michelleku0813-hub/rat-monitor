import type { DetectionEvent, ReviewStatus } from '../../types';
import { toTaipeiIso } from '../../utils/format';
import { DEMO_NOW } from './devices';
import { MOCK_HISTORY_DAYS, isInCoverageGap, taipeiMidnight } from './sessions';

/** De-duplication silence interval T (seconds). Product default per the metrics study. */
export const INDEPENDENCE_INTERVAL_SEC = 180;
export const MODEL_VERSION = 'yolo-tiny-v0.1';

/**
 * Deterministic PRNG so mock data is stable across reloads.
 */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260812);

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Higher activity during 01:00–04:00. */
function hourWeight(hour: number): number {
  if (hour >= 1 && hour <= 4) return 4.5;
  if (hour === 0 || hour === 5) return 2.2;
  if (hour >= 22 || hour <= 6) return 1.4;
  if (hour >= 12 && hour <= 14) return 0.7;
  return 0.45;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HOUR_WEIGHTS = HOURS.map(hourWeight);

interface LocationProfile {
  location_id: string;
  device_id: string;
  /** Expected independent events per full day. */
  base: number;
  /** Scenario multiplier by days-ago and Taipei weekday (0 = Sun). */
  multiplier: (daysAgo: number, weekday: number) => number;
}

const PROFILES: LocationProfile[] = [
  {
    // Market A: baiting 10 days ago → activity drops.
    location_id: 'LOC-001',
    device_id: 'RAT-TPE-001',
    base: 9,
    multiplier: (daysAgo) => (daysAgo < 10 ? 0.55 : 1),
  },
  {
    // Night market B: busier Fri/Sat, rising this week, spike today.
    location_id: 'LOC-002',
    device_id: 'RAT-TPE-002',
    base: 5,
    multiplier: (daysAgo, weekday) => {
      const weekend = weekday === 5 || weekday === 6 ? 1.25 : 1;
      if (daysAgo === 0) return 3.2;
      return (daysAgo < 7 ? 1.35 : 1) * weekend;
    },
  },
  {
    location_id: 'LOC-003',
    device_id: 'RAT-TPE-003',
    base: 2.5,
    multiplier: () => 1,
  },
];

const REVIEWERS = ['ops-reviewer-01', 'ops-reviewer-02'];

function reviewStatusFor(daysAgo: number, confidence: number): ReviewStatus {
  const pendingWeight = daysAgo <= 2 ? 0.7 : daysAgo <= 7 ? 0.35 : 0.1;
  if (rand() < pendingWeight / (pendingWeight + 1)) return 'pending';
  if (confidence < 0.66 && rand() < 0.45) return 'false_positive';
  return rand() < 0.95 ? 'confirmed' : 'false_positive';
}

function sampleDurationSec(): number {
  const r = rand();
  if (r < 0.55) return 3 + Math.round(rand() * 27); // passing through
  if (r < 0.85) return 30 + Math.round(rand() * 90);
  return 120 + Math.round(rand() * 480); // lingering / foraging
}

function buildEvents(): DetectionEvent[] {
  const events: DetectionEvent[] = [];
  const now = DEMO_NOW.getTime();
  let seq = 1;
  let track = 1;

  const makeEvent = (
    profile: LocationProfile,
    start: number,
    daysAgo: number,
    isIndependent: boolean,
    trackingId: string,
  ): DetectionEvent | null => {
    const duration = sampleDurationSec();
    const end = start + duration * 1000;
    if (end > now || isInCoverageGap(profile.device_id, start)) return null;

    const confidence = Math.round((0.55 + rand() * 0.43) * 100) / 100;
    const startIso = toTaipeiIso(new Date(start));
    const reviewStatus = reviewStatusFor(daysAgo, confidence);
    const reviewedAt =
      reviewStatus === 'pending' ? null : Math.min(end + (2 + rand() * 18) * 3600_000, now);
    const event: DetectionEvent = {
      event_id: `EVT-${startIso.slice(0, 10).replace(/-/g, '')}-${String(seq).padStart(4, '0')}`,
      device_id: profile.device_id,
      location_id: profile.location_id,
      captured_at: startIso,
      event_start: startIso,
      event_end: toTaipeiIso(new Date(end)),
      duration_sec: duration,
      tracking_id: trackingId,
      rat_detected: true,
      is_independent: isIndependent,
      independence_interval_sec: INDEPENDENCE_INTERVAL_SEC,
      max_simultaneous_count: rand() < 0.82 ? 1 : rand() < 0.7 ? 2 : 3,
      mean_confidence: confidence,
      image_url: `/mock/rat-00${(seq % 3) + 1}.svg`,
      model_version: MODEL_VERSION,
      review_status: reviewStatus,
      reviewed_by: reviewedAt === null ? null : REVIEWERS[Math.floor(rand() * REVIEWERS.length)],
      reviewed_at: reviewedAt === null ? null : toTaipeiIso(new Date(reviewedAt)),
    };
    seq += 1;
    return event;
  };

  for (let daysAgo = MOCK_HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const midnight = taipeiMidnight(daysAgo);
    const weekday = new Date(midnight + 12 * 60 * 60 * 1000).getUTCDay();

    for (const profile of PROFILES) {
      const expected = profile.base * profile.multiplier(daysAgo, weekday);
      const count = Math.max(0, Math.round(expected * (0.75 + rand() * 0.5)));

      for (let i = 0; i < count; i++) {
        const hour = pickWeighted(HOURS, HOUR_WEIGHTS);
        const start = midnight + hour * 3600_000 + Math.floor(rand() * 3600) * 1000;
        const trackingId = `TRK-${profile.device_id.slice(-3)}-${String(track++).padStart(5, '0')}`;
        const event = makeEvent(profile, start, daysAgo, true, trackingId);
        if (!event) continue;
        events.push(event);

        // Same track re-entering within T: recorded, but merged (not independent).
        if (rand() < 0.07) {
          const gapSec = 20 + Math.floor(rand() * (INDEPENDENCE_INTERVAL_SEC - 30));
          const reentry = makeEvent(
            profile,
            new Date(event.event_end).getTime() + gapSec * 1000,
            daysAgo,
            false,
            trackingId,
          );
          if (reentry) events.push(reentry);
        }
      }
    }
  }

  return events.sort(
    (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime(),
  );
}

export const DETECTION_EVENTS: DetectionEvent[] = buildEvents();
