import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { HistoryDataPoint } from '../types';

interface ChartMetric {
  key: string;
  label: string;
  color: string;
}

interface ChartProps {
  title: string;
  data: HistoryDataPoint[];
  metrics: ChartMetric[];
  timeRange: string;
}

function Chart({ title, data, metrics, timeRange }: ChartProps) {
  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp);
    if (timeRange === '24h') {
      return date.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatTooltipLabel = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            minTickGap={60}
            tick={{ fill: '#7a9cc0', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#7a9cc0', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip
            labelFormatter={formatTooltipLabel}
            contentStyle={{
              background: '#0f1729',
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: 8,
              color: '#e0e0e0',
              fontSize: 12,
            }}
            labelStyle={{ color: '#00d4ff', marginBottom: 4 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#b0b0b0', paddingTop: 8 }}
          />
          {metrics.map((metric) => (
            <Line
              key={metric.key}
              type="monotone"
              dataKey={metric.key}
              stroke={metric.color}
              name={metric.label}
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default Chart;
