import type { DetectionEvent, ReviewStatus } from '../../types';
import { DEMO_NOW } from './devices';

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

const LOCATION_DEVICES: { location_id: string; device_id: string; weight: number }[] = [
  { location_id: 'LOC-001', device_id: 'RAT-TPE-001', weight: 5 },
  { location_id: 'LOC-002', device_id: 'RAT-TPE-002', weight: 3.2 },
  { location_id: 'LOC-003', device_id: 'RAT-TPE-003', weight: 1.5 },
];

const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'confirmed', 'reviewed', 'false_positive'];
const REVIEW_WEIGHTS = [0.45, 0.3, 0.18, 0.07];

function formatTaipei(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
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

function buildEvents(): DetectionEvent[] {
  const events: DetectionEvent[] = [];
  const end = new Date(DEMO_NOW);
  end.setHours(17, 55, 0, 0);

  // ~7 days of activity; target >= 100 events with night peak & location skew
  const dayMultipliers = [0.85, 1.05, 0.95, 1.15, 0.9, 1.2, 1.0]; // slight daily variation

  let seq = 1;

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const dayBase = new Date(end);
    dayBase.setDate(dayBase.getDate() - dayOffset);
    dayBase.setHours(0, 0, 0, 0);

    const dayMult = dayMultipliers[6 - dayOffset];
    // Base events per day ~16–22 before hour/location filtering via sampling
    const targetForDay = Math.round(18 * dayMult + (rand() - 0.5) * 4);

    for (let i = 0; i < targetForDay; i++) {
      // Sample hour by weight
      const hours = Array.from({ length: 24 }, (_, h) => h);
      const weights = hours.map(hourWeight);
      const hour = pickWeighted(hours, weights);

      // Skip future hours for "today"
      if (dayOffset === 0 && hour > end.getHours()) continue;

      const minute = Math.floor(rand() * 60);
      const second = Math.floor(rand() * 60);
      const captured = new Date(dayBase);
      captured.setHours(hour, minute, second, 0);

      const loc = pickWeighted(
        LOCATION_DEVICES,
        LOCATION_DEVICES.map((l) => l.weight),
      );

      const confidence = Math.round((0.72 + rand() * 0.26) * 100) / 100;
      const detectedCount = rand() < 0.82 ? 1 : rand() < 0.7 ? 2 : 3;
      const imgIdx = (seq % 3) + 1;
      const dateStr = formatTaipei(captured).slice(0, 10).replace(/-/g, '');

      events.push({
        event_id: `EVT-${dateStr}-${String(seq).padStart(3, '0')}`,
        device_id: loc.device_id,
        location_id: loc.location_id,
        captured_at: formatTaipei(captured),
        rat_detected: true,
        detected_count: detectedCount,
        confidence,
        image_url: `/mock/rat-00${imgIdx}.svg`,
        model_version: 'yolo-tiny-v0.1',
        review_status: pickWeighted(REVIEW_STATUSES, REVIEW_WEIGHTS),
      });
      seq += 1;
    }
  }

  // Ensure we have at least 100 events
  while (events.length < 100) {
    const dayOffset = Math.floor(rand() * 7);
    const dayBase = new Date(end);
    dayBase.setDate(dayBase.getDate() - dayOffset);
    const hour = pickWeighted(
      Array.from({ length: 24 }, (_, h) => h),
      Array.from({ length: 24 }, (_, h) => hourWeight(h)),
    );
    dayBase.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
    const loc = pickWeighted(
      LOCATION_DEVICES,
      LOCATION_DEVICES.map((l) => l.weight),
    );
    const dateStr = formatTaipei(dayBase).slice(0, 10).replace(/-/g, '');
    events.push({
      event_id: `EVT-${dateStr}-${String(seq).padStart(3, '0')}`,
      device_id: loc.device_id,
      location_id: loc.location_id,
      captured_at: formatTaipei(dayBase),
      rat_detected: true,
      detected_count: 1,
      confidence: 0.88,
      image_url: `/mock/rat-001.svg`,
      model_version: 'yolo-tiny-v0.1',
      review_status: 'pending',
    });
    seq += 1;
  }

  return events.sort(
    (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime(),
  );
}

export const DETECTION_EVENTS: DetectionEvent[] = buildEvents();
