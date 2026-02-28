import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { Device, DeviceData, HistoryDataPoint, TimeRange, Metric } from './types';
import MetricCard from './components/MetricCard';
import PowerCard from './components/PowerCard';
import Chart from './components/Chart';

const METRICS: (Metric & { icon: string })[] = [
  { key: 'wind_voltage_v', label: '風機電壓', unit: 'V', color: '#8884d8', icon: '🌬️' },
  { key: 'current_a', label: '風機電流', unit: 'A', color: '#82ca9d', icon: '🔌' },
  { key: 'solar_voltage_v', label: '太陽能電壓', unit: 'V', color: '#ffc658', icon: '☀️' },
  { key: 'temp_c', label: '溫度', unit: '°C', color: '#8dd1e1', icon: '🌡️' },
  { key: 'pressure_hpa', label: '氣壓', unit: 'hPa', color: '#ff7c7c', icon: '🔵' },
  { key: 'humidity_pct', label: '濕度', unit: '%', color: '#a8d8ea', icon: '💧' },
  { key: 'wind_mps', label: '風速', unit: 'm/s', color: '#b8e0ff', icon: '💨' },
];

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

  // Load devices
  const loadDevices = useCallback(async () => {
    try {
      console.log('正在載入裝置...');
      const devicesData = await api.getDevices();
      console.log('裝置已載入:', devicesData);
      setDevices(devicesData);
      if (devicesData.length > 0 && !selectedDevice) {
        setSelectedDevice(devicesData[0].device_id);
      } else if (devicesData.length === 0 && !selectedDevice) {
        // 沒有設備時，使用默認設備 ID 嘗試載入數據
        console.log('無設備列表，使用默認設備 ID: esp32-001');
        setSelectedDevice('esp32-001');
      }
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Failed to load devices:', err);
      // 即使 API 失敗，也嘗試使用默認設備
      if (!selectedDevice) {
        console.log('API 失敗，使用默認設備 ID: esp32-001');
        setSelectedDevice('esp32-001');
      }
      setLoading(false);
      // 不設置 error，讓數據載入邏輯自己處理
    }
  }, [selectedDevice]);

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 30000);
    return () => clearInterval(interval);
  }, [loadDevices]);

  // Load latest data
  const loadLatestData = useCallback(async () => {
    if (!selectedDevice) return;

    try {
      console.log('正在載入最新數據:', selectedDevice);
      const data = await api.getLatest(selectedDevice);
      console.log('最新數據:', data);
      setLatestData(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to load latest data:', err);
      // 如果沒有最新數據，嘗試從歷史資料取最後一筆
      console.log('嘗試從歷史資料載入最後一筆數據...');
      try {
        const range = TIME_RANGES.find((r) => r.value === timeRange);
        if (range) {
          const now = Date.now();
          const from = now - range.ms;
          const history = await api.getHistory(selectedDevice, from, now);

          if (history && history.length > 0) {
            // 取最後一筆歷史數據作為最新數據
            const lastHistoryItem = history[history.length - 1];
            const fallbackData: DeviceData = {
              device_id: selectedDevice,
              timestamp: lastHistoryItem.timestamp,
              offline: true, // 標記為離線
              data: {
                voltage_v: lastHistoryItem.voltage_v ?? null,
                current_a: lastHistoryItem.current_a ?? null,
                power_w: lastHistoryItem.power_w ?? null,
                rpm: lastHistoryItem.rpm ?? null,
                pressure_hpa: lastHistoryItem.pressure_hpa ?? null,
                temp_c: lastHistoryItem.temp_c ?? null,
                humidity_pct: lastHistoryItem.humidity_pct ?? null,
                wind_mps: lastHistoryItem.wind_mps ?? null,
                wind_voltage_v: lastHistoryItem.wind_voltage_v ?? null,
                solar_voltage_v: lastHistoryItem.solar_voltage_v ?? null
              }
            };
            setLatestData(fallbackData);
            setLastUpdate(new Date(lastHistoryItem.timestamp));
            console.log('✓ 已從歷史資料載入最後一筆數據（設備離線）');
            setError(null);
            return;
          }
        }
      } catch (historyErr) {
        console.error('Failed to load history as fallback:', historyErr);
      }
      setError(err instanceof Error ? err.message : '無法載入數據');
    }
  }, [selectedDevice, timeRange]);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!selectedDevice) return;

    const range = TIME_RANGES.find((r) => r.value === timeRange);
    if (!range) return;

    const now = Date.now();
    const from = now - range.ms;

    try {
      console.log('正在載入歷史數據:', selectedDevice, '從', new Date(from), '到', new Date(now));
      const data = await api.getHistory(selectedDevice, from, now);
      console.log('歷史數據已載入:', data.length, '筆');
      setHistoryData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load history:', err);
      setError(err instanceof Error ? err.message : '無法載入歷史數據');
    }
  }, [selectedDevice, timeRange]);

  // Initial data load
  useEffect(() => {
    if (selectedDevice) {
      loadLatestData();
      loadHistory();
    }
  }, [selectedDevice, timeRange, loadLatestData, loadHistory]);

  // SSE connection with auto-reconnect
  const connectSSE = useCallback(() => {
    if (!selectedDevice) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    console.log('正在連接 SSE:', selectedDevice);
    const eventSource = api.createEventSource(selectedDevice);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE 連線已開啟');
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE 訊息:', data);

        if (data.type === 'connected') {
          console.log('SSE 已連線:', data.device_id);
        } else if (data.device_id === selectedDevice) {
          // Update latest data
          setLatestData({
            device_id: data.device_id,
            timestamp: data.timestamp,
            offline: false,
            voltage_v: data.voltage_v,
            current_a: data.current_a,
            power_w: data.power_w,
            rpm: data.rpm,
            pressure_hpa: data.pressure_hpa,
            temp_c: data.temp_c,
            humidity_pct: data.humidity_pct,
            wind_mps: data.wind_mps,
            wind_voltage_v: data.wind_voltage_v,
            solar_voltage_v: data.solar_voltage_v,
          });

          setLastUpdate(new Date());

          // Add to history
          setHistoryData((prev) => {
            const newPoint: HistoryDataPoint = {
              timestamp: data.timestamp,
              ts: new Date(data.timestamp).getTime(),
              voltage_v: data.voltage_v,
              current_a: data.current_a,
              power_w: data.power_w,
              rpm: data.rpm,
              pressure_hpa: data.pressure_hpa,
              temp_c: data.temp_c,
              humidity_pct: data.humidity_pct,
              wind_mps: data.wind_mps,
              wind_voltage_v: data.wind_voltage_v,
              solar_voltage_v: data.solar_voltage_v,
            };
            return [...prev, newPoint].slice(-1000); // Keep last 1000 points
          });
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE 連線錯誤，將在 5 秒後重新連線...');
      setError('即時連線中斷，正在重新連線...');
      eventSource.close();
      eventSourceRef.current = null;

      // Auto-reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectSSE();
      }, 5000);
    };
  }, [selectedDevice]);

  useEffect(() => {
    if (selectedDevice) {
      connectSSE();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [selectedDevice, connectSSE]);

  if (loading) {
    return (
      <div className="app">
        <div className="header">
          <h1>⚡ 功率監控系統</h1>
          <p>即時風力發電機功率與性能分析</p>
        </div>
        <div className="loading">⏳ 系統初始化中...</div>
      </div>
    );
  }

  const currentDevice = devices.find((d) => d.device_id === selectedDevice);
  const isOffline = latestData?.offline || currentDevice?.offline || false;

  const getValue = (key: string): number | null => {
    if (!latestData) return null;
    const value = latestData.data?.[key as keyof typeof latestData.data] ?? latestData[key as keyof DeviceData];
    return typeof value === 'number' ? value : null;
  };

  return (
    <div className="app">
      <div className="header">
        <div className="header-main">
          <h1>⚡ 功率監控系統</h1>
          <p>即時風力發電機功率與性能分析</p>
        </div>
        <div className="header-meta">
          <div className={`status-indicator ${isOffline ? 'offline' : 'online'}`}>
            <span className={`status-dot ${isOffline ? 'offline' : 'online'}`}></span>
            {isOffline ? '離線' : '在線'}
          </div>
          {lastUpdate && (
            <p className="last-update">最後更新：{lastUpdate.toLocaleTimeString('zh-TW')}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="close-btn" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* 即時數據 */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">📡 即時數據</h2>
          <div className="control-item">
            <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
              {devices.length > 0 ? (
                devices.map((device) => (
                  <option key={device.device_id} value={device.device_id}>
                    裝置：{device.device_id}
                  </option>
                ))
              ) : (
                selectedDevice && (
                  <option key={selectedDevice} value={selectedDevice}>
                    裝置：{selectedDevice}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="metrics-grid">
          <PowerCard
            power={getValue('power_w')}
            voltage={getValue('wind_voltage_v') ?? getValue('voltage_v')}
            current={getValue('current_a')}
          />
          {METRICS.map((metric) => (
            <MetricCard
              key={metric.key}
              label={metric.label}
              value={getValue(metric.key)}
              unit={metric.unit}
              icon={metric.icon}
            />
          ))}
        </div>
      </div>

      {/* 歷史數據 */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">📈 歷史數據</h2>
          <div className="time-range-buttons">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                className={timeRange === range.value ? 'active' : ''}
                onClick={() => setTimeRange(range.value)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {historyData.length === 0 ? (
          <p className="no-data">尚無歷史數據</p>
        ) : (
          <div className="charts-grid">
            <Chart
              title="🌬️ 風機與太陽能電壓"
              data={historyData}
              timeRange={timeRange}
              metrics={[
                { key: 'wind_voltage_v', label: '風機電壓 (V)', color: '#8884d8' },
                { key: 'solar_voltage_v', label: '太陽能電壓 (V)', color: '#ffc658' },
              ]}
            />

            <Chart
              title="🔌 風機電流與功率"
              data={historyData}
              timeRange={timeRange}
              metrics={[
                { key: 'current_a', label: '風機電流 (A)', color: '#82ca9d' },
                { key: 'power_w', label: '功率 (W)', color: '#ff7c7c' },
              ]}
            />

            <Chart
              title="🌡️ 溫度與氣壓"
              data={historyData}
              timeRange={timeRange}
              metrics={[
                { key: 'temp_c', label: '溫度 (°C)', color: '#8dd1e1' },
                { key: 'pressure_hpa', label: '氣壓 (hPa)', color: '#ff7c7c' },
              ]}
            />

            <Chart
              title="💧 濕度與風速"
              data={historyData}
              timeRange={timeRange}
              metrics={[
                { key: 'humidity_pct', label: '濕度 (%)', color: '#a8d8ea' },
                { key: 'wind_mps', label: '風速 (m/s)', color: '#b8e0ff' },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
