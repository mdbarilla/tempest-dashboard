import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import MetricIcon from '../components/MetricIcon';
import WeatherIcon from '../components/WeatherIcon';
import Sparkline from '../components/Sparkline';
import PrecipitationLogger from '../components/PrecipitationLogger';
import ViewToggle from '../components/ViewToggle';
import AtmosphereFeedbackModal from '../components/AtmosphereFeedbackModal';
import {
  buildConditionsMetrics,
  getTrendData,
} from '../utils/conditions-metrics';
import './ConditionsList.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/weather';
const LLM_MAX_AGE_HOURS = 2;
const DETAIL_VIEW_METRICS = ['pressure', 'humidity', 'wind', 'precipitation', 'solar', 'temperature'];

function isLlmEnabledByUrl() {
  if (typeof window === 'undefined') return false;
  const llmParam = new URLSearchParams(window.location.search).get('llm');
  if (!llmParam) return false;
  return ['1', 'true', 'on', 'yes'].includes(String(llmParam).toLowerCase());
}

function isNight(forecast) {
  if (!forecast?.daily?.length) return false;
  const now = new Date();
  const todayStr = now.toDateString();
  const dayIdx = forecast.daily.findIndex((d) => new Date(d.date * 1000).toDateString() === todayStr);
  const day = dayIdx >= 0 ? forecast.daily[dayIdx] : forecast.daily[0];
  const sunrise = day?.sunrise ? new Date(day.sunrise * 1000) : null;
  const sunset = day?.sunset ? new Date(day.sunset * 1000) : null;
  if (!sunrise || !sunset) return false;
  return now < sunrise || now > sunset;
}

const ConditionsList = ({
  current,
  forecast,
  recent,
  lastUpdate,
  isLocal,
  atmosphere,
  alerts = [],
  onRefresh,
  onRefreshAtmosphere,
}) => {
  const [feedbackLabel, setFeedbackLabel] = useState(null);
  const [downVotedAt, setDownVotedAt] = useState(null);
  const [refreshingAfterDown, setRefreshingAfterDown] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const navigate = useNavigate();
  const swipeStartRef = useRef(null);

  // When new atmosphere arrives (different generatedAt), clear down state
  useEffect(() => {
    if (feedbackLabel !== 'down' || downVotedAt == null) return;
    const currentId = atmosphere?.generatedAt ?? -2;
    if (currentId !== downVotedAt) {
      setDownVotedAt(null);
      setFeedbackLabel(null);
      setRefreshingAfterDown(false);
    }
  }, [atmosphere?.generatedAt, downVotedAt, feedbackLabel]);

  useEffect(() => {
    if (!refreshingAfterDown) return;
    const t = setTimeout(() => setRefreshingAfterDown(false), 12000);
    return () => clearTimeout(t);
  }, [refreshingAfterDown]);

  // Restore thumbs state from sessionStorage
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

  if (!current) return null;

  const night = isNight(forecast);

  // LLM description: hide if stale or initializing
  const generatedAt = atmosphere?.generatedAt;
  const isStale = typeof generatedAt === 'number' && (Date.now() / 1000 - generatedAt) > LLM_MAX_AGE_HOURS * 3600;
  const llmEnabled = isLlmEnabledByUrl();
  // Hide condition summary when LLM is disabled or not ready (no "Conditions summary loading" or "Condition summary unavailable")
  const isPlaceholderDescription = !atmosphere?.description ||
    atmosphere.description === 'Initializing art engine...' ||
    atmosphere.description === 'Condition summary unavailable.' ||
    (typeof atmosphere.description === 'string' && atmosphere.description.startsWith('Conditions summary loading'));
  const showLlm = llmEnabled && atmosphere?.description && !isStale && !isPlaceholderDescription;
  const llmDescription = showLlm ? atmosphere.description : null;

  const buildFeedbackPayload = () => {
    if (!atmosphere?.description) return {};
    const nwsAlerts = (alerts || []).map((a) => ({
      event: a.event || null,
      headline: (a.headline || '').slice(0, 200) || null,
    })).filter((a) => a.event != null || a.headline != null);
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
      uv: current?.uv != null ? Number(current.uv) : null,
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

  const metrics = buildConditionsMetrics({ current, forecast, recent });

  return (
    <div className="conditions-list-page">
      <header className="conditions-list-header">
        <div className="conditions-list-location">
          <h1 className="conditions-list-title">Tower Hill&nbsp;&nbsp;<span className="conditions-list-city">Wayland</span></h1>
          <div className="conditions-list-header-row">
            {lastUpdate && (
              <>
                <span className="page-and-update-mobile">
                  Currently • Updated {lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </span>
                <span className="conditions-list-nav-desktop">
                  <p className="conditions-list-updated">
                    Updated {lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                  <ViewToggle />
                  <span className="view-toggle-bullet" aria-hidden="true">•</span>
                  <Link to="/history" className="view-toggle-label history-link">History</Link>
                  <span className="view-toggle-bullet" aria-hidden="true">•</span>
                  <Link to="/chat" className="view-toggle-label history-link">Ask</Link>
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="conditions-list-grid">
        {metrics.map((m, index) => {
          const isConditionsCard = m.type === 'conditions';
          const hasDetailView = DETAIL_VIEW_METRICS.includes(m.type);
          const trendData = isConditionsCard ? null : getTrendData(m.type, recent, forecast);

          const cardContent = (
            <>
              <div className="conditions-list-left">
                <div className="conditions-list-icon-wrap">
                  {isConditionsCard ? (
                    <WeatherIcon
                      condition={m.condition}
                      size={24}
                      isNight={night}
                      className="conditions-list-icon conditions-list-icon-weather"
                    />
                  ) : (
                    <MetricIcon type={m.type} size={24} className="conditions-list-icon" />
                  )}
                </div>
                <div className="conditions-list-label">{m.label}</div>
              </div>
              <div className="conditions-list-divider" aria-hidden="true" />
              <div className="conditions-list-right">
                {isConditionsCard ? (
                  <div className="conditions-list-condition-block">
                    <div className="conditions-list-condition-text">{m.conditionDisplay}</div>
                    {llmDescription && (
                      feedbackLabel === 'down' ? (
                        <div className="conditions-list-atmosphere-row conditions-list-atmosphere-down" aria-live="polite">
                          {refreshingAfterDown
                            ? 'Hidden. Fetching a new description…'
                            : "Hidden — we'll use your feedback to improve."}
                        </div>
                      ) : feedbackLabel === 'up' ? (
                        <div className="conditions-list-atmosphere-row">
                          <span className="conditions-list-llm-description">{llmDescription}</span>
                          <span className="conditions-list-feedback-dismissed" aria-label="Thanks">✓ Thanks</span>
                        </div>
                      ) : (
                        <div className="conditions-list-atmosphere-row">
                          <span className="conditions-list-llm-description">{llmDescription}</span>
                          <span className="conditions-list-atmosphere-feedback" role="group" aria-label="Rate this description">
                            <button type="button" className="conditions-list-feedback-btn conditions-list-feedback-btn--up" aria-label="Good" onClick={handleThumbsUp}>👍</button>
                            <button type="button" className="conditions-list-feedback-btn conditions-list-feedback-btn--down" aria-label="Poor" onClick={handleThumbsDown}>👎</button>
                          </span>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <>
                    {m.type === 'precipitation' && isLocal && (
                      <span className="conditions-list-precip-edit" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                        <PrecipitationLogger
                          onAddClick={() => navigate('/conditions/precipitation', { state: { from: 'list', view: 'add' } })}
                        />
                      </span>
                    )}
                    <div className="conditions-list-value-block">
                      <div className="conditions-list-value">
                        {m.value}
                        {m.unit != null && m.unit !== '' && (
                          <span className="conditions-list-unit">{m.unit}</span>
                        )}
                      </div>
                      {m.type === 'temperature' && (m.showFeelsLike || m.highLowDisplay) && (
                        <div className="conditions-list-feels-like-highlow">
                          {m.showFeelsLike && <>Feels like {m.feelsLike}°</>}
                          {m.showFeelsLike && m.highLowDisplay && ' • '}
                          {m.highLowDisplay && <>{m.highLowDisplay}</>}
                        </div>
                      )}
                      {m.secondary ? (
                        <div className="conditions-list-secondary">{m.secondary}</div>
                      ) : null}
                      {m.customContent?.notes && (
                        <div className="conditions-list-note">{m.customContent.notes}</div>
                      )}
                    </div>
                    {trendData && trendData.length >= 2 && (
                      <div className="conditions-list-trend">
                        <div className="conditions-list-trend-viz">
                          <Sparkline
                            data={trendData}
                            width={140}
                            height={36}
                            color="var(--trendline-stroke)"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          );

          const handleCardTouchStart = hasDetailView ? (e) => {
            swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, metric: m.type };
          } : undefined;
          const handleCardTouchMove = hasDetailView ? (e) => {
            const start = swipeStartRef.current;
            if (!start || start.metric !== m.type) return;
            const x = e.touches[0].clientX;
            const y = e.touches[0].clientY;
            const dx = Math.abs(x - start.x);
            const dy = Math.abs(y - start.y);
            // If horizontal swipe dominates, prevent scroll so our swipe registers
            if (dx > 25 && dx > dy * 1.5 && e.cancelable) {
              e.preventDefault();
            }
          } : undefined;
          const handleCardTouchEnd = hasDetailView ? (e) => {
            const start = swipeStartRef.current;
            if (!start || start.metric !== m.type) return;
            const end = e.changedTouches?.[0];
            const endX = end?.clientX ?? start.x;
            const delta = start.x - endX;
            if (Math.abs(delta) > 50) {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/conditions/${m.type}`, { state: { from: 'list' } });
            }
            swipeStartRef.current = null;
          } : undefined;

          const staggerStyle = { animationDelay: `${index * 0.04}s` };
          return hasDetailView ? (
            <Link
              key={m.type}
              to={`/conditions/${m.type}`}
              state={{ from: 'list' }}
              className="conditions-list-card"
              style={staggerStyle}
              data-metric-type={m.type}
              data-sun-times={m.type === 'sunrise' || m.type === 'sunset' ? 'true' : undefined}
              data-has-trend={trendData ? 'true' : undefined}
              data-conditions-card={isConditionsCard ? 'true' : undefined}
              onTouchStart={handleCardTouchStart}
              onTouchMove={handleCardTouchMove}
              onTouchEnd={handleCardTouchEnd}
            >
              {cardContent}
            </Link>
          ) : (
            <div
              key={m.type}
              className="conditions-list-card"
              style={staggerStyle}
              data-metric-type={m.type}
              data-sun-times={m.type === 'sunrise' || m.type === 'sunset' ? 'true' : undefined}
              data-has-trend={trendData ? 'true' : undefined}
              data-conditions-card={isConditionsCard ? 'true' : undefined}
            >
              {cardContent}
            </div>
          );
        })}
      </div>

      <AtmosphereFeedbackModal
        isOpen={feedbackModalOpen}
        description={llmDescription || atmosphere?.description || ''}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmit={handleFeedbackModalSubmit}
        isSubmitting={feedbackSubmitting}
        feedbackPayload={buildFeedbackPayload()}
      />
    </div>
  );
};

ConditionsList.defaultProps = {
  alerts: [],
};

export default ConditionsList;
