/**
 * E-ink page for the Inky Impression 7.3 (800x480, 6-colour Spectra panel).
 * Rendered headless, screenshotted, and pushed to the panel on a timer.
 *
 *   /eink                        landscape 800x480
 *   /eink?orientation=portrait   portrait 480x800 (rotated to 800x480 before display)
 *   /eink?theme=light|dark       force a theme (default: dark from sunset to sunrise)
 *
 * Sets body[data-eink-ready="1"] once data has rendered so the capture script can wait for it.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import WeatherIcon from '../components/WeatherIcon';
import MetricIcon from '../components/MetricIcon';
import { buildMetrics, getTrendData } from '../utils/metricsData';
import './EinkPage.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/weather';

const LAYOUTS = {
  landscape: { width: 800, height: 480, hours: 6, days: 0, sparkWidth: 120 },
  portrait: { width: 480, height: 800, hours: 6, days: 6, sparkWidth: 100 },
};

const formatHour = (unix) =>
  new Date(unix * 1000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', '');

const isNightAt = (date, daily) => {
  const day = daily?.find((d) => new Date(d.date * 1000).toDateString() === date.toDateString());
  if (!day?.sunrise || !day?.sunset) return false;
  return date < new Date(day.sunrise * 1000) || date > new Date(day.sunset * 1000);
};

const resolveTheme = (param, daily) => {
  if (param === 'light' || param === 'dark') return param;
  const now = new Date();
  const hasSunTimes = daily?.some((d) => d.sunrise && d.sunset && new Date(d.date * 1000).toDateString() === now.toDateString());
  const night = hasSunTimes ? isNightAt(now, daily) : now.getHours() >= 18 || now.getHours() < 6;
  return night ? 'dark' : 'light';
};

function HourlyStrip({ hourly, daily, count, width }) {
  const hours = hourly.slice(0, count);
  const temps = hours.map((h) => Math.round(h.temperature.fahrenheit));
  const min = Math.min(...temps);
  const range = Math.max(...temps) - min;
  const colWidth = width / hours.length;

  const lineTop = 6;
  const lineRange = 28;
  const labelHeight = 30;
  const bandHeight = lineTop + lineRange + labelHeight;
  const yFor = (t) => lineTop + (range > 0 ? (1 - (t - min) / range) : 0.5) * lineRange;
  const points = temps.map((t, i) => `${colWidth * i + colWidth / 2},${yFor(t)}`);
  const path = `M 0,${yFor(temps[0])} L ${points.join(' L ')} L ${width},${yFor(temps[temps.length - 1])}`;

  return (
    <div className="eink-hourly" style={{ width }}>
      <div className="eink-hourly-cols">
        {hours.map((h) => {
          const time = new Date(h.time * 1000);
          return (
            <div key={h.time} className="eink-hourly-col" style={{ width: colWidth }}>
              <div className="eink-hourly-time">{formatHour(h.time)}</div>
              <WeatherIcon condition={h.conditions || 'Clear'} size={28} isNight={isNightAt(time, daily)} />
            </div>
          );
        })}
      </div>
      <div className="eink-hourly-band" style={{ height: bandHeight }}>
        <svg width={width} height={bandHeight} className="eink-hourly-line">
          <path d={path} fill="none" stroke="var(--eink-accent)" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        {hours.map((h, i) => (
          <div
            key={h.time}
            className="eink-hourly-temp"
            style={{ left: colWidth * i, width: colWidth, top: yFor(temps[i]) + 6 }}
          >
            {temps[i]}°
            {h.precipProbability > 20 && <span className="eink-hourly-precip">{h.precipProbability}%</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Unscaled polyline: the dashboard Sparkline shrinks its stroke via viewBox padding, which dithers away on e-ink. */
function EinkSparkline({ data, width, height, buckets = 40 }) {
  const valid = data.filter((v) => v !== null && v !== undefined);
  if (valid.length < 2) return null;
  const size = Math.max(1, Math.ceil(valid.length / buckets));
  const values = [];
  for (let i = 0; i < valid.length; i += size) {
    const chunk = valid.slice(i, i + size);
    values.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
  }
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const pad = 2;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(pad + (1 - (v - min) / range) * (height - pad * 2)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke="var(--eink-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MetricCell({ metric, trend, sparkWidth, compact }) {
  const label = compact && metric.type === 'solar' ? 'Solar' : metric.label;
  return (
    <div className="eink-metric">
      <div className="eink-metric-label">
        <MetricIcon type={metric.type} size={22} />
        <span>{label}</span>
      </div>
      <div className="eink-metric-value">
        {metric.value}
        {metric.unit && <span className="eink-metric-unit">{metric.unit}</span>}
      </div>
      <div className="eink-metric-secondary">{metric.secondary}</div>
      {trend && (
        <div className="eink-metric-trend">
          <EinkSparkline data={trend} width={sparkWidth} height={20} />
        </div>
      )}
    </div>
  );
}

function DailyList({ daily, count }) {
  return (
    <div className="eink-daily">
      {daily.slice(0, count).map((day, i) => (
        <div key={day.date} className="eink-daily-row">
          <span className="eink-daily-name">
            {i === 0 ? 'Today' : new Date(day.date * 1000).toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
          <WeatherIcon condition={day.conditions || 'Clear'} size={24} />
          <span className="eink-daily-condition">
            {day.conditions || 'Clear'}
            {day.precipProbability > 20 && <span className="eink-daily-precip"> {day.precipProbability}%</span>}
          </span>
          <span className="eink-daily-temps">
            {Math.round(day.temperature.high.fahrenheit)}° <span className="eink-sep">/</span> {Math.round(day.temperature.low.fahrenheit)}°
          </span>
        </div>
      ))}
    </div>
  );
}

export default function EinkPage() {
  const params = new URLSearchParams(window.location.search);
  const orientation = params.get('orientation') === 'portrait' ? 'portrait' : 'landscape';
  const layout = LAYOUTS[orientation];

  const [data, setData] = useState(null);
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.body.classList.add('eink-body');
    Promise.all([
      axios.get(`${API_BASE_URL}/complete`, { timeout: 15000 }),
      axios.get(`${API_BASE_URL}/recent?hours=24`, { timeout: 15000 }).catch(() => null),
    ])
      .then(([complete, recentRes]) => {
        if (!complete.data?.success) throw new Error('API returned no data');
        setData(complete.data.data);
        if (recentRes?.data?.success) setRecent(recentRes.data.data);
      })
      .catch((e) => setError(e.message || 'Unable to fetch weather data'));
  }, []);

  useEffect(() => {
    if (data || error) document.body.dataset.einkReady = '1';
  }, [data, error]);

  const frameStyle = { width: layout.width, height: layout.height };
  const theme = resolveTheme(params.get('theme'), data?.forecast?.daily);

  if (error || !data?.current) {
    return (
      <div className={`eink eink--${orientation} eink--${theme} eink--error`} style={frameStyle}>
        <div className="eink-error-title">Tower Hill</div>
        <div className="eink-error-message">{error || 'Loading…'}</div>
        <div className="eink-updated">{new Date().toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}</div>
      </div>
    );
  }

  const { current, forecast } = data;
  const temp = Math.round(current.temperature.fahrenheit);
  const conditions = forecast?.current?.conditions || current.conditions || 'Clear';
  const dailyHigh = forecast?.daily?.[0]?.temperature?.high?.fahrenheit;
  const dailyLow = forecast?.daily?.[0]?.temperature?.low?.fahrenheit;
  const high = dailyHigh != null ? Math.max(temp, Math.round(dailyHigh)) : temp;
  const low = dailyLow != null ? Math.min(temp, Math.round(dailyLow)) : temp;
  const feelsLike = Math.round(current.feelsLike.fahrenheit);
  const alerts = data.alerts || [];
  const metrics = buildMetrics(current, forecast, recent);
  const updated = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const contentWidth = layout.width - 40;
  const hourlyWidth = orientation === 'landscape' ? contentWidth - 236 : contentWidth;

  return (
    <div className={`eink eink--${orientation} eink--${theme}`} style={frameStyle}>
      <header className="eink-header">
        <div className="eink-title">
          Tower Hill <span className="eink-city">Wayland</span>
        </div>
        <div className="eink-updated">Updated {updated}</div>
      </header>

      <section className="eink-top">
        <div className="eink-now">
          <div className="eink-temp">{temp}°</div>
          <div className="eink-now-meta">
            <div className="eink-conditions">{conditions}</div>
            <div className="eink-hilo">
              {high}° <span className="eink-sep">/</span> {low}°
            </div>
            {Math.abs(temp - feelsLike) > 3 && <div className="eink-feels">Feels like {feelsLike}°</div>}
            {alerts.length > 0 && (
              <div className="eink-alert">
                {alerts[0].event}
                {alerts.length > 1 ? ` +${alerts.length - 1}` : ''}
              </div>
            )}
          </div>
        </div>
        {forecast?.hourly?.length > 0 && (
          <HourlyStrip hourly={forecast.hourly} daily={forecast.daily} count={layout.hours} width={hourlyWidth} />
        )}
      </section>

      <section className="eink-metrics">
        {metrics.map((m) => (
          <MetricCell
            key={m.type}
            metric={m}
            trend={getTrendData(m.type, recent, forecast)}
            sparkWidth={layout.sparkWidth}
            compact={orientation === 'portrait'}
          />
        ))}
      </section>

      {layout.days > 0 && forecast?.daily?.length > 0 && (
        <section className="eink-forecast">
          <DailyList daily={forecast.daily} count={layout.days} />
        </section>
      )}
    </div>
  );
}
