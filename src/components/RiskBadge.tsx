import type { RiskAssessment } from '../types';
import { formatPercent, riskLevelLabel } from '../utils/format';
import { InfoTip } from './InfoTip';

/** Risk level with its full, public derivation — never a black-box score. */
export function RiskBadge({ risk, showInfo = true }: { risk: RiskAssessment; showInfo?: boolean }) {
  const t = risk.thresholds;
  return (
    <span className="risk-badge-wrap">
      <span className={`risk-badge risk-badge--${risk.level}`}>
        <span className="risk-badge__icon" aria-hidden>
          {risk.level === 'high' ? '▲' : risk.level === 'medium' ? '◆' : '●'}
        </span>
        {riskLevelLabel(risk.level)}風險
      </span>
      {showInfo ? (
        <InfoTip label="風險分級依據">
          <strong>分級規則（Prototype 門檻，需依場域校正）</strong>
          <span>
            ① 每 100 監測小時事件數 {risk.events_per_100h}：≥{t.high} 高、≥{t.medium} 中，否則低 →
            基礎「{riskLevelLabel(risk.base_level)}」
          </span>
          <span>
            ② 近 7 日趨勢{' '}
            {risk.trend_change_percentage === null ? '—' : formatPercent(risk.trend_change_percentage)}
            ：≥ +{t.trend_up}% 且事件數 ≥ {t.trend_min_events} 時升一級
            {risk.trend_escalated ? '（已升級）' : ''}
          </span>
          <span>③ 今日有異常增加警示時升一級{risk.anomaly_escalated ? '（已升級）' : ''}</span>
        </InfoTip>
      ) : null}
    </span>
  );
}
