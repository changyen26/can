interface MetricCardProps {
  label: string;
  value: number | null;
  unit: string;
}

function MetricCard({ label, value, unit }: MetricCardProps) {
  const displayValue = value !== null && value !== undefined
    ? typeof value === 'number' && !Number.isInteger(value)
      ? value.toFixed(2)
      : value
    : '--';

  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        <span>{displayValue}</span>
        <span className="metric-unit">{unit}</span>
      </div>
    </div>
  );
}

export default MetricCard;
