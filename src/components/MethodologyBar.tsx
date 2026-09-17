import { useAsyncData } from '../hooks/useAsyncData';
import { getMetricMeta } from '../services/dataService';
import { formatDateTime } from '../utils/format';
import { InfoTip } from './InfoTip';

/** Disclosure strip: when data was updated and which rules produced the numbers. */
export function MethodologyBar() {
  const { data } = useAsyncData(() => getMetricMeta(), []);
  if (!data) return null;

  return (
    <div className="method-bar" role="note" aria-label="指標方法說明">
      <span>
        資料更新 <b>{formatDateTime(data.data_updated_at)}</b>
      </span>
      <span>
        去重間隔 T <b>{data.independence_interval_sec / 60} 分鐘</b>
        <InfoTip label="去重間隔說明">
          同一 Tracking ID 的連續軌跡算 1 次事件；消失超過 T 後再出現才算新事件。T 不同，事件數就不同，跨期比較須使用相同 T。
        </InfoTip>
      </span>
      <span>
        模型 <b className="mono">{data.model_version}</b>
      </span>
      <span>
        人工複核率 <b>{data.review_rate}%</b>
        <span className="method-bar__muted">（近 30 日，誤報 {data.false_positive_count} 筆已排除）</span>
      </span>
      <span className="method-bar__rule">活動事件 ≠ 老鼠數量</span>
    </div>
  );
}
