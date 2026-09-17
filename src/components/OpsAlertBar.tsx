import { Link } from 'react-router-dom';
import type { OpsAlert, OpsAlertKind } from '../types';
import { useAsyncData } from '../hooks/useAsyncData';
import { getOpsAlerts } from '../services/dataService';

const KIND_LABEL: Record<OpsAlertKind, string> = {
  spike: '活動突增',
  device_offline: '設備失聯',
  tamper: '畫面異常',
  review: '資料品質',
};

/** `actionableOnly` hides informational items (e.g. review backlog) for a calmer overview. */
export function OpsAlertBar({ actionableOnly = false }: { actionableOnly?: boolean }) {
  const { data, loading } = useAsyncData(() => getOpsAlerts(), []);

  if (loading && !data) {
    return <div className="ops-alerts ops-alerts--loading">載入告警…</div>;
  }

  const alerts = (data ?? []).filter((a) => !actionableOnly || a.severity !== 'info');
  if (alerts.length === 0) {
    return (
      <div className="ops-alerts ops-alerts--ok" role="status">
        <span className="ops-alerts__ok-label">營運狀態正常</span>
        <span className="ops-alerts__ok-detail">目前無待處理告警（Demo）</span>
      </div>
    );
  }

  return (
    <div className="ops-alerts" role="list" aria-label="營運告警">
      {alerts.map((alert: OpsAlert) => (
        <Link
          key={alert.id}
          to={alert.href}
          className={`ops-alert ops-alert--${alert.severity}`}
          role="listitem"
        >
          <span className="ops-alert__sev">{KIND_LABEL[alert.kind]}</span>
          <span className="ops-alert__body">
            <strong>{alert.title}</strong>
            <span>{alert.detail}</span>
          </span>
          <span className="ops-alert__go" aria-hidden>
            →
          </span>
        </Link>
      ))}
    </div>
  );
}
