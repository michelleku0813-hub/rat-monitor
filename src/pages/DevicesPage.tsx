import { getDeviceFleetSummary, getDevices, getLocationName } from '../services/dataService';
import { useAsyncData } from '../hooks/useAsyncData';
import { InfoTip } from '../components/InfoTip';
import { DEMO_NOW } from '../data/mock/devices';
import { cameraHealthLabel, deviceStatusLabel, formatAgo, formatDateTime } from '../utils/format';
import type { DeviceHealth } from '../types';

function dataTrust(device: DeviceHealth): { tone: 'online' | 'warning' | 'offline'; label: string } {
  if (device.heartbeat_stale || device.status === 'offline') return { tone: 'offline', label: '失聯・資料缺口' };
  if (device.camera_health !== 'normal') return { tone: 'warning', label: '在線但看不見' };
  if (device.status === 'warning') return { tone: 'warning', label: '需留意' };
  return { tone: 'online', label: '有效監測中' };
}

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
  const { data: fleet } = useAsyncData(() => getDeviceFleetSummary(), []);

  return (
    <div>
      <header className="page-header">
        <h1>
          設備健康監控
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>設備失聯或鏡頭被遮蔽時，所有活動指標都會出現資料缺口。先確認設備「看得見」，再解讀數據。數值皆為前端模擬遙測。</p>
      </header>

      {loading || !data || !fleet ? (
        <div className="loading">載入設備…</div>
      ) : (
        <>
          <section className="device-health-summary" aria-label="設備健康摘要">
            <div className="device-health-summary__metric">
              <span>
                有效監測率
                <InfoTip label="有效監測率說明">
                  在線、{fleet.heartbeat_timeout_min} 分鐘內有心跳、且畫面正常的設備比例。只有這些設備的資料會計入監測時數。
                </InfoTip>
              </span>
              <strong className={fleet.effective_rate < 80 ? 'is-warning' : ''}>{fleet.effective_rate}%</strong>
              <small>
                {fleet.effective} / {fleet.total} 台可信
              </small>
            </div>
            <div className="device-health-summary__metric">
              <span>失聯</span>
              <strong className={fleet.stale ? 'is-warning' : ''}>{fleet.stale}</strong>
              <small>超過 {fleet.heartbeat_timeout_min} 分鐘未回報</small>
            </div>
            <div className="device-health-summary__metric">
              <span>
                畫面異常
                <InfoTip label="畫面異常說明">
                  遮蔽、模糊或起霧。設備仍回報在線，但模型看不見，是「隱形資料缺口」，無鼠率會因此虛高。
                </InfoTip>
              </span>
              <strong className={fleet.camera_issues ? 'is-warning' : ''}>{fleet.camera_issues}</strong>
              <small>遮蔽／模糊／起霧</small>
            </div>
            <div className="device-health-summary__metric">
              <span>平均上傳成功率</span>
              <strong className={fleet.avg_upload_success_rate < 95 ? 'is-warning' : ''}>
                {fleet.avg_upload_success_rate}%
              </strong>
              <small>近 24 小時</small>
            </div>
          </section>

          <section className="device-monitor-grid" aria-label="設備遙測資料">
            {data.map((device) => {
              const memoryPercent = Math.round((device.memory_used_mb / device.memory_total_mb) * 100);
              const batteryRisk = 100 - device.battery;
              const trust = dataTrust(device);
              return (
                <article key={device.device_id} className={`device-monitor-card device-monitor-card--${trust.tone}`}>
                  <header className="device-monitor-card__head">
                    <div>
                      <div className="device-monitor-card__eyebrow">{getLocationName(device.location_id)}</div>
                      <h2 className="mono">{device.device_id}</h2>
                    </div>
                    <span className={`badge badge--${trust.tone}`}>{trust.label}</span>
                  </header>

                  <dl className="device-monitor-card__trust">
                    <div>
                      <dt>連線</dt>
                      <dd>
                        {deviceStatusLabel(device.status)}
                        {device.heartbeat_stale ? <span className="is-warning">（心跳逾時）</span> : null}
                      </dd>
                    </div>
                    <div>
                      <dt>畫面狀態</dt>
                      <dd className={device.camera_health !== 'normal' ? 'is-warning' : ''}>
                        {cameraHealthLabel(device.camera_health)}
                      </dd>
                    </div>
                    <div>
                      <dt>最後回報</dt>
                      <dd className={device.heartbeat_stale ? 'is-warning' : ''}>{formatAgo(device.last_seen, DEMO_NOW)}</dd>
                    </div>
                    <div>
                      <dt>上傳成功率</dt>
                      <dd className={device.upload_success_rate < 95 ? 'is-warning' : ''}>{device.upload_success_rate}%</dd>
                    </div>
                    <div>
                      <dt>近 7 日有效監測</dt>
                      <dd>{device.monitoring_hours_7d} / 168 h</dd>
                    </div>
                  </dl>

                  <div className="device-monitor-card__connection">
                    <span className={`connection-dot connection-dot--${device.status}`} />
                    <span>{device.network} · {device.signal_strength} dBm</span>
                    <time>{formatDateTime(device.last_seen)}</time>
                  </div>

                  <details className="device-monitor-card__engineering">
                    <summary>工程遙測（電力、記憶體、處理器、溫度）</summary>
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
                  </details>

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
