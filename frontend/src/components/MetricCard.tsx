interface MetricCardProps {
  label: string;
  value: number | null;
  unit: string;
}

function MetricCard({ label, value, unit }: MetricCardProps) {
  const displayValue = value !== null && value !== undefined
    ? typeof value === 'number'
      ? Math.abs(value) < 0.01
        ? value.toFixed(6)  // 極小數值顯示 6 位（微級精度，如 0.000781 A）
        : value.toFixed(3)  // 一般數值顯示 3 位（毫級精度）
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
