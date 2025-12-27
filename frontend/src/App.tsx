import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { Device, DeviceData, HistoryDataPoint, TimeRange, Metric } from './types';
import MetricCard from './components/MetricCard';
import PowerCard from './components/PowerCard';
import Chart from './components/Chart';

const METRICS: Metric[] = [
  { key: 'voltage_v', label: '電壓', unit: 'V', color: '#8884d8' },
  { key: 'current_a', label: '電流', unit: 'A', color: '#82ca9d' },
  { key: 'rpm', label: '轉速', unit: 'RPM', color: '#ffc658' },
  { key: 'pressure_hpa', label: '氣壓', unit: 'hPa', color: '#ff7c7c' },
  { key: 'temp_c', label: '溫度', unit: '°C', color: '#8dd1e1' },
  { key: 'humidity_pct', label: '濕度', unit: '%', color: '#a4de6c' },
  { key: 'wind_mps', label: '風速', unit: 'm/s', color: '#d0ed57' },
];

const TIME_RANGES: { value: TimeRange; label: string; ms: number }[] = [
  { value: '5m', label: '5 分鐘', ms: 5 * 60 * 1000 },
  { value: '1h', label: '1 小時', ms: 60 * 60 * 1000 },
  { value: '24h', label: '24 小時', ms: 24 * 60 * 60 * 1000 },
];

const CURL_COMMAND = `curl -X POST "http://localhost:5000/api/v1/ingest" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: dev-secret-key" \\
  -d '{
    "device_id": "esp32-001",
    "ts": ${Date.now()},
    "voltage_v": 12.34,
    "current_a": 1.23,
    "rpm": 3450,
    "pressure_hpa": 1013.25,
    "temp_c": 25.6,
    "humidity_pct": 55.2,
    "wind_mps": 3.4
  }'`;

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [latestData, setLatestData] = useState<DeviceData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryDataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
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
      }
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Failed to load devices:', err);
      setError(err instanceof Error ? err.message : '無法載入裝置');
      setLoading(false);
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
      setError(err instanceof Error ? err.message : '無法載入最新數據');
    }
  }, [selectedDevice]);

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

  // Handle simulate data
  const handleSimulate = async () => {
    setSimulating(true);
    try {
      await api.simulateData('esp32-001', 20);
      setError(null);
      // Reload data after simulation
      await loadDevices();
      setTimeout(() => {
        loadLatestData();
        loadHistory();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '無法模擬數據');
    } finally {
      setSimulating(false);
    }
  };

  // Handle copy curl
  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(CURL_COMMAND);
      alert('curl 指令已複製到剪貼簿！');
    } catch (err) {
      alert('複製失敗，請手動複製。');
    }
  };

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

  if (devices.length === 0) {
    return (
      <div className="app">
        <div className="header">
          <h1>⚡ 功率監控系統</h1>
          <p>即時風力發電機功率與性能分析</p>
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button className="close-btn" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        )}

        <div className="empty-state">
          <h2>⚠ 無在線裝置</h2>
          <p>未偵測到風力發電機數據。請發送數據或執行模擬以初始化系統。</p>

          <div className="empty-state-actions">
            <button className="btn btn-primary" onClick={handleSimulate} disabled={simulating}>
              {simulating ? '模擬中...' : '模擬數據'}
            </button>
            <button className="btn btn-secondary" onClick={handleCopyCurl}>
              複製 curl 指令
            </button>
          </div>

          <div className="code-block">
            <code>{CURL_COMMAND}</code>
          </div>

          <p style={{ marginTop: '20px', color: '#666', fontSize: '0.9rem' }}>
            發送數據後，儀表板將自動重新整理。
          </p>
        </div>
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
        <h1>⚡ 功率監控系統</h1>
        <p>即時風力發電機功率與性能分析</p>
        {lastUpdate && (
          <p className="last-update">最後更新：{lastUpdate.toLocaleTimeString()}</p>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="close-btn" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      <div className="controls">
        <div className="control-group">
          <div className="control-item">
            <label>裝置</label>
            <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
              {devices.map((device) => (
                <option key={device.device_id} value={device.device_id}>
                  {device.device_id}
                </option>
              ))}
            </select>
          </div>

          <div className="control-item">
            <label>狀態</label>
            <div className={`status-indicator ${isOffline ? 'offline' : 'online'}`}>
              <span className={`status-dot ${isOffline ? 'offline' : 'online'}`}></span>
              {isOffline ? '離線' : '在線'}
            </div>
          </div>

          <div className="control-item">
            <label>時間範圍</label>
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
        </div>
      </div>

      <div className="metrics-grid">
        <PowerCard
          power={getValue('power_w')}
          voltage={getValue('voltage_v')}
          current={getValue('current_a')}
        />
        {METRICS.map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={getValue(metric.key)}
            unit={metric.unit}
          />
        ))}
      </div>

      <div className="charts-section">
        <h2>歷史數據</h2>

        {historyData.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
            所選時間範圍內無歷史數據。
          </p>
        ) : (
          <>
            <Chart
              title="電氣指標"
              data={historyData}
              metrics={[
                { key: 'voltage_v', label: '電壓 (V)', color: '#8884d8' },
                { key: 'current_a', label: '電流 (A)', color: '#82ca9d' },
              ]}
            />

            <Chart
              title="機械指標"
              data={historyData}
              metrics={[
                { key: 'rpm', label: '轉速 (RPM)', color: '#ffc658' },
                { key: 'wind_mps', label: '風速 (m/s)', color: '#d0ed57' },
              ]}
            />

            <Chart
              title="環境指標"
              data={historyData}
              metrics={[
                { key: 'temp_c', label: '溫度 (°C)', color: '#8dd1e1' },
                { key: 'humidity_pct', label: '濕度 (%)', color: '#a4de6c' },
                { key: 'pressure_hpa', label: '氣壓 (hPa)', color: '#ff7c7c' },
              ]}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
