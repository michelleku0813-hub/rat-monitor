import { getLocations } from '../services/dataService';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDateTime, locationTypeLabel } from '../utils/format';

export function LocationsPage() {
  const { data, loading } = useAsyncData(() => getLocations(), []);

  return (
    <div>
      <header className="page-header">
        <h1>
          Locations
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>
          PoC 監測場域摘要。正式版場域比較建議優先使用 Events / 100 Monitoring Hours。
        </p>
      </header>

      {loading || !data ? (
        <div className="loading">載入場域…</div>
      ) : (
        <div className="location-grid">
          {data.map((loc) => (
            <article key={loc.location_id} className="panel location-card">
              <h3>{loc.name}</h3>
              <div className="location-card__type">
                {locationTypeLabel(loc.type)} · {loc.location_id}
              </div>
              <div className="stat-list">
                <div className="stat-row">
                  <span>Location Type</span>
                  <span>{locationTypeLabel(loc.type)}</span>
                </div>
                <div className="stat-row">
                  <span>Device Count</span>
                  <span>{loc.device_count}</span>
                </div>
                <div className="stat-row">
                  <span>Detection Event Count</span>
                  <span>{loc.detection_event_count}</span>
                </div>
                <div className="stat-row">
                  <span>Monitoring Hours</span>
                  <span>{loc.monitoring_hours}</span>
                </div>
                <div className="stat-row">
                  <span>Events / 100 Monitoring Hours</span>
                  <span>{loc.events_per_100_hours}</span>
                </div>
                <div className="stat-row">
                  <span>Peak Hour</span>
                  <span>{loc.peak_hour}</span>
                </div>
                <div className="stat-row">
                  <span>Latest Detection</span>
                  <span>{formatDateTime(loc.latest_detection)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
