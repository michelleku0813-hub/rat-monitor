import { getDevices, getLocationName } from '../services/dataService';
import { useAsyncData } from '../hooks/useAsyncData';
import { Panel } from '../components/Panel';
import { deviceStatusLabel, formatDateTime } from '../utils/format';

export function DevicesPage() {
  const { data, loading } = useAsyncData(() => getDevices(), []);

  return (
    <div>
      <header className="page-header">
        <h1>
          Devices
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>IoT 監測設備狀態。RAT-TPE-003 刻意設為 Warning，用於展示設備管理情境。</p>
      </header>

      <Panel title="設備清單" subtitle="GET /api/v1/devices（目前為 Mock）">
        {loading || !data ? (
          <div className="loading">載入設備…</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Battery</th>
                  <th>Network</th>
                  <th>Signal Strength</th>
                  <th>Last Seen</th>
                  <th>Firmware</th>
                  <th>AI Model</th>
                </tr>
              </thead>
              <tbody>
                {data.map((device) => (
                  <tr key={device.device_id}>
                    <td className="mono">{device.device_id}</td>
                    <td>{getLocationName(device.location_id)}</td>
                    <td>
                      <span className={`badge badge--${device.status}`}>
                        {deviceStatusLabel(device.status)}
                      </span>
                    </td>
                    <td>{device.battery}%</td>
                    <td>{device.network}</td>
                    <td className="mono">{device.signal_strength} dBm</td>
                    <td>{formatDateTime(device.last_seen)}</td>
                    <td className="mono">{device.firmware_version}</td>
                    <td className="mono">{device.ai_model_version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
