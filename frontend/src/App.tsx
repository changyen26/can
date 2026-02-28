import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zap, Wind, Sun, Thermometer, Droplets, Gauge,
  AlertTriangle, X, Activity, ChevronDown, BarChart3, Radio
} from 'lucide-react';
import { api } from './api';
import { Device, DeviceData, HistoryDataPoint, TimeRange } from './types';
import Chart from './components/Chart';

function BackgroundAnimation() {
  const windLines = Array.from({ length: 20 });
  const sparks = Array.from({ length: 40 });
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <style>{`
        @keyframes wind-blow {
          0% { transform: translateX(-20vw); opacity: 0; }
          15% { opacity: 0.8; }
          85% { opacity: 0.8; }
          100% { transform: translateX(120vw); opacity: 0; }
        }
        @keyframes spark-float {
          0% { transform: translateY(100vh) scale(0.5); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-10vh) scale(1.5); opacity: 0; }
        }
        @keyframes sun-pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }
        @keyframes green-pulse {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.25); opacity: 0.5; }
        }
      `}</style>

      <div className="absolute -top-20 -right-20 w-[40rem] h-[40rem] bg-amber-500/40 rounded-full blur-[120px]"
        style={{ animation: 'sun-pulse 8s ease-in-out infinite' }} />
      <div className="absolute top-10 -left-20 w-[30rem] h-[30rem] bg-emerald-500/40 rounded-full blur-[100px]"
        style={{ animation: 'green-pulse 12s ease-in-out infinite 2s' }} />
      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[50rem] h-[25rem] bg-cyan-500/30 rounded-full blur-[100px]"
        style={{ animation: 'sun-pulse 10s ease-in-out infinite 4s' }} />

      {windLines.map((_, i) => {
        const duration = 3 + Math.random() * 4;
        const delay = Math.random() * 5;
        const top = Math.random() * 100;
        const width = 150 + Math.random() * 300;
        return (
          <div key={'wind' + i}
            className="absolute h-[2px] bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent shadow-[0_0_8px_rgba(103,232,249,0.8)]"
            style={{ width: `${width}px`, top: `${top}%`, left: '-20%',
              animation: `wind-blow ${duration}s linear infinite`, animationDelay: `${delay}s` }} />
        );
      })}

      {sparks.map((_, i) => {
        const duration = 2 + Math.random() * 4;
        const delay = Math.random() * 5;
        const left = Math.random() * 100;
        const size = 3 + Math.random() * 4;
        return (
          <div key={'spark' + i}
            className="absolute bg-yellow-200 rounded-full"
            style={{ width: `${size}px`, height: `${size}px`, left: `${left}%`, bottom: '-20px',
              boxShadow: '0 0 16px 4px rgba(253, 224, 71, 0.9)',
              animation: `spark-float ${duration}s ease-in infinite`, animationDelay: `${delay}s` }} />
        );
      })}
    </div>
  );
}

const TIME_RANGES: { value: TimeRange; label: string; ms: number }[] = [
  { value: '5m', label: '5 分鐘', ms: 5 * 60 * 1000 },
  { value: '1h', label: '1 小時', ms: 60 * 60 * 1000 },
  { value: '24h', label: '24 小時', ms: 24 * 60 * 60 * 1000 },
];

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [latestData, setLatestData] = useState<DeviceData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryDataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const devicesData = await api.getDevices();
      setDevices(devicesData);
      if (devicesData.length > 0 && !selectedDevice) {
        setSelectedDevice(devicesData[0].device_id);
      } else if (devicesData.length === 0 && !selectedDevice) {
        setSelectedDevice('esp32-001');
      }
      setLoading(false);
      setError(null);
    } catch {
      if (!selectedDevice) setSelectedDevice('esp32-001');
      setLoading(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 30000);
    return () => clearInterval(interval);
  }, [loadDevices]);

  const loadLatestData = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      const data = await api.getLatest(selectedDevice);
      setLatestData(data);
      setLastUpdate(new Date());
      setError(null);
    } catch {
      try {
        const range = TIME_RANGES.find((r) => r.value === timeRange);
        if (range) {
          const now = Date.now();
          const history = await api.getHistory(selectedDevice, now - range.ms, now);
          if (history && history.length > 0) {
            const last = history[history.length - 1];
            setLatestData({
              device_id: selectedDevice,
              timestamp: last.timestamp,
              offline: true,
              data: {
                voltage_v: last.voltage_v ?? null,
                current_a: last.current_a ?? null,
                power_w: last.power_w ?? null,
                rpm: last.rpm ?? null,
                pressure_hpa: last.pressure_hpa ?? null,
                temp_c: last.temp_c ?? null,
                humidity_pct: last.humidity_pct ?? null,
                wind_mps: last.wind_mps ?? null,
                wind_voltage_v: last.wind_voltage_v ?? null,
                solar_voltage_v: last.solar_voltage_v ?? null,
              }
            });
            setLastUpdate(new Date(last.timestamp));
            setError(null);
            return;
          }
        }
      } catch { /* ignore */ }
      setError('即時連線中斷，正在重新連線...');
    }
  }, [selectedDevice, timeRange]);

  const loadHistory = useCallback(async () => {
    if (!selectedDevice) return;
    const range = TIME_RANGES.find((r) => r.value === timeRange);
    if (!range) return;
    const now = Date.now();
    try {
      const data = await api.getHistory(selectedDevice, now - range.ms, now);
      setHistoryData(data);
    } catch {
      // silently fail
    }
  }, [selectedDevice, timeRange]);

  useEffect(() => {
    if (selectedDevice) {
      loadLatestData();
      loadHistory();
    }
  }, [selectedDevice, timeRange, loadLatestData, loadHistory]);

  const connectSSE = useCallback(() => {
    if (!selectedDevice) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    const eventSource = api.createEventSource(selectedDevice);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => setError(null);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') return;
        if (data.device_id === selectedDevice) {
          setLatestData({
            device_id: data.device_id,
            timestamp: data.timestamp,
            offline: false,
            wind_voltage_v: data.wind_voltage_v,
            current_a: data.current_a,
            power_w: data.power_w,
            rpm: data.rpm,
            pressure_hpa: data.pressure_hpa,
            temp_c: data.temp_c,
            humidity_pct: data.humidity_pct,
            wind_mps: data.wind_mps,
            solar_voltage_v: data.solar_voltage_v,
          });
          setLastUpdate(new Date());
          setHistoryData((prev) => {
            const newPoint: HistoryDataPoint = {
              timestamp: data.timestamp,
              ts: new Date(data.timestamp).getTime(),
              wind_voltage_v: data.wind_voltage_v,
              current_a: data.current_a,
              power_w: data.power_w,
              rpm: data.rpm,
              pressure_hpa: data.pressure_hpa,
              temp_c: data.temp_c,
              humidity_pct: data.humidity_pct,
              wind_mps: data.wind_mps,
              solar_voltage_v: data.solar_voltage_v,
            };
            return [...prev, newPoint].slice(-1000);
          });
        }
      } catch { /* ignore */ }
    };

    eventSource.onerror = () => {
      setError('即時連線中斷，正在重新連線...');
      eventSource.close();
      eventSourceRef.current = null;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = window.setTimeout(() => connectSSE(), 5000);
    };
  }, [selectedDevice]);

  useEffect(() => {
    if (selectedDevice) connectSSE();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [selectedDevice, connectSSE]);

  const getValue = (key: string): number | null => {
    if (!latestData) return null;
    const v = latestData.data?.[key as keyof typeof latestData.data] ?? latestData[key as keyof DeviceData];
    return typeof v === 'number' ? v : null;
  };

  const fmt = (val: number | null): string => {
    if (val === null) return '--';
    return Math.abs(val) < 0.01 ? val.toFixed(6) : val.toFixed(2);
  };

  const currentDevice = devices.find((d) => d.device_id === selectedDevice);
  const isOffline = latestData?.offline ?? currentDevice?.offline ?? true;
  const isConnected = !isOffline;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="text-cyan-400 text-sm font-semibold tracking-widest animate-pulse">系統初始化中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 p-4 md:p-6 font-sans selection:bg-cyan-500/30 relative">
      <BackgroundAnimation />
      <div className="max-w-7xl mx-auto space-y-5 relative z-10">

        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 shadow-lg backdrop-blur-md gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-cyan-500/5 rounded-lg border border-blue-500/20">
              <Zap className="text-cyan-400 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wider text-white">功率監控系統</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                即時風力發電機功率與性能分析
                {lastUpdate && (
                  <span className="ml-2 text-slate-500">· 更新於 {lastUpdate.toLocaleTimeString('zh-TW')}</span>
                )}
              </p>
            </div>
          </div>

          <div className={`flex items-center space-x-2 px-4 py-2 rounded-full border ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
            <span className={`text-sm font-medium tracking-wide ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              {isConnected ? '系統在線' : '連線中斷'}
            </span>
          </div>
        </header>

        {/* Alert Banner */}
        {error && (
          <div className="flex items-center justify-between bg-gradient-to-r from-red-500/20 to-red-900/10 border border-red-500/40 text-red-200 px-5 py-3 rounded-lg shadow-lg">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm font-medium tracking-wide">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="p-1.5 hover:bg-red-500/30 rounded-md transition-colors">
              <X className="w-4 h-4 text-red-300" />
            </button>
          </div>
        )}

        {/* 裝置選擇器 */}
        <div className="flex items-center space-x-3 bg-slate-800/30 p-2.5 px-4 rounded-lg border border-slate-700/50 w-full md:max-w-xs">
          <Radio className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-sm text-slate-400 font-medium shrink-0">裝置：</span>
          <div className="relative flex-1">
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="bg-transparent text-slate-200 text-sm font-semibold outline-none w-full cursor-pointer appearance-none pr-6"
            >
              {devices.length > 0 ? (
                devices.map((d) => (
                  <option key={d.device_id} value={d.device_id} className="bg-slate-800">
                    {d.device_id}
                  </option>
                ))
              ) : (
                <option value={selectedDevice} className="bg-slate-800">{selectedDevice}</option>
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 即時數據 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

          {/* 功率大卡 */}
          <div className="col-span-1 bg-gradient-to-br from-slate-800/80 to-[#131b2f]/80 p-6 rounded-2xl border border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.1)] flex flex-col justify-between relative overflow-hidden group backdrop-blur-md">
            <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
              <Zap className="w-32 h-32 text-orange-500" />
            </div>
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-orange-500/10 rounded-md border border-orange-500/20">
                <Zap className="w-4 h-4 text-orange-400" />
              </div>
              <h2 className="text-sm font-semibold tracking-wider text-slate-300">總功率輸出</h2>
            </div>
            <div>
              <div className="flex items-baseline space-x-2 mt-4">
                <span className={`text-6xl font-bold font-mono tracking-tighter ${isConnected ? 'text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'text-slate-600'}`}>
                  {fmt(getValue('power_w'))}
                </span>
                <span className="text-xl text-slate-400 font-medium">W</span>
              </div>
              {isConnected && getValue('wind_voltage_v') !== null && getValue('current_a') !== null && (
                <p className="text-xs text-slate-500 font-mono mt-2">
                  P = {fmt(getValue('wind_voltage_v'))} V × {fmt(getValue('current_a'))} A
                </p>
              )}
            </div>
          </div>

          {/* 其他數值卡片 */}
          <div className="col-span-1 lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard icon={<Wind />}        title="風機電壓"   value={fmt(getValue('wind_voltage_v'))}  unit="V"    color="text-cyan-400"   glow="hover:shadow-[0_0_15px_rgba(34,211,238,0.12)]"   connected={isConnected} />
            <MetricCard icon={<Activity />}    title="風機電流"   value={fmt(getValue('current_a'))}       unit="A"    color="text-cyan-400"   glow="hover:shadow-[0_0_15px_rgba(34,211,238,0.12)]"   connected={isConnected} />
            <MetricCard icon={<Sun />}         title="太陽能電壓" value={fmt(getValue('solar_voltage_v'))} unit="V"    color="text-amber-400"  glow="hover:shadow-[0_0_15px_rgba(251,191,36,0.12)]"   connected={isConnected} />
            <MetricCard icon={<Wind />}        title="風速"       value={fmt(getValue('wind_mps'))}        unit="m/s"  color="text-teal-400"   glow="hover:shadow-[0_0_15px_rgba(45,212,191,0.12)]"   connected={isConnected} />
            <MetricCard icon={<Thermometer />} title="環境溫度"   value={fmt(getValue('temp_c'))}          unit="°C"   color="text-rose-400"   glow="hover:shadow-[0_0_15px_rgba(251,113,133,0.12)]"  connected={isConnected} />
            <MetricCard icon={<Gauge />}       title="大氣壓力"   value={fmt(getValue('pressure_hpa'))}   unit="hPa"  color="text-indigo-400" glow="hover:shadow-[0_0_15px_rgba(129,140,248,0.12)]"  connected={isConnected} />
            <MetricCard icon={<Droplets />}    title="濕度"       value={fmt(getValue('humidity_pct'))}   unit="%"    color="text-sky-400"    glow="hover:shadow-[0_0_15px_rgba(56,189,248,0.12)]"   connected={isConnected} />
          </div>
        </div>

        {/* 歷史數據 */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl overflow-hidden shadow-lg backdrop-blur-sm">
          <div className="p-4 border-b border-slate-700/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/60">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-blue-500/10 rounded-md border border-blue-500/20">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
              </div>
              <h2 className="text-sm font-semibold tracking-wider text-slate-200">歷史數據趨勢</h2>
            </div>
            <div className="flex bg-[#0B1120] rounded-lg p-1 border border-slate-700/80">
              {TIME_RANGES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTimeRange(value)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                    timeRange === value
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {historyData.length === 0 ? (
            <div className="h-64 bg-[#070b14] flex flex-col items-center justify-center space-y-3">
              <BarChart3 className="w-8 h-8 text-slate-600" />
              <p className="text-slate-400 text-sm font-medium">尚無歷史數據</p>
              <p className="text-slate-600 text-xs">等待裝置傳送數據後自動顯示</p>
            </div>
          ) : (
            <div className="bg-[#070b14] grid grid-cols-1 md:grid-cols-2">
              <Chart title="🌬️ 風機與太陽能電壓" data={historyData} timeRange={timeRange}
                metrics={[
                  { key: 'wind_voltage_v', label: '風機電壓 (V)', color: '#818cf8' },
                  { key: 'solar_voltage_v', label: '太陽能電壓 (V)', color: '#fbbf24' },
                ]}
              />
              <Chart title="🔌 風機電流與功率" data={historyData} timeRange={timeRange}
                metrics={[
                  { key: 'current_a', label: '風機電流 (A)', color: '#34d399' },
                  { key: 'power_w', label: '功率 (W)', color: '#fb923c' },
                ]}
              />
              <Chart title="🌡️ 溫度與氣壓" data={historyData} timeRange={timeRange}
                metrics={[
                  { key: 'temp_c', label: '溫度 (°C)', color: '#fb7185' },
                  { key: 'pressure_hpa', label: '氣壓 (hPa)', color: '#a78bfa' },
                ]}
              />
              <Chart title="💧 濕度與風速" data={historyData} timeRange={timeRange}
                metrics={[
                  { key: 'humidity_pct', label: '濕度 (%)', color: '#38bdf8' },
                  { key: 'wind_mps', label: '風速 (m/s)', color: '#2dd4bf' },
                ]}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactElement;
  title: string;
  value: string;
  unit: string;
  color: string;
  glow: string;
  connected: boolean;
}

function MetricCard({ icon, title, value, unit, color, glow, connected }: MetricCardProps) {
  return (
    <div className={`bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 transition-all duration-300 flex flex-col justify-between h-32 relative group hover:bg-slate-800/60 hover:border-slate-500/50 backdrop-blur-md ${glow}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
      <div className="flex items-center space-x-2.5 z-10">
        <div className={`p-2 rounded-lg bg-[#0B1120] border border-slate-700/50 ${color}`}>
          {React.cloneElement(icon, { className: 'w-4 h-4' })}
        </div>
        <span className="text-xs font-medium tracking-wide text-slate-400">{title}</span>
      </div>
      <div className="flex items-baseline space-x-1.5 z-10 mt-auto">
        <span className={`text-3xl font-bold font-mono tracking-tighter ${connected ? 'text-slate-200' : 'text-slate-600'}`}>
          {value}
        </span>
        <span className="text-xs font-semibold text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

export default App;
