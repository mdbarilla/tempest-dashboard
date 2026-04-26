const axios = require('axios');
const NodeCache = require('node-cache');

// Cache settings from environment or defaults
const CACHE_TTL_CURRENT = parseInt(process.env.CACHE_CURRENT_WEATHER) || 60;
const CACHE_TTL_FORECAST = parseInt(process.env.CACHE_FORECAST) || 300;
const CACHE_TTL_DEVICE_OBS = parseInt(process.env.CACHE_DEVICE_OBSERVATIONS) || 120; // 2 min for same range

// Initialize cache
const cache = new NodeCache({
  stdTTL: CACHE_TTL_CURRENT,
  checkperiod: 120
});

// Tempest device obs_st layout (array indices): 0=epoch, 1=wind lull m/s, 2=wind avg m/s, 3=wind gust m/s, 4=wind dir,
// 5=interval, 6=pressure mb, 7=air temp C, 8=humidity %, 9=illuminance, 10=uv, 11=solar, 12=rain mm, 13=precip type,
// 14=strike dist, 15=strike count, 16=battery, 17=report min, 18=local day rain mm
const MPS_TO_MPH = 2.23694;
const MM_TO_IN = 0.0393701;

class TempestAPI {
  constructor() {
    this.apiToken = process.env.TEMPEST_API_TOKEN;
    this.stationId = process.env.TEMPEST_STATION_ID;
    this.deviceId = process.env.TEMPEST_DEVICE_ID ? String(process.env.TEMPEST_DEVICE_ID).trim() : null;
    this.latitude = process.env.TEMPEST_LATITUDE;
    this.longitude = process.env.TEMPEST_LONGITUDE;
    this.baseUrl = 'https://swd.weatherflow.com/swd/rest';

    if (!this.apiToken || !this.stationId) {
      throw new Error('TEMPEST_API_TOKEN and TEMPEST_STATION_ID must be set in environment');
    }
  }

  /**
   * Convert one Tempest device obs_st array to a row matching our DB/bucket shape (same fields as observations table).
   * Device API uses metric: temp C, wind m/s, precip mm. We output F/C, mph, pressure mb, precip in inches for charts.
   */
  deviceObsArrayToRow(arr) {
    if (!Array.isArray(arr) || arr.length < 19) return null;
    const ts = Number(arr[0]);
    if (!Number.isFinite(ts)) return null;
    const tempC = arr[7] != null ? Number(arr[7]) : null;
    const tempF = tempC != null ? tempC * 9 / 5 + 32 : null;
    const windLull = arr[1] != null ? Number(arr[1]) * MPS_TO_MPH : null;
    const windAvg = arr[2] != null ? Number(arr[2]) * MPS_TO_MPH : null;
    const windGust = arr[3] != null ? Number(arr[3]) * MPS_TO_MPH : null;
    const precipMm = arr[18] != null ? Number(arr[18]) : null;
    const precipIn = precipMm != null ? precipMm * MM_TO_IN : null;
    return {
      timestamp: ts,
      temp_fahrenheit: tempF,
      temp_celsius: tempC,
      humidity: arr[8] != null ? Number(arr[8]) : null,
      wind_speed: windAvg,
      wind_gust: windGust,
      wind_lull: windLull,
      wind_direction: arr[4] != null ? Number(arr[4]) : null,
      pressure_mb: arr[6] != null ? Number(arr[6]) : null,
      uv_index: arr[10] != null ? Number(arr[10]) : null,
      solar_radiation: arr[11] != null ? Number(arr[11]) : null,
      precip_today: precipIn
    };
  }

  /**
   * Get device observations for a time range (max 5 days per request). Used to fill 3d/7d chart gaps when Pi is offline.
   * Returns array of rows in same shape as DB observations (timestamp, temp_fahrenheit, pressure_mb, etc.).
   */
  async getDeviceObservations(deviceId, timeStartUnix, timeEndUnix) {
    const id = deviceId || this.deviceId;
    if (!id || !this.apiToken) return [];

    const MAX_DAYS = 5;
    const maxSpan = MAX_DAYS * 24 * 3600;
    const span = timeEndUnix - timeStartUnix;
    const ranges = [];
    if (span <= maxSpan) {
      ranges.push([timeStartUnix, timeEndUnix]);
    } else {
      for (let t = timeStartUnix; t < timeEndUnix; t += maxSpan) {
        ranges.push([t, Math.min(t + maxSpan, timeEndUnix)]);
      }
    }

    const cacheKeyBase = `device_obs_${id}_`;
    const allRows = [];
    for (const [start, end] of ranges) {
      const cacheKey = `${cacheKeyBase}${start}_${end}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        allRows.push(...cached);
        continue;
      }
      try {
        const url = `${this.baseUrl}/observations/device/${id}?token=${this.apiToken}&time_start=${start}&time_end=${end}`;
        const response = await axios.get(url, { timeout: 15000 });
        const obs = response.data?.obs;
        const type = response.data?.type || 'obs_st';
        if (!Array.isArray(obs) || obs.length === 0) {
          // Do not cache empty so transient failures get retried
          continue;
        }
        const rows = obs
          .map((arr) => (type === 'obs_st' ? this.deviceObsArrayToRow(arr) : null))
          .filter(Boolean);
        cache.set(cacheKey, rows, CACHE_TTL_DEVICE_OBS);
        allRows.push(...rows);
      } catch (err) {
        console.warn('[TempestAPI] getDeviceObservations failed:', err.message);
      }
    }
    return allRows.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get current weather observations
   */
  async getCurrentWeather() {
    const cacheKey = 'current_weather';
    const cached = cache.get(cacheKey);

    if (cached) {
      console.log('Returning cached current weather');
      return cached;
    }

    try {
      // Use forecast API which includes current_conditions
      const url = `${this.baseUrl}/better_forecast?station_id=${this.stationId}&token=${this.apiToken}`;
      const response = await axios.get(url);

      if (!response.data.current_conditions) {
        throw new Error('No current conditions available');
      }

      const data = this.formatCurrentWeatherFromForecast(response.data.current_conditions);
      cache.set(cacheKey, data, CACHE_TTL_CURRENT);

      return data;
    } catch (error) {
      console.error('Error fetching current weather:', error.message);
      throw error;
    }
  }

  /**
   * Get forecast data
   */
  async getForecast() {
    const cacheKey = 'forecast';
    const cached = cache.get(cacheKey);

    if (cached) {
      console.log('Returning cached forecast');
      return cached;
    }

    try {
      const url = `${this.baseUrl}/better_forecast?station_id=${this.stationId}&token=${this.apiToken}`;
      const response = await axios.get(url);

      const data = this.formatForecast(response.data);
      cache.set(cacheKey, data, CACHE_TTL_FORECAST);

      return data;
    } catch (error) {
      console.error('Error fetching forecast:', error.message);
      throw error;
    }
  }

  /**
   * Get both current weather and forecast in one call
   */
  async getCompleteWeather() {
    const [current, forecast] = await Promise.all([
      this.getCurrentWeather(),
      this.getForecast()
    ]);

    return {
      current,
      forecast,
      station: {
        id: this.stationId,
        latitude: this.latitude,
        longitude: this.longitude
      }
    };
  }

  /**
   * Format current weather data from forecast API current_conditions
   */
  formatCurrentWeatherFromForecast(conditions) {
    const MM_TO_IN = 0.0393701;
    const precipTodayMm = conditions.precip_accum_local_day ?? conditions.precip_accum_local_day_mm ?? conditions.precip_local_day_accum ?? null;
    const precipLastHourMm = conditions.precip_accum_last_1hr ?? conditions.precip_accum_last_1hr_mm ?? conditions.precip_last_hour_accum ?? null;
    const precipToday = precipTodayMm != null ? precipTodayMm * MM_TO_IN : 0;
    const precipLastHour = precipLastHourMm != null ? precipLastHourMm * MM_TO_IN : 0;
    return {
      timestamp: conditions.time,
      temperature: {
        celsius: conditions.air_temperature,
        fahrenheit: (conditions.air_temperature * 9/5) + 32
      },
      feelsLike: {
        celsius: conditions.feels_like,
        fahrenheit: (conditions.feels_like * 9/5) + 32
      },
      humidity: conditions.relative_humidity,
      wind: {
        speed: conditions.wind_avg,
        gust: conditions.wind_gust,
        lull: conditions.wind_lull ?? null,
        direction: conditions.wind_direction,
        directionText: conditions.wind_direction_cardinal || this.getWindDirection(conditions.wind_direction)
      },
      pressure: {
        mb: conditions.sea_level_pressure,
        inHg: conditions.sea_level_pressure * 0.02953
      },
      uv: conditions.uv,
      solarRadiation: conditions.solar_radiation,
      precipitation: {
        today: precipToday,
        lastHour: precipLastHour
      },
      lightning: {
        strikeCount: 0,
        lastDistance: 0,
        lastTime: 0
      },
      conditions: conditions.conditions,
      icon: conditions.icon
    };
  }

  /**
   * Format current weather data (legacy - kept for compatibility)
   */
  formatCurrentWeather(data) {
    const obs = data.obs[0];

    return {
      timestamp: obs.timestamp,
      temperature: {
        celsius: obs.air_temperature,
        fahrenheit: (obs.air_temperature * 9/5) + 32
      },
      feelsLike: {
        celsius: obs.feels_like,
        fahrenheit: (obs.feels_like * 9/5) + 32
      },
      humidity: obs.relative_humidity,
      wind: {
        speed: obs.wind_avg,
        gust: obs.wind_gust,
        direction: obs.wind_direction,
        directionText: this.getWindDirection(obs.wind_direction)
      },
      pressure: {
        mb: obs.sea_level_pressure,
        inHg: obs.sea_level_pressure * 0.02953
      },
      uv: obs.uv,
      solarRadiation: obs.solar_radiation,
      precipitation: {
        today: obs.precip_accum_local_day,
        lastHour: obs.precip_accum_last_1hr
      },
      lightning: {
        strikeCount: obs.lightning_strike_count,
        lastDistance: obs.lightning_strike_last_distance,
        lastTime: obs.lightning_strike_last_epoch
      }
    };
  }

  /**
   * Format forecast data
   */
  formatForecast(data) {
    const result = {
      current: data.current_conditions,
      hourly: [],
      daily: []
    };

    // Format hourly forecast (next 24 hours)
    if (data.forecast && data.forecast.hourly) {
      result.hourly = data.forecast.hourly.slice(0, 24).map(hour => ({
        time: hour.time,
        temperature: {
          celsius: hour.air_temperature,
          fahrenheit: (hour.air_temperature * 9/5) + 32
        },
        conditions: hour.conditions || hour.condition,
        icon: hour.icon ?? (hour.icon_num != null ? hour.icon_num : undefined),
        precipProbability: hour.precip_probability,
        humidity: hour.relative_humidity,
        wind: {
          speed: hour.wind_avg,
          gust: hour.wind_gust ?? null,
          lull: hour.wind_lull ?? null,
          direction: hour.wind_direction
        }
      }));
    }

    // Format daily forecast
    if (data.forecast && data.forecast.daily) {
      result.daily = data.forecast.daily.map(day => ({
        date: day.day_start_local || day.day_start,
        conditions: day.conditions || day.condition,
        icon: day.icon ?? (day.icon_num != null ? day.icon_num : undefined),
        temperature: {
          high: {
            celsius: day.air_temp_high,
            fahrenheit: (day.air_temp_high * 9/5) + 32
          },
          low: {
            celsius: day.air_temp_low,
            fahrenheit: (day.air_temp_low * 9/5) + 32
          }
        },
        precipProbability: day.precip_probability,
        precipType: day.precip_type,
        sunrise: day.sunrise,
        sunset: day.sunset
      }));
    }

    return result;
  }

  /**
   * Convert wind direction degrees to cardinal direction
   */
  getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    cache.flushAll();
  }
}

module.exports = new TempestAPI();
