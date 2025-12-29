interface PowerCardProps {
  power: number | null;
  voltage: number | null;
  current: number | null;
}

function PowerCard({ power, voltage, current }: PowerCardProps) {
  const displayValue = power !== null
    ? power.toFixed(3)  // 顯示到小數點後 3 位（毫級精度）
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
      {power !== null && voltage !== null && current !== null && (
        <div className="power-formula">
          P = V × I = {voltage.toFixed(3)} × {current.toFixed(3)}
        </div>
      )}
    </div>
  );
}

export default PowerCard;
