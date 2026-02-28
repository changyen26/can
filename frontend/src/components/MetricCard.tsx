interface MetricCardProps {
  label: string;
  value: number | null;
  unit: string;
  icon: string;
}

function MetricCard({ label, value, unit, icon }: MetricCardProps) {
  const displayValue = value !== null && value !== undefined
    ? typeof value === 'number'
      ? Math.abs(value) < 0.01
        ? value.toFixed(6)
        : value.toFixed(3)
      : value
    : '--';

  return (
    <div className="metric-card">
      <div className="metric-label">
        <span className="metric-icon">{icon}</span>
        {label}
      </div>
      <div className="metric-value">
        <span>{displayValue}</span>
        <span className="metric-unit">{unit}</span>
      </div>
    </div>
  );
}

export default MetricCard;
