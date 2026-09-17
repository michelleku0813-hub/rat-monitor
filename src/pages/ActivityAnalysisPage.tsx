import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getActivityProfile,
  getDailyActivity,
  getHeatmap,
  getHourlyActivity,
  getRodentAbsenceRate,
} from '../services/dataService';
import { LOCATIONS } from '../data/mock/locations';
import { useAsyncData } from '../hooks/useAsyncData';
import { Panel } from '../components/Panel';
import { DailyLineChart, DurationHistogram, HourlyBarChart } from '../components/Charts';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { MethodologyBar } from '../components/MethodologyBar';
import { InfoTip } from '../components/InfoTip';
import { formatDuration } from '../utils/format';
import type { ActivityFilters } from '../types';

export function ActivityAnalysisPage() {
  const [searchParams] = useSearchParams();
  const [days, setDays] = useState<7 | 14 | 30>(30);
  const [locationId, setLocationId] = useState(searchParams.get('location') ?? 'all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filters: ActivityFilters = useMemo(
    () => ({
      days,
      location_id: locationId === 'all' ? undefined : locationId,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }),
    [days, locationId, startDate, endDate],
  );

  const heatmap = useAsyncData(() => getHeatmap(filters), [filters]);
  const daily = useAsyncData(() => getDailyActivity(filters), [filters]);
  const profile = useAsyncData(() => getActivityProfile(filters), [filters]);
  const hourly = useAsyncData(() => getHourlyActivity(filters), [filters]);
  // RAR is defined over whole nights, so it follows the rolling day range only.
  const rar = useAsyncData(
    () => getRodentAbsenceRate({ days, location_id: filters.location_id }),
    [days, filters.location_id],
  );
  const rangeLabel = startDate || endDate ? '自訂區間' : `近 ${days} 日`;

  return (
    <div>
      <header className="page-header">
        <h1>
          活動分析
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>
          分析「何時最活躍、趨勢往哪走、是路過還是逗留」。所有數值皆為去重後的獨立活動事件，非老鼠族群數。
        </p>
      </header>

      <MethodologyBar />

      <div className="filters">
        <div className="filter-field">
          <label htmlFor="loc">場域篩選</label>
          <select id="loc" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="all">全部場域</option>
            {LOCATIONS.map((loc) => (
              <option key={loc.location_id} value={loc.location_id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="days">分析區間</label>
          <select
            id="days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 14 | 30)}
          >
            <option value={7}>近 7 天</option>
            <option value={14}>近 14 天</option>
            <option value={30}>近 30 天</option>
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="start">起始日期</label>
          <input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div className="filter-field">
          <label htmlFor="end">結束日期</label>
          <input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <Panel
          title="星期 × 小時 Heatmap"
          subtitle={`${rangeLabel} · 各格為該星期該時段的平均活動事件數，用來安排巡查人力`}
        >
          {heatmap.loading || !heatmap.data ? (
            <div className="loading">載入熱力圖…</div>
          ) : (
            <ActivityHeatmap data={heatmap.data} />
          )}
        </Panel>

        <Panel title="每日趨勢" subtitle={`${rangeLabel} · 每日獨立活動事件與 7 日移動平均`}>
          {daily.loading || !daily.data ? (
            <div className="loading">載入趨勢…</div>
          ) : (
            <DailyLineChart data={daily.data} />
          )}
          <p className="note">
            滑鼠移到資料點可看當日有效監測小時與每 100 小時事件數；監測時數偏低的日子，事件數會被低估。
          </p>
        </Panel>

        <div className="chart-grid">
          <Panel title="24 小時活動分布" subtitle={`${rangeLabel} · 各時段平均活動事件數／日`}>
            {hourly.data ? <HourlyBarChart data={hourly.data} /> : <div className="loading">…</div>}
          </Panel>

          <Panel
            title="事件持續時間分布"
            subtitle={
              profile.data
                ? `${rangeLabel} · 中位數 ${formatDuration(profile.data.median_duration_sec)}；短＝路過、長＝逗留覓食`
                : rangeLabel
            }
          >
            {profile.data ? (
              <DurationHistogram data={profile.data.duration_buckets} />
            ) : (
              <div className="loading">…</div>
            )}
            <p className="note">追蹤中斷時持續時間會被低估。</p>
          </Panel>
        </div>

        <div className="chart-grid chart-grid--even">
          <Panel title="無鼠率（RAR）" subtitle={`近 ${days} 夜 · 19:00–07:00 · 越高越好`}>
            {rar.data ? (
              <div className="share-meter">
                <div className="share-meter__value">
                  {rar.data.value ?? '—'}
                  <span>%</span>
                  <InfoTip label="無鼠率說明">
                    參考香港食環署：每晚 19:00–07:00 切成 2 分鐘片段，無活動片段 ÷ 有效片段。設備離線或畫面遮蔽的片段不列入，避免「看不見」被當成「無鼠」。
                  </InfoTip>
                </div>
                <div className="share-meter__bar" aria-hidden>
                  <span style={{ width: `${rar.data.value ?? 0}%` }} />
                </div>
                <div className="share-meter__legend">
                  <span>
                    <i className="share-meter__swatch share-meter__swatch--night" /> 無活動片段{' '}
                    {(rar.data.valid_slices - rar.data.rodent_slices).toLocaleString()}
                  </span>
                  <span>
                    <i className="share-meter__swatch share-meter__swatch--day" /> 有活動片段 {rar.data.rodent_slices}
                  </span>
                </div>
              </div>
            ) : (
              <div className="loading">…</div>
            )}
          </Panel>

          <Panel title="夜間活動占比" subtitle={`${rangeLabel} · 19:00–07:00`}>
            {profile.data ? (
              <div className="share-meter">
                <div className="share-meter__value">
                  {profile.data.nocturnal_share}
                  <span>%</span>
                  <InfoTip label="夜間占比說明">
                    夜間事件 ÷ 全部事件。鼠類多夜行，占比明顯偏低時應檢查是否有白天誤報（光影、垃圾晃動）。下水道等場域日夜皆可能活動。
                  </InfoTip>
                </div>
                <div className="share-meter__bar" aria-hidden>
                  <span style={{ width: `${profile.data.nocturnal_share}%` }} />
                </div>
                <div className="share-meter__legend">
                  <span>
                    <i className="share-meter__swatch share-meter__swatch--night" /> 夜間 {profile.data.nocturnal_events} 次
                  </span>
                  <span>
                    <i className="share-meter__swatch share-meter__swatch--day" /> 日間{' '}
                    {profile.data.total_events - profile.data.nocturnal_events} 次
                  </span>
                </div>
              </div>
            ) : (
              <div className="loading">…</div>
            )}
          </Panel>

        </div>
      </div>
    </div>
  );
}
