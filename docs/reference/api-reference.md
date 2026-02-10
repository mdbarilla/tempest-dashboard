# API Reference

Complete reference for the Tempest Weather Suite API.

## Base URL

```
http://localhost:3001/api/weather
```

For production, replace with your deployed URL.

## Authentication

Currently, the API is open. For production, consider adding API key authentication.

## Endpoints

### Health Check

Check if the server is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-16T12:00:00.000Z",
  "uptime": 3600
}
```

---

### Get Current Weather

Get the latest weather observations.

**Endpoint:** `GET /api/weather/current`

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": 1705406400,
    "temperature": {
      "celsius": 22.5,
      "fahrenheit": 72.5
    },
    "feelsLike": {
      "celsius": 21.8,
      "fahrenheit": 71.2
    },
    "humidity": 45,
    "wind": {
      "speed": 8,
      "gust": 12,
      "direction": 180,
      "directionText": "S"
    },
    "pressure": {
      "mb": 1013.25,
      "inHg": 29.92
    },
    "uv": 3.5,
    "solarRadiation": 450,
    "precipitation": {
      "today": 0.25,
      "lastHour": 0.05
    },
    "lightning": {
      "strikeCount": 0,
      "lastDistance": null,
      "lastTime": null
    }
  }
}
```

---

### Get Forecast

Get forecast data including hourly and daily forecasts.

**Endpoint:** `GET /api/weather/forecast`

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      "conditions": "Partly Cloudy",
      "icon": "partly-cloudy-day",
      "sunrise": 1705406400,
      "sunset": 1705442400
    },
    "hourly": [
      {
        "time": 1705410000,
        "temperature": {
          "celsius": 23.0,
          "fahrenheit": 73.4
        },
        "conditions": "Partly Cloudy",
        "icon": "partly-cloudy-day",
        "precipProbability": 10,
        "wind": {
          "speed": 9,
          "direction": 180
        }
      }
      // ... next 23 hours
    ],
    "daily": [
      {
        "date": 1705363200,
        "conditions": "Partly Cloudy",
        "icon": "partly-cloudy-day",
        "temperature": {
          "high": {
            "celsius": 25.0,
            "fahrenheit": 77.0
          },
          "low": {
            "celsius": 18.0,
            "fahrenheit": 64.4
          }
        },
        "precipProbability": 15,
        "precipType": "rain",
        "sunrise": 1705406400,
        "sunset": 1705442400
      }
      // ... next 9 days
    ]
  }
}
```

---

### Get Complete Weather

Get both current conditions and forecast in one request.

**Endpoint:** `GET /api/weather/complete`

**Response:**
```json
{
  "success": true,
  "data": {
    "current": {
      // Same as /current response
    },
    "forecast": {
      // Same as /forecast response
    },
    "station": {
      "id": "204768",
      "latitude": "42.3725",
      "longitude": "-71.3161"
    }
  }
}
```

---

### Get Recent Observations (Charts)

Get recent observations for sparklines and metric detail charts. Supports 24h, 3d (72h), and 7d (168h) ranges. For 3d/7d, returns hourly-bucketed data; buckets without observations contain null values (charts render gaps).

**Endpoint:** `GET /api/weather/recent`

**Query Parameters:**
- `hours` (optional) - Number of hours to fetch (default: 6, max: 720). Use 24, 72, or 168 for chart views.
- `metric` (optional) - Filter: `pressure`, `humidity`, `wind`, `temperature`, `precipitation`, `solar`, `uv`

**Example:**
```
GET /api/weather/recent?hours=72&metric=pressure
```

**Response:**
```json
{
  "success": true,
  "count": 72,
  "hours": 72,
  "data": {
    "timestamps": [1770228000, 1770231600, ...],
    "pressure": [1013.2, null, 1012.8, ...]
  }
}
```

---

### Get Historical Data

Retrieve historical weather observations from the database.

**Endpoint:** `GET /api/weather/historical`

**Query Parameters:**
- `start` (required) - Start date in YYYY-MM-DD format
- `end` (required) - End date in YYYY-MM-DD format
- `limit` (optional) - Maximum records to return (default: 1000)

**Example:**
```
GET /api/weather/historical?start=2024-01-01&end=2024-01-16&limit=500
```

**Response:**
```json
{
  "success": true,
  "count": 384,
  "data": [
    {
      "id": 1,
      "timestamp": 1705406400,
      "temp_celsius": 22.5,
      "temp_fahrenheit": 72.5,
      "feels_like_celsius": 21.8,
      "feels_like_fahrenheit": 71.2,
      "humidity": 45,
      "wind_speed": 8,
      "wind_gust": 12,
      "wind_direction": 180,
      "pressure_mb": 1013.25,
      "pressure_inhg": 29.92,
      "uv_index": 3.5,
      "solar_radiation": 450,
      "precip_today": 0.25,
      "precip_last_hour": 0.05,
      "lightning_strikes": 0,
      "created_at": "2024-01-16 12:00:00"
    }
    // ... more records
  ]
}
```

---

### Get Statistics

Get statistical summary for a date range.

**Endpoint:** `GET /api/weather/stats`

**Query Parameters:**
- `start` (required) - Start date in YYYY-MM-DD format
- `end` (required) - End date in YYYY-MM-DD format

**Example:**
```
GET /api/weather/stats?start=2024-01-01&end=2024-01-16
```

**Response:**
```json
{
  "success": true,
  "data": {
    "record_count": 384,
    "min_temp_f": 32.5,
    "max_temp_f": 85.2,
    "avg_temp_f": 68.7,
    "min_temp_c": 0.3,
    "max_temp_c": 29.6,
    "avg_temp_c": 20.4,
    "avg_humidity": 52.3,
    "max_wind_gust": 28.5,
    "avg_wind_speed": 6.2,
    "total_precipitation": 1.25,
    "max_uv": 8.5,
    "avg_pressure": 1015.2,
    "total_lightning_strikes": 5
  }
}
```

---

## Google Home Webhook

### Dialogflow Fulfillment

Process Google Home/Assistant voice queries.

**Endpoint:** `POST /webhooks/google-home`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "queryResult": {
    "intent": {
      "displayName": "GetCurrentWeather"
    },
    "parameters": {}
  }
}
```

**Response:**
```json
{
  "fulfillmentText": "It's currently 72 degrees with partly cloudy skies and 45% humidity.",
  "source": "tempest-weather-webhook"
}
```

**Supported Intents:**
- `GetCurrentWeather` - Current conditions
- `GetTemperature` - Temperature only
- `GetForecast` - Forecast (today/tomorrow)
- `GetPrecipitation` - Rain information
- `GetWindConditions` - Wind information

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

The API includes rate limiting:
- **100 requests per 15 minutes** per IP address
- Applies to `/api/*` endpoints only

Exceeded rate limit response:
```json
{
  "error": "Too many requests, please try again later."
}
```

---

## Data Caching

To optimize performance and reduce Tempest API calls:

- **Current weather**: Cached for 60 seconds
- **Forecast**: Cached for 5 minutes

Cache can be cleared by restarting the server.

---

## CORS

CORS is enabled for all origins in development. For production, configure allowed origins in `backend/server.js`.

---

## Timestamps

All timestamps are Unix epoch time (seconds since Jan 1, 1970).

Convert to JavaScript Date:
```javascript
const date = new Date(timestamp * 1000);
```

---

## Units

### Temperature
- Celsius (°C)
- Fahrenheit (°F)

### Wind Speed
- Miles per hour (mph)

### Pressure
- Millibars (mb)
- Inches of mercury (inHg)

### Precipitation
- Inches (in)

### Solar Radiation
- Watts per square meter (W/m²)

---

## Example Usage

### JavaScript (Frontend)

```javascript
// Fetch current weather
const response = await fetch('http://localhost:3001/api/weather/current');
const { data } = await response.json();

console.log(`Temperature: ${data.temperature.fahrenheit}°F`);
console.log(`Humidity: ${data.humidity}%`);
```

### cURL

```bash
# Get current weather
curl http://localhost:3001/api/weather/current

# Get historical data
curl "http://localhost:3001/api/weather/historical?start=2024-01-01&end=2024-01-16"

# Get statistics
curl "http://localhost:3001/api/weather/stats?start=2024-01-01&end=2024-01-16"
```

### Python

```python
import requests

# Get current weather
response = requests.get('http://localhost:3001/api/weather/current')
data = response.json()['data']

print(f"Temperature: {data['temperature']['fahrenheit']}°F")
print(f"Humidity: {data['humidity']}%")
```

---

## WebSocket Support

WebSocket support for real-time updates is planned for a future release.

---

## Future Enhancements

Planned API improvements:
- [ ] API key authentication
- [ ] WebSocket real-time updates
- [ ] Hourly aggregated historical data
- [ ] Weather alerts endpoint
- [ ] Multiple station support
- [ ] GraphQL endpoint
- [ ] Bulk data export
