/** Display helpers — Taipei timezone for demo consistency */

const TZ = 'Asia/Taipei';

/** ISO string with explicit +08:00 offset, independent of the browser timezone. */
export function toTaipeiIso(date: Date): string {
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
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}+08:00`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Relative age for live monitor frames (vs DEMO_NOW when provided). */
export function formatFrameAge(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return '—';
  const sec = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Accept either ISO datetime or YYYY-MM-DD
  const d = iso.length <= 10 ? `${iso}T12:00:00+08:00` : iso;
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: TZ,
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(d));
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}%`;
}

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function locationTypeLabel(type: string): string {
  const map: Record<string, string> = {
    market: '市場',
    night_market: '夜市',
    alley: '巷道',
    other: '其他',
  };
  return map[type] ?? type;
}

export function reviewStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待人工複核',
    confirmed: '人工確認',
    false_positive: '人工判定誤報',
  };
  return map[status] ?? status;
}

export function deviceStatusLabel(status: string): string {
  const map: Record<string, string> = {
    online: 'Online',
    warning: 'Warning',
    offline: 'Offline',
  };
  return map[status] ?? status;
}

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export function formatChange(value: number | null): string {
  return value === null ? '—' : formatPercent(value);
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return '—';
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} 分 ${s} 秒` : `${m} 分`;
}

/** "3 小時前" style age relative to a reference time. */
export function formatAgo(iso: string | null | undefined, now: Date): string {
  if (!iso) return '—';
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return '剛剛';
  if (min < 60) return `${min} 分鐘前`;
  if (min < 1440) return `${Math.floor(min / 60)} 小時前`;
  return `${Math.floor(min / 1440)} 天前`;
}

export function riskLevelLabel(level: string): string {
  const map: Record<string, string> = { low: '低', medium: '中', high: '高' };
  return map[level] ?? level;
}

export function cameraHealthLabel(health: string): string {
  const map: Record<string, string> = {
    normal: '畫面正常',
    occluded: '鏡頭遮蔽',
    blurred: '畫面模糊',
    foggy: '鏡頭起霧',
  };
  return map[health] ?? health;
}
