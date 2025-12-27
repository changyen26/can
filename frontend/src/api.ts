import { Device, DeviceData, HistoryDataPoint } from './types';

const API_BASE = '/api/v1';

export const api = {
  async getDevices(): Promise<Device[]> {
    const response = await fetch(`${API_BASE}/devices`);
    if (!response.ok) throw new Error('Failed to fetch devices');
    const data = await response.json();
    return data.devices;
  },

  async getLatest(deviceId: string): Promise<DeviceData> {
    const response = await fetch(`${API_BASE}/latest?device_id=${deviceId}`);
    if (!response.ok) throw new Error('Failed to fetch latest data');
    return response.json();
  },

  async getHistory(
    deviceId: string,
    fromTs: number,
    toTs: number,
    metric?: string
  ): Promise<HistoryDataPoint[]> {
    const params = new URLSearchParams({
      device_id: deviceId,
      from: fromTs.toString(),
      to: toTs.toString(),
      limit: '1000',
    });

    if (metric) {
      params.append('metric', metric);
    }

    const response = await fetch(`${API_BASE}/history?${params}`);
    if (!response.ok) throw new Error('Failed to fetch history');
    const data = await response.json();
    return data.history;
  },

  async simulateData(deviceId: string = 'esp32-001', count: number = 20): Promise<void> {
    const response = await fetch(`${API_BASE}/dev/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_id: deviceId, count }),
    });
    if (!response.ok) throw new Error('Failed to simulate data');
  },

  createEventSource(deviceId: string): EventSource {
    return new EventSource(`${API_BASE}/stream?device_id=${deviceId}`);
  },
};
