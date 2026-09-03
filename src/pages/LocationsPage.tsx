import { useMemo, useState } from 'react';
import { TaipeiDeviceMap } from '../components/TaipeiDeviceMap';
import { getDevices, getLocations } from '../services/dataService';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDateTime, locationTypeLabel } from '../utils/format';

export function LocationsPage() {
  const { data: locations, loading: locationsLoading } = useAsyncData(() => getLocations(), []);
  const { data: devices, loading: devicesLoading } = useAsyncData(() => getDevices(), []);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const activeLocationId = useMemo(
    () => selectedLocationId ?? locations?.[0]?.location_id ?? null,
    [locations, selectedLocationId],
  );
  const onlineCount = devices?.filter((device) => device.status === 'online').length ?? 0;

  return (
    <div>
      <header className="page-header">
        <h1>
          台北市機台佈建圖
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>
          以台北市行政區示意圖呈現機台放置點與目前連線狀態。點選地圖標記，可查看場域及設備摘要。
        </p>
      </header>

      {locationsLoading || devicesLoading || !locations || !devices ? (
        <div className="loading">載入場域…</div>
      ) : (
        <div className="locations-dashboard">
          <div className="locations-dashboard__map panel">
            <TaipeiDeviceMap
              locations={locations}
              devices={devices}
              selectedLocationId={activeLocationId}
              onLocationSelect={(location) => setSelectedLocationId(location.location_id)}
            />
          </div>

          <aside className="panel deployment-summary">
            <div className="deployment-summary__head">
              <div>
                <div className="eyebrow">Fleet coverage</div>
                <h2>佈建狀態</h2>
              </div>
              <span className="deployment-summary__live">
                <i /> 即時回報
              </span>
            </div>
            <div className="deployment-summary__metrics">
              <div>
                <strong>{locations.length}</strong>
                <span>監測場域</span>
              </div>
              <div>
                <strong>{devices.length}</strong>
                <span>已佈建機台</span>
              </div>
              <div>
                <strong>{onlineCount}</strong>
                <span>正常連線</span>
              </div>
            </div>
            <div className="deployment-list" role="list" aria-label="監測場域清單">
              {locations.map((loc) => {
                const locationDevices = devices.filter(
                  (device) => device.location_id === loc.location_id,
                );
                const status = locationDevices.some((device) => device.status === 'offline')
                  ? 'offline'
                  : locationDevices.some((device) => device.status === 'warning')
                    ? 'warning'
                    : 'online';
                const selected = loc.location_id === activeLocationId;

                return (
                  <button
                    key={loc.location_id}
                    type="button"
                    className={`deployment-list__item${selected ? ' is-selected' : ''}`}
                    onClick={() => setSelectedLocationId(loc.location_id)}
                    role="listitem"
                  >
                    <span className={`deployment-list__dot deployment-list__dot--${status}`} />
                    <span className="deployment-list__copy">
                      <strong>{loc.name}</strong>
                      <small>{loc.district} · {locationTypeLabel(loc.type)}</small>
                    </span>
                    <span className="deployment-list__count">{locationDevices.length} 台</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="location-grid locations-dashboard__cards">
            {locations.map((loc) => (
              <article key={loc.location_id} className="panel location-card">
                <div className="location-card__head">
                  <div>
                    <h3>{loc.name}</h3>
                    <div className="location-card__type">
                      {loc.district} · {locationTypeLabel(loc.type)} · {loc.location_id}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setSelectedLocationId(loc.location_id)}
                  >
                    地圖定位
                  </button>
                </div>
                <div className="stat-list">
                  <div className="stat-row">
                    <span>設備數量</span>
                    <span>{loc.device_count} 台</span>
                  </div>
                  <div className="stat-row">
                    <span>偵測事件</span>
                    <span>{loc.detection_event_count} 次</span>
                  </div>
                  <div className="stat-row">
                    <span>監測時數</span>
                    <span>{loc.monitoring_hours} h</span>
                  </div>
                  <div className="stat-row">
                    <span>每百小時事件</span>
                    <span>{loc.events_per_100_hours}</span>
                  </div>
                  <div className="stat-row">
                    <span>最近偵測</span>
                    <span>{formatDateTime(loc.latest_detection)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
