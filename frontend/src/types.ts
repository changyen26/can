export interface DeviceData {
  device_id: string;
  timestamp: string;
  offline?: boolean;
  data?: {
    voltage_v: number | null;
    current_a: number | null;
    power_w: number | null;
    rpm: number | null;
    pressure_hpa: number | null;
    temp_c: number | null;
    humidity_pct: number | null;
    wind_mps: number | null;
  };
  voltage_v?: number | null;
  current_a?: number | null;
  power_w?: number | null;
  rpm?: number | null;
  pressure_hpa?: number | null;
  temp_c?: number | null;
  humidity_pct?: number | null;
  wind_mps?: number | null;
}

export interface Device {
  device_id: string;
  last_seen: string;
  offline: boolean;
}

export interface HistoryDataPoint {
  timestamp: string;
  ts: number;
  voltage_v?: number | null;
  current_a?: number | null;
  power_w?: number | null;
  rpm?: number | null;
  pressure_hpa?: number | null;
  temp_c?: number | null;
  humidity_pct?: number | null;
  wind_mps?: number | null;
}

export type TimeRange = '5m' | '1h' | '24h';

export interface Metric {
  key: string;
  label: string;
  unit: string;
  color: string;
}
