import type { Device } from '../../types';

/** Reference "now" for demo data consistency (Asia/Taipei). */
export const DEMO_NOW = new Date('2026-08-12T18:00:00+08:00');

export const DEVICES: Device[] = [
  {
    device_id: 'RAT-TPE-001',
    location_id: 'LOC-001',
    status: 'online',
    battery: 87,
    network: '4G',
    signal_strength: -68,
    last_seen: '2026-08-12T17:52:11+08:00',
    firmware_version: '1.2.0',
    ai_model_version: 'yolo-tiny-v0.1',
  },
  {
    device_id: 'RAT-TPE-002',
    location_id: 'LOC-002',
    status: 'online',
    battery: 64,
    network: 'Wi-Fi',
    signal_strength: -55,
    last_seen: '2026-08-12T17:48:33+08:00',
    firmware_version: '1.2.0',
    ai_model_version: 'yolo-tiny-v0.1',
  },
  {
    device_id: 'RAT-TPE-003',
    location_id: 'LOC-003',
    status: 'warning',
    battery: 18,
    network: 'LoRa',
    signal_strength: -102,
    last_seen: '2026-08-12T09:14:02+08:00',
    firmware_version: '1.1.4',
    ai_model_version: 'yolo-tiny-v0.1',
  },
];

export const DEVICE_MAP = Object.fromEntries(
  DEVICES.map((d) => [d.device_id, d]),
) as Record<string, Device>;
