import { getDevices, getLocationName } from '../services/dataService';
import { useAsyncData } from '../hooks/useAsyncData';
import { deviceStatusLabel, formatDateTime } from '../utils/format';

function meterTone(value: number, warningAt = 75): 'good' | 'warning' | 'critical' {
  if (value >= 90) return 'critical';
  if (value >= warningAt) return 'warning';
  return 'good';
}

function TelemetryMeter({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: 'good' | 'warning' | 'critical';
}) {
  return (
    <div className="telemetry-meter">
      <div className="telemetry-meter__head">
        <span>{label}</span>
        <strong>{detail}</strong>
      </div>
      <div className="telemetry-meter__track" aria-label={`${label} ${detail}`}>
        <span className={`telemetry-meter__fill telemetry-meter__fill--${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function DevicesPage() {
  const { data, loading } = useAsyncData(() => getDevices(), []);

  return (
    <div>
      <header className="page-header">
        <h1>
          設備健康監控
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>即時檢視各機台的連線狀態、供電、電池、記憶體與環境溫度；數值皆為前端模擬遙測。</p>
      </header>

      {loading || !data ? (
        <div className="loading">載入設備…</div>
      ) : (
        <>
          <section className="device-health-summary" aria-label="設備健康摘要">
            <div className="device-health-summary__metric">
              <span>受監控設備</span>
              <strong>{data.length}</strong>
              <small>全部已納入監測</small>
            </div>
            <div className="device-health-summary__metric">
              <span>正常連線</span>
              <strong>{data.filter((device) => device.status === 'online').length}</strong>
              <small>過去 15 分鐘內回報</small>
            </div>
            <div className="device-health-summary__metric">
              <span>需優先處理</span>
              <strong className="is-warning">{data.filter((device) => device.status !== 'online').length}</strong>
              <small>電力或通訊異常</small>
            </div>
            <div className="device-health-summary__metric">
              <span>平均記憶體使用</span>
              <strong>
                {Math.round(
                  data.reduce(
                    (total, device) => total + (device.memory_used_mb / device.memory_total_mb) * 100,
                    0,
                  ) / data.length,
                )}%
              </strong>
              <small>RAM 使用率</small>
            </div>
          </section>

          <section className="device-monitor-grid" aria-label="設備遙測資料">
            {data.map((device) => {
              const memoryPercent = Math.round((device.memory_used_mb / device.memory_total_mb) * 100);
              const batteryRisk = 100 - device.battery;
              return (
                <article key={device.device_id} className={`device-monitor-card device-monitor-card--${device.status}`}>
                  <header className="device-monitor-card__head">
                    <div>
                      <div className="device-monitor-card__eyebrow">{getLocationName(device.location_id)}</div>
                      <h2 className="mono">{device.device_id}</h2>
                    </div>
                    <span className={`badge badge--${device.status}`}>
                      {deviceStatusLabel(device.status)}
                    </span>
                  </header>

                  <div className="device-monitor-card__connection">
                    <span className={`connection-dot connection-dot--${device.status}`} />
                    <span>{device.network} · {device.signal_strength} dBm</span>
                    <time>最後回報 {formatDateTime(device.last_seen)}</time>
                  </div>

                  <div className="device-monitor-card__telemetry">
                    <TelemetryMeter
                      label="備援電池"
                      value={device.battery}
                      detail={`${device.battery}%`}
                      tone={device.battery < 20 ? 'critical' : device.battery < 40 ? 'warning' : 'good'}
                    />
                    <TelemetryMeter
                      label="記憶體"
                      value={memoryPercent}
                      detail={`${device.memory_used_mb} / ${device.memory_total_mb} MB`}
                      tone={meterTone(memoryPercent)}
                    />
                    <TelemetryMeter
                      label="處理器負載"
                      value={device.cpu_usage}
                      detail={`${device.cpu_usage}%`}
                      tone={meterTone(device.cpu_usage, 65)}
                    />
                  </div>

                  <dl className="device-monitor-card__facts">
                    <div>
                      <dt>供電模式</dt>
                      <dd>{device.power_mode}</dd>
                    </div>
                    <div>
                      <dt>輸入電壓</dt>
                      <dd>{device.voltage.toFixed(1)} V</dd>
                    </div>
                    <div>
                      <dt>耗電功率</dt>
                      <dd>{device.power_watts.toFixed(1)} W</dd>
                    </div>
                    <div>
                      <dt>設備溫度</dt>
                      <dd className={device.temperature_c >= 55 ? 'is-warning' : ''}>{device.temperature_c} °C</dd>
                    </div>
                  </dl>

                  <footer className="device-monitor-card__footer">
                    <span>Firmware <b className="mono">{device.firmware_version}</b></span>
                    <span>AI <b className="mono">{device.ai_model_version}</b></span>
                    {batteryRisk > 80 ? <span className="device-monitor-card__alert">請安排現場電力檢查</span> : null}
                  </footer>
                </article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
