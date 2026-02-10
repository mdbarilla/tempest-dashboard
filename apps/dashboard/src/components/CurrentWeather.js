import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import WeatherIcon from './WeatherIcon';
import ConditionCorrector from './ConditionCorrector';
import { ReactComponent as SparkIcon } from './spark-icon.svg';
import { ReactComponent as ThumbUpIcon } from './thumb-up-icon.svg';
import { ReactComponent as ThumbDownIcon } from './thumb-down-icon.svg';
import StormWarningDetail from './StormWarningDetail';
import ViewToggle from './ViewToggle';
import AtmosphereFeedbackModal from './AtmosphereFeedbackModal';
import AskModal from './AskModal';
import './StormWarning.css';
import './CurrentWeather.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/weather';

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

/** Max age in hours for the LLM line; if atmosphere.generatedAt is older, we hide it. */
const LLM_MAX_AGE_HOURS = 2;

const MODAL_STORAGE_KEYS = {
  stormDetail: 'tempest-storm-detail-open',
  feedback: 'tempest-feedback-modal-open',
  ask: 'tempest-ask-modal-open',
};

function getStoredModalOpen(key) {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setStoredModalOpen(key, open) {
  try {
    if (open) sessionStorage.setItem(key, '1');
    else sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const CurrentWeather = ({ current, forecast, lastUpdate, alerts = [], atmosphere, isLocal, onRefreshAtmosphere }) => {
  const hourlyScrollRef = useRef(null);
  const [stormDetailOpen, setStormDetailOpenState] = useState(() => getStoredModalOpen(MODAL_STORAGE_KEYS.stormDetail));
  /** 'up'|'down'|null: which vote was sent; null = not voted yet */
  const [feedbackLabel, setFeedbackLabel] = useState(null);
  /** When user chose down: generatedAt we hid (or -1 if missing), to detect when new atmosphere arrives */
  const [downVotedAt, setDownVotedAt] = useState(null);
  const [refreshingAfterDown, setRefreshingAfterDown] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpenState] = useState(() => getStoredModalOpen(MODAL_STORAGE_KEYS.feedback));
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [askModalOpen, setAskModalOpenState] = useState(() => getStoredModalOpen(MODAL_STORAGE_KEYS.ask));

  const setStormDetailOpen = (v) => {
    setStormDetailOpenState(v);
    setStoredModalOpen(MODAL_STORAGE_KEYS.stormDetail, v);
  };
  const setFeedbackModalOpen = (v) => {
    setFeedbackModalOpenState(v);
    setStoredModalOpen(MODAL_STORAGE_KEYS.feedback, v);
  };
  const setAskModalOpen = (v) => {
    setAskModalOpenState(v);
    setStoredModalOpen(MODAL_STORAGE_KEYS.ask, v);
  };

  // When new atmosphere arrives (different generatedAt), clear down state so the new description shows with thumbs
  useEffect(() => {
    if (feedbackLabel !== 'down' || downVotedAt == null) return;
    const currentId = atmosphere?.generatedAt ?? -2;
    if (currentId !== downVotedAt) {
      setDownVotedAt(null);
      setFeedbackLabel(null);
      setRefreshingAfterDown(false);
    }
  }, [atmosphere?.generatedAt, downVotedAt, feedbackLabel]);

  // After thumbs down we show "Fetching…"; stop after 12s if refresh didn't return new data
  useEffect(() => {
    if (!refreshingAfterDown) return;
    const t = setTimeout(() => setRefreshingAfterDown(false), 12000);
    return () => clearTimeout(t);
  }, [refreshingAfterDown]);

  // Restore thumbs state from sessionStorage after reload (e.g. from condition corrector).
  // Keeps "✓ Thanks" or "Hidden…" so the same phrase can't be voted twice.
  useEffect(() => {
    if (atmosphere?.generatedAt == null || feedbackLabel != null) return;
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('atmosphere_feedback') : null;
      const obj = raw ? JSON.parse(raw) : null;
      if (obj && obj.generatedAt === atmosphere.generatedAt && (obj.label === 'up' || obj.label === 'down')) {
        setFeedbackLabel(obj.label);
        if (obj.label === 'down') {
          setDownVotedAt(atmosphere.generatedAt);
          setRefreshingAfterDown(false);
        }
      }
    } catch (_) { /* ignore */ }
  }, [atmosphere?.generatedAt, feedbackLabel]);

  // Hide LLM line when generatedAt is older than LLM_MAX_AGE_HOURS (avoids "cold and clear at night" at 10 AM from stale/cached run)
  const generatedAt = atmosphere?.generatedAt;
  const isStale = typeof generatedAt === 'number' && (Date.now() / 1000 - generatedAt) > LLM_MAX_AGE_HOURS * 3600;
  // Hide condition summary when LLM is disabled or not ready (no "Conditions summary loading" or "Condition summary unavailable")
  const isPlaceholderDescription = !atmosphere?.description ||
    atmosphere.description === 'Initializing art engine...' ||
    atmosphere.description === 'Condition summary unavailable.' ||
    (typeof atmosphere.description === 'string' && atmosphere.description.startsWith('Conditions summary loading'));

  // Early return check after hooks
  if (!current) return null;

  // Derive isCorrected directly from forecast data - no local state needed
  const isCorrected = forecast?.current?.corrected || false;

  const temp = Math.round(current.temperature.fahrenheit);
  const feelsLike = Math.round(current.feelsLike.fahrenheit);
  const conditions = forecast?.current?.conditions || 'Clear';
  const originalCondition = forecast?.current?.originalCondition;
  const correctionId = forecast?.current?.correctionId;

  // Calculate if it's currently nighttime based on sunset/sunrise
  const isCurrentlyNight = () => {
    if (!forecast?.daily?.[0]) return false;
    const now = new Date();
    const sunrise = forecast.daily[0].sunrise ? new Date(forecast.daily[0].sunrise * 1000) : null;
    const sunset = forecast.daily[0].sunset ? new Date(forecast.daily[0].sunset * 1000) : null;
    if (!sunrise || !sunset) return false;
    return now < sunrise || now > sunset;
  };

  // Check if a specific hour is nighttime
  const isHourNight = (hourTimestamp) => {
    if (!forecast?.daily) return false;
    const hourDate = new Date(hourTimestamp * 1000);
    const hourDay = hourDate.toDateString();

    // Find the matching day in the forecast
    const matchingDay = forecast.daily.find(day => {
      const dayDate = new Date(day.date * 1000);
      return dayDate.toDateString() === hourDay;
    });

    if (!matchingDay) return false;

    const sunrise = matchingDay.sunrise ? new Date(matchingDay.sunrise * 1000) : null;
    const sunset = matchingDay.sunset ? new Date(matchingDay.sunset * 1000) : null;
    if (!sunrise || !sunset) return false;
    return hourDate < sunrise || hourDate > sunset;
  };

  // Calculate actual high/low for today
  // Use daily forecast high/low but adjust if current temp exceeds them
  const calculateTodayHighLow = () => {
    const dailyHigh = forecast?.daily?.[0]?.temperature?.high?.fahrenheit;
    const dailyLow = forecast?.daily?.[0]?.temperature?.low?.fahrenheit;

    if (!dailyHigh || !dailyLow) return { high: temp, low: temp };

    // If current temp is higher than forecast high, use current
    // If current temp is lower than forecast low, use current
    const high = Math.max(temp, dailyHigh);
    const low = Math.min(temp, dailyLow);

    return { high, low };
  };

  const { high: todayHigh, low: todayLow } = calculateTodayHighLow();

  const isNight = isCurrentlyNight();

  const handleCorrection = async (reportedCondition, precipPct = null) => {
    try {
      await axios.post(`${API_BASE_URL}/correction`, {
        timestamp: current.timestamp,
        reportedCondition,
        originalCondition: originalCondition || conditions,
        temperature: current.temperature.fahrenheit,
        precip_pct_at_correction: precipPct != null ? Number(precipPct) : null
      });

      // Refresh the page to get updated conditions
      window.location.reload();
    } catch (error) {
      console.error('Error submitting correction:', error);
      throw error;
    }
  };

  const handleCancelCorrection = async () => {
    if (!correctionId) return;

    try {
      await axios.delete(`${API_BASE_URL}/correction/${correctionId}?obs_timestamp=${current.timestamp}`);
      window.location.reload();
    } catch (error) {
      console.error('Error canceling correction:', error);
      alert('Failed to cancel correction. Please try again.');
    }
  };

  const buildFeedbackPayload = () => {
    if (!atmosphere?.description) return {};
    const nwsAlerts = (alerts || []).map(a => ({
      event: a.event || null,
      headline: (a.headline || '').slice(0, 200) || null
    })).filter(a => a.event != null || a.headline != null);
    return {
      description: atmosphere.description,
      condition: atmosphere.condition ?? null,
      generatedAt: atmosphere.generatedAt ?? null,
      tempF: current?.temperature?.fahrenheit ?? null,
      humidity: current?.humidity ?? null,
      nwsAlerts: nwsAlerts.length ? nwsAlerts : null,
      conditionCorrected: forecast?.current?.conditions ?? null,
      conditionOriginal: forecast?.current?.originalCondition ?? forecast?.current?.conditions ?? null,
      windSpeed: current?.wind?.speed != null ? Number(current.wind.speed) : null,
      windGust: current?.wind?.gust != null ? Number(current.wind.gust) : null,
      windDirection: (current?.wind?.directionText || current?.wind?.direction) ?? null,
      precipToday: current?.precipitation?.today != null ? Number(current.precipitation.today) : null,
      precipLastHour: current?.precipitation?.lastHour != null ? Number(current.precipitation.lastHour) : null,
      precipManualInches: current?.precipitation?.manual?.amountInches != null ? Number(current.precipitation.manual.amountInches) : null,
      precipManualType: current?.precipitation?.manual?.type ?? null,
      solarRadiation: current?.solarRadiation != null ? Number(current.solarRadiation) : null,
      uv: current?.uv != null ? Number(current.uv) : null
    };
  };

  const handleThumbsUp = async () => {
    if (feedbackLabel != null || !atmosphere?.description) return;
    try {
      await axios.post(`${API_BASE_URL}/atmosphere/feedback`, { ...buildFeedbackPayload(), label: 'up' });
      setFeedbackLabel('up');
      try {
        sessionStorage.setItem('atmosphere_feedback', JSON.stringify({ generatedAt: atmosphere.generatedAt, label: 'up' }));
      } catch (_) { /* ignore */ }
    } catch (e) {
      console.error('Atmosphere feedback failed', e);
    }
  };

  const handleThumbsDown = () => {
    if (feedbackLabel != null || !atmosphere?.description) return;
    setFeedbackModalOpen(true);
  };

  const handleFeedbackModalSubmit = async (payload) => {
    try {
      setFeedbackSubmitting(true);
      await axios.post(`${API_BASE_URL}/atmosphere/feedback`, payload);
      setFeedbackLabel('down');
      try {
        sessionStorage.setItem('atmosphere_feedback', JSON.stringify({ generatedAt: atmosphere.generatedAt, label: 'down' }));
      } catch (_) { /* ignore */ }
      setDownVotedAt(atmosphere.generatedAt ?? -1);
      setRefreshingAfterDown(true);
      onRefreshAtmosphere?.();
      setFeedbackModalOpen(false);
    } catch (e) {
      console.error('Atmosphere feedback failed', e);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Screen width for responsive calculations
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;

  return (
    <div className="current-weather">
      {/* Header stays full-width */}
      <div className="weather-header">
        <div className="location-info">
          <h1>Tower Hill&nbsp;&nbsp;<span className="location-city">Wayland</span></h1>
          {lastUpdate && (
            <div className="weather-header-row">
              <span className="last-update">
                Updated {lastUpdate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              <ViewToggle />
            </div>
          )}
        </div>
        <WeatherIcon condition={conditions} size={56} className="weather-icon" isNight={isNight} />
      </div>

      {/* Temperature + Hourly Carousel layout */}
      <div className="current-weather-layout">
        <div className="weather-content-row">
          {/* Temperature display - starts beside metadata, stays that way; large temp links to detail modal */}
          <div className="temperature-display">
            <Link to="/conditions/temperature" className="temperature temperature-link" aria-label="View temperature details">
              {temp}°
            </Link>
            <div className="metadata-container">
              <div className="conditions-container">
                <div className="conditions">{conditions}</div>
                {isLocal && (
                  <div className="condition-actions">
                    <ConditionCorrector
                      currentCondition={conditions}
                      temperature={current.temperature.fahrenheit}
                      timestamp={current.timestamp}
                      currentPrecipPct={forecast?.hourly?.[0]?.precipProbability ?? null}
                      onCorrect={handleCorrection}
                      onCancel={handleCancelCorrection}
                      isCorrected={isCorrected}
                    />
                    <div className="condition-corrector-wrapper">
                      <button
                        type="button"
                        className="condition-btn condition-ask-btn"
                        onClick={(e) => { e.stopPropagation(); setAskModalOpen(true); }}
                        title="Ask about weather"
                        aria-label="Ask about weather"
                      >
                        <SparkIcon className="condition-ask-icon" aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
                {alerts.length > 0 && (
                  <button
                    type="button"
                    className="storm-warning-label storm-warning-label--inline"
                    onClick={() => setStormDetailOpen(true)}
                    title="View alerts"
                    aria-label={alerts.length > 1 ? `${alerts[0].event} and ${alerts.length - 1} more. Tap to view details.` : `${alerts[0].event}. Tap to view details.`}
                  >
                    {alerts.length > 1
                      ? `${alerts[0].event} +${alerts.length - 1} more`
                      : truncate(alerts[0].event, 24)}
                  </button>
                )}
              </div>
              <div className="temp-row">
                <div className="high-low">
                  <span className="temp-high-display">{Math.round(todayHigh)}°</span>
                  <span className="temp-separator"> / </span>
                  <span className="temp-low-display">{Math.round(todayLow)}°</span>
                </div>
                {Math.abs(temp - feelsLike) > 3 && (
                  <div className="feels-like">Feels like {feelsLike}°</div>
                )}
              </div>
              {isLocal && atmosphere?.description && !isStale && !isPlaceholderDescription && (
                feedbackLabel === 'down' ? (
                  <div className="atmospheric-description-row atmosphere-down-message" aria-live="polite">
                    {refreshingAfterDown
                      ? 'Hidden. Fetching a new description…'
                      : "Hidden — we'll use your feedback to improve."}
                  </div>
                ) : feedbackLabel === 'up' ? (
                  <div className="atmospheric-description-row">
                    <span className="atmospheric-description" title="Condition summary from station and NWS data">
                      {atmosphere.description}
                    </span>
                    <span className="feedback-dismissed feedback-dismissed--up" aria-label="Thanks">✓ Thanks</span>
                  </div>
                ) : (
                  <div className="atmospheric-description-row">
                    <span className="atmospheric-description" title="Condition summary from station and NWS data">
                      {atmosphere.description}
                    </span>
                    <span className="atmosphere-feedback" role="group" aria-label="Rate this description">
                      <button type="button" className="feedback-btn feedback-btn--up" aria-label="Good" onClick={handleThumbsUp}><ThumbUpIcon className="feedback-btn-icon" /></button>
                      <button type="button" className="feedback-btn feedback-btn--down" aria-label="Poor" onClick={handleThumbsDown}><ThumbDownIcon className="feedback-btn-icon" /></button>
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Mobile: pill alert button above carousel (hidden on tablet/desktop) */}
          {alerts.length > 0 && (
            <button
              type="button"
              className="storm-warning-label storm-warning-label--block"
              onClick={() => setStormDetailOpen(true)}
              title="View alerts"
              aria-label={alerts.length > 1 ? `${alerts[0].event} and ${alerts.length - 1} more. Tap to view details.` : `${alerts[0].event}. Tap to view details.`}
            >
              {alerts.length > 1
                ? `${alerts[0].event} +${alerts.length - 1} more`
                : truncate(alerts[0].event, 24)}
            </button>
          )}

        {/* Hourly preview - scrollable */}
        {forecast?.hourly && (() => {
        const hourlyData = forecast.hourly.slice(0, 24);

        const temps = hourlyData.map(h => Math.round(h.temperature.fahrenheit));
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);
        const tempRange = maxTemp - minTemp;

        // Dynamic vertical range based on actual temperature variation
        // More range = more vertical space for better visualization
        const maxVerticalRange = tempRange > 20 ? 60 : tempRange > 10 ? 50 : tempRange > 5 ? 40 : 30;

        // Calculate points for SVG path (trendline) - responsive values
        let itemWidth, gapWidth, iconSize;

        // Gap values MUST match CSS exactly for trendline alignment
        // CSS gaps: mobile 1rem (16px), tablet 1.5rem (24px), desktop 1.75rem (28px), large 2rem (32px)
        let svgBottomOffset;
        if (screenWidth >= 1440) {
          itemWidth = 90;   // extra large desktop
          gapWidth = 32;    // 2rem gap (match CSS)
          iconSize = 36;
          svgBottomOffset = 42;
        } else if (screenWidth >= 1280) {
          itemWidth = 80;   // large desktop
          gapWidth = 28;    // 1.75rem gap (match CSS)
          iconSize = 36;
          svgBottomOffset = 42;
        } else if (screenWidth >= 1024) {
          itemWidth = 85;   // medium desktop
          gapWidth = 26;    // ~1.625rem gap
          iconSize = 34;
          svgBottomOffset = 42;
        } else if (screenWidth >= 768) {
          itemWidth = 72;   // tablet
          gapWidth = 24;    // 1.5rem gap (match CSS)
          iconSize = 32;
          svgBottomOffset = 42;
        } else if (screenWidth >= 481) {
          itemWidth = 72;   // default mobile (481-767px) - matches CSS min-width
          gapWidth = 20;    // 1.25rem gap (match CSS)
          iconSize = 28;
          svgBottomOffset = 36;
        } else {
          itemWidth = 72;   // small mobile (<=480px) - match CSS min-width so trendline aligns
          gapWidth = 20;    // match 481-767 for consistency
          iconSize = 28;
          svgBottomOffset = 34;
        }

        // Trendline SVG - positioned with temperature values
        // Icons are now fixed above, temps move with trendline
        const iconSpace = iconSize + 16; // Icon height plus margins (0.5rem top + 0.5rem bottom)
        const tempHeight = maxVerticalRange + 35; // Height of temp positioning container
        const svgHeight = iconSpace + tempHeight; // Total SVG height

        const baseOffset = 28;
        const points = hourlyData.map((hour, index) => {
          const hourTemp = Math.round(hour.temperature.fahrenheit);
          const normalizedTemp = tempRange > 0 ? (hourTemp - minTemp) / tempRange : 0.5;
          const verticalOffset = baseOffset + (maxVerticalRange * normalizedTemp);
          const x = (index * (itemWidth + gapWidth)) + (itemWidth / 2); // Center of each item; aligned with layout
          // Y position: higher temp = lower Y (higher on screen)
          // Use paddingTop positioning: maxVerticalRange - verticalOffset + baseOffset
          const y = iconSpace + (maxVerticalRange - verticalOffset + baseOffset);
          return { x, y };
        });

        // Create SVG path extending edge to edge
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];

        // Extend path to edges: start at x=0, go through all points, end at full width
        const fullWidth = (hourlyData.length - 1) * (itemWidth + gapWidth) + itemWidth;
        // Add extra width on mobile and tablet to extend to right edge (account for right padding)
        const rightPadding = screenWidth < 1024 ? (screenWidth >= 768 ? 48 : 28) : 0; // tablet: 3rem = 48px, mobile: 1.75rem = 28px
        const pathData = `M 0 ${firstPoint.y} L ${points.map(p => `${p.x} ${p.y}`).join(' L ')} L ${fullWidth + rightPadding} ${lastPoint.y}`;

        const svgWidth = fullWidth + rightPadding;

        return (
          <div className="hourly-preview-section">
            <div className="hourly-preview-container">
              <div className="hourly-preview" ref={hourlyScrollRef}>
                <div style={{ position: 'relative', display: 'inline-flex', gap: `${gapWidth}px`, alignItems: 'flex-end', overflow: 'visible' }}>
                  {/* SVG trendline positioned absolutely at bottom, behind content */}
                  <svg
                    className="hourly-trendline"
                    width={svgWidth}
                    height={svgHeight}
                    style={{
                      position: 'absolute',
                      bottom: `${svgBottomOffset}px`,
                      left: screenWidth < 1024 ? (screenWidth >= 768 ? '-1.25rem' : '0') : '0',
                      pointerEvents: 'none',
                      zIndex: 1
                    }}
                  >
                    <path d={pathData} fill="none" stroke="var(--trendline-stroke)" strokeWidth="2" />
                  </svg>
                  {hourlyData.map((hour, index) => {
                  const time = new Date(hour.time * 1000);
                  const hourTemp = Math.round(hour.temperature.fahrenheit);
                  const hourCondition = hour.conditions || conditions;
                  const hourIsNight = isHourNight(hour.time);

                  // Calculate vertical offset for temps (higher temp = more offset = higher position)
                  const normalizedTemp = tempRange > 0 ? (hourTemp - minTemp) / tempRange : 0.5;
                  const baseOffset = 28; // Minimum offset to keep temps above trendline with padding (matches SVG baseOffset)
                  const verticalOffset = baseOffset + (maxVerticalRange * normalizedTemp);

                  return (
                    <div key={index} className="hourly-item" style={{ position: 'relative', zIndex: 2, width: itemWidth, minWidth: itemWidth }}>
                      <div className="hourly-time">
                        {time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', '')}
                      </div>
                      {/* Icon fixed under timestamp */}
                      <div className="hourly-icon-small" data-condition={hourCondition} style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                        <WeatherIcon condition={hourCondition} size={iconSize} isNight={hourIsNight} />
                      </div>
                      {/* Trendline area with temp positioned using top padding */}
                      <div style={{ height: `${maxVerticalRange + 65}px`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: `${maxVerticalRange - verticalOffset + baseOffset}px`, position: 'relative', overflow: 'visible' }}>
                        <div className="hourly-temp">
                          {hourTemp}°
                        </div>
                        {hour.precipProbability > 20 && (
                          <div className="hourly-precip">
                            {hour.precipProbability}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          </div>
        );
        })()}
        </div>
      </div>
      {/* Debug panel: development only — hidden in production */}
      {process.env.NODE_ENV === 'development' && isLocal && ((onRefreshAtmosphere && atmosphere?.description === 'Initializing art engine...') || !atmosphere?.description) && (
        <div className="atmosphere-debug-panel">
          {onRefreshAtmosphere && atmosphere?.description === 'Initializing art engine...' && (
            <button type="button" className="atmosphere-refresh" onClick={onRefreshAtmosphere}>
              Refresh atmosphere
            </button>
          )}
          {process.env.NODE_ENV === 'development' && atmosphere?.description === 'Initializing art engine...' && (
            <div className="atmosphere-debug">
              LLM not ready. Bridge runs ~10 min after UDP. Check: curl http://towerhill.local:5000/weather and journalctl -u weather-bridge on the Pi. Backend: /api/weather/atmosphere?debug=1
            </div>
          )}
          {process.env.NODE_ENV === 'development' && !atmosphere?.description && (
            <div className="atmosphere-debug">
              Atmosphere: not shown — {atmosphere?.error
                ? `${atmosphere.error}. Bridge runs on the Pi at towerhill.local:5000 (not localhost:5000). From Mac: curl http://towerhill.local:5000/weather. On Pi: sudo systemctl status weather-bridge.`
                : atmosphere == null
                  ? 'atmosphere is null. Backend cannot reach the bridge on :5000. Debug: curl "http://localhost:3001/api/weather/atmosphere?debug=1"'
                  : 'atmosphere.description is empty'}
            </div>
          )}
        </div>
      )}
      {stormDetailOpen && <StormWarningDetail alerts={alerts} onClose={() => setStormDetailOpen(false)} />}
      <AskModal isOpen={askModalOpen} onClose={() => setAskModalOpen(false)} />
      <AtmosphereFeedbackModal
        isOpen={feedbackModalOpen}
        description={atmosphere?.description || ''}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmit={handleFeedbackModalSubmit}
        isSubmitting={feedbackSubmitting}
        feedbackPayload={buildFeedbackPayload()}
      />
    </div>
  );
};

export default CurrentWeather;
