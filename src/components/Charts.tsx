import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyActivity, HourlyActivity, LocationActivity } from '../types';
import { formatChange, formatDate, riskLevelLabel } from '../utils/format';

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #d5dde5',
  borderRadius: 4,
  fontSize: 12,
};

const axisTick = { fontSize: 11, fill: '#8494a4' };

const RISK_FILL: Record<string, string> = {
  low: 'var(--risk-low)',
  medium: 'var(--risk-medium)',
  high: 'var(--risk-high)',
};

export function HourlyBarChart({ data }: { data: HourlyActivity[] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={(h) => String(h).padStart(2, '0')}
            tick={axisTick}
            axisLine={{ stroke: '#d5dde5' }}
            tickLine={false}
          />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v) => String(Math.round(Number(v) * 10) / 10)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'rgba(11, 79, 108, 0.06)' }}
            labelFormatter={(h) =>
              `${String(h).padStart(2, '0')}:00–${String((Number(h) + 1) % 24).padStart(2, '0')}:00`
            }
            formatter={(value, _name, item) => {
              const row = item?.payload as HourlyActivity | undefined;
              return [`平均 ${value} 次／日（合計 ${row?.events ?? 0}）`, '活動事件'];
            }}
          />
          <Bar dataKey="avg_per_day" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Daily independent events with a 7-day moving average overlay. */
export function DailyLineChart({ data }: { data: DailyActivity[] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatDate(d)}
            tick={axisTick}
            axisLine={{ stroke: '#d5dde5' }}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(d) => String(d)}
            formatter={(value, name, item) => {
              const row = item?.payload as DailyActivity | undefined;
              if (name === 'ma7') return [value ?? '—', '7 日移動平均'];
              return [
                `${value} 次（每 100h ${row?.events_per_100h ?? '—'}，監測 ${row?.monitoring_hours ?? 0}h）`,
                '每日活動事件',
              ];
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={24}
            iconSize={10}
            wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
            formatter={(name) => (name === 'ma7' ? '7 日移動平均' : '每日活動事件')}
          />
          <Line
            type="monotone"
            dataKey="events"
            stroke="var(--chart-bar-soft)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--chart-bar-soft)', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="ma7"
            stroke="var(--chart-line)"
            strokeWidth={2.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Sites ranked by Events / 100 monitoring hours, colored by risk level. */
export function LocationRankChart({ data }: { data: LocationActivity[] }) {
  const height = Math.max(160, data.length * 52 + 32);
  return (
    <div className="chart-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 72, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis type="number" tick={axisTick} axisLine={{ stroke: '#d5dde5' }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="location_name"
            width={64}
            tick={{ fontSize: 12, fill: '#5a6a7a' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'rgba(11, 79, 108, 0.06)' }}
            formatter={(value, _name, item) => {
              const row = item?.payload as LocationActivity | undefined;
              return [
                `${value}（${row?.events ?? 0} 事件 ÷ ${row?.monitoring_hours ?? 0} 監測小時）· 趨勢 ${formatChange(row?.risk.trend_change_percentage ?? null)} · ${riskLevelLabel(row?.risk.level ?? '')}風險`,
                '每 100 監測小時事件數',
              ];
            }}
          />
          <Bar
            dataKey="events_per_100_hours"
            radius={[0, 4, 4, 0]}
            maxBarSize={26}
            isAnimationActive={false}
          >
            {data.map((row) => (
              <Cell key={row.location_id} fill={RISK_FILL[row.risk.level]} />
            ))}
            <LabelList
              dataKey="events_per_100_hours"
              position="right"
              content={(props) => {
                const { x = 0, y = 0, width = 0, height: h = 0, index = 0 } = props as {
                  x?: number;
                  y?: number;
                  width?: number;
                  height?: number;
                  index?: number;
                };
                const row = data[index];
                return (
                  <text
                    x={Number(x) + Number(width) + 8}
                    y={Number(y) + Number(h) / 2}
                    dominantBaseline="central"
                    fontSize={12}
                    fill="var(--text-secondary)"
                  >
                    {row.events_per_100_hours} · {riskLevelLabel(row.risk.level)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DurationHistogram({ data }: { data: { label: string; events: number }[] }) {
  return (
    <div className="chart-wrap chart-wrap--sm">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: '#d5dde5' }} tickLine={false} />
          <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'rgba(11, 79, 108, 0.06)' }}
            formatter={(value) => [`${value} 次`, '活動事件']}
          />
          <Bar
            dataKey="events"
            fill="var(--chart-bar)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
