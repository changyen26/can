from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class DeviceData(db.Model):
    """Model for storing windmill device sensor data"""
    __tablename__ = 'device_data'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(100), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, nullable=False, index=True)

    # Sensor readings
    voltage_v = db.Column(db.Float)
    current_a = db.Column(db.Float)
    power_w = db.Column(db.Float)  # Calculated power (W) = voltage * current
    rpm = db.Column(db.Integer)
    pressure_hpa = db.Column(db.Float)
    temp_c = db.Column(db.Float)
    humidity_pct = db.Column(db.Float)
    wind_mps = db.Column(db.Float)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<DeviceData {self.device_id} @ {self.timestamp}>'

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'device_id': self.device_id,
            'timestamp': self.timestamp.isoformat(),
            'voltage_v': self.voltage_v,
            'current_a': self.current_a,
            'power_w': self.power_w,
            'rpm': self.rpm,
            'pressure_hpa': self.pressure_hpa,
            'temp_c': self.temp_c,
            'humidity_pct': self.humidity_pct,
            'wind_mps': self.wind_mps
        }
