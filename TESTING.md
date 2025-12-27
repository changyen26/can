# API Testing Guide

This document provides curl commands to test the Windmill Monitor API.

## Prerequisites

- Backend server running (local: `http://localhost:5000` or deployed URL)
- API key configured in environment variables

For local testing:
```bash
export API_URL="http://localhost:5000"
export API_KEY="dev-secret-key"
```

For deployed (Zeabur):
```bash
export API_URL="https://your-app.zeabur.app"
export API_KEY="your-production-api-key"
```

## Test Cases

### 1. Health Check

```bash
curl -X GET "${API_URL}/api/v1/health"
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000000"
}
```

---

### 2. Test Case 1: Normal Data Ingestion

Send complete sensor data for device `esp32-001`.

```bash
curl -X POST "${API_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "device_id": "esp32-001",
    "ts": 1730000000000,
    "voltage_v": 12.34,
    "current_a": 1.23,
    "rpm": 3450,
    "pressure_hpa": 1013.25,
    "temp_c": 25.6,
    "humidity_pct": 55.2,
    "wind_mps": 3.4
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "id": 1,
  "device_id": "esp32-001"
}
```

---

### 3. Test Case 2: Different Device

Send data for a second device `esp32-002`.

```bash
curl -X POST "${API_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "device_id": "esp32-002",
    "ts": 1730000060000,
    "voltage_v": 13.5,
    "current_a": 1.5,
    "rpm": 3800,
    "pressure_hpa": 1015.0,
    "temp_c": 24.2,
    "humidity_pct": 60.0,
    "wind_mps": 4.2
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "id": 2,
  "device_id": "esp32-002"
}
```

---

### 4. Test Case 3: Partial Data (Missing Optional Fields)

Send data with only required fields and some optional ones. The system should accept this gracefully.

```bash
curl -X POST "${API_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "device_id": "esp32-001",
    "ts": 1730000120000,
    "voltage_v": 12.1,
    "rpm": 3500,
    "temp_c": 26.0
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "id": 3,
  "device_id": "esp32-001"
}
```

**Note:** Missing fields (`current_a`, `pressure_hpa`, etc.) will be stored as `null`.

---

### 5. Get Device List

```bash
curl -X GET "${API_URL}/api/v1/devices"
```

**Expected Response:**
```json
{
  "devices": [
    {
      "device_id": "esp32-001",
      "last_seen": "2024-10-27T12:02:00",
      "offline": false
    },
    {
      "device_id": "esp32-002",
      "last_seen": "2024-10-27T12:01:00",
      "offline": false
    }
  ]
}
```

---

### 6. Get Latest Data for Device

```bash
curl -X GET "${API_URL}/api/v1/latest?device_id=esp32-001"
```

**Expected Response:**
```json
{
  "device_id": "esp32-001",
  "timestamp": "2024-10-27T12:02:00",
  "offline": false,
  "data": {
    "voltage_v": 12.1,
    "current_a": null,
    "rpm": 3500,
    "pressure_hpa": null,
    "temp_c": 26.0,
    "humidity_pct": null,
    "wind_mps": null
  }
}
```

---

### 7. Get Historical Data

Get all metrics for the last hour:

```bash
# Calculate timestamps (Unix timestamp in milliseconds)
TO_TS=$(date +%s)000
FROM_TS=$((TO_TS - 3600000))  # 1 hour ago

curl -X GET "${API_URL}/api/v1/history?device_id=esp32-001&from=${FROM_TS}&to=${TO_TS}"
```

Get specific metric only:

```bash
TO_TS=$(date +%s)000
FROM_TS=$((TO_TS - 3600000))

curl -X GET "${API_URL}/api/v1/history?device_id=esp32-001&metric=voltage_v&from=${FROM_TS}&to=${TO_TS}&limit=100"
```

**Expected Response:**
```json
{
  "device_id": "esp32-001",
  "count": 3,
  "history": [
    {
      "timestamp": "2024-10-27T12:00:00",
      "ts": 1730000000000,
      "voltage_v": 12.34
    },
    {
      "timestamp": "2024-10-27T12:02:00",
      "ts": 1730000120000,
      "voltage_v": 12.1
    }
  ]
}
```

---

### 8. Test SSE Stream (Real-time)

Open SSE connection (keep terminal open):

```bash
curl -N -H "Accept: text/event-stream" \
  "${API_URL}/api/v1/stream?device_id=esp32-001"
```

**Expected Output:**
```
data: {"type":"connected","device_id":"esp32-001"}

: keepalive

data: {"device_id":"esp32-001","timestamp":"2024-10-27T12:05:00",...}
```

While this is running, send data from another terminal using Test Case 1 or 2. You should see the data appear in real-time.

---

### 9. Error Cases

#### Missing API Key
```bash
curl -X POST "${API_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "esp32-001",
    "ts": 1730000000000,
    "voltage_v": 12.34
  }'
```

**Expected Response:** `401 Unauthorized`
```json
{
  "error": "Invalid or missing API key"
}
```

#### Invalid API Key
```bash
curl -X POST "${API_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: wrong-key" \
  -d '{
    "device_id": "esp32-001",
    "ts": 1730000000000,
    "voltage_v": 12.34
  }'
```

**Expected Response:** `401 Unauthorized`

#### Missing Required Field
```bash
curl -X POST "${API_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "device_id": "esp32-001",
    "voltage_v": 12.34
  }'
```

**Expected Response:** `400 Bad Request`
```json
{
  "error": "Missing required field: ts"
}
```

---

## Automated Test Script

Save this as `test-api.sh`:

```bash
#!/bin/bash

API_URL="${API_URL:-http://localhost:5000}"
API_KEY="${API_KEY:-dev-secret-key}"

echo "Testing Windmill Monitor API at ${API_URL}"
echo "=========================================="

echo -e "\n1. Health Check"
curl -s "${API_URL}/api/v1/health" | jq '.'

echo -e "\n\n2. Ingest Test Data (esp32-001)"
curl -s -X POST "${API_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
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
  }' | jq '.'

echo -e "\n\n3. Ingest Test Data (esp32-002)"
curl -s -X POST "${API_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "device_id": "esp32-002",
    "ts": '$(date +%s)000',
    "voltage_v": 13.5,
    "current_a": 1.5,
    "rpm": 3800
  }' | jq '.'

echo -e "\n\n4. Get Devices"
curl -s "${API_URL}/api/v1/devices" | jq '.'

echo -e "\n\n5. Get Latest Data (esp32-001)"
curl -s "${API_URL}/api/v1/latest?device_id=esp32-001" | jq '.'

echo -e "\n\n6. Test Invalid API Key (should fail)"
curl -s -X POST "${API_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: wrong-key" \
  -d '{
    "device_id": "esp32-001",
    "ts": '$(date +%s)000',
    "voltage_v": 12.34
  }' | jq '.'

echo -e "\n\nAll tests completed!"
```

Make it executable and run:
```bash
chmod +x test-api.sh
./test-api.sh
```

---

## Testing Offline Detection

1. Send data for a device:
```bash
curl -X POST "${API_URL}/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "device_id": "esp32-test",
    "ts": '$(date +%s)000',
    "voltage_v": 12.0
  }'
```

2. Wait for `OFFLINE_THRESHOLD_SECONDS` (default: 300 seconds / 5 minutes)

3. Check device status:
```bash
curl -X GET "${API_URL}/api/v1/devices"
```

The device should show `"offline": true`.

---

## Performance Testing

Send multiple data points rapidly:

```bash
for i in {1..100}; do
  curl -s -X POST "${API_URL}/api/v1/ingest" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${API_KEY}" \
    -d '{
      "device_id": "esp32-perf",
      "ts": '$(date +%s)000',
      "voltage_v": '$((10 + RANDOM % 5))',
      "current_a": '$((1 + RANDOM % 2))',
      "rpm": '$((3000 + RANDOM % 1000))'
    }' &
done
wait

echo "Sent 100 requests. Check database for results."
```
