import type { Device } from '../../types';
import { toTaipeiIso } from '../../utils/format';

/**
 * Reference "now" for demo data consistency (Asia/Taipei).
 * All mock timestamps are derived from this value — change it here only.
 */
export const DEMO_NOW = new Date('2026-09-17T18:00:00+08:00');

/** ISO timestamp a given number of seconds before DEMO_NOW. */
const secondsAgo = (sec: number) => toTaipeiIso(new Date(DEMO_NOW.getTime() - sec * 1000));

export const DEVICES: Device[] = [
  {
    device_id: 'RAT-TPE-001',
    location_id: 'LOC-001',
    status: 'online',
    camera_health: 'normal',
    battery: 87,
    power_mode: '市電＋備援電池',
    voltage: 12.1,
    power_watts: 5.8,
    memory_used_mb: 1140,
    memory_total_mb: 2048,
    cpu_usage: 34,
    temperature_c: 42,
    network: '4G',
    signal_strength: -68,
    last_seen: secondsAgo(7 * 60 + 49),
    upload_success_rate: 99.4,
    firmware_version: '1.2.0',
    ai_model_version: 'yolo-tiny-v0.1',
  },
  {
    device_id: 'RAT-TPE-002',
    location_id: 'LOC-002',
    status: 'online',
    camera_health: 'foggy',
    battery: 64,
    power_mode: '市電＋備援電池',
    voltage: 12.0,
    power_watts: 5.1,
    memory_used_mb: 1468,
    memory_total_mb: 2048,
    cpu_usage: 47,
    temperature_c: 45,
    network: 'Wi-Fi',
    signal_strength: -55,
    last_seen: secondsAgo(11 * 60 + 27),
    upload_success_rate: 97.8,
    firmware_version: '1.2.0',
    ai_model_version: 'yolo-tiny-v0.1',
  },
  {
    device_id: 'RAT-TPE-003',
    location_id: 'LOC-003',
    status: 'warning',
    camera_health: 'normal',
    battery: 18,
    power_mode: '備援電池供電',
    voltage: 10.7,
    power_watts: 4.6,
    memory_used_mb: 1832,
    memory_total_mb: 2048,
    cpu_usage: 71,
    temperature_c: 58,
    network: 'LoRa',
    signal_strength: -102,
    last_seen: secondsAgo(8 * 3600 + 45 * 60 + 58), // 09:14:02 today
    upload_success_rate: 81.2,
    firmware_version: '1.1.4',
    ai_model_version: 'yolo-tiny-v0.1',
  },
];
