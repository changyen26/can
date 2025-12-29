interface PowerCardProps {
  power: number | null;
  voltage: number | null;
  current: number | null;
}

function PowerCard({ power, voltage, current }: PowerCardProps) {
  const formatValue = (val: number | null) => {
    if (val === null) return '--';
    return Math.abs(val) < 0.01 ? val.toFixed(6) : val.toFixed(3);
  };

  const displayValue = formatValue(power);

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
      {power !== null && voltage !== null && current !== null && (
        <div className="power-formula">
          P = V × I = {formatValue(voltage)} × {formatValue(current)}
        </div>
      )}
    </div>
  );
}

export default PowerCard;
