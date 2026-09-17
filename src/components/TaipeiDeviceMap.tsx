import { useEffect, useId, useMemo, useState } from 'react';

export type TaipeiDeviceStatus = 'online' | 'warning' | 'offline';

/**
 * The component deliberately accepts coordinates as optional values.  This lets
 * the current mock locations render immediately, while a future API can supply
 * true device coordinates without changing the map UI.
 */
export interface TaipeiMapLocation {
  location_id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  /** Short aliases supported for APIs that return lat/lng. */
  lat?: number;
  lng?: number;
}

export interface TaipeiMapDevice {
  device_id: string;
  location_id: string;
  status: TaipeiDeviceStatus;
  battery?: number;
  network?: string;
  signal_strength?: number;
}

export type TaipeiRiskLevel = 'low' | 'medium' | 'high';

export interface TaipeiLocationMetric {
  risk_level: TaipeiRiskLevel;
  events_per_100_hours: number;
}

export interface TaipeiDeviceMapProps {
  locations: readonly TaipeiMapLocation[];
  devices: readonly TaipeiMapDevice[];
  /** When provided, marker color = risk level and marker size = Events / 100h. */
  metrics?: Readonly<Record<string, TaipeiLocationMetric>>;
  /** Makes selection controlled when provided. */
  selectedLocationId?: string | null;
  onLocationSelect?: (location: TaipeiMapLocation) => void;
  className?: string;
  title?: string;
}

interface MarkerPoint {
  x: number;
  y: number;
}

interface LocationSummary {
  location: TaipeiMapLocation;
  devices: TaipeiMapDevice[];
  status: TaipeiDeviceStatus;
  point: MarkerPoint;
}

const RISK_COLORS: Record<TaipeiRiskLevel, string> = {
  low: '#5b9f93',
  medium: '#d99a00',
  high: '#c73e35',
};

const RISK_LABELS: Record<TaipeiRiskLevel, string> = { low: '低風險', medium: '中風險', high: '高風險' };

const TAIPEI_BOUNDS = {
  minLatitude: 24.96,
  maxLatitude: 25.21,
  minLongitude: 121.45,
  maxLongitude: 121.62,
};

const MAP_AREA = { left: 142, right: 578, top: 60, bottom: 510 };

/** Fallback locations preserve a useful visual layout until exact GPS data arrives. */
const KNOWN_FALLBACK_POINTS: Record<string, MarkerPoint> = {
  'LOC-001': { x: 273, y: 387 }, // 萬華
  'LOC-002': { x: 363, y: 263 }, // 大同
  'LOC-003': { x: 348, y: 350 }, // 中正
};

const GENERIC_FALLBACK_POINTS: MarkerPoint[] = [
  { x: 420, y: 292 },
  { x: 460, y: 365 },
  { x: 333, y: 426 },
  { x: 505, y: 237 },
  { x: 294, y: 244 },
  { x: 414, y: 438 },
];

function statusRank(status: TaipeiDeviceStatus): number {
  if (status === 'offline') return 3;
  if (status === 'warning') return 2;
  return 1;
}

function aggregateStatus(devices: TaipeiMapDevice[]): TaipeiDeviceStatus {
  if (devices.length === 0) return 'offline';
  return devices.reduce<TaipeiDeviceStatus>((worst, device) => {
    return statusRank(device.status) > statusRank(worst) ? device.status : worst;
  }, 'online');
}

function statusLabel(status: TaipeiDeviceStatus): string {
  const labels: Record<TaipeiDeviceStatus, string> = {
    online: '正常連線',
    warning: '需留意',
    offline: '離線',
  };
  return labels[status];
}

function markerPoint(location: TaipeiMapLocation, index: number): MarkerPoint {
  const latitude = location.latitude ?? location.lat;
  const longitude = location.longitude ?? location.lng;

  if (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= TAIPEI_BOUNDS.minLatitude &&
    latitude <= TAIPEI_BOUNDS.maxLatitude &&
    longitude >= TAIPEI_BOUNDS.minLongitude &&
    longitude <= TAIPEI_BOUNDS.maxLongitude
  ) {
    const xRatio =
      (longitude - TAIPEI_BOUNDS.minLongitude) /
      (TAIPEI_BOUNDS.maxLongitude - TAIPEI_BOUNDS.minLongitude);
    const yRatio =
      (TAIPEI_BOUNDS.maxLatitude - latitude) /
      (TAIPEI_BOUNDS.maxLatitude - TAIPEI_BOUNDS.minLatitude);
    return {
      x: MAP_AREA.left + xRatio * (MAP_AREA.right - MAP_AREA.left),
      y: MAP_AREA.top + yRatio * (MAP_AREA.bottom - MAP_AREA.top),
    };
  }

  return KNOWN_FALLBACK_POINTS[location.location_id] ??
    GENERIC_FALLBACK_POINTS[index % GENERIC_FALLBACK_POINTS.length];
}

function formatBattery(battery: number | undefined): string {
  return typeof battery === 'number' ? `${Math.round(battery)}%` : '—';
}

/**
 * A dependency-free, stylized Taipei City map.  It intentionally uses SVG
 * rather than a tile provider so it stays useful in a demo or offline console.
 */
export function TaipeiDeviceMap({
  locations,
  devices,
  metrics,
  selectedLocationId,
  onLocationSelect,
  className,
  title = '台北市機台分布圖',
}: TaipeiDeviceMapProps) {
  const generatedId = useId().replace(/:/g, '');
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = useState<string | null>(
    () => locations[0]?.location_id ?? null,
  );
  const isControlled = selectedLocationId !== undefined;
  const activeLocationId = isControlled ? selectedLocationId ?? null : uncontrolledSelectedId;

  useEffect(() => {
    if (
      !isControlled &&
      uncontrolledSelectedId !== null &&
      !locations.some((location) => location.location_id === uncontrolledSelectedId)
    ) {
      setUncontrolledSelectedId(locations[0]?.location_id ?? null);
    }
  }, [isControlled, locations, uncontrolledSelectedId]);

  const summaries = useMemo<LocationSummary[]>(() => {
    const devicesByLocation = new Map<string, TaipeiMapDevice[]>();
    for (const device of devices) {
      const group = devicesByLocation.get(device.location_id) ?? [];
      group.push(device);
      devicesByLocation.set(device.location_id, group);
    }

    return locations.map((location, index) => {
      const locationDevices = devicesByLocation.get(location.location_id) ?? [];
      return {
        location,
        devices: locationDevices,
        status: aggregateStatus(locationDevices),
        point: markerPoint(location, index),
      };
    });
  }, [devices, locations]);

  const maxRate = Math.max(1, ...Object.values(metrics ?? {}).map((m) => m.events_per_100_hours));

  const selectedSummary = summaries.find(
    (summary) => summary.location.location_id === activeLocationId,
  );

  const selectLocation = (location: TaipeiMapLocation) => {
    if (!isControlled) setUncontrolledSelectedId(location.location_id);
    onLocationSelect?.(location);
  };

  const rootClassName = ['taipei-device-map', className].filter(Boolean).join(' ');
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;

  return (
    <section className={rootClassName} aria-labelledby={titleId}>
      <header className="taipei-device-map__header">
        <div>
          <h2 id={titleId} className="taipei-device-map__title">
            {title}
          </h2>
          <p className="taipei-device-map__subtitle">
            {metrics
              ? '顏色為風險等級、大小為近 7 日每 100 監測小時事件數；點選標記查看設備狀態。'
              : '點選標記查看所在場域的機台與連線狀態。'}
          </p>
        </div>
        <div className="taipei-device-map__count" aria-label={`${locations.length} 個監測場域`}>
          {locations.length} 個場域
        </div>
      </header>

      <div className="taipei-device-map__canvas">
        <svg
          className="taipei-device-map__svg"
          viewBox="0 0 720 580"
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
        >
          <title>{title}</title>
          <desc id={descriptionId}>
            台北市行政區示意圖，共有 {locations.length} 個可互動的設備場域標記。
          </desc>
          <defs>
            <linearGradient id={`${generatedId}-background`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#eff8fb" />
              <stop offset="1" stopColor="#dcecf2" />
            </linearGradient>
            <linearGradient id={`${generatedId}-city`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#f8fbfc" />
              <stop offset="1" stopColor="#d7e7e9" />
            </linearGradient>
            <filter id={`${generatedId}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#102433" floodOpacity="0.22" />
            </filter>
          </defs>

          <rect
            className="taipei-device-map__water"
            width="720"
            height="580"
            rx="18"
            fill={`url(#${generatedId}-background)`}
          />
          <path
            className="taipei-device-map__city-outline"
            d="M305 52 L385 64 L438 102 L497 111 L546 171 L557 239 L530 294 L550 354 L520 414 L478 471 L419 503 L359 515 L300 482 L239 452 L190 398 L168 331 L186 273 L174 205 L210 139 L260 108 Z"
            fill={`url(#${generatedId}-city)`}
            stroke="#7a98a4"
            strokeWidth="3"
          />

          <g className="taipei-device-map__districts" stroke="#a9c0c8" strokeWidth="1.5" fill="none">
            <path d="M305 52 L260 108 L210 139 L242 190 L305 181 L343 126 Z" />
            <path d="M343 126 L305 181 L325 245 L403 230 L438 102 L385 64 Z" />
            <path d="M438 102 L403 230 L490 230 L546 171 L497 111 Z" />
            <path d="M242 190 L174 205 L186 273 L255 287 L325 245 L305 181 Z" />
            <path d="M325 245 L255 287 L265 347 L341 357 L386 305 L403 230 Z" />
            <path d="M403 230 L386 305 L468 326 L530 294 L557 239 L490 230 Z" />
            <path d="M186 273 L168 331 L239 352 L265 347 L255 287 Z" />
            <path d="M239 352 L190 398 L239 452 L300 482 L329 412 L265 347 Z" />
            <path d="M265 347 L329 412 L390 402 L386 305 L341 357 Z" />
            <path d="M386 305 L390 402 L478 471 L520 414 L550 354 L468 326 Z" />
            <path d="M329 412 L300 482 L359 515 L419 503 L478 471 L390 402 Z" />
          </g>

          <g className="taipei-device-map__roads" fill="none" stroke="#ffffff" strokeLinecap="round">
            <path d="M197 255 C290 248 395 278 537 251" strokeWidth="5" opacity="0.72" />
            <path d="M220 377 C306 350 408 356 516 399" strokeWidth="4" opacity="0.72" />
            <path d="M350 102 C334 211 356 346 412 491" strokeWidth="4" opacity="0.72" />
          </g>

          <g className="taipei-device-map__district-labels" fill="#52717c" fontSize="14" fontWeight="600">
            <text x="261" y="144">北投</text>
            <text x="358" y="164">士林</text>
            <text x="465" y="172">內湖</text>
            <text x="209" y="247">萬華</text>
            <text x="298" y="286">中正</text>
            <text x="433" y="278">松山</text>
            <text x="199" y="327">大同</text>
            <text x="287" y="382">大安</text>
            <text x="411" y="369">信義</text>
            <text x="385" y="462">文山</text>
          </g>

          <g className="taipei-device-map__markers">
            {summaries.map((summary) => {
              const isSelected = summary.location.location_id === activeLocationId;
              const metric = metrics?.[summary.location.location_id];
              const dotRadius = metric ? 5 + (metric.events_per_100_hours / maxRate) * 5 : 8;
              const markerLabel = metric
                ? `${summary.location.name}，${RISK_LABELS[metric.risk_level]}，每 100 監測小時 ${metric.events_per_100_hours} 次，設備${statusLabel(summary.status)}`
                : `${summary.location.name}，${summary.devices.length} 台設備，${statusLabel(summary.status)}`;
              return (
                <g
                  key={summary.location.location_id}
                  className={`taipei-device-map__marker taipei-device-map__marker--${summary.status}${
                    isSelected ? ' is-selected' : ''
                  }`}
                  transform={`translate(${summary.point.x} ${summary.point.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={markerLabel}
                  aria-pressed={isSelected}
                  onClick={() => selectLocation(summary.location)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectLocation(summary.location);
                    }
                  }}
                >
                  <title>{markerLabel}</title>
                  {isSelected ? <circle r="22" fill="#0b4f6c" opacity="0.16" /> : null}
                  <circle
                    className="taipei-device-map__marker-ring"
                    r={dotRadius + 5}
                    fill="#ffffff"
                    stroke="#102433"
                    strokeWidth="2"
                    filter={`url(#${generatedId}-shadow)`}
                  />
                  <circle
                    className="taipei-device-map__marker-dot"
                    r={dotRadius}
                    fill={
                      metric
                        ? RISK_COLORS[metric.risk_level]
                        : summary.status === 'online'
                          ? '#12b76a'
                          : summary.status === 'warning'
                            ? '#f79009'
                            : '#f04438'
                    }
                  />
                  {metric && summary.status !== 'online' ? (
                    <g transform={`translate(${dotRadius + 3} ${-(dotRadius + 3)})`}>
                      <circle r="7" fill="#102433" stroke="#ffffff" strokeWidth="1.5" />
                      <text x="0" y="3.5" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="700">
                        !
                      </text>
                    </g>
                  ) : null}
                  <text
                    className="taipei-device-map__marker-count"
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {summary.devices.length}
                  </text>
                  <text
                    className="taipei-device-map__marker-label"
                    x="0"
                    y={dotRadius + 23}
                    textAnchor="middle"
                    fill="#102433"
                    fontSize="12"
                    fontWeight="700"
                  >
                    {summary.location.name}
                  </text>
                </g>
              );
            })}
          </g>

          <text
            className="taipei-device-map__north-label"
            x="650"
            y="55"
            textAnchor="middle"
            fill="#52717c"
            fontSize="12"
            fontWeight="700"
          >
            北
          </text>
          <path d="M650 65 L642 84 L650 80 L658 84 Z" fill="#52717c" />
        </svg>
      </div>

      {metrics ? (
        <div className="taipei-device-map__legend" aria-label="風險等級圖例">
          {(['low', 'medium', 'high'] as const).map((level) => (
            <span key={level} className="taipei-device-map__legend-item">
              <span
                className="taipei-device-map__legend-dot"
                style={{ background: RISK_COLORS[level] }}
                aria-hidden
              />
              {RISK_LABELS[level]}
            </span>
          ))}
          <span className="taipei-device-map__legend-item">
            <span className="taipei-device-map__legend-alert" aria-hidden>!</span>
            設備需留意／離線
          </span>
          <span className="taipei-device-map__legend-item">標記越大＝每 100 監測小時事件越多</span>
        </div>
      ) : (
        <div className="taipei-device-map__legend" aria-label="設備狀態圖例">
          {(['online', 'warning', 'offline'] as const).map((status) => (
            <span key={status} className={`taipei-device-map__legend-item taipei-device-map__legend-item--${status}`}>
              <span className="taipei-device-map__legend-dot" aria-hidden />
              {statusLabel(status)}
            </span>
          ))}
        </div>
      )}

      <div className="taipei-device-map__selection" aria-live="polite">
        {selectedSummary ? (
          <>
            <div className="taipei-device-map__selection-heading">
              <div>
                <p className="taipei-device-map__selection-eyebrow">已選擇場域</p>
                <h3>{selectedSummary.location.name}</h3>
              </div>
              <span
                className={`taipei-device-map__status taipei-device-map__status--${selectedSummary.status}`}
              >
                {selectedSummary.devices.length === 0
                  ? '尚未配置設備'
                  : statusLabel(selectedSummary.status)}
              </span>
            </div>
            {selectedSummary.location.address ? (
              <p className="taipei-device-map__selection-address">{selectedSummary.location.address}</p>
            ) : null}
            <ul className="taipei-device-map__device-list" aria-label={`${selectedSummary.location.name} 的設備`}>
              {selectedSummary.devices.length > 0 ? (
                selectedSummary.devices.map((device) => (
                  <li key={device.device_id} className="taipei-device-map__device-row">
                    <span className="taipei-device-map__device-id">{device.device_id}</span>
                    <span className={`taipei-device-map__device-state taipei-device-map__device-state--${device.status}`}>
                      {statusLabel(device.status)}
                    </span>
                    <span>電量 {formatBattery(device.battery)}</span>
                    {device.network ? <span>{device.network}</span> : null}
                  </li>
                ))
              ) : (
                <li className="taipei-device-map__empty">此場域目前沒有已配置的監測設備。</li>
              )}
            </ul>
          </>
        ) : (
          <p className="taipei-device-map__empty">尚無可顯示的場域資料。</p>
        )}
      </div>
    </section>
  );
}
