/**
 * Metric card data shared by the dashboard (Metrics) and the e-ink page (EinkPage).
 */

/** Parse SQLite datetime (UTC) to local time for display */
export const parseSqliteUtc = (val) => {
  if (!val) return null;
  const s = String(val);
  if (/Z$|[-+]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s + 'Z');
};

/** Trend series for a metric: prefer recent observations, fall back to forecast. */
export const getTrendData = (metric, recent, forecast) => {
  if (recent?.[metric] && Array.isArray(recent[metric])) {
    const validData = recent[metric].filter(v => v !== null && v !== undefined);
    if (validData.length >= 2) {
      return recent[metric];
    }
  }

  if (!forecast?.hourly || !Array.isArray(forecast.hourly) || forecast.hourly.length < 6) {
    return null;
  }

  const last6Hours = forecast.hourly.slice(0, 6);

  switch (metric) {
    case 'pressure':
      return null; // No pressure in forecast
    case 'humidity':
      return last6Hours.map(h => h.humidity || null).reverse();
    case 'wind':
      return last6Hours.map(h => h.wind?.speed || null).reverse();
    case 'precipitation':
      return last6Hours.map(h => h.precipProbability || 0).reverse();
    case 'solar':
      return last6Hours.map(h => h.solarRadiation || 0).reverse();
    default:
      return null;
  }
};

const getPressureTrend = (recent) => {
  const pressureData = recent?.pressure;
  if (!pressureData || !Array.isArray(pressureData) || pressureData.length < 2) {
    return 'stable';
  }

  const validData = pressureData.filter(v => v !== null && v !== undefined);
  if (validData.length < 2) return 'stable';

  const latestPressure = validData[validData.length - 1];
  const earlierPressure = validData[0];
  const diff = latestPressure - earlierPressure;

  // Threshold: 0.5 mb change is considered significant
  if (diff > 0.5) return 'rising';
  if (diff < -0.5) return 'falling';
  return 'stable';
};

// Daytime = sunrise to sunset (Sunset primary); night = 12a–sunrise and sunset–12a (Sunrise primary).
// Resolve the relevant day by calendar date or most recent sunset-in-past.
const getSunTime = (forecast) => {
  if (!forecast?.daily?.length) return null;

  const now = new Date();
  const nowMs = now.getTime();
  const todayStr = now.toDateString();

  let dayIdx = 0;
  const byDate = forecast.daily.findIndex((d) => new Date(d.date * 1000).toDateString() === todayStr);
  if (byDate >= 0) {
    dayIdx = byDate;
  } else {
    const withPastSunset = forecast.daily.findIndex((d) => d.sunset && d.sunset * 1000 < nowMs);
    if (withPastSunset >= 0) dayIdx = withPastSunset;
  }

  const day = forecast.daily[dayIdx];
  const sunrise = day.sunrise ? new Date(day.sunrise * 1000) : null;
  const sunset = day.sunset ? new Date(day.sunset * 1000) : null;
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
    // Night: 12a–sunrise => primary = today's sunrise, secondary = yesterday's or today's sunset; sunset–12a => primary = tomorrow's sunrise, secondary = today's sunset.
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
    daylightDuration: `${daylightHours}h ${daylightMinutes}m daylight`
  };
};

// Magnus formula approximation
const calculateDewPoint = (tempF, humidity) => {
  const tempC = (tempF - 32) * 5/9;
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
  const dewPointC = (b * alpha) / (a - alpha);
  return Math.round((dewPointC * 9/5) + 32);
};

/** The six metric cards: pressure, humidity, wind, precipitation, solar, sunrise/sunset. */
export const buildMetrics = (current, forecast, recent) => {
  const manualPrecip = current.precipitation?.manual;
  const pressureTrend = getPressureTrend(recent);
  const sunTime = getSunTime(forecast);
  const dewPoint = calculateDewPoint(current.temperature.fahrenheit, current.humidity);

  return [
    {
      type: 'pressure',
      label: 'Pressure',
      value: current.pressure.inHg.toFixed(2),
      unit: 'inHg',
      secondary: `${current.pressure.mb.toFixed(1)} mb · ${pressureTrend}`,
      link: '/conditions/pressure'
    },
    {
      type: 'humidity',
      label: 'Humidity',
      value: Math.round(current.humidity),
      unit: '%',
      secondary: `Dew point ${dewPoint}°`,
      link: '/conditions/humidity'
    },
    {
      type: 'wind',
      label: 'Wind',
      value: Math.round(current.wind.speed),
      unit: 'mph',
      secondary: `Gusts ${Math.round(current.wind.gust)} mph ${current.wind.directionText}`,
      link: '/conditions/wind'
    },
    {
      type: 'precipitation',
      label: 'Precipitation',
      value: manualPrecip ? manualPrecip.amountInches.toFixed(2) : current.precipitation.today.toFixed(2),
      unit: 'in',
      secondary: manualPrecip
        ? (() => {
            const a = Number(manualPrecip.amountInches);
            const inchStr = a >= 1 ? `${a}in` : (a === 0 ? '0in' : `${String(a).replace(/^0/, '')}in`);
            const sinceTime = manualPrecip.updatedAt
              ? parseSqliteUtc(manualPrecip.updatedAt)?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              : null;
            return sinceTime
              ? `${manualPrecip.type} (manual)\n${inchStr} since ${sinceTime}`
              : `${manualPrecip.type} (manual)`;
          })()
        : `${current.precipitation.lastHour.toFixed(2)} in last hour`,
      link: '/conditions/precipitation',
      manualNotes: manualPrecip?.notes || null
    },
    {
      type: 'solar',
      label: 'Solar Radiation',
      value: Math.round(current.solarRadiation || 0),
      unit: 'W/m²',
      secondary: `UV Index ${current.uv || 0}`,
      link: '/conditions/solar'
    },
    ...(sunTime ? [{
      type: sunTime.label.toLowerCase(),
      label: sunTime.label,
      value: sunTime.primaryTime.split(' ')[0],
      unit: sunTime.primaryTime.split(' ')[1],
      secondary: `${sunTime.secondaryLabel} ${sunTime.secondaryTime}\n${sunTime.daylightDuration}`,
      link: '/conditions/sun'
    }] : [])
  ];
};
