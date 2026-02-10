# Tempest Backend Services

This directory contains the core services that power the Tempest Weather API backend.

## Services Overview

### DataCollector (`data-collector.js`)

Automated service that periodically fetches current weather observations and saves them to the database. This ensures continuous historical data availability for sparkline trends.

**Features:**
- Configurable collection interval (default: 1 minute)
- Automatic database cleanup of old observations (default: 7 days retention)
- Error handling with automatic shutdown after consecutive failures
- Graceful shutdown support
- Status monitoring

**Configuration:**

```javascript
const collector = new DataCollector(intervalMinutes, {
  maxConsecutiveErrors: 10,    // Stop after N consecutive errors
  retentionDays: 7,             // Keep data for N days
  cleanupIntervalHours: 24      // Run cleanup every N hours
});
```

**Usage:**

```javascript
// Start collecting
collector.start();

// Get status
const status = collector.getStatus();
console.log(status.isRunning);        // true/false
console.log(status.consecutiveErrors); // error count

// Stop collecting
collector.stop();
```

**Production Considerations:**
- The collector automatically stops after 10 consecutive errors to prevent resource waste
- Log verbosity is reduced (logs only every 10 minutes) to minimize console noise
- Old data is automatically cleaned up to prevent unbounded database growth
- Graceful shutdown is handled via SIGTERM/SIGINT signals

---

### WeatherDatabase (`database.js`)

SQLite database manager for storing and retrieving weather observations, corrections, and manual precipitation entries.

**Key Methods:**
- `saveObservation(data)` - Save weather observation
- `getHistoricalData(startDate, endDate, limit)` - Retrieve observations for date range
- `deleteOldObservations(cutoffTimestamp)` - Remove old data (used by DataCollector)
- `getStatistics(startDate, endDate)` - Get aggregated statistics
- `saveCorrection(data)` - Save user condition correction
- `logPrecipitation(data)` - Log manual precipitation entry

**Database Schema:**
- `observations` - Weather readings with timestamp, temperature, pressure, etc.
- `condition_corrections` - User-reported condition overrides
- `manual_precipitation` - User-logged precipitation entries

**Singleton Pattern:**
The database is exported as a singleton instance to ensure a single connection across the application.

---

### TempestAPI (`tempest-api.js`)

Client for the Tempest Weather API with built-in caching.

**Features:**
- Automatic response caching (60s for current weather, 5min for forecast)
- Handles station-specific and location-based weather requests
- Caches better forecast data to reduce API calls

**Key Methods:**
- `getCurrentWeather()` - Get current conditions
- `getBetterForecast()` - Get detailed hourly/daily forecast
- `clearCache()` - Manually clear all cached data

**Caching:**
- Current weather: 60 seconds TTL
- Forecast data: 300 seconds (5 minutes) TTL
- Cache automatically expires on TTL
- Manual cache clearing available via API endpoint

---

## Environment Variables

Required environment variables (set in `backend/.env`):

```bash
# Tempest API credentials
TEMPEST_API_TOKEN=your_api_token
TEMPEST_STATION_ID=your_station_id

# Location for better forecast (optional)
TEMPEST_LATITUDE=your_latitude
TEMPEST_LONGITUDE=your_longitude

# Server configuration
PORT=3001
NODE_ENV=production

# Cache settings (optional)
CACHE_CURRENT_WEATHER=60    # seconds
CACHE_FORECAST=300          # seconds

# Database path (optional)
DATABASE_PATH=./data/weather.db
```

---

## Production Deployment

### System Requirements
- Node.js 16+
- SQLite3
- 100MB+ free disk space for database

### Running in Production

```bash
# Install dependencies
npm install

# Start server
npm start
```

The server will:
1. Initialize SQLite database
2. Start Express API server on port 3001
3. Start data collector (saves observations every minute)
4. Begin automatic database cleanup (every 24 hours)

### Process Management

For production deployments, use a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name tempest-backend

# Enable auto-restart on reboot
pm2 startup
pm2 save
```

### Monitoring

Check data collector status:
```bash
curl http://localhost:3001/health
```

View recent database activity:
```bash
sqlite3 data/weather.db "SELECT COUNT(*), datetime(MAX(timestamp), 'unixepoch') FROM observations;"
```

---

## Troubleshooting

### Data Collector Not Running
- Check logs for error messages
- Verify TEMPEST_API_TOKEN and TEMPEST_STATION_ID are set
- Check that Tempest API is accessible
- Collector auto-stops after 10 consecutive errors - restart server

### Database Growing Too Large
- Default retention is 7 days
- Adjust `retentionDays` in server.js if needed
- Manual cleanup: Delete observations older than N days

### Rate Limiting Warnings
- Server now sets `trust proxy` to handle X-Forwarded-For headers
- If behind nginx/load balancer, this is normal and safe

---

## Development

### Running in Development Mode

```bash
# Install dev dependencies
npm install

# Run with auto-reload
npm run dev
```

### Testing Edge Cases

```bash
# Test with invalid hours parameter
curl "http://localhost:3001/api/weather/recent?hours=invalid"

# Test with extreme hours value
curl "http://localhost:3001/api/weather/recent?hours=999"

# Test with zero hours
curl "http://localhost:3001/api/weather/recent?hours=0"
```

All edge cases should return appropriate error messages or clamped values.
