import { Link } from 'react-router-dom';
import { getDashboardSummary, getDailyActivity, getLocationActivity } from '../services/dataService';
import { useAsyncData } from '../hooks/useAsyncData';
import { KpiCard } from '../components/KpiCard';
import { Panel } from '../components/Panel';
import { DailyLineChart, LocationRankChart } from '../components/Charts';
import { LiveMonitor } from '../components/LiveMonitor';
import { OpsAlertBar } from '../components/OpsAlertBar';
import { DeadRatSimulator } from '../components/DeadRatSimulator';
import { MethodologyBar } from '../components/MethodologyBar';
import { formatChange } from '../utils/format';

const TOP_N = 5;

export function OverviewPage() {
  const summary = useAsyncData(() => getDashboardSummary(), []);
  const daily = useAsyncData(() => getDailyActivity({ days: 14 }), []);
  const locations = useAsyncData(() => getLocationActivity({ days: 7 }), []);

  if (summary.loading || !summary.data) {
    return <div className="loading">載入 Overview…</div>;
  }

  const s = summary.data;
  const rate = s.events_per_100h;
  const trendArrow = s.trend.direction === 'up' ? '↑' : s.trend.direction === 'down' ? '↓' : '→';
  const trendWord = s.trend.direction === 'up' ? '上升' : s.trend.direction === 'down' ? '下降' : '持平';
  const anomaly = s.anomalies.top;
  const deviceIssues = [
    s.devices.stale ? `${s.devices.stale} 台失聯` : '',
    s.devices.camera_issues ? `${s.devices.camera_issues} 台畫面異常` : '',
  ].filter(Boolean);

  return (
    <div>
      <header className="page-header">
        <h1>
          城市監測總覽
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>鼠隻活動水位、走向、優先處理場域與設備可信度。活動事件不等於老鼠數量。</p>
      </header>

      <div className="kpi-grid kpi-grid--overview">
        <KpiCard
          label="每 100 監測小時活動事件"
          value={rate.value}
          unit="次"
          hint={`近 7 日 · 前 7 日 ${rate.previous}`}
          info={
            <>
              <strong>(獨立活動事件 ÷ 有效監測小時) × 100</strong>
              <span>
                近 7 日 {rate.events} 事件 ÷ {rate.monitoring_hours} 小時。可跨場域公平比較；離線或畫面遮蔽的時段不計入分母。
              </span>
              <span>相對活動指標，不代表老鼠數量或密度。</span>
            </>
          }
        />
        <KpiCard
          label="近 7 日趨勢"
          value={`${trendArrow} ${formatChange(s.trend.change_percentage)}`}
          unit={trendWord}
          tone={s.trend.direction === 'flat' ? 'neutral' : s.trend.direction}
          sparkline={s.trend.sparkline}
          hint={`日均 ${s.trend.last7_daily_avg} 次`}
          info={
            <>
              <strong>近 7×24 小時 vs 前 7×24 小時事件數</strong>
              <span>
                前 7 日日均 {s.trend.prev7_daily_avg} 次；變動未達 ±10% 視為持平。小圖為近 14 日的 7 日移動平均。
              </span>
            </>
          }
        />
        <KpiCard
          label="異常增加警示"
          value={s.anomalies.open}
          unit="處"
          tone={s.anomalies.open > 0 ? 'alert' : 'neutral'}
          hint={
            anomaly ? (
              <Link to={`/analysis?location=${anomaly.location_id}`} className="kpi-card__link">
                {anomaly.location_name} →
              </Link>
            ) : (
              '各場域均在基線內'
            )
          }
          info={
            <>
              <strong>穩健 z 分數 &gt; 3 觸發</strong>
              <span>今日截至目前的事件數，對照前 28 日同一時間點的中位數與 MAD。</span>
              {anomaly ? (
                <span>
                  {anomaly.location_name}：今日 {anomaly.metric_value} 次、基線 {anomaly.baseline_value}，z = {anomaly.z_score}
                </span>
              ) : null}
            </>
          }
        />
        <KpiCard
          label="設備有效監測率"
          value={s.devices.effective_rate}
          unit="%"
          tone={s.devices.effective_rate < 80 ? 'alert' : 'neutral'}
          hint={
            deviceIssues.length ? (
              <Link to="/devices" className="kpi-card__link">
                {deviceIssues.join(' · ')} →
              </Link>
            ) : (
              `${s.devices.total} 台皆正常`
            )
          }
          info={
            <>
              <strong>在線、有心跳、且畫面正常的設備比例</strong>
              <span>「在線」不等於「看得見」：鏡頭遮蔽或起霧時資料有缺口。先修設備，再信數據。</span>
            </>
          }
        />
      </div>

      <OpsAlertBar actionableOnly />

      <div className="chart-grid">
        <Panel title="近 14 日活動趨勢" subtitle="每日活動事件與 7 日移動平均">
          {daily.data ? <DailyLineChart data={daily.data} /> : <div className="loading">…</div>}
        </Panel>

        <Panel
          title={`場域風險排名 Top ${TOP_N}`}
          subtitle="近 7 日每 100 監測小時事件數"
          action={
            <Link to="/locations" className="panel-link">
              分級依據
            </Link>
          }
        >
          {locations.data ? (
            <LocationRankChart data={locations.data.slice(0, TOP_N)} />
          ) : (
            <div className="loading">…</div>
          )}
        </Panel>
      </div>

      <h2 className="section-heading">現場即時</h2>
      <div className="overview-stack">
        <LiveMonitor />
      </div>

      <DeadRatSimulator />

      <MethodologyBar />
    </div>
  );
}
