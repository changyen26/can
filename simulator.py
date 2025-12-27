#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
風力發電機數據模擬器
每秒自動發送數據到後端 API
"""

import time
import random
import requests
import json
from datetime import datetime

# ========== 設定區 ==========

# API 設定
#API_URL = "http://localhost:5000/api/v1/ingest"  # 本地測試
API_URL = "https://cyutfan-backend.zeabur.app/api/v1/ingest"  # Zeabur 部署
API_KEY = "dev-secret-key"

# 設備 ID
DEVICE_ID = "esp32-001"

# 發送間隔（秒）
INTERVAL = 0.5

# ========== 數據生成函數 ==========

def generate_sensor_data():
    """
    生成模擬的感測器數據
    返回符合 API 格式的字典
    """
    # 模擬真實的風機數據變化
    voltage = round(random.uniform(11.5, 13.5), 2)      # 電壓 (V)
    current = round(random.uniform(0.8, 2.0), 2)        # 電流 (A)
    rpm = random.randint(2800, 4200)                    # 轉速 (RPM)
    pressure = round(random.uniform(1010.0, 1020.0), 2) # 氣壓 (hPa)
    temp = round(random.uniform(20.0, 35.0), 1)         # 溫度 (°C)
    humidity = round(random.uniform(40.0, 70.0), 1)     # 濕度 (%)
    wind_speed = round(random.uniform(2.0, 6.0), 1)     # 風速 (m/s)

    return {
        "device_id": DEVICE_ID,
        "ts": int(time.time() * 1000),  # 當前時間戳（毫秒）
        "voltage_v": voltage,
        "current_a": current,
        "rpm": rpm,
        "pressure_hpa": pressure,
        "temp_c": temp,
        "humidity_pct": humidity,
        "wind_mps": wind_speed
    }

# ========== 發送函數 ==========

def send_data(data):
    """
    發送數據到 API
    """
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }

    try:
        response = requests.post(API_URL, json=data, headers=headers, timeout=10)

        # 200 OK 或 201 Created 都算成功
        if response.status_code in [200, 201]:
            power = data['voltage_v'] * data['current_a']
            print(f"✅ [{datetime.now().strftime('%H:%M:%S')}] "
                  f"數據已發送 | 功率: {power:.2f}W | "
                  f"電壓: {data['voltage_v']}V | "
                  f"電流: {data['current_a']}A | "
                  f"轉速: {data['rpm']} RPM")
            return True
        else:
            print(f"❌ 發送失敗: {response.status_code} - {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print(f"❌ 連線錯誤: 無法連接到 {API_URL}")
        print(f"   請確認後端是否正在運行")
        return False
    except requests.exceptions.Timeout:
        print(f"❌ 請求超時")
        return False
    except Exception as e:
        print(f"❌ 發送錯誤: {e}")
        return False

# ========== 主程式 ==========

def main():
    """
    主程式：每秒發送一次數據
    """
    print("=" * 70)
    print("🌪️  風力發電機數據模擬器")
    print("=" * 70)
    print(f"📡 API 位址: {API_URL}")
    print(f"🔑 API Key: {API_KEY}")
    print(f"📟 設備 ID: {DEVICE_ID}")
    print(f"⏱️  發送間隔: {INTERVAL} 秒")
    print("=" * 70)
    print(f"開始發送數據... (按 Ctrl+C 停止)\n")

    count = 0

    try:
        while True:
            count += 1

            # 生成數據
            data = generate_sensor_data()

            # 發送數據
            success = send_data(data)

            if success:
                # 每 10 筆顯示統計
                if count % 10 == 0:
                    print(f"📊 已發送 {count} 筆數據\n")

            # 等待下一次發送
            time.sleep(INTERVAL)

    except KeyboardInterrupt:
        print(f"\n\n⏹️  已停止發送")
        print(f"📊 總共發送: {count} 筆數據")
        print("=" * 70)

if __name__ == "__main__":
    main()
