import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyActivity, HourlyActivity, LocationActivity } from '../types';
import { formatDate } from '../utils/format';

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #d5dde5',
  borderRadius: 4,
  fontSize: 12,
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
            tick={{ fontSize: 11, fill: '#8494a4' }}
            axisLine={{ stroke: '#d5dde5' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#8494a4' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(h) => `${String(h).padStart(2, '0')}:00–${String((Number(h) + 1) % 24).padStart(2, '0')}:00`}
            formatter={(value) => [`${value} 事件`, 'Detection Events']}
          />
          <Bar dataKey="events" fill="var(--chart-bar)" radius={[2, 2, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyLineChart({ data }: { data: DailyActivity[] }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatDate(d)}
            tick={{ fontSize: 11, fill: '#8494a4' }}
            axisLine={{ stroke: '#d5dde5' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#8494a4' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(d) => String(d)}
            formatter={(value) => [`${value} 事件`, 'Detection Events']}
          />
          <Line
            type="monotone"
            dataKey="events"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--chart-line)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LocationBarChart({ data }: { data: LocationActivity[] }) {
  return (
    <div className="chart-wrap chart-wrap--sm">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#8494a4' }}
            axisLine={{ stroke: '#d5dde5' }}
            tickLine={false}
          />
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
            formatter={(value, _name, item) => {
              const row = item?.payload as LocationActivity | undefined;
              return [
                `${value} 事件（${row?.events_per_100_hours ?? '—'} / 100h）`,
                'Detection Events',
              ];
            }}
          />
          <Bar dataKey="events" fill="var(--chart-bar)" radius={[0, 2, 2, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
