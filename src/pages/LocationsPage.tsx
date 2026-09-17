import { useMemo, useState } from 'react';
import { TaipeiDeviceMap, type TaipeiLocationMetric } from '../components/TaipeiDeviceMap';
import { RiskBadge } from '../components/RiskBadge';
import { MethodologyBar } from '../components/MethodologyBar';
import { getDevices, getLocations } from '../services/dataService';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatChange, formatDateTime, locationTypeLabel } from '../utils/format';
import type { DeviceHealth, RiskLevel } from '../types';

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

/** Treat a stale heartbeat as offline so the map reflects real data availability. */
function effectiveStatus(device: DeviceHealth): DeviceHealth['status'] {
  if (device.heartbeat_stale) return 'offline';
  if (device.camera_health !== 'normal') return 'warning';
  return device.status;
}

export function LocationsPage() {
  const { data: locations, loading: locationsLoading } = useAsyncData(() => getLocations(), []);
  const { data: devices, loading: devicesLoading } = useAsyncData(() => getDevices(), []);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const ranked = useMemo(
    () =>
      [...(locations ?? [])].sort(
        (a, b) =>
          RISK_ORDER[a.risk.level] - RISK_ORDER[b.risk.level] ||
          b.events_per_100_hours - a.events_per_100_hours,
      ),
    [locations],
  );

  const mapDevices = useMemo(
    () => (devices ?? []).map((d) => ({ ...d, status: effectiveStatus(d) })),
    [devices],
  );

  const metrics = useMemo(
    () =>
      Object.fromEntries(
        ranked.map((loc) => [
          loc.location_id,
          { risk_level: loc.risk.level, events_per_100_hours: loc.events_per_100_hours },
        ]),
      ) as Record<string, TaipeiLocationMetric>,
    [ranked],
  );

  const activeLocationId = selectedLocationId ?? ranked[0]?.location_id ?? null;
  const effectiveCount = devices?.filter((device) => device.effective_monitoring).length ?? 0;
  const highRiskCount = ranked.filter((loc) => loc.risk.level === 'high').length;

  return (
    <div>
      <header className="page-header">
        <h1>
          台北市場域熱點
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>
          以近 7 日「每 100 監測小時活動事件數」比較各場域，並依可解釋的規則分級，協助決定今天先去哪裡。
        </p>
      </header>

      <MethodologyBar />

      {locationsLoading || devicesLoading || !locations || !devices ? (
        <div className="loading">載入場域…</div>
      ) : (
        <div className="locations-dashboard">
          <div className="locations-dashboard__map panel">
            <TaipeiDeviceMap
              locations={ranked}
              devices={mapDevices}
              metrics={metrics}
              selectedLocationId={activeLocationId}
              onLocationSelect={(location) => setSelectedLocationId(location.location_id)}
            />
          </div>

          <aside className="panel deployment-summary">
            <div className="deployment-summary__head">
              <div>
                <div className="eyebrow">Priority</div>
                <h2>優先處理順序</h2>
              </div>
            </div>
            <div className="deployment-summary__metrics">
              <div>
                <strong>{locations.length}</strong>
                <span>監測場域</span>
              </div>
              <div>
                <strong className={highRiskCount ? 'is-alert' : ''}>{highRiskCount}</strong>
                <span>高風險場域</span>
              </div>
              <div>
                <strong>
                  {effectiveCount}/{devices.length}
                </strong>
                <span>有效監測設備</span>
              </div>
            </div>
            <div className="deployment-list" role="list" aria-label="場域風險排序">
              {ranked.map((loc, index) => {
                const selected = loc.location_id === activeLocationId;
                return (
                  <button
                    key={loc.location_id}
                    type="button"
                    className={`deployment-list__item${selected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedLocationId(loc.location_id)}
                    role="listitem"
                  >
                    <span className="deployment-list__rank">{index + 1}</span>
                    <span className="deployment-list__copy">
                      <strong>{loc.name}</strong>
                      <small>
                        {loc.district} · 每 100h {loc.events_per_100_hours} · 趨勢{' '}
                        {formatChange(loc.trend_change_percentage)}
                      </small>
                    </span>
                    <RiskBadge risk={loc.risk} showInfo={false} />
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="location-grid locations-dashboard__cards">
            {ranked.map((loc) => (
              <article key={loc.location_id} className="panel location-card">
                <div className="location-card__head">
                  <div>
                    <h3>{loc.name}</h3>
                    <div className="location-card__type">
                      {loc.district} · {locationTypeLabel(loc.type)} · {loc.location_id}
                    </div>
                  </div>
                  <RiskBadge risk={loc.risk} />
                </div>
                <div className="stat-list">
                  <div className="stat-row">
                    <span>每 100 監測小時事件（近 7 日）</span>
                    <span>
                      <b>{loc.events_per_100_hours}</b>
                    </span>
                  </div>
                  <div className="stat-row">
                    <span>較前 7 日</span>
                    <span
                      className={
                        (loc.trend_change_percentage ?? 0) >= 10
                          ? 'is-up'
                          : (loc.trend_change_percentage ?? 0) <= -10
                            ? 'is-down'
                            : ''
                      }
                    >
                      {formatChange(loc.trend_change_percentage)}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span>獨立活動事件（近 7 日）</span>
                    <span>{loc.detection_event_count} 次</span>
                  </div>
                  <div className="stat-row">
                    <span>有效監測時數（近 7 日）</span>
                    <span>{loc.monitoring_hours} h</span>
                  </div>
                  <div className="stat-row">
                    <span>活動高峰時段</span>
                    <span>{loc.peak_hour}</span>
                  </div>
                  <div className="stat-row">
                    <span>設備數量</span>
                    <span>{loc.device_count} 台</span>
                  </div>
                  <div className="stat-row">
                    <span>最近活動</span>
                    <span>{formatDateTime(loc.latest_detection)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setSelectedLocationId(loc.location_id)}
                >
                  地圖定位
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
