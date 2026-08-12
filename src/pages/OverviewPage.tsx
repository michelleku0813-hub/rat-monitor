import {
  getDashboardSummary,
  getDailyActivity,
  getHourlyActivity,
  getLocationActivity,
} from '../services/dataService';
import { useAsyncData } from '../hooks/useAsyncData';
import { KpiCard } from '../components/KpiCard';
import { Panel } from '../components/Panel';
import { DailyLineChart, HourlyBarChart, LocationBarChart } from '../components/Charts';
import { LiveMonitor } from '../components/LiveMonitor';
import { OpsAlertBar } from '../components/OpsAlertBar';
import { RecentEventsStrip } from '../components/RecentEventsStrip';
import { formatPercent, formatTime } from '../utils/format';

export function OverviewPage() {
  const summary = useAsyncData(() => getDashboardSummary(), []);
  const hourly = useAsyncData(() => getHourlyActivity(), []);
  const daily = useAsyncData(() => getDailyActivity({ days: 7 }), []);
  const locations = useAsyncData(() => getLocationActivity({ days: 7 }), []);

  if (summary.loading || !summary.data) {
    return <div className="loading">載入 Overview…</div>;
  }

  const s = summary.data;
  const changeTone =
    s.change_percentage > 0 ? 'up' : s.change_percentage < 0 ? 'down' : 'neutral';

  return (
    <div>
      <header className="page-header">
        <h1>
          Overview
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>
          以「鼠隻活動偵測事件」（Detection Events）呈現監測概況。事件數不等於老鼠個體數或族群數。
        </p>
      </header>

      <div className="kpi-grid">
        <KpiCard
          label="今日鼠隻活動"
          value={s.today_events}
          unit="次事件"
          hint="今日有效 Detection Event"
        />
        <KpiCard
          label="較昨日"
          value={formatPercent(s.change_percentage)}
          tone={changeTone}
          hint={`昨日 ${s.yesterday_events} 次事件`}
        />
        <KpiCard
          label="活動高峰時段"
          value={s.peak_hour}
          hint="當日事件數最高時段"
        />
        <KpiCard
          label="最高活動場域"
          value={s.highest_activity_location}
          hint="近 7 日事件數（Prototype）"
        />
        <KpiCard
          label="設備在線狀態"
          value={`${s.online_devices} / ${s.total_devices}`}
          hint="正常回報設備數"
        />
        <KpiCard
          label="最近一次鼠隻活動"
          value={formatTime(s.latest_detection)}
          hint="最近一筆 Detection Event"
        />
      </div>

      <OpsAlertBar />

      <div className="overview-stack">
        <LiveMonitor />
        <RecentEventsStrip />
      </div>

      <div className="chart-grid">
        <Panel
          title="24 小時鼠隻活動分布"
          subtitle="回答：每天什麼時間最常偵測到鼠隻活動？"
        >
          {hourly.data ? <HourlyBarChart data={hourly.data} /> : <div className="loading">…</div>}
          <p className="note">Y 軸為 Detection Events（事件數），非老鼠個體數。</p>
        </Panel>

        <Panel
          title="最近 7 日鼠隻活動趨勢"
          subtitle="觀察鼠隻活動是否增加或降低"
        >
          {daily.data ? <DailyLineChart data={daily.data} /> : <div className="loading">…</div>}
        </Panel>
      </div>

      <div className="chart-grid chart-grid--full">
        <Panel
          title="場域活動比較"
          subtitle="Prototype 使用原始事件數；正式版建議 Events / 100 Monitoring Hours"
        >
          {locations.data ? (
            <LocationBarChart data={locations.data} />
          ) : (
            <div className="loading">…</div>
          )}
          <p className="note">
            正式版應優先採標準化指標，避免因監測時數不同造成比較偏差。
          </p>
        </Panel>
      </div>
    </div>
  );
}
