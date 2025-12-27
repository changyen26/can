# Local Testing Guide

本指南用於本地測試，不涉及部署。

## 快速啟動

### 1. 啟動後端 (Terminal 1)

```bash
cd backend
python app.py
```

後端將在 `http://localhost:5000` 啟動。

**後端日誌說明：**
- 啟動時會顯示配置信息（Database、API Key 等）
- 收到 ingest 請求時會顯示 📥 圖標
- 成功寫入 DB 會顯示 ✅ 圖標
- SSE 連線會顯示 🔌 圖標
- 錯誤會顯示 ❌ 圖標

### 2. 啟動前端 (Terminal 2)

```bash
cd frontend
npm install   # 首次需要安裝依賴
npm run dev
```

前端將在 `http://localhost:5173` 啟動。

**預設 API Key:** `dev-secret-key`

---

## Step 1: 空狀態畫面

當你第一次打開 `http://localhost:5173`，你會看到：

**空狀態畫面：**
- 標題：「No Devices Found」
- 說明文字：「No wind turbine data has been received yet...」
- 兩個按鈕：
  1. **「Simulate Data」** - 點擊後立即生成 20 筆測試數據
  2. **「Copy curl Command」** - 複製 curl 測試命令到剪貼簿
- 顯示完整的 curl 命令供參考

---

## Step 2: 三種測試方式

### 方式 1：使用 Simulate 按鈕（最快）

1. 打開前端 `http://localhost:5173`
2. 點擊 **「Simulate Data」** 按鈕
3. 等待 2-3 秒，畫面會自動重新整理
4. 你會看到完整的 Dashboard 出現

### 方式 2：使用 curl 命令

打開第三個 terminal，執行以下任一命令：

#### 測試 1：正常完整資料

```bash
curl -X POST "http://localhost:5000/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret-key" \
  -d '{
    "device_id": "esp32-001",
    "ts": '$(date +%s)000',
    "voltage_v": 12.34,
    "current_a": 1.23,
    "rpm": 3450,
    "pressure_hpa": 1013.25,
    "temp_c": 25.6,
    "humidity_pct": 55.2,
    "wind_mps": 3.4
  }'
```

**預期後端日誌：**
```
📥 Received ingest request: device_id=esp32-001, ts=1730000000000
✅ Data saved to DB: id=1, device_id=esp32-001
📡 Broadcast to SSE clients: device_id=esp32-001
```

**預期回應：**
```json
{
  "status": "success",
  "id": 1,
  "device_id": "esp32-001"
}
```

#### 測試 2：不同裝置

```bash
curl -X POST "http://localhost:5000/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret-key" \
  -d '{
    "device_id": "esp32-002",
    "ts": '$(date +%s)000',
    "voltage_v": 13.5,
    "current_a": 1.5,
    "rpm": 3800,
    "pressure_hpa": 1015.0,
    "temp_c": 24.2,
    "humidity_pct": 60.0,
    "wind_mps": 4.2
  }'
```

**預期結果：**
- Device 下拉選單會出現 `esp32-002`
- 可以切換不同裝置查看數據

#### 測試 3：缺少部分欄位（依然接受）

```bash
curl -X POST "http://localhost:5000/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret-key" \
  -d '{
    "device_id": "esp32-001",
    "ts": '$(date +%s)000',
    "voltage_v": 12.1,
    "rpm": 3500,
    "temp_c": 26.0
  }'
```

**預期結果：**
- 資料成功寫入
- 缺少的欄位（`current_a`, `pressure_hpa` 等）會顯示為 `--`

### 方式 3：連續發送（模擬即時數據流）

```bash
# 每秒發送一次，共 10 次
for i in {1..10}; do
  curl -X POST "http://localhost:5000/api/v1/ingest" \
    -H "Content-Type: application/json" \
    -H "x-api-key: dev-secret-key" \
    -d '{
      "device_id": "esp32-001",
      "ts": '$(date +%s)000',
      "voltage_v": '$(echo "12 + $RANDOM % 3 - 1" | bc -l)',
      "current_a": '$(echo "1.2 + $RANDOM % 100 / 100" | bc -l)',
      "rpm": '$((3400 + RANDOM % 200))',
      "temp_c": '$(echo "25 + $RANDOM % 5 - 2" | bc -l)'
    }'
  sleep 1
done
```

**預期結果：**
- 卡片數值會即時更新（透過 SSE）
- 圖表會即時增加新的數據點
- Header 的 「Last update」時間會持續更新

---

## Step 3: Dashboard 畫面說明

發送數據後，前端畫面會顯示：

### Header 區
- **標題**：Windmill Monitor
- **副標題**：Real-time wind turbine monitoring system
- **Last update**：最後更新時間（即時更新）

### 控制欄
- **Device 下拉選單**：選擇不同裝置
- **Status Badge**：
  - 🟢 Online（綠色，有脈動動畫）
  - 🔴 Offline（紅色，5 分鐘沒收到數據）
- **Time Range 按鈕**：5m / 1h / 24h

### 7 張卡片（Metrics Grid）
每張卡片顯示：
- 標籤（例如：VOLTAGE）
- 數值（大字體，例如：12.34）
- 單位（小字體，例如：V）
- 缺值時顯示：`--`

卡片會有 hover 效果（向上浮動）

### 圖表區（3 個折線圖）
1. **Electrical Metrics**：Voltage + Current
2. **Mechanical Metrics**：RPM + Wind Speed
3. **Environmental Metrics**：Temperature + Humidity + Pressure

圖表特性：
- X 軸顯示時間（HH:MM 格式）
- Y 軸自動縮放
- Hover 時顯示詳細數值
- 多條線用不同顏色區分
- 空白時顯示：「No historical data available...」

---

## Step 4: 即時更新測試

### 測試 SSE 即時推送

1. 打開前端，確保有 device 存在
2. 打開瀏覽器開發者工具 → Network → 篩選 `stream`
3. 你會看到一個持續連線的 SSE 請求
4. 在另一個 terminal 發送 curl 測試（上面的測試 1）
5. **預期結果：**
   - 卡片數值立即更新（無需重新整理）
   - 圖表立即增加新數據點
   - Header 的 Last update 時間更新
   - Console 顯示：`SSE message: {...}`

### 測試 SSE 自動重連

1. 在後端 terminal 按 `Ctrl+C` 停止伺服器
2. **預期結果：**
   - 前端顯示紅色錯誤提示條：「Real-time connection lost. Reconnecting...」
   - Console 顯示：`SSE connection error, will reconnect in 5 seconds...`
3. 重新啟動後端 `python app.py`
4. **預期結果：**
   - 5 秒後自動重連
   - 錯誤提示條消失
   - SSE 恢復正常

---

## 錯誤測試

### 測試 1：錯誤的 API Key

```bash
curl -X POST "http://localhost:5000/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: wrong-key" \
  -d '{
    "device_id": "esp32-001",
    "ts": '$(date +%s)000',
    "voltage_v": 12.34
  }'
```

**預期回應：** `401 Unauthorized`
```json
{
  "error": "Invalid or missing API key"
}
```

### 測試 2：缺少必要欄位

```bash
curl -X POST "http://localhost:5000/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-secret-key" \
  -d '{
    "device_id": "esp32-001",
    "voltage_v": 12.34
  }'
```

**預期回應：** `400 Bad Request`
```json
{
  "error": "Missing required field: ts"
}
```

---

## 其他 API 測試

### 查詢所有裝置

```bash
curl http://localhost:5000/api/v1/devices
```

### 查詢最新數據

```bash
curl "http://localhost:5000/api/v1/latest?device_id=esp32-001"
```

### 查詢歷史數據

```bash
# 最近 1 小時
FROM_TS=$(($(date +%s) * 1000 - 3600000))
TO_TS=$(($(date +%s) * 1000))

curl "http://localhost:5000/api/v1/history?device_id=esp32-001&from=${FROM_TS}&to=${TO_TS}"
```

### 健康檢查

```bash
curl http://localhost:5000/api/v1/health
```

---

## 清空數據（開發用）

```bash
curl -X POST http://localhost:5000/api/v1/dev/clear
```

**預期回應：**
```json
{
  "status": "success",
  "deleted": 10,
  "message": "Cleared 10 data points"
}
```

清空後，前端會回到空狀態畫面。

---

## Troubleshooting

### 前端顯示 "Failed to fetch devices"

1. 檢查後端是否正在運行：`curl http://localhost:5000/api/v1/health`
2. 檢查後端 logs 是否有錯誤
3. 確認端口 5000 沒有被佔用

### 圖表沒有數據

1. 確認時間範圍內有數據（切換到 24h 試試）
2. 檢查瀏覽器 Console 是否有錯誤
3. 嘗試手動 refresh：`Ctrl+R` 或 `F5`

### SSE 無法連線

1. 檢查瀏覽器是否支援 EventSource（所有現代瀏覽器都支援）
2. 檢查 Network tab 是否有 `/api/v1/stream` 請求
3. 確認後端 logs 是否顯示 `🔌 SSE connection opened`

---

## 畫面預期效果總結

### 狀態變化流程

1. **初始狀態（無數據）**
   - 顯示空狀態畫面
   - 兩個按鈕：Simulate / Copy curl
   - 顯示 curl 命令範例

2. **點擊 Simulate Data 或發送 curl**
   - Loading... 狀態（可能很快看不到）
   - 自動重新整理 devices

3. **有數據後**
   - Header：顯示標題 + Last update
   - 控制欄：Device 下拉 + Online badge + Time range
   - 7 張卡片：顯示數值或 `--`
   - 3 個圖表：顯示折線圖

4. **即時更新（SSE）**
   - 收到新數據時：
     - 卡片數值立即更新
     - 圖表增加新數據點
     - Last update 時間更新
   - 無需重新整理頁面

5. **錯誤狀態**
   - 紅色錯誤提示條出現在 header 下方
   - 可點擊 × 關閉
   - SSE 斷線會自動重連（5 秒後）
