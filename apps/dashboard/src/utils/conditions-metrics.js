/** Parse SQLite datetime (UTC) to local time for display */
const parseSqliteUtc = (val) => {
  if (!val) return null;
  const s = String(val);
  if (/Z$|[-+]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s + 'Z');
};

/**
 * Shared logic for conditions-list metrics (and future reuse in Metrics).
 * Builds metric definitions from current, forecast, and recent data.
 */

/**
 * Returns historical trend data only (from /recent). No forecast fallback:
 * conditions list trendlines must show past observations, not hourly forecast.
 */
export function getTrendData(metric, recent, _forecast) {
  if (!recent?.[metric] || !Array.isArray(recent[metric])) {
    return null;
  }
  const valid = recent[metric].filter((v) => v != null);
  if (valid.length < 2) {
    return null;
  }
  return recent[metric];
}

const TREND_HOURS = 12;

export function getTrendCallouts(metric, trendData, hours = TREND_HOURS) {
  if (!trendData || !Array.isArray(trendData) || trendData.length < 2) return null;
  const valid = trendData.filter((v) => v != null);
  if (valid.length < 2) return null;
  const lo = Math.min(...valid);
  const hi = Math.max(...valid);
  const key = `${hours}h`;
  let unit = '';
  switch (metric) {
    case 'temperature':
      unit = '°';
      break;
    case 'pressure':
      unit = ' mb';
      break;
    case 'humidity':
      unit = '%';
      break;
    case 'wind':
      unit = ' mph';
      break;
    case 'precipitation':
      unit = ' in';
      break;
    case 'solar':
      unit = ' W/m²';
      break;
    default:
      unit = '';
  }
  const format = (v) => (metric === 'pressure' ? v.toFixed(1) : Math.round(v));
  return { key, lo: format(lo), hi: format(hi), unit };
}

export function getPressureTrend(recent) {
  const pressureData = recent?.pressure;
  if (!pressureData || !Array.isArray(pressureData) || pressureData.length < 2) return 'stable';
  const valid = pressureData.filter((v) => v != null);
  if (valid.length < 2) return 'stable';
  const latest = valid[valid.length - 1];
  const earlier = valid[0];
  const diff = latest - earlier;
  if (diff > 0.5) return 'rising';
  if (diff < -0.5) return 'falling';
  return 'stable';
}

export function getSunTime(forecast) {
  if (!forecast?.daily?.length) return null;
  const now = new Date();
  const nowMs = now.getTime();
  const todayStr = now.toDateString();
  let dayIdx = forecast.daily.findIndex((d) => new Date(d.date * 1000).toDateString() === todayStr);
  if (dayIdx < 0) {
    const withPast = forecast.daily.findIndex((d) => d.sunset && d.sunset * 1000 < nowMs);
    if (withPast >= 0) dayIdx = withPast;
  }
  const day = forecast.daily[dayIdx];
  const sunrise = day?.sunrise ? new Date(day.sunrise * 1000) : null;
  const sunset = day?.sunset ? new Date(day.sunset * 1000) : null;
  if (!sunrise || !sunset) return null;
  const isDaytime = nowMs >= sunrise.getTime() && nowMs < sunset.getTime();
  const daylightMs = sunset - sunrise;
  const daylightHours = Math.floor(daylightMs / (1000 * 60 * 60));
  const daylightMinutes = Math.floor((daylightMs % (1000 * 60 * 60)) / (1000 * 60));
  const sunsetTime = sunset.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const sunriseTime = sunrise.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  let displaySunriseTime;
  let secondaryTimeVal;
  if (isDaytime) {
    displaySunriseTime = sunriseTime;
    secondaryTimeVal = sunriseTime;
  } else {
    if (nowMs < sunrise.getTime()) {
      displaySunriseTime = sunriseTime;
      const prev = forecast.daily[dayIdx - 1];
      secondaryTimeVal = prev?.sunset ? new Date(prev.sunset * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : sunsetTime;
    } else {
      const next = forecast.daily[dayIdx + 1];
      displaySunriseTime = next?.sunrise ? new Date(next.sunrise * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
      secondaryTimeVal = sunsetTime;
    }
  }
  return {
    label: isDaytime ? 'Sunset' : 'Sunrise',
    primaryTime: isDaytime ? sunsetTime : displaySunriseTime,
    secondaryTime: secondaryTimeVal,
    secondaryLabel: isDaytime ? 'Sunrise' : 'Sunset',
    daylightDuration: `${daylightHours}h ${daylightMinutes}m daylight`,
  };
}

export function calculateDewPoint(tempF, humidity) {
  const tempC = ((tempF - 32) * 5) / 9;
  const a = 17.27, b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
  const dewPointC = (b * alpha) / (a - alpha);
  return Math.round((dewPointC * 9) / 5 + 32);
}

/**
 * @param {{ current: object, forecast: object, recent: object }} opts
 * @returns {Array<{ type: string, label: string, value: string|number, unit: string, secondary: string, customContent?: { notes: string } | null }>}
 */
export function buildConditionsMetrics({ current, forecast, recent }) {
  if (!current) return [];
  const manualPrecip = current.precipitation?.manual;
  const hasManualEntry = Boolean(manualPrecip);
  const pressureTrend = getPressureTrend(recent);
  const sunTime = getSunTime(forecast);
  const dewPoint = calculateDewPoint(current.temperature.fahrenheit, current.humidity);
  const conditions = forecast?.current?.conditions || 'Clear';
  const tempF = current.temperature.fahrenheit;
  const feelsLikeF = current.feelsLike.fahrenheit;
  const showFeelsLike = Math.abs(tempF - feelsLikeF) > 3;
  const feelsLike = Math.round(feelsLikeF);

  const conditionDisplay = (conditions || 'Clear').replace(/\b\w/g, (c) => c.toUpperCase());

  // Today high/low: use daily forecast, clamp with current temp; display as XX°/XX°
  const dailyHigh = forecast?.daily?.[0]?.temperature?.high?.fahrenheit;
  const dailyLow = forecast?.daily?.[0]?.temperature?.low?.fahrenheit;
  const todayHigh = dailyHigh != null ? Math.round(Math.max(tempF, dailyHigh)) : Math.round(tempF);
  const todayLow = dailyLow != null ? Math.round(Math.min(tempF, dailyLow)) : Math.round(tempF);
  const highLowDisplay = `${todayHigh}°/${todayLow}°`;

  const metrics = [
    {
      type: 'conditions',
      label: 'Current conditions',
      condition: conditions || 'Clear',
      conditionDisplay,
    },
    {
      type: 'temperature',
      label: 'Temperature',
      value: tempF.toFixed(1),
      unit: '°',
      secondary: null,
      showFeelsLike,
      feelsLike,
      todayHigh,
      todayLow,
      highLowDisplay,
    },
    {
      type: 'pressure',
      label: 'Pressure',
      value: current.pressure.inHg.toFixed(2),
      unit: 'inHg',
      secondary: `${current.pressure.mb.toFixed(1)} mb · ${pressureTrend}`,
    },
    {
      type: 'humidity',
      label: 'Humidity',
      value: Math.round(current.humidity),
      unit: '%',
      secondary: `Dew point ${dewPoint}°`,
    },
    {
      type: 'wind',
      label: 'Wind',
      value: Math.round(current.wind.speed),
      unit: 'mph',
      secondary: `Gusts ${Math.round(current.wind.gust)} mph ${current.wind.directionText}`,
    },
    {
      type: 'precipitation',
      label: 'Precipitation',
      value: manualPrecip ? manualPrecip.amountInches.toFixed(2) : current.precipitation.today.toFixed(2),
      unit: 'in',
      secondary: manualPrecip
        ? (() => {
            const a = Number(manualPrecip.amountInches);
            const inchStr = a >= 1 ? `${a}in` : a === 0 ? '0in' : `${String(a).replace(/^0/, '')}in`;
            const sinceTime = manualPrecip.updatedAt
              ? parseSqliteUtc(manualPrecip.updatedAt)?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              : null;
            return sinceTime ? `${manualPrecip.type} (manual) · ${inchStr} since ${sinceTime}` : `${manualPrecip.type} (manual)`;
          })()
        : `${current.precipitation.lastHour.toFixed(2)} in last hour`,
      customContent: hasManualEntry && manualPrecip.notes ? { notes: manualPrecip.notes } : null,
    },
    {
      type: 'solar',
      label: 'Solar Radiation',
      value: Math.round(current.solarRadiation || 0),
      unit: 'W/m²',
      secondary: `UV Index ${current.uv ?? 0}`,
    },
  ];

  if (sunTime) {
    const parts = sunTime.primaryTime.split(' ');
    metrics.push({
      type: sunTime.label.toLowerCase(),
      label: sunTime.label,
      value: parts[0],
      unit: parts[1] ? ` ${parts[1]}` : '',
      secondary: `${sunTime.secondaryLabel} ${sunTime.secondaryTime} · ${sunTime.daylightDuration}`,
    });
  }

  return metrics;
}
