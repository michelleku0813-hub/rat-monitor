import { useMemo, useState } from 'react';
import { getDailyActivity, getHeatmap } from '../services/dataService';
import { LOCATIONS } from '../data/mock/locations';
import { useAsyncData } from '../hooks/useAsyncData';
import { Panel } from '../components/Panel';
import { DailyLineChart } from '../components/Charts';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import type { ActivityFilters } from '../types';

export function ActivityAnalysisPage() {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [locationId, setLocationId] = useState('all');
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

  return (
    <div>
      <header className="page-header">
        <h1>
          Activity Analysis
          <span className="demo-chip">Demo Data</span>
        </h1>
        <p>
          進階分析「星期 × 小時」活動模式與趨勢。指標皆為 Detection Event Count，非老鼠族群數。
        </p>
      </header>

      <div className="filters">
        <div className="filter-field">
          <label htmlFor="loc">場域篩選</label>
          <select
            id="loc"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="all">All Locations</option>
            {LOCATIONS.map((loc) => (
              <option key={loc.location_id} value={loc.location_id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="days">每日趨勢區間</label>
          <select
            id="days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 14 | 30)}
          >
            <option value={7}>7 天</option>
            <option value={14}>14 天</option>
            <option value={30}>30 天</option>
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="start">Start Date</label>
          <input
            id="start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="end">End Date</label>
          <input
            id="end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <Panel
          title="星期 × 小時 Heatmap"
          subtitle="找出「星期＋時間」組合的鼠隻活動高峰"
        >
          {heatmap.loading || !heatmap.data ? (
            <div className="loading">載入熱力圖…</div>
          ) : (
            <ActivityHeatmap data={heatmap.data} />
          )}
        </Panel>

        <Panel title="每日趨勢" subtitle={`近 ${days} 日 Detection Events`}>
          {daily.loading || !daily.data ? (
            <div className="loading">載入趨勢…</div>
          ) : (
            <DailyLineChart data={daily.data} />
          )}
          <p className="note">
            Prototype Mock 資料涵蓋最近 7 天；選擇 14 / 30 天時，超出範圍日期可能為 0。
          </p>
        </Panel>
      </div>
    </div>
  );
}
