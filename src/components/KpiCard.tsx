import type { ReactNode } from 'react';
import { InfoTip } from './InfoTip';

interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  hint?: ReactNode;
  /** Semantic tone for the value: 'up' = worse (more activity), 'down' = better. */
  tone?: 'up' | 'down' | 'neutral' | 'alert';
  /** Formula and limitations, shown behind an ⓘ. */
  info?: ReactNode;
  /** Small trend line; values are plotted left→right. */
  sparkline?: number[];
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - 3 - ((v - min) / span) * (h - 6),
  ]);
  const [lx, ly] = points[points.length - 1];

  return (
    <svg className="kpi-card__spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline
        points={points.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lx} cy={ly} r="3" fill="currentColor" />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  hint,
  tone,
  info,
  sparkline,
}: KpiCardProps) {
  return (
    <article className="kpi-card">
      <div className="kpi-card__label">
        <span>{label}</span>
        {info ? <InfoTip label={`${label} 說明`}>{info}</InfoTip> : null}
      </div>
      <div className="kpi-card__body">
        <div className={`kpi-card__value ${tone ?? ''}`}>
          {value}
          {unit ? <span className="kpi-card__unit">{unit}</span> : null}
        </div>
        {sparkline ? <Sparkline values={sparkline} /> : null}
      </div>
      {hint ? <div className="kpi-card__hint">{hint}</div> : null}
    </article>
  );
}
