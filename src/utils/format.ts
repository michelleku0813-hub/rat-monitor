/** Display helpers — Taipei timezone for demo consistency */

const TZ = 'Asia/Taipei';

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
    pending: '待審核',
    confirmed: '已確認',
    reviewed: '已檢視',
    false_positive: '誤報',
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
