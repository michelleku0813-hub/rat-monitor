import type { HeatmapCell } from '../types';
import { WEEKDAY_LABELS } from '../utils/format';

interface HeatmapProps {
  data: HeatmapCell[];
}

function cellColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return '#eef2f6';
  const t = value / max;
  // Teal scale — civic / public-health tone
  if (t < 0.25) return '#c8e6e1';
  if (t < 0.5) return '#7ec4b8';
  if (t < 0.75) return '#3a9a8c';
  return '#1b7a6e';
}

export function ActivityHeatmap({ data }: HeatmapProps) {
  const max = Math.max(...data.map((c) => c.events), 0);
  const lookup = new Map(data.map((c) => [`${c.weekday}-${c.hour}`, c.events]));

  return (
    <div className="heatmap">
      <table className="heatmap-table" aria-label="星期與小時活動熱力圖">
        <thead>
          <tr>
            <th aria-hidden />
            {Array.from({ length: 24 }, (_, h) => (
              <th key={h}>{String(h).padStart(2, '0')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAY_LABELS.map((label, weekday) => (
            <tr key={weekday}>
              <td className="row-label">週{label}</td>
              {Array.from({ length: 24 }, (_, hour) => {
                const events = lookup.get(`${weekday}-${hour}`) ?? 0;
                return (
                  <td key={hour}>
                    <div
                      className="heatmap-cell"
                      style={{ background: cellColor(events, max) }}
                      title={`週${label} ${String(hour).padStart(2, '0')}:00 — ${events} 事件`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heatmap-legend">
        <span>低</span>
        <div className="heatmap-legend__bar" aria-hidden>
          <span style={{ background: '#eef2f6' }} />
          <span style={{ background: '#c8e6e1' }} />
          <span style={{ background: '#7ec4b8' }} />
          <span style={{ background: '#3a9a8c' }} />
          <span style={{ background: '#1b7a6e' }} />
        </div>
        <span>高（Detection Event Count）</span>
      </div>
    </div>
  );
}
