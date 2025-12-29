# Database Migrations

## add_voltage_fields.sql

**Date:** 2025-12-29

**Description:** Adds two new optional fields for voltage readings:
- `wind_voltage_v` (FLOAT): Wind generator voltage
- `solar_voltage_v` (FLOAT): Solar panel voltage

### Manual Migration

**SQLite:**
```sql
ALTER TABLE device_data ADD COLUMN wind_voltage_v REAL;
ALTER TABLE device_data ADD COLUMN solar_voltage_v REAL;
```

**PostgreSQL:**
```sql
ALTER TABLE device_data ADD COLUMN wind_voltage_v DOUBLE PRECISION;
ALTER TABLE device_data ADD COLUMN solar_voltage_v DOUBLE PRECISION;
```

### Automatic Migration

Run the Python migration script:
```bash
cd backend
python migrate_add_voltage_fields.py
```

### Notes

- These fields are optional (nullable)
- Existing records will have NULL values for these fields
- The application is backward compatible - old clients can continue to work without sending these fields
- New clients can send `wind_voltage_v` and `solar_voltage_v` in the ingest API
