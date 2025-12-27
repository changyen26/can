# Windmill Monitor

Real-time wind turbine monitoring system with live data streaming and historical analytics.

## Features

- Real-time sensor data monitoring via Server-Sent Events (SSE)
- 7 key metrics: Voltage, Current, RPM, Pressure, Temperature, Humidity, Wind Speed
- Interactive charts with multiple time ranges (5m, 1h, 24h)
- Multi-device support
- Online/Offline status detection
- SQLite (default) with PostgreSQL support
- API key protection for data ingestion
- Responsive dashboard built with React + TypeScript

## Architecture

**Frontend + Backend Monolith**
- Single Zeabur service
- Flask serves both API and static frontend files
- No CORS issues, simplified deployment

## Project Structure

```
windmill-monitor/
├── backend/
│   ├── app.py              # Flask application
│   ├── models.py           # Database models
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── App.tsx         # Main app
│   │   ├── api.ts          # API client
│   │   ├── types.ts        # TypeScript types
│   │   └── index.css       # Styles
│   ├── package.json
│   └── vite.config.ts
├── Procfile                # Zeabur/Heroku start command
├── zbpack.json             # Zeabur build configuration
├── .env.example            # Environment variables template
└── README.md
```

## Local Development

### Prerequisites

- Python 3.9+
- Node.js 18+
- npm or yarn

### Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd windmill-monitor
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env and set your API_KEY
```

3. **Install backend dependencies**
```bash
cd backend
pip install -r requirements.txt
```

4. **Install frontend dependencies**
```bash
cd ../frontend
npm install
```

5. **Run backend (Terminal 1)**
```bash
cd backend
python app.py
```

Backend will run on `http://localhost:5000`

6. **Run frontend dev server (Terminal 2)**
```bash
cd frontend
npm run dev
```

Frontend dev server will run on `http://localhost:5173` with API proxy to backend.

### Building for Production

```bash
# Build frontend
cd frontend
npm run build

# The built files will be in frontend/dist/
# Flask will serve these files automatically
```

## Zeabur Deployment

### Step 1: Prepare Your Repository

1. Ensure all files are committed to Git
2. Push to GitHub/GitLab

### Step 2: Deploy to Zeabur

1. Go to [Zeabur Dashboard](https://zeabur.com)
2. Click "Create Project"
3. Connect your Git repository
4. Zeabur will auto-detect the project type

### Step 3: Configure Environment Variables

In Zeabur dashboard, add these environment variables:

| Variable | Value | Required |
|----------|-------|----------|
| `API_KEY` | Your secret API key (e.g., `my-secure-key-12345`) | Yes |
| `DATABASE_URL` | Leave empty for SQLite, or PostgreSQL URL | No |
| `CORS_ORIGINS` | `*` (or specific origins) | No |
| `OFFLINE_THRESHOLD_SECONDS` | `300` (5 minutes) | No |
| `FLASK_ENV` | `production` | No |

**Important Notes:**
- For SQLite: Leave `DATABASE_URL` empty (default)
- For PostgreSQL: Add a PostgreSQL service in Zeabur, then set `DATABASE_URL` to the connection string
- Zeabur automatically sets the `PORT` variable

### Step 4: Build & Deploy

Zeabur will:
1. Run `cd frontend && npm install && npm run build` (builds React app)
2. Run `cd backend && pip install -r requirements.txt` (installs Python deps)
3. Execute `Procfile` command to start the server

### Step 5: Access Your App

- Your app will be available at `https://<your-project>.zeabur.app`
- Test the API health endpoint: `https://<your-project>.zeabur.app/api/v1/health`

## API Endpoints

### Health Check
```
GET /api/v1/health
```

### Get Devices
```
GET /api/v1/devices
```

Returns list of all devices with their online/offline status.

### Get Latest Data
```
GET /api/v1/latest?device_id=esp32-001
```

Returns the most recent data point for a device.

### Get Historical Data
```
GET /api/v1/history?device_id=esp32-001&from=1730000000000&to=1730003600000&metric=voltage_v&limit=1000
```

Parameters:
- `device_id` (required): Device identifier
- `from` (optional): Start timestamp in milliseconds
- `to` (optional): End timestamp in milliseconds
- `metric` (optional): Specific metric to retrieve
- `limit` (optional, default: 1000): Max number of records

### Ingest Data (Protected)
```
POST /api/v1/ingest
Headers:
  x-api-key: your-secret-api-key
  Content-Type: application/json

Body:
{
  "device_id": "esp32-001",
  "ts": 1730000000000,
  "voltage_v": 12.34,
  "current_a": 1.23,
  "rpm": 3450,
  "pressure_hpa": 1013.25,
  "temp_c": 25.6,
  "humidity_pct": 55.2,
  "wind_mps": 3.4
}
```

### Real-time Stream (SSE)
```
GET /api/v1/stream?device_id=esp32-001
```

Opens an SSE connection for real-time updates.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_KEY` | Secret key for ingest endpoint | `dev-secret-key` |
| `DATABASE_URL` | Database connection string | `sqlite:///windmill.db` |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `*` |
| `OFFLINE_THRESHOLD_SECONDS` | Seconds before device marked offline | `300` |
| `FLASK_ENV` | Flask environment | `production` |
| `PORT` | Server port | `5000` |

## ESP32 Integration Example

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* serverUrl = "https://your-app.zeabur.app/api/v1/ingest";
const char* apiKey = "your-secret-api-key";

void sendData() {
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", apiKey);

  StaticJsonDocument<256> doc;
  doc["device_id"] = "esp32-001";
  doc["ts"] = millis();
  doc["voltage_v"] = 12.34;
  doc["current_a"] = 1.23;
  doc["rpm"] = 3450;
  doc["pressure_hpa"] = 1013.25;
  doc["temp_c"] = 25.6;
  doc["humidity_pct"] = 55.2;
  doc["wind_mps"] = 3.4;

  String json;
  serializeJson(doc, json);

  int httpCode = http.POST(json);
  http.end();
}
```

## Database Migration (SQLite to PostgreSQL)

If you need to switch from SQLite to PostgreSQL:

1. Add PostgreSQL service in Zeabur
2. Set `DATABASE_URL` environment variable to PostgreSQL connection string
3. Redeploy (database tables will be created automatically)

**Note:** Data migration requires manual export/import.

## Troubleshooting

### Frontend shows "No devices found"
- Check if data has been sent to `/api/v1/ingest`
- Verify API key is correct
- Check backend logs

### SSE not connecting
- Ensure browser supports EventSource
- Check network tab for connection errors
- Verify device_id exists

### Database errors on Zeabur
- For SQLite: Check file permissions (SQLite might not persist on Zeabur)
- **Recommended:** Use PostgreSQL for production on Zeabur

### API returns 401 Unauthorized
- Verify `x-api-key` header matches `API_KEY` environment variable

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
