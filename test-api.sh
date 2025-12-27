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
