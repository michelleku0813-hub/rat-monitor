import { Link } from 'react-router-dom';
import type { OpsAlert } from '../types';
import { useAsyncData } from '../hooks/useAsyncData';
import { getOpsAlerts } from '../services/dataService';

export function OpsAlertBar() {
  const { data, loading } = useAsyncData(() => getOpsAlerts(), []);

  if (loading && !data) {
    return <div className="ops-alerts ops-alerts--loading">載入告警…</div>;
  }

  const alerts = data ?? [];
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
          <span className="ops-alert__sev">{alert.severity}</span>
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
