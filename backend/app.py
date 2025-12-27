import os
import json
import time
import logging
import random
import threading
from queue import Queue, Empty, Full
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
from functools import wraps
from models import db, DeviceData

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///windmill.db')
# Fix for PostgreSQL URL format
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

API_KEY = os.getenv('API_KEY', 'dev-secret-key')
# CORS origins - allow all if not specified
cors_env = os.getenv('CORS_ORIGINS', '*')
CORS_ORIGINS = cors_env.split(',') if cors_env != '*' else '*'
OFFLINE_THRESHOLD_SECONDS = int(os.getenv('OFFLINE_THRESHOLD_SECONDS', '300'))

logger.info(f"Starting Windmill Monitor API")
logger.info(f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
logger.info(f"API Key: {API_KEY}")
logger.info(f"CORS Origins: {CORS_ORIGINS}")

# Initialize database
db.init_app(app)

# CORS configuration - Allow all origins and methods for API
CORS(app, resources={
    r"/api/*": {
        "origins": CORS_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "x-api-key"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": False,
        "max_age": 3600
    }
})

# Create tables on startup
with app.app_context():
    db.create_all()
    logger.info("Database tables created/verified")

# SSE clients management
sse_clients = {}
clients_lock = threading.Lock()


def require_api_key(f):
    """Decorator to protect endpoints with API key"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        provided_key = request.headers.get('x-api-key')
        if provided_key != API_KEY:
            return jsonify({'error': 'Invalid or missing API key'}), 401
        return f(*args, **kwargs)
    return decorated_function


def broadcast_to_device_clients(device_id, data):
    """Send data to all SSE clients subscribed to a device"""
    with clients_lock:
        if device_id in sse_clients:
            for client_queue in sse_clients[device_id]:
                try:
                    client_queue.put_nowait(data)
                except Full:
                    pass


@app.route('/')
def index():
    """Serve frontend"""
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """Serve frontend static files"""
    try:
        return send_from_directory(app.static_folder, path)
    except:
        return send_from_directory(app.static_folder, 'index.html')


@app.route('/api/v1/ingest', methods=['POST'])
@require_api_key
def ingest():
    """Receive and store device data"""
    try:
        data = request.get_json()
        logger.info(f"📥 Received ingest request: device_id={data.get('device_id')}, ts={data.get('ts')}")

        # Validate required fields
        required_fields = ['device_id', 'ts']
        for field in required_fields:
            if field not in data:
                logger.warning(f"❌ Missing required field: {field}")
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Calculate power: P = V × I
        voltage = data.get('voltage_v')
        current = data.get('current_a')
        power = None
        if voltage is not None and current is not None:
            power = voltage * current
            logger.info(f"⚡ Calculated power: {power:.2f}W (V={voltage}V, I={current}A)")

        # Create device data entry
        device_data = DeviceData(
            device_id=data['device_id'],
            timestamp=datetime.utcfromtimestamp(data['ts'] / 1000.0),  # Use UTC
            voltage_v=voltage,
            current_a=current,
            power_w=power,
            rpm=data.get('rpm'),
            pressure_hpa=data.get('pressure_hpa'),
            temp_c=data.get('temp_c'),
            humidity_pct=data.get('humidity_pct'),
            wind_mps=data.get('wind_mps')
        )

        db.session.add(device_data)
        db.session.commit()

        logger.info(f"✅ Data saved to DB: id={device_data.id}, device_id={device_data.device_id}")

        # Broadcast to SSE clients
        broadcast_data = {
            'device_id': device_data.device_id,
            'timestamp': device_data.timestamp.isoformat(),
            'voltage_v': device_data.voltage_v,
            'current_a': device_data.current_a,
            'power_w': device_data.power_w,
            'rpm': device_data.rpm,
            'pressure_hpa': device_data.pressure_hpa,
            'temp_c': device_data.temp_c,
            'humidity_pct': device_data.humidity_pct,
            'wind_mps': device_data.wind_mps
        }
        broadcast_to_device_clients(device_data.device_id, broadcast_data)
        logger.info(f"📡 Broadcast to SSE clients: device_id={device_data.device_id}")

        return jsonify({
            'status': 'success',
            'id': device_data.id,
            'device_id': device_data.device_id
        }), 201

    except Exception as e:
        logger.error(f"❌ Error in ingest: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/stream')
def stream():
    """SSE endpoint for real-time data"""
    device_id = request.args.get('device_id')
    if not device_id:
        return jsonify({'error': 'device_id parameter required'}), 400

    logger.info(f"🔌 SSE connection opened: device_id={device_id}")

    def event_stream():
        client_queue = Queue(maxsize=10)

        with clients_lock:
            if device_id not in sse_clients:
                sse_clients[device_id] = []
            sse_clients[device_id].append(client_queue)

        try:
            # Send initial connection message
            yield f"data: {json.dumps({'type': 'connected', 'device_id': device_id})}\n\n"

            while True:
                try:
                    data = client_queue.get(timeout=10)  # 10 second timeout
                    yield f"data: {json.dumps(data)}\n\n"
                except Empty:
                    # Send keepalive every 10 seconds to prevent worker timeout
                    yield f": keepalive {datetime.utcnow().isoformat()}\n\n"
        finally:
            logger.info(f"🔌 SSE connection closed: device_id={device_id}")
            with clients_lock:
                if device_id in sse_clients:
                    sse_clients[device_id].remove(client_queue)
                    if not sse_clients[device_id]:
                        del sse_clients[device_id]

    response = Response(event_stream(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['X-Accel-Buffering'] = 'no'
    response.headers['Connection'] = 'keep-alive'
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response


@app.route('/api/v1/devices')
def get_devices():
    """Get list of all devices that have sent data"""
    try:
        devices = db.session.query(DeviceData.device_id).distinct().all()
        device_list = []

        logger.info(f"📋 Getting devices list: found {len(devices)} unique device(s)")

        for (device_id,) in devices:
            # Get latest data for each device
            latest = DeviceData.query.filter_by(device_id=device_id)\
                .order_by(DeviceData.timestamp.desc()).first()

            if latest:
                offline = (datetime.utcnow() - latest.timestamp).total_seconds() > OFFLINE_THRESHOLD_SECONDS
                device_list.append({
                    'device_id': device_id,
                    'last_seen': latest.timestamp.isoformat(),
                    'offline': offline
                })

        logger.info(f"✅ Returning {len(device_list)} device(s)")
        return jsonify({'devices': device_list})
    except Exception as e:
        logger.error(f"❌ Error getting devices: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/latest')
def get_latest():
    """Get latest data for a device"""
    device_id = request.args.get('device_id')
    if not device_id:
        return jsonify({'error': 'device_id parameter required'}), 400

    try:
        latest = DeviceData.query.filter_by(device_id=device_id)\
            .order_by(DeviceData.timestamp.desc()).first()

        if not latest:
            return jsonify({'error': 'No data found for device'}), 404

        offline = (datetime.utcnow() - latest.timestamp).total_seconds() > OFFLINE_THRESHOLD_SECONDS

        return jsonify({
            'device_id': latest.device_id,
            'timestamp': latest.timestamp.isoformat(),
            'offline': offline,
            'data': {
                'voltage_v': latest.voltage_v,
                'current_a': latest.current_a,
                'power_w': latest.power_w,
                'rpm': latest.rpm,
                'pressure_hpa': latest.pressure_hpa,
                'temp_c': latest.temp_c,
                'humidity_pct': latest.humidity_pct,
                'wind_mps': latest.wind_mps
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/history')
def get_history():
    """Get historical data for a device"""
    device_id = request.args.get('device_id')
    metric = request.args.get('metric')
    from_ts = request.args.get('from')
    to_ts = request.args.get('to')
    limit = request.args.get('limit', 1000, type=int)

    if not device_id:
        return jsonify({'error': 'device_id parameter required'}), 400

    try:
        query = DeviceData.query.filter_by(device_id=device_id)

        if from_ts:
            from_dt = datetime.utcfromtimestamp(int(from_ts) / 1000.0)  # Use UTC
            query = query.filter(DeviceData.timestamp >= from_dt)

        if to_ts:
            to_dt = datetime.utcfromtimestamp(int(to_ts) / 1000.0)  # Use UTC
            query = query.filter(DeviceData.timestamp <= to_dt)

        results = query.order_by(DeviceData.timestamp.desc()).limit(limit).all()

        history = []
        for record in reversed(results):
            entry = {
                'timestamp': record.timestamp.isoformat(),
                'ts': int(record.timestamp.timestamp() * 1000)
            }

            if metric:
                # Return only requested metric
                entry[metric] = getattr(record, metric, None)
            else:
                # Return all metrics
                entry.update({
                    'voltage_v': record.voltage_v,
                    'current_a': record.current_a,
                    'power_w': record.power_w,
                    'rpm': record.rpm,
                    'pressure_hpa': record.pressure_hpa,
                    'temp_c': record.temp_c,
                    'humidity_pct': record.humidity_pct,
                    'wind_mps': record.wind_mps
                })

            history.append(entry)

        return jsonify({
            'device_id': device_id,
            'count': len(history),
            'history': history
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/health')
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})


# Development endpoints
@app.route('/api/v1/dev/simulate', methods=['POST'])
def simulate_data():
    """Development only: Simulate device data"""
    try:
        count = request.json.get('count', 20) if request.json else 20
        device_id = request.json.get('device_id', 'esp32-001') if request.json else 'esp32-001'

        logger.info(f"🧪 Simulating {count} data points for device {device_id}")

        now = datetime.utcnow()
        created = []

        for i in range(count):
            timestamp = now - timedelta(minutes=count - i)

            # Generate sensor data
            voltage = round(12 + random.uniform(-1, 1), 2)
            current = round(1.2 + random.uniform(-0.2, 0.3), 2)
            power = voltage * current  # Calculate power

            device_data = DeviceData(
                device_id=device_id,
                timestamp=timestamp,
                voltage_v=voltage,
                current_a=current,
                power_w=power,
                rpm=int(3400 + random.uniform(-200, 300)),
                pressure_hpa=round(1013 + random.uniform(-5, 5), 2),
                temp_c=round(25 + random.uniform(-3, 3), 1),
                humidity_pct=round(55 + random.uniform(-10, 10), 1),
                wind_mps=round(3.5 + random.uniform(-1, 1.5), 1)
            )

            db.session.add(device_data)
            created.append(device_data.id)

        db.session.commit()
        logger.info(f"✅ Simulated {count} data points")

        return jsonify({
            'status': 'success',
            'device_id': device_id,
            'count': count,
            'message': f'Created {count} simulated data points'
        }), 201

    except Exception as e:
        logger.error(f"❌ Error simulating data: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/dev/clear', methods=['POST'])
def clear_data():
    """Development only: Clear all device data"""
    try:
        count = db.session.query(DeviceData).count()
        db.session.query(DeviceData).delete()
        db.session.commit()

        logger.info(f"🗑️ Cleared {count} data points")

        return jsonify({
            'status': 'success',
            'deleted': count,
            'message': f'Cleared {count} data points'
        })

    except Exception as e:
        logger.error(f"❌ Error clearing data: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', '5000'))
    logger.info(f"🚀 Starting Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')
