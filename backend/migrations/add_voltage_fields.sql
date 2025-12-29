-- Migration: Add wind_voltage_v and solar_voltage_v fields
-- Date: 2025-12-29
-- Description: Add two new optional float fields for wind and solar voltage readings

-- For SQLite
ALTER TABLE device_data ADD COLUMN wind_voltage_v REAL;
ALTER TABLE device_data ADD COLUMN solar_voltage_v REAL;

-- For PostgreSQL, use these instead:
-- ALTER TABLE device_data ADD COLUMN wind_voltage_v DOUBLE PRECISION;
-- ALTER TABLE device_data ADD COLUMN solar_voltage_v DOUBLE PRECISION;
