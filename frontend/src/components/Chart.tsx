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

  const formatTooltip = (timestamp: string) =>
    new Date(timestamp).toLocaleString('zh-TW', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  return (
    <div className="p-5 border-r border-b border-slate-800/80 last:border-r-0 [&:nth-child(even)]:border-r-0">
      <p className="text-xs font-semibold text-slate-400 tracking-wider mb-4 pl-3 border-l-2 border-cyan-500/60">
        {title}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            minTickGap={60}
            tick={{ fill: '#475569', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#475569', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            labelFormatter={formatTooltip}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid rgba(148,163,184,0.15)',
              borderRadius: 10,
              color: '#e2e8f0',
              fontSize: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
            labelStyle={{ color: '#94a3b8', marginBottom: 4, fontSize: 11 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }}
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
