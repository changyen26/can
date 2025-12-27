interface PowerCardProps {
  voltage: number | null;
  current: number | null;
}

function PowerCard({ voltage, current }: PowerCardProps) {
  const power = voltage !== null && current !== null ? voltage * current : null;

  const displayValue = power !== null
    ? power.toFixed(2)
    : '--';

  const getPowerStatus = () => {
    if (power === null) return 'unknown';
    if (power < 10) return 'low';
    if (power < 20) return 'normal';
    return 'high';
  };

  const status = getPowerStatus();

  return (
    <div className={`metric-card power-card ${status}`}>
      <div className="metric-label">⚡ 功率輸出</div>
      <div className="metric-value">
        <span>{displayValue}</span>
        <span className="metric-unit">W</span>
      </div>
      {power !== null && (
        <div className="power-formula">
          P = V × I = {voltage?.toFixed(2)} × {current?.toFixed(2)}
        </div>
      )}
    </div>
  );
}

export default PowerCard;
