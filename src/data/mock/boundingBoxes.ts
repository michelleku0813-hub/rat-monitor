import type { BoundingBox } from '../../types';

/** Deterministic mock boxes from an event id + detected count. */
export function boxesForEvent(
  eventId: string,
  detectedCount: number,
  confidence: number,
): BoundingBox[] {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    hash = (hash * 31 + eventId.charCodeAt(i)) >>> 0;
  }

  const boxes: BoundingBox[] = [];
  const count = Math.max(1, Math.min(detectedCount, 3));

  for (let i = 0; i < count; i++) {
    const seed = (hash + i * 9973) % 1000;
    const x = 0.12 + ((seed % 50) / 100) * 0.45;
    const y = 0.2 + (((seed * 7) % 40) / 100) * 0.35;
    const w = 0.16 + ((seed % 20) / 100) * 0.12;
    const h = 0.14 + (((seed * 3) % 18) / 100) * 0.1;
    const conf = Math.max(0.7, Math.min(0.99, confidence - i * 0.04));
    boxes.push({
      x: Math.min(x, 0.78),
      y: Math.min(y, 0.72),
      w,
      h,
      label: 'rat',
      confidence: Math.round(conf * 100) / 100,
    });
  }

  return boxes;
}
