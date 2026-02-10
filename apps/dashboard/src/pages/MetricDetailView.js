import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import useHistoricalData from '../hooks/useHistoricalData';
import MetricChart from '../components/MetricChart';
import TimeRangeSelector from '../components/TimeRangeSelector';
import MetricIcon from '../components/MetricIcon';
import Modal from '../components/Modal';
import { ReactComponent as EditIcon } from '../components/edit-icon.svg';
import WeatherIcon from '../components/WeatherIcon';
import { getMetricConfig, MB_TO_INHG } from '../utils/chartHelpers';
import './MetricDetailView.css';
import '../components/PrecipitationLogger.css';

/** List (3 lines) icon for History */
const ListIcon = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

/** Caret up (stroke only, for amount/time spinners) */
const CaretUp = ({ size = 10, className }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M2 8 L6 4 L10 8" />
  </svg>
);

/** Caret down (stroke only, for amount/time spinners) */
const CaretDown = ({ size = 10, className }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M2 4 L6 8 L10 4" />
  </svg>
);

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/weather';
const PRECIP_TYPES = [
  { value: 'snow', label: 'Snow' },
  { value: 'rain', label: 'Rain' },
  { value: 'sleet', label: 'Sleet' },
  { value: 'freezing rain', label: 'Freezing Rain' },
  { value: 'hail', label: 'Hail' },
  { value: 'mixed', label: 'Mixed' }
];
/** Map precip type to condition string for WeatherIcon (matches primary screen) */
const PRECIP_TYPE_TO_CONDITION = {
  snow: 'Snow',
  rain: 'Rain',
  sleet: 'Sleet',
  'freezing rain': 'Freezing Rain',
  hail: 'Rain',
  mixed: 'Cloudy'
};
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function getDefaultTimeFromTimestamp(ts) {
  if (!ts) return { hour12: 12, minute: 0, ampm: 'am' };
  const d = new Date(ts * 1000);
  const hour24 = d.getHours();
  const minute = d.getMinutes();
  return { hour12: hour24 % 12 || 12, minute, ampm: hour24 < 12 ? 'am' : 'pm' };
}

/** Parse SQLite datetime (UTC) to local time for display */
const parseSqliteUtc = (val) => {
  if (!val) return null;
  const s = String(val);
  if (/Z$|[-+]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s + 'Z');
};

const METRIC_ORDER = ['temperature', 'pressure', 'humidity', 'wind', 'precipitation', 'solar'];

const MetricDetailView = ({ current, forecast, metricOverride, connectionStatus = 'online', onRetryConnection, onRefresh, isLocal = false }) => {
  const paramsMetric = useParams().metric;
  const metric = metricOverride != null ? metricOverride : paramsMetric;
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state || {};
  const [hours, setHours] = useState(24);
  const [pressureUnit, setPressureUnit] = useState('inHg');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Precipitation: one modal, sub-views chart | add | history
  const [precipView, setPrecipView] = useState(() => navState?.view || 'chart');
  const [precipType, setPrecipType] = useState('');
  const [precipAmount, setPrecipAmount] = useState('');
  const [precipNotes, setPrecipNotes] = useState('');
  const [entryHour, setEntryHour] = useState(12);
  const [entryMinute, setEntryMinute] = useState(0);
  const [entryAmPm, setEntryAmPm] = useState('am');
  const [precipSubmitting, setPrecipSubmitting] = useState(false);
  const [precipHistoryData, setPrecipHistoryData] = useState({ entries: [], total: 0 });
  const [precipHistoryLoading, setPrecipHistoryLoading] = useState(false);

  const safeMetric = metric || '';
  const { data, loading, error, refetch } = useHistoricalData(safeMetric, hours);
  const scrollPositionRef = useRef(0);

  // External (towerhill.app): only show chart for precipitation; hide Graph/Edit/History tabs and add/history content
  const effectivePrecipView = safeMetric === 'precipitation' && !isLocal ? 'chart' : precipView;

  // Stable x-axis: fix chart end time so labels don't redraw when switching metrics
  const [chartEndTime, setChartEndTime] = useState(null);
  useEffect(() => { setChartEndTime(null); }, [hours]);
  useEffect(() => {
    if (data?.data?.length && chartEndTime == null)
      setChartEndTime(data.data[data.data.length - 1].timestamp);
  }, [data, chartEndTime]);

  // Keep last chart data so the chart stays mounted when switching metrics (morph instead of redraw)
  const prevChartRef = useRef({ data: null, metric: null });
  if (data?.data?.length) prevChartRef.current = { data, metric: safeMetric };
  const chartDataToShow = data ?? prevChartRef.current?.data ?? null;
  const chartMetricToShow = data ? safeMetric : (prevChartRef.current?.metric ?? safeMetric);
  const hasChartData = chartDataToShow?.data?.length;

  // Sync precipView from nav state when opening with view=add
  useEffect(() => {
    if (navState?.view && (navState.view === 'add' || navState.view === 'history')) {
      setPrecipView(navState.view);
    }
  }, [navState?.view]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = () => setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Lock scroll when modal is open. Apply to .app so body stays without overflow:hidden,
  // which allows modal backdrop blur (backdrop-filter) to render correctly.
  useEffect(() => {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    scrollPositionRef.current = scrollY;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '';

    const app = document.querySelector('.app');
    if (app) {
      app.style.overflow = 'hidden';
      app.style.position = 'fixed';
      app.style.top = `-${scrollY}px`;
      app.style.left = '0';
      app.style.right = '0';
      app.style.width = '100%';
      app.style.paddingRight = paddingRight;
    }

    return () => {
      if (app) {
        app.style.overflow = '';
        app.style.position = '';
        app.style.top = '';
        app.style.left = '';
        app.style.right = '';
        app.style.width = '';
        app.style.paddingRight = '';
      }
      window.scrollTo(0, scrollPositionRef.current);
    };
  }, []);

  // Browser back button: router handles URL change; no need to navigate (would double-navigate)

  const handleClose = useCallback(() => {
    const from = navState?.from;
    navigate(from === 'list' ? '/conditions' : '/');
  }, [navigate, navState?.from]);

  const handleTimeRangeChange = useCallback((newHours) => {
    setHours(newHours);
  }, []);

  // Precip: set time picker to current when switching to add view
  useEffect(() => {
    if (safeMetric === 'precipitation' && precipView === 'add' && current?.timestamp) {
      const def = getDefaultTimeFromTimestamp(current.timestamp);
      setEntryHour(def.hour12);
      setEntryMinute(def.minute);
      setEntryAmPm(def.ampm);
    }
  }, [safeMetric, precipView, current?.timestamp]);

  const fetchPrecipHistory = useCallback(async () => {
    setPrecipHistoryLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/precipitation/today`);
      if (response?.data?.success) {
        setPrecipHistoryData({ entries: response.data.data ?? [], total: response.data.total ?? 0 });
      }
    } catch (err) {
      console.error('Error fetching precipitation history:', err);
    } finally {
      setPrecipHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (safeMetric === 'precipitation' && precipView === 'history') {
      fetchPrecipHistory();
    }
  }, [safeMetric, precipView, fetchPrecipHistory]);

  const handlePrecipSubmit = useCallback(async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!precipType || !precipAmount) return;
    const parsedAmount = parseFloat(precipAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid positive number for the amount.');
      return;
    }
    const today = new Date();
    let hour24 = entryHour;
    if (entryAmPm === 'pm' && entryHour < 12) hour24 = entryHour + 12;
    if (entryAmPm === 'am' && entryHour === 12) hour24 = 0;
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour24, entryMinute, 0, 0);
    const submitTimestamp = Math.floor(date.getTime() / 1000);
    setPrecipSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/precipitation/manual`, {
        timestamp: submitTimestamp,
        amountInches: parsedAmount,
        precipType: precipType.toLowerCase(),
        notes: precipNotes.trim() || undefined,
        temperature: current?.temperature?.fahrenheit
      });
      setPrecipType('');
      setPrecipAmount('');
      setPrecipNotes('');
      await fetchPrecipHistory();
      refetch();
      setPrecipView('chart');
    } catch (err) {
      console.error('Error submitting precipitation:', err);
      alert('Failed to log precipitation. Please try again.');
    } finally {
      setPrecipSubmitting(false);
    }
  }, [precipType, precipAmount, precipNotes, entryHour, entryMinute, entryAmPm, current?.temperature?.fahrenheit, fetchPrecipHistory, refetch]);

  const handlePrecipDelete = useCallback(async (id) => {
    if (!id) return;
    setPrecipSubmitting(true);
    try {
      await axios.delete(`${API_BASE_URL}/precipitation/manual/${id}`);
      await fetchPrecipHistory();
      refetch();
    } catch (err) {
      console.error('Error deleting precipitation:', err);
    } finally {
      setPrecipSubmitting(false);
    }
  }, [fetchPrecipHistory, refetch]);

  const handlePrecipDeleteAll = useCallback(async () => {
    if (!precipHistoryData.entries.length) return;
    if (!window.confirm('Delete all precipitation entries for today?')) return;
    setPrecipSubmitting(true);
    try {
      for (const entry of precipHistoryData.entries) {
        await axios.delete(`${API_BASE_URL}/precipitation/manual/${entry.id}`);
      }
      await fetchPrecipHistory();
      refetch();
      setPrecipView('chart');
    } catch (err) {
      console.error('Error deleting precipitation:', err);
    } finally {
      setPrecipSubmitting(false);
    }
  }, [precipHistoryData.entries, fetchPrecipHistory, refetch]);

  const formatPrecipTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate secondary text for each metric (matching Metrics component logic)
  const getSecondaryText = useCallback(() => {
    if (!current) return null;
    
    const calculateDewPoint = (tempF, humidity) => {
      const tempC = (tempF - 32) * 5/9;
      const a = 17.27;
      const b = 237.7;
      const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
      const dewPointC = (b * alpha) / (a - alpha);
      return Math.round((dewPointC * 9/5) + 32);
    };

    const getPressureTrend = () => {
      if (!data?.data || data.data.length < 2) return 'stable';
      const values = data.data.map(d => d.value).filter(v => v !== null && v !== undefined);
      if (values.length < 2) return 'stable';
      const diff = values[values.length - 1] - values[0];
      if (diff > 0.5) return 'rising';
      if (diff < -0.5) return 'falling';
      return 'stable';
    };

    switch (safeMetric) {
      case 'temperature': {
        const feels = current.feelsLike?.fahrenheit != null ? Math.round(current.feelsLike.fahrenheit) : null;
        return feels != null ? `Feels like ${feels}°` : null;
      }
      case 'pressure':
        return `${current.pressure.mb.toFixed(1)} mb · ${getPressureTrend()}`;
      case 'humidity':
        return `Dew point ${calculateDewPoint(current.temperature.fahrenheit, current.humidity)}°`;
      case 'wind':
        return `Gusts ${Math.round(current.wind.gust)} mph ${current.wind.directionText}`;
      case 'precipitation':
        const manualPrecip = current.precipitation?.manual;
        if (manualPrecip) {
          const a = Number(manualPrecip.amountInches);
          const inchStr = a >= 1 ? `${a}in` : (a === 0 ? '0in' : `${String(a).replace(/^0/, '')}in`);
          const sinceTime = manualPrecip.updatedAt
            ? parseSqliteUtc(manualPrecip.updatedAt)?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
            : null;
          return sinceTime ? `${manualPrecip.type} (manual)\n${inchStr} since ${sinceTime}` : `${manualPrecip.type} (manual)`;
        }
        return `${current.precipitation.lastHour.toFixed(2)} in last hour`;
      case 'solar':
        return `UV Index ${current.uv || 0}`;
      default:
        return null;
    }
  }, [current, safeMetric, data]);

  // All hooks must be called before any conditional returns
  const config = useMemo(() => getMetricConfig(safeMetric, { pressureUnit }), [safeMetric, pressureUnit]);
  const currentValue = useMemo(() => {
    const arr = data?.data;
    return arr?.length ? arr[arr.length - 1]?.value : undefined;
  }, [data]);

  // Primary display: pressure always in inHg (e.g. 29.95); other metrics as-is
  const currentValueNumber = useMemo(() => {
    if (safeMetric === 'pressure') {
      const inHg = current?.pressure?.inHg;
      if (inHg != null) return parseFloat(Number(inHg).toFixed(2));
      const arr = data?.data;
      const lastMb = arr?.length ? arr[arr.length - 1]?.value : null;
      if (lastMb != null) return parseFloat((lastMb * MB_TO_INHG).toFixed(2));
      return null;
    }
    if (currentValue === null || currentValue === undefined) return null;
    return safeMetric === 'temperature' || safeMetric === 'humidity' || safeMetric === 'wind' || safeMetric === 'solar' || safeMetric === 'uv'
      ? Math.round(currentValue)
      : parseFloat(currentValue.toFixed(2));
  }, [currentValue, safeMetric, current?.pressure?.inHg, data?.data]);

  const secondaryText = useMemo(() => getSecondaryText(), [getSecondaryText]);

  // Early return after all hooks
  if (!metric) {
    return null;
  }

  return (
    <Modal
      isOpen
      onClose={handleClose}
      size="xl"
      ariaLabelledBy="metric-detail-title"
      ariaDescribedBy="metric-detail-description"
      className="metric-detail-container"
    >
      <div className="metric-detail-header">
          <div className="metric-detail-header-inner">
            <div className="metric-detail-left">
              <div className="metric-detail-icon-wrap">
                <MetricIcon type={safeMetric} size={28} className="metric-detail-icon" aria-hidden="true" />
              </div>
              <h1 id="metric-detail-title" className="metric-detail-label">{config.label}</h1>
            </div>
            <div className="metric-detail-divider" aria-hidden="true" />
            <div className="metric-detail-right">
              {currentValueNumber !== null && (
                <div 
                  id="metric-detail-description"
                  className="metric-detail-value-block"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="metric-detail-value-number">{currentValueNumber}</span>
                  {(safeMetric === 'pressure' ? 'inHg' : config.unit) && (
                    <span className="metric-detail-value-unit">{safeMetric === 'pressure' ? 'inHg' : config.unit}</span>
                  )}
                </div>
              )}
              {secondaryText && (
                <div className="metric-detail-secondary">
                  {secondaryText.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < secondaryText.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            className="metric-detail-close"
            onClick={handleClose}
            aria-label="Close detail view"
            type="button"
            autoFocus
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={`metric-detail-content${safeMetric === 'precipitation' && (effectivePrecipView === 'add' || effectivePrecipView === 'history') ? ' metric-detail-content-precip-actions' : ''}`}>
          {loading && !hasChartData && (
            <div className="metric-detail-loading">
              <div className="loading-spinner"></div>
              <p>Loading historical data...</p>
            </div>
          )}

          {error && (
            <div className="metric-detail-error">
              <div className="error-icon">⚠️</div>
              <p>
                {connectionStatus === 'offline'
                  ? 'Connection unavailable. Use the Retry button above to reconnect, or try again below.'
                  : error}
              </p>
              <button
                onClick={() => {
                  refetch();
                  onRetryConnection?.();
                }}
                className="retry-button"
              >
                Retry
              </button>
            </div>
          )}

          {(safeMetric === 'precipitation' || (!error && (data || (loading && prevChartRef.current?.data)))) && (
            <div 
              className="metric-detail-chart-wrapper"
              role="img"
              aria-label={safeMetric === 'precipitation' ? 'Precipitation' : `${config.label} chart showing ${hours <= 24 ? '24 hour' : hours <= 72 ? '3 day' : '7 day'} historical data`}
            >
              <div className="metric-detail-chart-controls">
                {safeMetric === 'precipitation' && isLocal && (
                  <div className="metric-detail-precip-actions">
                    <button
                      type="button"
                      className={`metric-detail-precip-action-btn ${precipView === 'chart' ? 'active' : ''}`}
                      onClick={() => setPrecipView('chart')}
                      aria-pressed={precipView === 'chart'}
                    >
                      Graph
                    </button>
                    <button
                      type="button"
                      className={`metric-detail-precip-action-btn ${precipView === 'add' ? 'active' : ''}`}
                      onClick={() => setPrecipView('add')}
                      aria-pressed={precipView === 'add'}
                      title="Add precipitation"
                    >
                      <EditIcon className="metric-detail-precip-action-icon" aria-hidden />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className={`metric-detail-precip-action-btn ${precipView === 'history' ? 'active' : ''}`}
                      onClick={() => setPrecipView('history')}
                      aria-pressed={precipView === 'history'}
                    >
                      <ListIcon className="metric-detail-precip-action-icon" />
                      <span>History</span>
                    </button>
                  </div>
                )}
                {(safeMetric !== 'precipitation' || effectivePrecipView === 'chart') && (
                  <div className="metric-detail-chart-pill">
                    <TimeRangeSelector
                      selectedHours={hours}
                      onSelect={handleTimeRangeChange}
                      disabled={loading}
                    />
                  </div>
                )}
                {safeMetric === 'pressure' && (
                  <div className="metric-detail-pressure-unit-pill">
                    <button
                      type="button"
                      className={`metric-detail-unit-btn ${pressureUnit === 'inHg' ? 'active' : ''}`}
                      onClick={() => setPressureUnit('inHg')}
                      aria-pressed={pressureUnit === 'inHg'}
                      aria-label="Show pressure in inches of mercury"
                    >
                      inHg
                    </button>
                    <button
                      type="button"
                      className={`metric-detail-unit-btn ${pressureUnit === 'mb' ? 'active' : ''}`}
                      onClick={() => setPressureUnit('mb')}
                      aria-pressed={pressureUnit === 'mb'}
                      aria-label="Show pressure in millibars"
                    >
                      mb
                    </button>
                  </div>
                )}
              </div>

              {safeMetric === 'precipitation' && effectivePrecipView === 'add' && (
                <div className="metric-detail-precip-form">
                  <form className="logger-body" onSubmit={handlePrecipSubmit}>
                    <div className="precip-form-amount-time-row">
                    <div className="form-group">
                      <label htmlFor="precip-detail-amount">Amount (inches):</label>
                      <div className="precip-amount-wrap">
                        <input
                          id="precip-detail-amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="100"
                          value={precipAmount}
                          onChange={(e) => setPrecipAmount(e.target.value)}
                          placeholder="e.g., 1.25"
                          disabled={precipSubmitting}
                          autoFocus
                        />
                        <div className="precip-amount-spinners">
                          <button
                            type="button"
                            className="precip-amount-spinner-btn"
                            onClick={() => {
                              const n = parseFloat(precipAmount) || 0;
                              const step = 0.01;
                              const next = Math.min(100, Math.round((n + step) * 100) / 100);
                              setPrecipAmount(String(next));
                            }}
                            disabled={precipSubmitting}
                            aria-label="Increase amount"
                          >
                            <CaretUp size={10} className="precip-spinner-caret" />
                          </button>
                          <button
                            type="button"
                            className="precip-amount-spinner-btn"
                            onClick={() => {
                              const n = parseFloat(precipAmount) || 0.01;
                              const step = 0.01;
                              const next = Math.max(0.01, Math.round((n - step) * 100) / 100);
                              setPrecipAmount(String(next));
                            }}
                            disabled={precipSubmitting}
                            aria-label="Decrease amount"
                          >
                            <CaretDown size={10} className="precip-spinner-caret" />
                          </button>
                        </div>
                      </div>
                      <small className="help-text">Enter the amount to add to today&apos;s total. For snow, enter snow depth.</small>
                    </div>
                    <div className="form-group">
                      <label>Time (today)</label>
                      <div className="precip-time-picker" role="group" aria-label="Entry time">
                        <div className="precip-time-wrap">
                          <select id="precip-detail-hour" value={entryHour} onChange={(e) => setEntryHour(Number(e.target.value))} disabled={precipSubmitting} aria-label="Hour">
                            {HOURS_12.map((h) => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <div className="precip-time-spinners">
                            <button type="button" className="precip-time-spinner-btn" onClick={() => { const i = HOURS_12.indexOf(entryHour); setEntryHour(HOURS_12[(i + 1) % 12]); }} disabled={precipSubmitting} aria-label="Next hour"><CaretUp size={8} className="precip-spinner-caret precip-spinner-caret--time" /></button>
                            <button type="button" className="precip-time-spinner-btn" onClick={() => { const i = HOURS_12.indexOf(entryHour); setEntryHour(HOURS_12[(i - 1 + 12) % 12]); }} disabled={precipSubmitting} aria-label="Previous hour"><CaretDown size={8} className="precip-spinner-caret precip-spinner-caret--time" /></button>
                          </div>
                        </div>
                        <span className="precip-time-sep" aria-hidden="true">:</span>
                        <div className="precip-time-wrap precip-time-wrap-minute">
                          <select id="precip-detail-minute" value={entryMinute} onChange={(e) => setEntryMinute(Number(e.target.value))} disabled={precipSubmitting} aria-label="Minute">
                            {MINUTES.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                          </select>
                          <div className="precip-time-spinners">
                            <button type="button" className="precip-time-spinner-btn" onClick={() => setEntryMinute((entryMinute + 1) % 60)} disabled={precipSubmitting} aria-label="Next minute"><CaretUp size={8} className="precip-spinner-caret precip-spinner-caret--time" /></button>
                            <button type="button" className="precip-time-spinner-btn" onClick={() => setEntryMinute((entryMinute - 1 + 60) % 60)} disabled={precipSubmitting} aria-label="Previous minute"><CaretDown size={8} className="precip-spinner-caret precip-spinner-caret--time" /></button>
                          </div>
                        </div>
                        <div className="precip-time-wrap">
                          <select id="precip-detail-ampm" value={entryAmPm} onChange={(e) => setEntryAmPm(e.target.value)} disabled={precipSubmitting} aria-label="AM or PM">
                            <option value="am">AM</option>
                            <option value="pm">PM</option>
                          </select>
                          <div className="precip-time-spinners">
                            <button type="button" className="precip-time-spinner-btn" onClick={() => setEntryAmPm(entryAmPm === 'am' ? 'pm' : 'am')} disabled={precipSubmitting} aria-label="Toggle AM/PM"><CaretUp size={8} className="precip-spinner-caret precip-spinner-caret--time" /></button>
                            <button type="button" className="precip-time-spinner-btn" onClick={() => setEntryAmPm(entryAmPm === 'am' ? 'pm' : 'am')} disabled={precipSubmitting} aria-label="Toggle AM/PM"><CaretDown size={8} className="precip-spinner-caret precip-spinner-caret--time" /></button>
                          </div>
                        </div>
                      </div>
                      <small className="help-text">Defaults to current time; change to log for a different time today.</small>
                    </div>
                    </div>
                    <div className="form-group">
                      <label>Precipitation Type:</label>
                      <div className="precip-type-options">
                        {PRECIP_TYPES.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            className={`precip-type-option ${precipType === type.value ? 'selected' : ''}`}
                            onClick={() => setPrecipType(type.value)}
                            disabled={precipSubmitting}
                          >
                            <span className="precip-type-option-icon" aria-hidden>
                              <WeatherIcon condition={PRECIP_TYPE_TO_CONDITION[type.value]} size={22} isNight={false} />
                            </span>
                            <span className="precip-type-option-label">{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group precip-form-notes-group">
                      <label htmlFor="precip-detail-notes">Notes (optional):</label>
                      <textarea
                        id="precip-detail-notes"
                        value={precipNotes}
                        onChange={(e) => setPrecipNotes(e.target.value)}
                        placeholder="e.g., Heavy wet snow, started at 2pm"
                        disabled={precipSubmitting}
                        rows={3}
                      />
                    </div>
                  </form>
                </div>
              )}

              {safeMetric === 'precipitation' && effectivePrecipView === 'history' && (
                <div className="metric-detail-precip-history">
                  <div className="logger-body">
                    {precipHistoryLoading ? (
                      <div className="history-loading">Loading...</div>
                    ) : precipHistoryData.entries.length === 0 ? (
                      <div className="history-empty">No entries for today</div>
                    ) : (
                      <>
                        <div className="history-total">
                          <span className="total-label">Today&apos;s Total:</span>
                          <span className="total-value">{precipHistoryData.total.toFixed(2)} in</span>
                        </div>
                        <div className="history-list">
                          {precipHistoryData.entries.map((entry) => (
                            <div key={entry.id} className="history-entry">
                              <div className="entry-info">
                                <div className="entry-main">
                                  <span className="entry-type">{entry.precip_type}</span>
                                  <span className="entry-amount">{entry.amount_inches.toFixed(2)} in</span>
                                </div>
                                <div className="entry-time">{formatPrecipTime(entry.timestamp)}</div>
                                {entry.notes && <div className="entry-notes">{entry.notes}</div>}
                              </div>
                              <button type="button" className="entry-delete" onClick={() => handlePrecipDelete(entry.id)} disabled={precipSubmitting} title="Delete entry">×</button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Precip actions footer: fixed at bottom of modal */}
              {safeMetric === 'precipitation' && (effectivePrecipView === 'add' || effectivePrecipView === 'history') && (
                <div className="metric-detail-precip-footer">
                  <div className="logger-actions">
                    {precipView === 'add' && (
                      <button type="button" className="submit-btn" onClick={handlePrecipSubmit} disabled={!precipType || !precipAmount || precipSubmitting}>
                        {precipSubmitting ? 'Adding...' : 'Add to Total'}
                      </button>
                    )}
                    {precipView === 'history' && (
                      <>
                        <button type="button" className="submit-btn" onClick={() => setPrecipView('add')}>Add Entry</button>
                        {precipHistoryData.entries.length > 0 && (
                          <button type="button" className="delete-all-btn" onClick={handlePrecipDeleteAll} disabled={precipSubmitting}>Delete All</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {(safeMetric !== 'precipitation' || effectivePrecipView === 'chart') && hasChartData && (
              <>
              <div
                className="metric-detail-chart-area"
                onMouseLeave={() => !isMobile && setHoveredPoint(null)}
              >
                <div className="metric-detail-chart-scroll">
                  <div className="metric-detail-chart-scroll-inner">
                    <MetricChart
                      data={chartMetricToShow === 'pressure' && pressureUnit === 'inHg'
                        ? (chartDataToShow.data || []).map(d => ({ ...d, value: d.value * MB_TO_INHG }))
                        : (chartDataToShow.data || [])}
                      metric={chartMetricToShow}
                      hours={hours}
                      manualEntries={chartDataToShow.manualEntries || []}
                      pressureUnit={chartMetricToShow === 'pressure' ? pressureUnit : undefined}
                      onHoverChange={setHoveredPoint}
                      useClickTooltip={isMobile}
                      activePoint={isMobile && hoveredPoint?.timestamp != null && hoveredPoint?.value != null
                        ? { timestamp: hoveredPoint.timestamp, value: hoveredPoint.value }
                        : null}
                      stableTimeEnd={chartEndTime ?? undefined}
                    />
                  </div>
                </div>
              </div>

              <div className="metric-detail-chart-footer">
                <nav
                  className="metric-detail-pagination"
                  aria-label="Navigate between metrics"
                >
                  {METRIC_ORDER.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`metric-detail-pagination-btn ${m === safeMetric ? 'active' : ''}`}
                      onClick={() => navigate(`/conditions/${m}`, { state: navState })}
                      aria-label={`View ${getMetricConfig(m).label}`}
                      aria-current={m === safeMetric ? 'true' : undefined}
                    >
                      <MetricIcon type={m} size={20} />
                    </button>
                  ))}
                </nav>
                <div className="metric-detail-chart-hover-badge" aria-live="polite">
                  {hoveredPoint ? (
                    <div className="metric-detail-chart-hover-badge__value">
                      <span className="chart-hover-time">{hoveredPoint.formattedTime}</span>
                      <span className="chart-hover-value">
                        {hoveredPoint.formattedValueNumber}
                        {hoveredPoint.formattedValueUnit && (
                          <span className="chart-hover-value-unit">{hoveredPoint.formattedValueUnit}</span>
                        )}
                      </span>
                      {hoveredPoint.manualEntry && (
                        <span className="chart-hover-manual">
                          Manual: {hoveredPoint.manualEntry.amountInches.toFixed(2)} in ({hoveredPoint.manualEntry.type})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="metric-detail-chart-hover-badge__placeholder">
                      {isMobile ? 'Tap chart for hourly details' : 'Hover chart for hourly details'}
                    </span>
                  )}
                </div>
              </div>
              </>
              )}

            </div>
          )}

          {!loading && !error && data && data.data.length === 0 && (
            <div className="metric-detail-empty">
              <p>No data available for this time range</p>
            </div>
          )}
        </div>
    </Modal>
  );
};

export default MetricDetailView;
