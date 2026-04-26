import React from 'react';
import { useNavigate } from 'react-router-dom';
import MetricIcon from './MetricIcon';
import Sparkline from './Sparkline';
import './Metrics.css';

/** Parse SQLite datetime (UTC) to local time for display */
const parseSqliteUtc = (val) => {
  if (!val) return null;
  const s = String(val);
  if (/Z$|[-+]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s + 'Z');
};

const Metrics = ({ current, forecast, recent, onMetricClick, isLocal, onRefresh }) => {
  const navigate = useNavigate();
  
  if (!current) return null;

  const manualPrecip = current.precipitation?.manual;
  const hasManualEntry = Boolean(manualPrecip);

  // Get trend data - prefer recent observations over forecast
  const getTrendData = (metric) => {
    // Use recent historical data if available (from database) and has enough data points
    if (recent?.[metric] && Array.isArray(recent[metric])) {
      const validData = recent[metric].filter(v => v !== null && v !== undefined);
      if (validData.length >= 2) {
        return recent[metric];
      }
    }

    // Fallback to forecast data for metrics that support it
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

  // Calculate pressure trend
  const getPressureTrend = () => {
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

  // Get sunset and sunrise times with primary/secondary designation.
  // Daytime = sunrise to sunset (Sunset primary); night = 12a–sunrise and sunset–12a (Sunrise primary).
  // Resolve the relevant day by calendar date or most recent sunset-in-past.
  const getSunTime = () => {
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

    // Daytime only between sunrise and sunset; otherwise night (12a–sunrise or sunset–12a).
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

  const handleClick = (link, metricType) => {
    if (onMetricClick) {
      onMetricClick(link);
    } else {
      navigate(link);
    }
  };

  // Calculate dew point from temperature (Fahrenheit) and humidity
  const calculateDewPoint = (tempF, humidity) => {
    // Convert Fahrenheit to Celsius for calculation
    const tempC = (tempF - 32) * 5/9;
    // Magnus formula approximation
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
    const dewPointC = (b * alpha) / (a - alpha);
    // Convert back to Fahrenheit
    return Math.round((dewPointC * 9/5) + 32);
  };

  const pressureTrend = getPressureTrend();
  const sunTime = getSunTime();
  const dewPoint = calculateDewPoint(current.temperature.fahrenheit, current.humidity);

  const metrics = [
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
      secondary: (() => {
        const w = current.wind;
        if (!w) return '';
        const dir = w.directionText || '';
        if (w.lull != null && w.gust != null && w.speed != null) {
          return `${Math.round(w.lull)}–${Math.round(w.gust)} mph ${dir}`.trim();
        }
        return `Gusts ${Math.round(w.gust)} mph ${dir}`.trim();
      })(),
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
      customContent: hasManualEntry && manualPrecip.notes ? (
        <div className="manual-precip-note">{manualPrecip.notes}</div>
      ) : null
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

  return (
    <div className="metrics-section">
      <div className="metrics">
        {metrics.map((metric, index) => {
          const isSunTime = metric.type === 'sunrise' || metric.type === 'sunset';
          return (
          <div
            key={index}
            className="metric-card"
            onClick={isSunTime ? undefined : () => handleClick(metric.link, metric.type)}
            data-sun-times={isSunTime ? 'true' : undefined}
            style={{
              animationDelay: `${0.3 + index * 0.05}s`
            }}
          >
            <MetricIcon type={metric.type} size={32} className="metric-icon" />
            <div className="metric-content">
              <div className="metric-label">{metric.label}</div>
              <div className="metric-value">
                {metric.value}
                {metric.unit && <span className="metric-unit">{metric.unit}</span>}
              </div>
              {metric.secondary && (
                <div className="metric-secondary">
                  {metric.secondary}
                </div>
              )}
              {metric.customContent && metric.customContent}
              {(getTrendData(metric.type) || metric.type === 'precipitation') && (
                <div className="metric-trend-row">
                  {getTrendData(metric.type) && (
                    <div className="metric-trend">
                      <Sparkline
                        data={getTrendData(metric.type)}
                        width={120}
                        height={24}
                        color="var(--trendline-stroke)"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default Metrics;
