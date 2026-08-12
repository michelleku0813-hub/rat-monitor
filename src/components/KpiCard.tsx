interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: 'up' | 'down' | 'neutral';
}

export function KpiCard({ label, value, unit, hint, tone }: KpiCardProps) {
  return (
    <article className="kpi-card">
      <div className="kpi-card__label">{label}</div>
      <div className={`kpi-card__value ${tone ?? ''}`}>
        {value}
        {unit ? <span className="kpi-card__unit">{unit}</span> : null}
      </div>
      {hint ? <div className="kpi-card__hint">{hint}</div> : null}
    </article>
  );
}
