#!/usr/bin/env python3
"""
Migration script: Add wind_voltage_v and solar_voltage_v fields
Usage: python migrate_add_voltage_fields.py
"""
import os
import sys
from sqlalchemy import create_engine, text

# Get database URL from environment or use default
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///windmill.db')

# Fix PostgreSQL URL format if needed
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

print(f"Connecting to database: {DATABASE_URL}")

try:
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # Detect database type
        if 'sqlite' in DATABASE_URL.lower():
            print("Detected SQLite database")
            column_type = "REAL"
        else:
            print("Detected PostgreSQL database")
            column_type = "DOUBLE PRECISION"

        # Add wind_voltage_v column
        try:
            print(f"Adding wind_voltage_v column ({column_type})...")
            conn.execute(text(f"ALTER TABLE device_data ADD COLUMN wind_voltage_v {column_type}"))
            conn.commit()
            print("✓ wind_voltage_v column added successfully")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("✓ wind_voltage_v column already exists")
            else:
                raise

        # Add solar_voltage_v column
        try:
            print(f"Adding solar_voltage_v column ({column_type})...")
            conn.execute(text(f"ALTER TABLE device_data ADD COLUMN solar_voltage_v {column_type}"))
            conn.commit()
            print("✓ solar_voltage_v column added successfully")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("✓ solar_voltage_v column already exists")
            else:
                raise

    print("\n✅ Migration completed successfully!")

except Exception as e:
    print(f"\n❌ Migration failed: {str(e)}", file=sys.stderr)
    sys.exit(1)
